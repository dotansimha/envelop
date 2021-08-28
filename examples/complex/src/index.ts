/* eslint-disable no-console */
import fastify from 'fastify';
import { getGraphQLParameters, processRequest, renderGraphiQL, shouldRenderGraphiQL } from 'graphql-helix';
import { envelop, useSchema } from '@envelop/core';
import { useAuth0 } from '@envelop/auth0';
import * as envalid from 'envalid';
import { handleHelixResult } from './util';
import { schema } from './schema';

const env = envalid.cleanEnv(process.env, {
  AUTH0_CLIENT_ID: envalid.str(),
  AUTH0_AUDIENCE: envalid.str(),
  AUTH0_DOMAIN: envalid.str(),
});

const auth0Config = {
  domain: env.AUTH0_DOMAIN,
  audience: env.AUTH0_AUDIENCE,
  clientId: env.AUTH0_CLIENT_ID,
};

const getEnveloped = envelop({
  plugins: [
    useSchema(schema),
    useAuth0({
      domain: auth0Config.domain,
      audience: auth0Config.audience,
      preventUnauthenticatedAccess: false, // If you need to have unauthenticated parts on your schema, make sure to disable that by setting it to `false` and the check it in your resolvers.
      extendContextField: 'auth0', // The name of the field injected to your `context`
      tokenType: 'Bearer', // Type of token to expect in the header
    }),
  ],
});

const app = fastify();

app.route({
  method: 'GET',
  url: '/',
  async handler(req, res) {
    res.header('Content-Type', 'text/html; charset=UTF-8');
    res.send(/* HTML */ `
      <!DOCTYPE html />
      <html>
        <head>
          <script src="https://cdn.auth0.com/js/auth0-spa-js/1.12/auth0-spa-js.production.js"></script>
        </head>
        <body>
          <script>
            createAuth0Client({
              domain: '${auth0Config.domain}',
              client_id: '${auth0Config.clientId}',
              audience: '${auth0Config.audience}',
            }).then(async auth0 => {
              const isAuthenticated = await auth0.isAuthenticated();
              await auth0.loginWithPopup();
              const accessToken = await auth0.getTokenSilently();
              window.document.body.innerText = accessToken;
            });
          </script>
        </body>
      </html>
    `);
  },
});

const graphiqlContent = /* GraphQL */ `
  query isAuthenticated {
    isAuthenticated
  }
`;

app.route({
  method: ['GET', 'POST'],
  url: '/graphql',
  async handler(req, res) {
    const { parse, validate, contextFactory, execute, schema } = getEnveloped({ req });
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };

    if (shouldRenderGraphiQL(request)) {
      res.type('text/html');
      res.send(
        renderGraphiQL({
          defaultQuery: graphiqlContent
            .split('\n')
            .slice(1)
            .map(line => line.replace('  ', ''))
            .join('\n'),
        })
      );
    } else {
      const request = {
        body: req.body,
        headers: req.headers,
        method: req.method,
        query: req.query,
      };
      const { operationName, query, variables } = getGraphQLParameters(request);

      const result = await processRequest({
        operationName,
        query,
        variables,
        request,
        schema,
        parse,
        validate,
        execute,
        contextFactory,
      });

      await handleHelixResult(result, req, res);
    }
  },
});

app.listen(3000, () => {
  console.log(`GraphQL server is running on http://localhost:3000/graphql`);
});
