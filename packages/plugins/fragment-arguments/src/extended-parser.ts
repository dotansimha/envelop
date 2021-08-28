/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ParseOptions, Parser } from 'graphql/language/parser';
import type { Lexer } from 'graphql/language/lexer';
import { TokenKind, Kind, Token, Location } from 'graphql';

export class FragmentArgumentCompatibleParser extends Parser {
  // see https://github.com/graphql/graphql-js/pull/3248
  getLexer(): Lexer {
    return (this as any)._lexer as Lexer;
  }

  // see https://github.com/graphql/graphql-js/pull/3248
  getOptions(): ParseOptions {
    return (this as any)._options as ParseOptions;
  }

  // for backwards-compat with v15, this api was removed in v16 in favor of the this.node API.
  loc(startToken: Token): Location | undefined {
    if (this.getOptions()?.noLocation !== true) {
      const lexer = this.getLexer();
      return new Location(startToken, lexer.lastToken, lexer.source);
    }
    return undefined;
  }

  parseFragment() {
    const start = this.getLexer().token;
    this.expectToken(TokenKind.SPREAD);
    const hasTypeCondition = this.expectOptionalKeyword('on');

    if (!hasTypeCondition && this.peek(TokenKind.NAME)) {
      const name = this.parseFragmentName();

      if (this.peek(TokenKind.PAREN_L)) {
        return {
          kind: Kind.FRAGMENT_SPREAD,
          name,
          arguments: this.parseArguments(false),
          directives: this.parseDirectives(false),
          loc: this.loc(start),
        };
      }

      return {
        kind: Kind.FRAGMENT_SPREAD,
        name: this.parseFragmentName(),
        directives: this.parseDirectives(false),
        loc: this.loc(start),
      };
    }

    return {
      kind: Kind.INLINE_FRAGMENT,
      typeCondition: hasTypeCondition ? this.parseNamedType() : undefined,
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet(),
      loc: this.loc(start),
    };
  }

  parseFragmentDefinition() {
    const start = this.getLexer().token;
    this.expectKeyword('fragment');
    const name = this.parseFragmentName();

    if (this.peek(TokenKind.PAREN_L)) {
      return {
        kind: Kind.FRAGMENT_DEFINITION,
        name,
        variableDefinitions: this.parseVariableDefinitions(),
        typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
        directives: this.parseDirectives(false),
        selectionSet: this.parseSelectionSet(),
        loc: this.loc(start),
      };
    }

    return {
      kind: Kind.FRAGMENT_DEFINITION,
      name,
      typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet(),
      loc: this.loc(start),
    };
  }
}
