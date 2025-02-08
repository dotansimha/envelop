/* eslint-disable dot-notation */
/* eslint-disable no-console */
import { Plugin } from '@envelop/types';
import { app, auth } from 'firebase-admin';
import { GraphQLError } from 'graphql';

export type FirebaseAuthPluginOptions = {
  firebaseApp: app.App;
  tokenType?: string;
  headerName?: string;
  extendContextField?: '_firebaseAuth' | string;
};

type BuildContext<TOptions extends FirebaseAuthPluginOptions> = TOptions['extendContextField'] extends string
  ? {
      [TName in TOptions['extendContextField'] as TOptions['extendContextField']]: auth.DecodedIdToken;
    }
  : { _firebaseAuth: auth.DecodedIdToken };

export const useFirebaseAuth = <TOptions extends FirebaseAuthPluginOptions>({
  tokenType = 'Bearer',
  headerName = 'authorization',
  extendContextField = '_firebaseAuth',
  firebaseApp,
}: TOptions): Plugin<BuildContext<TOptions>> => {
  return {
    async onContextBuilding({ context, extendContext }) {
      const req = context['req'] || context['request'] || {};
      const headers = req.headers || context['headers'] || null;

      if (!headers) {
        console.warn('No headers found in request');
      }

      const authHeader = headers[headerName];
      if (!authHeader) {
        throw new Error(`No ${headerName} header found in request`);
      }

      const split = authHeader.split(' ');
      if (split.length !== 2) {
        throw new Error(`Invalid ${tokenType} value for ${headerName} header!`);
      }

      const [type, token] = split;
      if (type !== tokenType) {
        throw new Error(`Unsupported token type provided: ${type}!`);
      }

      try {
        const verifiedToken = await firebaseApp.auth().verifyIdToken(token);
        return extendContext({
          [extendContextField]: verifiedToken,
        } as BuildContext<TOptions>);
      } catch (e) {
        throw new GraphQLError('Invalid token');
      }
    },
  };
};
