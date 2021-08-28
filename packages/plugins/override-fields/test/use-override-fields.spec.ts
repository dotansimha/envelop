import { createTestkit, assertSingleExecutionValue } from '@envelop/testing';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { useOverrideFields } from '../src';

describe('useOverrideFields', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockCountryAlphaCode2 = jest.fn();
  const mockCountryAlphaCode3 = jest.fn();
  const mockContinentCountryAlphaCode2 = jest.fn();
  const mockContinentCountryAlphaCode3 = jest.fn();
  const mockContinentCountries = jest.fn().mockImplementation(() => [
    {
      alphaCode2: mockContinentCountryAlphaCode2.mockReturnValueOnce('AD'),
      alphaCode3: mockContinentCountryAlphaCode3.mockReturnValueOnce('AND'),
      name: 'Andorra',
    },
    {
      alphaCode2: mockContinentCountryAlphaCode2.mockReturnValueOnce('AL'),
      alphaCode3: mockContinentCountryAlphaCode3.mockReturnValueOnce('ALB'),
      name: 'Albania',
    },
  ]);
  const mockCountries = jest.fn().mockImplementation(() => [
    {
      alphaCode2: mockCountryAlphaCode2.mockReturnValueOnce('GB'),
      alphaCode3: mockCountryAlphaCode3.mockReturnValueOnce('GBR'),
      name: 'United Kingdom',
    },
    {
      alphaCode2: mockCountryAlphaCode2.mockReturnValueOnce('IT'),
      alphaCode3: mockCountryAlphaCode3.mockReturnValueOnce('ITA'),
      name: 'Italy',
    },
  ]);

  const schema = makeExecutableSchema({
    typeDefs: /* GraphQL */ `
      type Query {
        countries: [Country!]
      }
      type Country {
        name: String!
        alphaCode2: String
        alphaCode3: String
        continent: Continent
      }
      type Continent {
        code: ID!
        name: String!
        countries: [Country!]
      }
    `,
    resolvers: {
      Query: {
        countries: mockCountries,
      },
      Country: {
        continent: () => ({
          code: 'EU',
          name: 'Europe',
          countries: mockContinentCountries,
        }),
      },
    },
  });

  describe('default override logic and implementation', () => {
    it('Should correctly override root Type and field', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: ['Query.countries'],
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockCountries).not.toHaveBeenCalled();
      expect(result.data!.countries).toBe(null);
    });

    it('Should correctly override root Type and nested field', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: ['Query.countries.continent.countries'],
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockContinentCountries).not.toHaveBeenCalled();

      expect(result.data!.countries[0].continent.countries).toBe(null);
      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'GB',
        alphaCode3: 'GBR',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'IT',
        alphaCode3: 'ITA',
      });
    });

    it('Should correctly override non-root Type and field', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: ['Country.alphaCode3'],
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockCountryAlphaCode2).toHaveBeenCalledTimes(2);
      expect(mockContinentCountryAlphaCode2).toHaveBeenCalledTimes(4);
      expect(mockCountryAlphaCode3).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode3).not.toHaveBeenCalled();

      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'GB',
        alphaCode3: null,
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'IT',
        alphaCode3: null,
      });

      expect(result.data!.countries[0].continent.countries[0]).toMatchObject({
        alphaCode2: 'AD',
        alphaCode3: null,
      });
      expect(result.data!.countries[1].continent.countries[1]).toMatchObject({
        alphaCode2: 'AL',
        alphaCode3: null,
      });
    });

    it('Should correctly override using a Regular Expression', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: [/Country\.alphaCode.*/],
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockCountryAlphaCode2).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode2).not.toHaveBeenCalled();
      expect(mockCountryAlphaCode3).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode3).not.toHaveBeenCalled();

      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: null,
        alphaCode3: null,
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: null,
        alphaCode3: null,
      });

      expect(result.data!.countries[0].continent.countries[0]).toMatchObject({
        alphaCode2: null,
        alphaCode3: null,
      });
      expect(result.data!.countries[1].continent.countries[1]).toMatchObject({
        alphaCode2: null,
        alphaCode3: null,
      });
    });
  });

  describe('custom override logic with default implementation', () => {
    it('Should not override "plain string fields" when `shouldOverride` returns false', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: ['Query.countries.continent.countries'],
            shouldOverride: () => false,
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockContinentCountries).toHaveBeenCalledTimes(2);
      expect(mockContinentCountryAlphaCode2).toHaveBeenCalledTimes(4);
      expect(mockContinentCountryAlphaCode3).toHaveBeenCalledTimes(4);

      expect(result.data!.countries[0].continent.countries[0]).toMatchObject({
        alphaCode2: 'AD',
        alphaCode3: 'AND',
      });
      expect(result.data!.countries[1].continent.countries[1]).toMatchObject({
        alphaCode2: 'AL',
        alphaCode3: 'ALB',
      });

      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'GB',
        alphaCode3: 'GBR',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'IT',
        alphaCode3: 'ITA',
      });
    });

    it('Should override "plain string fields" when `shouldOverride` returns true', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: ['Query.countries.continent.countries'],
            shouldOverride: () => true,
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockContinentCountries).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode2).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode3).not.toHaveBeenCalled();

      expect(result.data!.countries[0].continent.countries).toBe(null);
      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'GB',
        alphaCode3: 'GBR',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'IT',
        alphaCode3: 'ITA',
      });
    });

    it('Should not override "regex fields" when `shouldOverride` returns false', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: [/Country\.alphaCode.*/],
            shouldOverride: () => false,
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockCountryAlphaCode2).toHaveBeenCalledTimes(2);
      expect(mockContinentCountryAlphaCode2).toHaveBeenCalledTimes(4);
      expect(mockCountryAlphaCode3).toHaveBeenCalledTimes(2);
      expect(mockContinentCountryAlphaCode3).toHaveBeenCalledTimes(4);

      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'GB',
        alphaCode3: 'GBR',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'IT',
        alphaCode3: 'ITA',
      });

      expect(result.data!.countries[0].continent.countries[0]).toMatchObject({
        alphaCode2: 'AD',
        alphaCode3: 'AND',
      });
      expect(result.data!.countries[0].continent.countries[1]).toMatchObject({
        alphaCode2: 'AL',
        alphaCode3: 'ALB',
      });
    });

    it('Should override "regex fields" when `shouldOverride` returns true', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: [/Country\.alphaCode.*/],
            shouldOverride: () => true,
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockCountryAlphaCode2).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode2).not.toHaveBeenCalled();
      expect(mockCountryAlphaCode3).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode3).not.toHaveBeenCalled();

      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: null,
        alphaCode3: null,
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: null,
        alphaCode3: null,
      });

      expect(result.data!.countries[1].continent.countries[0]).toMatchObject({
        alphaCode2: null,
        alphaCode3: null,
      });
      expect(result.data!.countries[1].continent.countries[1]).toMatchObject({
        alphaCode2: null,
        alphaCode3: null,
      });
    });
  });

  describe('default override logic with custom implementation', () => {
    it('Should return custom value, as implemented in `overrideFn` when overriding "plain string fields"', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: ['Query.countries.continent.countries'],
            overrideFn: () => [
              {
                alphaCode2: 'AT',
                alphaCode3: 'AUT',
                name: 'Austria',
              },
            ],
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockContinentCountries).not.toHaveBeenCalled();

      expect(result.data!.countries[0].continent.countries).toEqual([
        {
          alphaCode2: 'AT',
          alphaCode3: 'AUT',
          name: 'Austria',
        },
      ]);
      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'GB',
        alphaCode3: 'GBR',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'IT',
        alphaCode3: 'ITA',
      });
    });

    it('Should return custom value, as implemented in `overrideFn` when overriding "regex fields"', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: [/Country\.alphaCode.*/],
            overrideFn: () => 'customAlphaCode',
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockCountryAlphaCode2).not.toHaveBeenCalled();
      expect(mockCountryAlphaCode3).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode2).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode3).not.toHaveBeenCalled();

      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'customAlphaCode',
        alphaCode3: 'customAlphaCode',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'customAlphaCode',
        alphaCode3: 'customAlphaCode',
      });

      expect(result.data!.countries[0].continent.countries[0]).toMatchObject({
        alphaCode2: 'customAlphaCode',
        alphaCode3: 'customAlphaCode',
      });
      expect(result.data!.countries[0].continent.countries[1]).toMatchObject({
        alphaCode2: 'customAlphaCode',
        alphaCode3: 'customAlphaCode',
      });
    });
  });

  describe('custom override logic plus custom implementation', () => {
    it('Should correctly override "plain string fields"', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: ['Query.countries.continent.countries'],
            shouldOverride: () => true,
            overrideFn: () => [
              {
                alphaCode2: 'AT',
                alphaCode3: 'AUT',
                name: 'Austria',
              },
            ],
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockContinentCountries).not.toHaveBeenCalled();

      expect(result.data!.countries[0].continent.countries).toEqual([
        {
          alphaCode2: 'AT',
          alphaCode3: 'AUT',
          name: 'Austria',
        },
      ]);
      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'GB',
        alphaCode3: 'GBR',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'IT',
        alphaCode3: 'ITA',
      });
    });

    it('Should correctly not override "plain string fields"', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: ['Query.countries.continent.countries'],
            shouldOverride: () => false,
            overrideFn: () => [
              {
                alphaCode2: 'AT',
                alphaCode3: 'AUT',
                name: 'Austria',
              },
            ],
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockContinentCountries).toHaveBeenCalledTimes(2);

      expect(result.data!.countries[0].continent.countries).toEqual([
        {
          alphaCode2: 'AD',
          alphaCode3: 'AND',
          name: 'Andorra',
        },
        {
          alphaCode2: 'AL',
          alphaCode3: 'ALB',
          name: 'Albania',
        },
      ]);
      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'GB',
        alphaCode3: 'GBR',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'IT',
        alphaCode3: 'ITA',
      });
    });

    it('Should correctly override "regex fields"', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: [/Country\.alphaCode.*/],
            shouldOverride: () => true,
            overrideFn: () => 'customAlphaCode',
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockCountryAlphaCode2).not.toHaveBeenCalled();
      expect(mockCountryAlphaCode3).not.toHaveBeenCalled();
      expect(mockCountryAlphaCode3).not.toHaveBeenCalled();
      expect(mockContinentCountryAlphaCode3).not.toHaveBeenCalled();

      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'customAlphaCode',
        alphaCode3: 'customAlphaCode',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'customAlphaCode',
        alphaCode3: 'customAlphaCode',
      });

      expect(result.data!.countries[1].continent.countries[0]).toMatchObject({
        alphaCode2: 'customAlphaCode',
        alphaCode3: 'customAlphaCode',
      });
      expect(result.data!.countries[1].continent.countries[1]).toMatchObject({
        alphaCode2: 'customAlphaCode',
        alphaCode3: 'customAlphaCode',
      });
    });

    it('Should correctly not override "regex fields"', async () => {
      const testInstance = createTestkit(
        [
          useOverrideFields({
            fields: [/Country\.alphaCode.*/],
            shouldOverride: () => false,
            overrideFn: () => 'customAlphaCode',
          }),
        ],
        schema
      );

      const result = await testInstance.execute(
        `query { countries { alphaCode2 alphaCode3 continent { countries { alphaCode2 alphaCode3 name } } } }`
      );
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(mockCountryAlphaCode2).toHaveBeenCalledTimes(2);
      expect(mockCountryAlphaCode3).toHaveBeenCalledTimes(2);
      expect(mockContinentCountryAlphaCode2).toHaveBeenCalledTimes(4);
      expect(mockContinentCountryAlphaCode3).toHaveBeenCalledTimes(4);

      expect(result.data!.countries[0]).toMatchObject({
        alphaCode2: 'GB',
        alphaCode3: 'GBR',
      });
      expect(result.data!.countries[1]).toMatchObject({
        alphaCode2: 'IT',
        alphaCode3: 'ITA',
      });

      expect(result.data!.countries[1].continent.countries[0]).toMatchObject({
        alphaCode2: 'AD',
        alphaCode3: 'AND',
      });
      expect(result.data!.countries[1].continent.countries[1]).toMatchObject({
        alphaCode2: 'AL',
        alphaCode3: 'ALB',
      });
    });
  });
});
