import { FastifyReply, FastifyRequest } from 'fastify';
import { ProcessRequestResult } from 'graphql-helix';

export async function handleHelixResult(
  result: ProcessRequestResult<any, any>,
  req: FastifyRequest,
  res: FastifyReply
): Promise<void> {
  if (result.type === 'RESPONSE') {
    res.statusCode = result.status;
    res.send(result.payload);
  } else if (result.type === 'MULTIPART_RESPONSE') {
    res.raw.writeHead(200, {
      Connection: 'keep-alive',
      'Content-Type': 'multipart/mixed; boundary="-"',
      'Transfer-Encoding': 'chunked',
    });

    req.raw.on('close', () => {
      result.unsubscribe();
    });

    res.raw.write('---');

    await result.subscribe(result => {
      const chunk = Buffer.from(JSON.stringify(result), 'utf8');
      const data = ['', 'Content-Type: application/json; charset=utf-8', 'Content-Length: ' + String(chunk.length), '', chunk];

      if (result.hasNext) {
        data.push('---');
      }

      res.raw.write(data.join('\r\n'));
    });

    res.raw.write('\r\n-----\r\n');
    res.raw.end();
  } else {
    res.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    });

    req.raw.on('close', () => {
      result.unsubscribe();
    });

    await result.subscribe(result => {
      res.raw.write(`data: ${JSON.stringify(result)}\n\n`);
    });
  }
}
