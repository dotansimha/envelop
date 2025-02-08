## `@envelop/firebase-auth`

This plugin validates JWT token created by Firebase Auth and injects the Firebase user profile into your GraphQL context, you can implement authentication in a simple way.

## Getting Started

1. Setup a firebase project and setup Auth on your web app. Checkout [Get Started with Firebase Authentication on Websites](https://firebase.google.com/docs/auth/web/start)
2. When you sign up your user you can get a JWT token from Firebase Auth by calling `getIdToken()` on your user object. Pass that token as a header in your GraphQL request (for example: `Authorization: Bearer <TOKEN>`).
3. Generate a private key for your Firebase project so your server can verify the token. Checkout [Add the Firebase Admin SDK to your server](https://firebase.google.com/docs/admin/setup)
4. Add the plugin to your server and configure it.

```ts
import { envelop } from '@envelop/core';
import { useFirebaseAuth } from '@envelop/firebase-auth';
import admin from 'firebase-admin';
import serviceAccount from "path/to/serviceAccountKey.json";

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    plugins: [
      useFirebaseAuth({
        firebaseApp: admin.initializeApp({ credential: admin.credential.cert(serviceAccount)}),
      }),
    ],
});
```

5. Make sure to pass your request as part of the context building:

```ts
myHttpServer.on('request', async req => {
  const { contextFactory } = getEnveloped({ req });
  const contextValue = await contextFactory({ req }); // Make sure to pass it here
});
```

6. You should be able to get user profile from the context.

```ts
const myResolvers = {
  Query: {
    me: (root, args, context, info) => {
      const firebaseUser = context._firebaseAuth;
    },
  },
};
```

### API Reference

#### `firebaseApp`

This is the firebase app instance that is passed to the plugin to validate the token.

See https://firebase.google.com/docs/reference/admin/node/admin#.initializeApp for all the options that you can pass.

#### `headerName` + `tokenType`

This plugin looks for `req` and `request` in the context, then look for `headers` and look for `authentication` header (you can customize it with `headerName`). Then, it validates that the token is of type `Bearer` (you can customize it with `tokenType` option).

#### `extendContextField`

The name of the field to inject to your `context`. When the user is valid, the decoded and verified payload of the JWT is injected.

You can read more about the token structure here: e https://github.com/firebase/firebase-admin-node/blob/d96e61bad190a2e7bd68c35a55626f65c0506a7a/src/auth/index.ts#L503-L650

By default, the `_firebaseAuth` value is used.

### Examples

Checkout https://github.com/saihaj/firebase-graphql-envelop [Create React App](https://create-react-app.dev) + [GraphQL EZ](https://www.graphql-ez.com) app using this plugin
