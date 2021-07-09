import { Parser } from 'graphql/language/parser';
import { Lexer } from 'graphql/language/lexer';
import { TokenKind, Kind, Source, DocumentNode, TokenKindEnum, Token } from 'graphql';

declare module 'graphql/language/parser' {
  export class Parser {
    constructor(source: string | Source, options?: ParseOptions);
    _lexer: Lexer;
    expectOptionalKeyword(word: string): boolean;
    expectToken(token: TokenKindEnum): void;
    peek(token: TokenKindEnum): boolean;
    parseFragmentName(): string;
    parseArguments(flag: boolean): any;
    parseDirectives(flag: boolean): any;
    loc(start: Token): any;
    parseNamedType(): any;
    parseSelectionSet(): any;
    expectKeyword(keyword: string): void;
    parseVariableDefinitions(): void;
    parseDocument(): DocumentNode;
  }
}

export class FragmentArgumentCompatibleParser extends Parser {
  parseFragment() {
    const start = this._lexer.token;
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
    const start = this._lexer.token;
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
