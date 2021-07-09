import { DefaultContext, Plugin } from '@envelop/types';
import { DirectiveNode, GraphQLResolveInfo } from 'graphql';
import { getDirective } from './utils';
export * from './utils';

export class UnauthenticatedError extends Error {}

export type ResolveUserFn<UserType, ContextType = DefaultContext> = (
  context: ContextType
) => null | UserType | Promise<UserType | null>;

export type ValidateUserFn<UserType, ContextType = DefaultContext> = (
  user: UserType,
  context: ContextType,
  resolverInfo?: { root: unknown; args: Record<string, unknown>; context: ContextType; info: GraphQLResolveInfo },
  directiveNode?: DirectiveNode
) => void | Promise<void>;

export const DIRECTIVE_SDL = /* GraphQL */ `
  directive @auth on FIELD_DEFINITION
`;

export type GenericAuthPluginOptions<UserType extends {} = {}, ContextType extends DefaultContext = DefaultContext> = {
  /**
   * Here you can implement any custom sync/async code, and use the context built so far in Envelop and the HTTP request
   * to find the current user.
   * Common practice is to use a JWT token here, validate it, and use the payload as-is, or fetch the user from an external services.
   * Make sure to either return `null` or the user object.
   */
  resolveUserFn: ResolveUserFn<UserType, ContextType>;
  /**
   * Here you can implement any custom to check if the user is valid and have access to the server.
   * This method is being triggered in different flows, besed on the mode you chose to implement.
   */
  validateUser?: ValidateUserFn<UserType, ContextType>;
  /**
   * Overrides the default field name for injecting the user into the execution `context`.
   * @default currentUser
   */
  contextFieldName?: 'currentUser' | string;
} & (
  | {
      /**
       * This mode offers complete protection for the entire API.
       * It protects your entire GraphQL schema, by validating the user before executing the request.
       */
      mode: 'protect-all';
    }
  | {
      /**
       * Just resolves the user and inject to authenticated user into the `context`.
       * User validation needs to be implemented by you, in your resolvers.
       */
      mode: 'resolve-only';
    }
  | {
      /**
       * resolves the user and inject to authenticated user into the `context`.
       * And checks for `@auth` directives usages to run validation automatically.
       */
      mode: 'protect-auth-directive';
      /**
       * Overrides the default directive name
       * @default auth
       */
      authDirectiveName?: 'auth' | string;
    }
);

export function defaultValidateFn<UserType, ContextType>(user: UserType, contextType: ContextType): void {
  if (!user) {
    throw new UnauthenticatedError('Unauthenticated!');
  }
}

export const useGenericAuth = <UserType extends {} = {}, ContextType extends DefaultContext = DefaultContext>(
  options: GenericAuthPluginOptions<UserType, ContextType>
): Plugin<{
  validateUser: ValidateUserFn<UserType, ContextType>;
}> => {
  const fieldName = options.contextFieldName || 'currentUser';
  const validateUser = options.validateUser || defaultValidateFn;

  if (options.mode === 'protect-all') {
    return {
      async onContextBuilding({ context, extendContext }) {
        const user = await options.resolveUserFn(context as unknown as ContextType);
        await validateUser(user!, context as unknown as ContextType);

        extendContext({
          [fieldName]: user,
        } as unknown as ContextType);
      },
    };
  } else if (options.mode === 'resolve-only') {
    return {
      async onContextBuilding({ context, extendContext }) {
        const user = await options.resolveUserFn(context as unknown as ContextType);

        extendContext({
          [fieldName]: user,
          validateUser: () => validateUser(user!, context as unknown as ContextType),
        } as unknown as ContextType);
      },
    };
  } else if (options.mode === 'protect-auth-directive') {
    return {
      async onContextBuilding({ context, extendContext }) {
        const user = await options.resolveUserFn(context as unknown as ContextType);

        extendContext({
          [fieldName]: user,
          validateUser: () => validateUser(user!, context as unknown as ContextType),
        } as unknown as ContextType);
      },
      onExecute() {
        return {
          async onResolverCalled({ args, root, context, info }) {
            const authDirectiveNode = getDirective(info, options.authDirectiveName || 'auth');

            if (authDirectiveNode) {
              await context.validateUser(
                context[fieldName],
                context as unknown as ContextType,
                {
                  info,
                  context: context as unknown as ContextType,
                  args,
                  root,
                },
                authDirectiveNode
              );
            }
          },
        };
      },
    };
  }

  return {};
};
