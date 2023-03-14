import y, { ZodDiscriminatedUnion } from '../src';
import z, { util, ZodObject } from 'zod';
import { expectShape } from './testUtil';

test('valid', () => {
  expect(
    y
      .discriminatedUnion('type', [
        z.object({ type: z.literal('a'), a: z.string() }),
        z.object({ type: z.literal('b'), b: z.string() }),
      ])
      .parse({ type: 'a', a: 'abc' }),
  ).toEqual({ type: 'a', a: 'abc' });
});

test('valid - discriminator value of various primitive types', () => {
  const schema = y.discriminatedUnion('type', [
    z.object({ type: z.literal('1'), val: z.literal(1) }),
    z.object({ type: z.literal(1), val: z.literal(2) }),
    z.object({ type: z.literal(BigInt(1)), val: z.literal(3) }),
    z.object({ type: z.literal('true'), val: z.literal(4) }),
    z.object({ type: z.literal(true), val: z.literal(5) }),
    z.object({ type: z.literal('null'), val: z.literal(6) }),
    z.object({ type: z.literal(null), val: z.literal(7) }),
    z.object({ type: z.literal('undefined'), val: z.literal(8) }),
    z.object({ type: z.literal(undefined), val: z.literal(9) }),
    z.object({ type: z.literal('transform'), val: z.literal(10) }),
    z.object({ type: z.literal('refine'), val: z.literal(11) }),
    z.object({ type: z.literal('superRefine'), val: z.literal(12) }),
  ]);

  expect(schema.parse({ type: '1', val: 1 })).toEqual({ type: '1', val: 1 });
  expect(schema.parse({ type: 1, val: 2 })).toEqual({ type: 1, val: 2 });
  expect(schema.parse({ type: BigInt(1), val: 3 })).toEqual({
    type: BigInt(1),
    val: 3,
  });
  expect(schema.parse({ type: 'true', val: 4 })).toEqual({
    type: 'true',
    val: 4,
  });
  expect(schema.parse({ type: true, val: 5 })).toEqual({
    type: true,
    val: 5,
  });
  expect(schema.parse({ type: 'null', val: 6 })).toEqual({
    type: 'null',
    val: 6,
  });
  expect(schema.parse({ type: null, val: 7 })).toEqual({
    type: null,
    val: 7,
  });
  expect(schema.parse({ type: 'undefined', val: 8 })).toEqual({
    type: 'undefined',
    val: 8,
  });
  expect(schema.parse({ type: undefined, val: 9 })).toEqual({
    type: undefined,
    val: 9,
  });
});

test('valid - various zod validator discriminators', () => {
  const schema = y.discriminatedUnion('type', [
    z.object({ type: z.undefined(), val: z.literal(1) }),
    z.object({ type: z.null(), val: z.literal(2) }),
    z.object({ type: z.enum(['a', 'b', 'c']), val: z.literal(3) }),
  ]);

  expect(schema.parse({ type: undefined, val: 1 })).toEqual({
    type: undefined,
    val: 1,
  });
  expect(schema.parse({ type: null, val: 2 })).toEqual({
    type: null,
    val: 2,
  });
  expect(schema.parse({ type: 'c', val: 3 })).toEqual({
    type: 'c',
    val: 3,
  });
});

test('valid - zod lazy discriminator', () => {
  const schema = y.discriminatedUnion('type', [
    z.object({ type: z.lazy(() => z.literal('a')), val: z.literal(1) }),
    z.object({ type: z.lazy(() => z.literal('b')), val: z.literal(2) }),
  ]);

  expect(schema.parse({ type: 'b', val: 2 })).toEqual({
    type: 'b',
    val: 2,
  });
});

test('valid - zod native enum discriminator', () => {
  enum Fruits {
    Apple,
    Banana,
  }
  const schema = y.discriminatedUnion('type', [
    z.object({ type: z.literal('a'), val: z.literal(1) }),
    z.object({ type: z.nativeEnum(Fruits), val: z.literal(2) }),
  ]);

  expect(schema.parse({ type: Fruits.Banana, val: 2 })).toEqual({
    type: Fruits.Banana,
    val: 2,
  });
});

test('valid - wrapped optional discriminator value ', () => {
  const schema = y.discriminatedUnion('type', [
    z.object({ type: z.literal('1').optional(), val: z.literal(1) }),
    z.object({ type: z.literal(1), val: z.literal(2) }),
  ]);

  expect(schema.parse({ type: '1', val: 1 })).toEqual({ type: '1', val: 1 });
  expect(schema.parse({ type: undefined, val: 1 })).toEqual({
    type: undefined,
    val: 1,
  });
  expect(schema.parse({ type: 1, val: 2 })).toEqual({ type: 1, val: 2 });
});

test('invalid - collision with multiple undefined discriminators', () => {
  try {
    y.discriminatedUnion('type', [
      z.object({ type: z.literal('1').optional(), val: z.literal(1) }),
      z.object({ type: z.literal(undefined), val: z.literal(2) }),
    ]);
    throw new Error();
  } catch (e: any) {
    expect(e.message.includes('has duplicate value')).toEqual(true);
  }
});

test('invalid - null', () => {
  try {
    y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), a: z.string() }),
      z.object({ type: z.literal('b'), b: z.string() }),
    ]).parse(null);
    throw new Error();
  } catch (e: any) {
    expect(JSON.parse(e.message)).toEqual([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: z.ZodParsedType.object,
        message: 'Expected object, received null',
        received: z.ZodParsedType.null,
        path: [],
      },
    ]);
  }
});

test('invalid discriminator value', () => {
  try {
    y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), a: z.string() }),
      z.object({ type: z.literal('b'), b: z.string() }),
    ]).parse({ type: 'x', a: 'abc' });
    throw new Error();
  } catch (e: any) {
    expect(JSON.parse(e.message)).toEqual([
      {
        code: z.ZodIssueCode.invalid_union_discriminator,
        options: ['a', 'b'],
        message: "Invalid discriminator value. Expected 'a' | 'b'",
        path: ['type'],
      },
    ]);
  }
});

test('valid discriminator value, invalid data', () => {
  try {
    y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), a: z.string() }),
      z.object({ type: z.literal('b'), b: z.string() }),
    ]).parse({ type: 'a', b: 'abc' });
    throw new Error();
  } catch (e: any) {
    expect(JSON.parse(e.message)).toEqual([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: z.ZodParsedType.string,
        message: 'Required',
        path: ['a'],
        received: z.ZodParsedType.undefined,
      },
    ]);
  }
});

test('wrong schema - missing discriminator', () => {
  try {
    y.discriminatedUnion('type', [z.object({ type: z.literal('a'), a: z.string() }), z.object({ b: z.string() }) as any]);
    throw new Error();
  } catch (e: any) {
    expect(e.message.includes('could not be extracted')).toBe(true);
  }
});

test('wrong schema - duplicate discriminator values', () => {
  try {
    y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), a: z.string() }),
      z.object({ type: z.literal('a'), b: z.string() }),
    ]);
    throw new Error();
  } catch (e: any) {
    expect(e.message.includes('has duplicate value')).toEqual(true);
  }
});

test('valid - `DiscriminatedUnion` as a union option', () => {
  const A = z.object({ type: z.literal('a'), a: z.literal(1) });
  const B = z.object({ type: z.literal('b'), b: z.literal(2) });
  const C = z.object({ type: z.literal('c').optional(), c: z.literal(true) });
  const AorB = y.discriminatedUnion('type', [A, B]);
  const schema = y.discriminatedUnion('type', [AorB, C]);

  expect(schema.parse({ type: 'a', a: 1 })).toEqual({ type: 'a', a: 1 });
  expect(schema.parse({ type: 'b', b: 2 })).toEqual({ type: 'b', b: 2 });
  expect(schema.parse({ type: undefined, c: true })).toEqual({
    type: undefined,
    c: true,
  });

  expect(schema.parse({ type: 'c', c: true })).toEqual({
    type: 'c',
    c: true,
  });
});

test('valid expected types from inference with another DiscriminatedUnion element', () => {
  const A = z.object({ type: z.literal('a'), a: z.literal(1) });
  const B = z.object({ type: z.literal('b'), b: z.literal(2) });
  const C = z.object({ type: z.literal('c').optional(), c: z.literal(true) });
  const AorB = y.discriminatedUnion('type', [A, B]);
  const schema = y.discriminatedUnion('type', [AorB, C]);
  type schemaType = z.infer<typeof schema>;

  util.assertEqual<schemaType, { type: 'a'; a: 1 } | { type: 'b'; b: 2 } | { type?: 'c' | undefined; c: true }>(true);
});

test('DU flattens children DiscriminatedUnion elements with same discriminator key', () => {
  const A = z.object({ type: z.literal('a'), a: z.literal(1) });
  const B = z.object({ type: z.literal('b'), b: z.literal(2) });
  const C = z.object({ type: z.literal('c').optional(), c: z.literal(true) });
  const D = z.object({ type: z.literal('d'), d: z.literal('d') });

  const AorB = y.discriminatedUnion('type', [A, B]);
  const child = y.discriminatedUnion('type', [AorB, C]);
  const parent = y.discriminatedUnion('type', [child, D]);

  expect(parent.options.length).toEqual(4);
});

test('valid - nested disjointed DiscriminatedUnions', () => {
  const subtype = y.discriminatedUnion('subtype', [
    z.object({
      type: z.literal('baz'),
      subtype: z.literal('able'),
    }),
    z.object({
      type: z.literal('bauble'),
      subtype: z.literal('beehive'),
      undertype: z.literal('alpha'),
    }),
    z.object({
      type: z.literal('baz'),
      subtype: z.literal('baker'),
    }),
  ]);

  const schema = y.discriminatedUnion('type', [
    z.object({
      type: z.literal('foo'),
    }),
    z.object({
      type: z.literal('bar'),
    }),
    subtype,
  ]);

  const testMaps = [
    { type: 'baz', subtype: 'able' } as const,
    { type: 'baz', subtype: 'baker' } as const,
    { type: 'bauble', subtype: 'beehive', undertype: 'alpha' } as const,
    { type: 'foo' } as const,
    { type: 'bar' } as const,
  ];
  type SubSchemaTypes = typeof testMaps extends Array<infer S> ? S : never;

  testMaps.map(el => expect(schema.parse(el)).toEqual(el));

  expectShape<SubSchemaTypes>().forSchema(schema);
});

test('valid expected types from inference with disjointed nested DiscriminatedUnions', () => {
  const underDU = y.discriminatedUnion('undertype', [
    z.object({
      undertype: z.literal('a'),
      subtype: z.literal(1),
      wowee: z.literal(true),
    }),
    z.object({
      undertype: z.literal('b'),
      subtype: z.literal(1),
      wowee: z.literal(false),
    }),
    z.object({
      undertype: z.literal('c'),
      subtype: z.literal(2),
      extra: z.literal('yes'),
    }),
  ]);

  const subDU = y.discriminatedUnion('subtype', [
    underDU,
    z.object({
      subtype: z.literal(9),
      additional: z.literal('true'),
    }),
  ]);

  type schemaType = z.infer<typeof subDU>;

  util.assertEqual<
    schemaType,
    | { undertype: 'a'; subtype: 1; wowee: true }
    | { undertype: 'b'; subtype: 1; wowee: false }
    | { undertype: 'c'; subtype: 2; extra: 'yes' }
    | { subtype: 9; additional: 'true' }
  >(true);
});

test('invalid - duplicate values for nested disjointed DUs', () => {
  const underDU = y.discriminatedUnion('undertype', [
    z.object({
      undertype: z.literal('a'),
      subtype: z.literal(9),
      wowee: z.literal(true),
    }),
    z.object({
      undertype: z.literal('b'),
      subtype: z.literal(1),
      wowee: z.literal(false),
    }),
    z.object({
      undertype: z.literal('c'),
      subtype: z.literal(2),
      extra: z.literal('yes'),
    }),
  ]);
  try {
    y.discriminatedUnion('subtype', [
      underDU,
      z.object({
        subtype: z.literal(9),
        additional: z.literal('true'),
      }),
    ]);
    throw new Error();
  } catch (e: any) {
    expect(e.message.includes('has duplicate value `9`')).toEqual(true);
  }
});

test('invalid - nested DUs with missing parent discriminator keys', () => {
  const underDU = y.discriminatedUnion('undertype', [
    z.object({
      undertype: z.literal('a'),
      subtype: z.literal(1),
      wowee: z.literal(true),
    }),
    z.object({
      undertype: z.literal('b'),
      subtype: z.literal(1),
      wowee: z.literal(false),
      additional: z.literal('true'),
    }),
    z.object({
      undertype: z.literal('c'),
      subtype: z.literal(2),
      extra: z.literal('yes'),
    }),
  ]);

  const subDU = y.discriminatedUnion('subtype', [
    underDU,
    z.object({
      subtype: z.literal(9),
      additional: z.literal('false'),
    }),
  ]);

  try {
    y.discriminatedUnion('additional', [
      subDU,
      z.object({
        subtype: z.literal(9),
        additional: z.literal('true'),
      }),
    ]);
    throw new Error();
  } catch (e: any) {
    expect(e.message.includes('value for key `additional` could not be extracted')).toEqual(true);
  }
});

test('multiple nested DiscriminatedUnion elements', () => {
  const NESTING_DEPTH = 20;
  const elementArray = Array(NESTING_DEPTH)
    .fill(0)
    .map((_el, i) => z.object({ type: z.literal(i), [`${i}`]: z.literal(true) }));

  const firstSchema = y.discriminatedUnion('type', [elementArray[0], elementArray[1]]);

  const schema = elementArray
    .slice(2)
    .reduce<y.ZodDiscriminatedUnion<'type', any>>((prev, curr) => y.discriminatedUnion('type', [prev, curr]), firstSchema);

  Array(NESTING_DEPTH)
    .fill(0)
    .map((_el, i) => ({ type: i, [`${i}`]: true }))
    .map(el => {
      expect(schema.parse(el)).toEqual(el);
    });
});

test('discriminator not available for nested DiscriminatedUnion', () => {
  try {
    const A = z.object({ type: z.literal('a'), a: z.literal(1) });
    const B = z.object({ type: z.literal('b'), b: z.literal(2) });
    const AorB = y.discriminatedUnion('type', [A, B]);

    const C = z.object({ foo: z.literal('c'), a: z.literal(3) });
    const D = z.object({ foo: z.literal('d'), b: z.literal(4) });
    const CorD = y.discriminatedUnion('foo', [C, D]);

    y.discriminatedUnion('type', [AorB, CorD as any]);
    throw new Error();
  } catch (e: any) {
    expect(e.message.includes('value for key `type` could not be extracted')).toEqual(true);
  }
});

test('async - valid', async () => {
  expect(
    await y
      .discriminatedUnion('type', [
        z.object({
          type: z.literal('a'),
          a: z
            .string()
            .refine(async () => true)
            .transform(async val => Number(val)),
        }),
        z.object({
          type: z.literal('b'),
          b: z.string(),
        }),
      ])
      .parseAsync({ type: 'a', a: '1' }),
  ).toEqual({ type: 'a', a: 1 });
});

test('async - invalid', async () => {
  try {
    await y
      .discriminatedUnion('type', [
        z.object({
          type: z.literal('a'),
          a: z
            .string()
            .refine(async () => true)
            .transform(async val => val),
        }),
        z.object({
          type: z.literal('b'),
          b: z.string(),
        }),
      ])
      .parseAsync({ type: 'a', a: 1 });
    throw new Error();
  } catch (e: any) {
    expect(JSON.parse(e.message)).toEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['a'],
        message: 'Expected string, received number',
      },
    ]);
  }
});

test('valid - literals with .default or .preprocess', () => {
  const schema = y.discriminatedUnion('type', [
    z.object({
      type: z.literal('foo').default('foo'),
      a: z.string(),
    }),
    z.object({
      type: z.literal('custom'),
      method: z.string(),
    }),
    z.object({
      type: z.preprocess(val => String(val), z.literal('bar')),
      c: z.string(),
    }),
  ]);
  expect(schema.parse({ type: 'foo', a: 'foo' })).toEqual({
    type: 'foo',
    a: 'foo',
  });
});

describe('create params tests', () => {
  it('uses the given errorMap', () => {
    const schema = y.discriminatedUnion(
      'type',
      [z.object({ type: z.literal('a'), a: z.string() }), z.object({ type: z.literal('b'), b: z.string() })],
      { errorMap: () => ({ message: 'oops' }) },
    );

    const result = schema.safeParse({ type: 'c' });

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({ issues: [expect.objectContaining({ message: 'oops' })] }),
    });
  });

  it('uses the given invalid_union_discriminator', () => {
    const schema = y.discriminatedUnion(
      'type',
      [z.object({ type: z.literal('a'), a: z.string() }), z.object({ type: z.literal('b'), b: z.string() })],
      { invalid_union_discriminator: 'My error message', invalid_type_error: 'My type error message' },
    );

    const result = schema.safeParse({ type: undefined });

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({ issues: [expect.objectContaining({ message: 'My error message' })] }),
    });
  });

  it('uses the given invalid_type_error', () => {
    const schema = y.discriminatedUnion(
      'type',
      [z.object({ type: z.literal('a'), a: z.string() }), z.object({ type: z.literal('b'), b: z.string() })],
      { invalid_union_discriminator: 'My error message', invalid_type_error: 'My type error message' },
    );

    const result = schema.safeParse('not an objet');

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({ issues: [expect.objectContaining({ message: 'My type error message' })] }),
    });
  });

  it('does not allow "invalid_union_discriminator" in conjunction with "errprMap"', () => {
    expect.assertions(1);

    try {
      y.discriminatedUnion(
        'type',
        [z.object({ type: z.literal('a'), a: z.string() }), z.object({ type: z.literal('b'), b: z.string() })],
        { errorMap: () => ({ message: 'oops' }), invalid_union_discriminator: 'oopsie' },
      );
    } catch (e: any) {
      expect(e.message).toEqual(
        `Can't use "invalid_type_error" or "invalid_union_discriminator" in conjunction with custom error map.`,
      );
    }
  });

  it('does not allow "invalid_union_discriminator" in conjunction with "errprMap"', () => {
    expect.assertions(1);

    try {
      y.discriminatedUnion(
        'type',
        [z.object({ type: z.literal('a'), a: z.string() }), z.object({ type: z.literal('b'), b: z.string() })],
        { errorMap: () => ({ message: 'oops' }), invalid_type_error: 'oopsie' },
      );
    } catch (e: any) {
      expect(e.message).toEqual(
        `Can't use "invalid_type_error" or "invalid_union_discriminator" in conjunction with custom error map.`,
      );
    }
  });
});

describe('object schema functions', () => {
  test('strict', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).passthrough(),
      z.object({ type: z.literal('b'), baz: z.string() }).passthrough(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).passthrough(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).passthrough(),
      ]),
    ]);

    const strictSchema = schema.strict();

    const input = { type: 'a', foo: 'bar', test: 123 };
    const output = strictSchema.safeParse(input);

    expect(output).toEqual({
      success: false,
      error: expect.objectContaining({ issues: [expect.objectContaining({ code: 'unrecognized_keys' })] }),
    });

    expectShape<
      | { type: 'a'; foo: string }
      | { type: 'b'; baz: string }
      | { type: 'c'; sub: 'a'; foo: string }
      | { type: 'c'; sub: 'b'; baz: string }
    >().forSchema(strictSchema);
    expect(strictSchema.options).toHaveLength(3);
    strictSchema.options.forEach(option => {
      if (option instanceof ZodDiscriminatedUnion) {
        expect(option.options).toHaveLength(2);
        option.options.forEach(o => {
          expect(o._def.unknownKeys).toEqual('strict');
        });
      } else {
        expect(option._def.unknownKeys).toEqual('strict');
      }
    });
  });

  test('strip', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).strict(),
      z.object({ type: z.literal('b'), baz: z.string() }).strict(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strict(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strict(),
      ]),
    ]);

    const stripSchema = schema.strip();

    const input = { type: 'a', foo: 'bar', test: 123 };
    const output = stripSchema.parse(input);

    expect(output).toEqual({ type: 'a', foo: 'bar' });

    expectShape<
      | { type: 'a'; foo: string }
      | { type: 'b'; baz: string }
      | { type: 'c'; sub: 'a'; foo: string }
      | { type: 'c'; sub: 'b'; baz: string }
    >().forSchema(stripSchema);
    expect(stripSchema.options).toHaveLength(3);
    stripSchema.options.forEach(option => {
      if (option instanceof ZodDiscriminatedUnion) {
        expect(option.options).toHaveLength(2);
        option.options.forEach(o => {
          expect(o._def.unknownKeys).toEqual('strip');
        });
      } else {
        expect(option._def.unknownKeys).toEqual('strip');
      }
    });
  });

  test('passthrough', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).strict(),
      z.object({ type: z.literal('b'), baz: z.string() }).strict(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strict(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strict(),
      ]),
    ]);

    const passthroughSchema = schema.passthrough();

    const input = { type: 'a', foo: 'bar', test: 123 };
    const output = passthroughSchema.parse(input);

    expect(output).toEqual({ type: 'a', foo: 'bar', test: 123 });

    expectShape<
      | { type: 'a'; foo: string }
      | { type: 'b'; baz: string }
      | { type: 'c'; sub: 'a'; foo: string }
      | { type: 'c'; sub: 'b'; baz: string }
    >().forSchema(passthroughSchema);
    expect(passthroughSchema.options).toHaveLength(3);
    passthroughSchema.options.forEach(option => {
      if (option instanceof ZodDiscriminatedUnion) {
        expect(option.options).toHaveLength(2);
        option.options.forEach(o => {
          expect(o._def.unknownKeys).toEqual('passthrough');
        });
      } else {
        expect(option._def.unknownKeys).toEqual('passthrough');
      }
    });
  });

  test('catchall', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).strict(),
      z.object({ type: z.literal('b'), baz: z.string() }).strict(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strict(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strict(),
      ]),
    ]);

    const catchallSchema = schema.catchall(z.number());

    const validInput = { type: 'a', foo: 'bar', test: 123 };
    const invalidInput = { type: 'a', foo: 'bar', test: 'this is a string' };

    expect(catchallSchema.parse(validInput)).toEqual({ type: 'a', foo: 'bar', test: 123 });

    expectShape<
      (
        | { type: 'a'; foo: string }
        | { type: 'b'; baz: string }
        | { type: 'c'; sub: 'a'; foo: string }
        | { type: 'c'; sub: 'b'; baz: string }
      ) &
        Record<string, number>
    >().forSchema(catchallSchema);
    expect(catchallSchema.safeParse(invalidInput)).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [
          expect.objectContaining({
            code: 'invalid_type',
            expected: 'number',
            received: 'string',
            path: ['test'],
          }),
        ],
      }),
    });
  });

  test('pick including discriminator', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).strip(),
      z.object({ type: z.literal('b'), baz: z.string() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strip(),
      ]),
    ]);

    const pickSchema = schema.pick({ type: true, foo: true });
    expect(pickSchema.parse({ type: 'a', foo: 'bar' })).toEqual({ type: 'a', foo: 'bar' });
    expect(pickSchema.parse({ type: 'b', baz: 'bar' })).toEqual({ type: 'b' });

    expectShape<
      { type: 'a'; foo: string } | { type: 'b' } | { type: 'c'; sub: 'a'; foo: string } | { type: 'c'; sub: 'b' }
    >().forSchema(pickSchema);
  });

  test('pick without discriminator adds discriminator', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).strip(),
      z.object({ type: z.literal('b'), baz: z.string() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strip(),
      ]),
    ]);

    const pickSchema = schema.pick({ foo: true });

    expect(pickSchema.parse({ type: 'a', foo: 'bar' })).toEqual({ type: 'a', foo: 'bar' });
    expect(pickSchema.parse({ type: 'b', baz: 'bar' })).toEqual({ type: 'b' });

    expectShape<
      { type: 'a'; foo: string } | { type: 'b' } | { type: 'c'; sub: 'a'; foo: string } | { type: 'c'; sub: 'b' }
    >().forSchema(pickSchema);
  });

  test('omit without discriminator', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).strip(),
      z.object({ type: z.literal('b'), baz: z.string() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strip(),
      ]),
    ]);

    const omitSchema = schema.omit({ foo: true });

    expect(omitSchema.parse({ type: 'a', foo: 'bar' })).toEqual({ type: 'a' });
    expect(omitSchema.parse({ type: 'b', baz: 'bar' })).toEqual({ type: 'b', baz: 'bar' });

    expectShape<
      { type: 'a' } | { type: 'b'; baz: string } | { type: 'c'; sub: 'a' } | { type: 'c'; sub: 'b'; baz: string }
    >().forSchema(omitSchema);
  });

  test('try to omit discriminator', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).strip(),
      z.object({ type: z.literal('b'), baz: z.string() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strip(),
      ]),
    ]);

    const omitSchema = schema.omit({ type: true } as any);

    expect(omitSchema.parse({ type: 'a', foo: 'bar' })).toEqual({ type: 'a', foo: 'bar' });
    expect(omitSchema.parse({ type: 'b', baz: 'bar' })).toEqual({ type: 'b', baz: 'bar' });
  });

  test('deepPartial, keeps discriminator required', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.object({ bar: z.string(), baz: z.number() }) }).strip(),
      z.object({ type: z.literal('b'), baz: z.string() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strip(),
      ]),
    ]);

    const deepPartialSchema = schema.deepPartial();

    expect(deepPartialSchema.parse({ type: 'a', foo: { bar: 'test', baz: 123 } })).toEqual({
      type: 'a',
      foo: { bar: 'test', baz: 123 },
    });
    expect(deepPartialSchema.parse({ type: 'a', foo: { bar: 'test' } })).toEqual({ type: 'a', foo: { bar: 'test' } });
    expect(deepPartialSchema.parse({ type: 'a' })).toEqual({ type: 'a' });
    expect(deepPartialSchema.parse({ type: 'b', baz: 'bar' })).toEqual({ type: 'b', baz: 'bar' });

    expect(deepPartialSchema.safeParse({})).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [expect.objectContaining({ code: 'invalid_union_discriminator', options: ['a', 'b', 'c'] })],
      }),
    });
    expectShape<
      | { type: 'a'; foo?: { bar?: string; baz?: number } }
      | { type: 'b'; baz?: string }
      | { type: 'c'; sub: 'a'; foo?: string }
      | { type: 'c'; sub: 'b'; baz?: string }
    >().forSchema(deepPartialSchema);
  });

  test('partial, without mask, keeps discriminator required', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.object({ bar: z.string(), baz: z.number() }) }).strip(),
      z.object({ type: z.literal('b'), baz: z.string() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strip(),
      ]),
    ]);

    const partialSchema = schema.partial();

    expect(partialSchema.parse({ type: 'a', foo: { bar: 'test', baz: 123 } })).toEqual({
      type: 'a',
      foo: { bar: 'test', baz: 123 },
    });
    expect(partialSchema.parse({ type: 'a' })).toEqual({ type: 'a' });
    expect(partialSchema.parse({ type: 'b', baz: 'bar' })).toEqual({ type: 'b', baz: 'bar' });

    expect(partialSchema.safeParse({ type: 'a', foo: { bar: 'test' } })).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [
          expect.objectContaining({ code: 'invalid_type', expected: 'number', received: 'undefined', path: ['foo', 'baz'] }),
        ],
      }),
    });

    expect(partialSchema.safeParse({})).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [expect.objectContaining({ code: 'invalid_union_discriminator', options: ['a', 'b', 'c'] })],
      }),
    });
    expectShape<
      | { type: 'a'; foo?: { bar: string; baz: number } }
      | { type: 'b'; baz?: string }
      | { type: 'c'; sub: 'a'; foo?: string }
      | { type: 'c'; sub: 'b'; baz?: string }
    >().forSchema(partialSchema);
  });

  test('partial, with mask', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).strip(),
      z.object({ type: z.literal('b'), baz: z.string() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strip(),
      ]),
    ]);

    const partialSchema = schema.partial({ foo: true });

    expect(partialSchema.parse({ type: 'a' })).toEqual({ type: 'a' });
    expect(partialSchema.parse({ type: 'a', foo: 'bar' })).toEqual({ type: 'a', foo: 'bar' });

    expect(partialSchema.parse({ type: 'b', baz: 'foo' })).toEqual({ type: 'b', baz: 'foo' });
    expect(partialSchema.safeParse({ type: 'b' })).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [expect.objectContaining({ code: 'invalid_type', expected: 'string', received: 'undefined', path: ['baz'] })],
      }),
    });

    expectShape<
      | { type: 'a'; foo?: string }
      | { type: 'b'; baz: string }
      | { type: 'c'; sub: 'a'; foo?: string }
      | { type: 'c'; sub: 'b'; baz: string }
    >().forSchema(partialSchema);
  });

  test('partial, with mask including discriminator keeps discriminator required', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.string() }).strip(),
      z.object({ type: z.literal('b'), baz: z.string() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strip(),
      ]),
    ]);

    const partialSchema = schema.partial({ type: true, baz: true } as any);

    expect(partialSchema.parse({ type: 'b' })).toEqual({ type: 'b' });
    expect(partialSchema.parse({ type: 'b', baz: 'foo' })).toEqual({ type: 'b', baz: 'foo' });

    expect(partialSchema.parse({ type: 'a', foo: 'bar' })).toEqual({ type: 'a', foo: 'bar' });
    expect(partialSchema.safeParse({ type: 'a' })).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [expect.objectContaining({ code: 'invalid_type', expected: 'string', received: 'undefined', path: ['foo'] })],
      }),
    });

    expect(partialSchema.safeParse({})).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [expect.objectContaining({ code: 'invalid_union_discriminator', options: ['a', 'b', 'c'] })],
      }),
    });
  });

  test('required, without a mask', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.object({ bar: z.string().optional() }).optional() }).strip(),
      z.object({ type: z.literal('b'), baz: z.string().optional() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string().optional() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string() }).strip(),
      ]),
    ]);

    const requiredSchema = schema.required();

    expect(requiredSchema.parse({ type: 'a', foo: { bar: 'baz' } })).toEqual({ type: 'a', foo: { bar: 'baz' } });
    expect(requiredSchema.parse({ type: 'a', foo: {} })).toEqual({ type: 'a', foo: {} });
    expect(requiredSchema.parse({ type: 'b', baz: 'bar' })).toEqual({ type: 'b', baz: 'bar' });

    expect(requiredSchema.safeParse({ type: 'a' })).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [expect.objectContaining({ code: 'invalid_type', expected: 'object', received: 'undefined', path: ['foo'] })],
      }),
    });

    expect(requiredSchema.safeParse({})).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [expect.objectContaining({ code: 'invalid_union_discriminator', options: ['a', 'b', 'c'] })],
      }),
    });
    expectShape<
      | { type: 'a'; foo: { bar?: string } }
      | { type: 'b'; baz: string }
      | { type: 'c'; sub: 'a'; foo: string }
      | { type: 'c'; sub: 'b'; baz: string }
    >().forSchema(requiredSchema);
  });

  test('required, with a mask', () => {
    const schema = y.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), foo: z.object({ bar: z.string().optional() }).optional() }).strip(),
      z.object({ type: z.literal('b'), baz: z.string().optional() }).strip(),
      y.discriminatedUnion('sub', [
        z.object({ type: z.literal('c'), sub: z.literal('a'), foo: z.string().optional() }).strip(),
        z.object({ type: z.literal('c'), sub: z.literal('b'), baz: z.string().optional() }).strip(),
      ]),
    ]);

    const requiredSchema = schema.required({ foo: true });

    expect(requiredSchema.parse({ type: 'a', foo: { bar: 'baz' } })).toEqual({ type: 'a', foo: { bar: 'baz' } });
    expect(requiredSchema.parse({ type: 'a', foo: {} })).toEqual({ type: 'a', foo: {} });
    expect(requiredSchema.parse({ type: 'b', baz: 'bar' })).toEqual({ type: 'b', baz: 'bar' });
    expect(requiredSchema.parse({ type: 'b' })).toEqual({ type: 'b' });

    expect(requiredSchema.safeParse({ type: 'a' })).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [expect.objectContaining({ code: 'invalid_type', expected: 'object', received: 'undefined', path: ['foo'] })],
      }),
    });

    expect(requiredSchema.safeParse({})).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: [expect.objectContaining({ code: 'invalid_union_discriminator', options: ['a', 'b', 'c'] })],
      }),
    });
    expectShape<
      | { type: 'a'; foo: { bar?: string } }
      | { type: 'b'; baz?: string }
      | { type: 'c'; sub: 'a'; foo: string }
      | { type: 'c'; sub: 'b'; baz?: string }
    >().forSchema(requiredSchema);
  });
});
