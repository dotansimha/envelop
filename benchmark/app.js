/// @ts-check
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { envelop, useSchema, useExtendContext } = require('../packages/core');
const { useParserCache } = require('../packages/plugins/parser-cache');
const { useGraphQlJit } = require('../packages/plugins/graphql-jit');
const { useValidationCache } = require('../packages/plugins/validation-cache');
const { fastify } = require('fastify');
const faker = require('faker');

faker.seed(4321);

function generateData() {
  const authors = [];
  for (let i = 0; i < 20; i++) {
    const books = [];

    for (let k = 0; k < 3; k++) {
      books.push({
        id: faker.datatype.uuid(),
        name: faker.internet.domainName(),
        numPages: faker.datatype.number(),
      });
    }

    authors.push({
      id: faker.datatype.uuid(),
      name: faker.name.findName(),
      company: faker.company.bs(),
      books,
    });
  }

  return authors;
}

const data = generateData();

const schema = makeExecutableSchema({
  typeDefs: /* GraphQL */ `
    type Author {
      id: ID!
      name: String!
      company: String!
      books: [Book!]!
    }

    type Book {
      id: ID!
      name: String!
      numPages: Int!
    }

    type Query {
      authors: [Author!]!
    }
  `,
  resolvers: {
    Author: {},
    Query: {
      authors: () => data,
    },
  },
});

const getEnveloped = envelop({
  plugins: [
    useSchema(schema),
    useGraphQlJit(),
    useParserCache(),
    useValidationCache(),
    useExtendContext(async () => {
      // Uncomment this to add an intentional delay
      // await new Promise(resolve => setTimeout(resolve, 100));

      return {
        customContext: 'test',
      };
    }),
  ],
  enableInternalTracing: true,
});
const app = fastify();

app.route({
  method: 'POST',
  url: '/graphql',
  async handler(req, res) {
    const proxy = getEnveloped({ req });
    const document = proxy.parse(req.body.query);
    const errors = proxy.validate(proxy.schema, document);

    if (errors.length) {
      res.send({ errors });
      return;
    }

    res.send(
      await proxy.execute({
        schema: proxy.schema,
        operationName: req.body.operationName,
        document,
        variableValues: req.body.variable,
        contextValue: await proxy.contextFactory(),
      })
    );
  },
});

app.listen(5000, () => {
  // eslint-disable-next-line no-console
  console.log(`GraphQL Test Server is running... Ready for K6!`);
});
