import {
  addIssueToContext,
  input,
  INVALID,
  output,
  ParseInput,
  ParseReturnType,
  Primitive,
  ProcessedCreateParams,
  RawCreateParams as ZodRawCreateParams,
  UnknownKeysParam,
  util,
  ZodDefault,
  ZodEffects,
  ZodEnum,
  ZodErrorMap,
  ZodIssueCode,
  ZodLazy,
  ZodLiteral,
  ZodNativeEnum,
  ZodNull,
  ZodNullable,
  ZodObject,
  ZodOptional,
  ZodParsedType,
  ZodRawShape,
  ZodType,
  ZodTypeAny,
  ZodTypeDef,
  ZodUndefined,
} from 'zod';
import { DeepPartial } from './helpers/partialUtil';

type Defined<T> = T extends undefined ? never : T;

export type RawCreateParams = Omit<Defined<ZodRawCreateParams>, 'required_error'> & {
  invalid_union_discriminator?: string;
};

function processCreateParams(params: RawCreateParams | undefined): ProcessedCreateParams {
  if (!params) return {};
  const { errorMap, invalid_type_error, invalid_union_discriminator, description } = params;
  if (errorMap && (invalid_type_error || invalid_union_discriminator)) {
    throw new Error(`Can't use "invalid_type_error" or "invalid_union_discriminator" in conjunction with custom error map.`);
  }
  if (errorMap) return { errorMap: errorMap, description };
  const customMap: ZodErrorMap = (iss, ctx) => {
    switch (iss.code) {
      case 'invalid_type':
        return { message: invalid_type_error ?? ctx.defaultError };
      case 'invalid_union_discriminator':
        return { message: invalid_union_discriminator ?? ctx.defaultError };
      default:
        return { message: ctx.defaultError };
    }
  };
  return { errorMap: customMap, description };
}

type identity<T> = T;
type keys<T> = T extends T ? keyof T : never;
type noNeverKeys<T extends ZodRawShape> = {
  [k in keyof T]: [T[k]] extends [never] ? never : k;
}[keyof T];
type noNever<T extends ZodRawShape> = identity<{
  [k in noNeverKeys<T>]: k extends keyof T ? T[k] : never;
}>;
type deoptional<T extends ZodTypeAny> = T extends ZodOptional<infer U>
  ? deoptional<U>
  : T extends ZodNullable<infer U>
  ? ZodNullable<deoptional<U>>
  : T;

type ErrMessage = string | { message?: string };

const ZodDiscriminatedUnionTypeName = 'ZodDiscriminatedUnion';
type ZodDiscriminatedUnionTypeName = typeof ZodDiscriminatedUnionTypeName;

/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
//////////                                 //////////
//////////      ZodDiscriminatedUnion      //////////
//////////                                 //////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////

const getDiscriminator = <T extends ZodTypeAny>(type: T): Primitive[] => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return Object.values(type.enum as any);
  } else if (type instanceof ZodDiscriminatedUnion) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodOptional) {
    return [undefined, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodUndefined) {
    return [undefined];
  } else if (type instanceof ZodNull) {
    return [null];
  } else {
    return [];
  }
};

export type ZodDiscriminatedUnionObject<Discriminator extends string> = ZodObject<
  { [key in Discriminator]: ZodTypeAny } & ZodRawShape,
  any,
  any
>;

export type ZodDiscriminatedUnionOption<Discriminator extends string> =
  | ZodDiscriminatedUnionObject<Discriminator>
  | ZodDiscriminatedUnion<any, ZodDiscriminatedUnionOption<any>[]>;

export interface ZodDiscriminatedUnionDef<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<Discriminator>[] = ZodDiscriminatedUnionOption<Discriminator>[],
> extends ZodTypeDef {
  discriminator: Discriminator;
  options: Options;
  optionsMap: Map<Primitive, ZodDiscriminatedUnionOption<Discriminator>>;
  typeName: ZodDiscriminatedUnionTypeName;
}

type ExtractShapes<Options extends ZodDiscriminatedUnionOption<any>[]> = Options extends [infer First, ...infer Rest]
  ? First extends ZodObject<infer Shape, any, any, any, any>
    ? [Shape, ...(Rest extends ZodDiscriminatedUnionOption<any>[] ? ExtractShapes<Rest> : [])]
    : First extends ZodDiscriminatedUnion<any, infer NestedOptions>
    ? [...ExtractShapes<NestedOptions>, ...(Rest extends ZodDiscriminatedUnionOption<any>[] ? ExtractShapes<Rest> : [])]
    : []
  : [];

type KeyofObjectUnion<Options extends ZodDiscriminatedUnionOption<any>[]> = keys<ExtractShapes<Options>[number]>;

type AsDiscriminatorUnionOptions<T, Discriminator extends string> = T extends ZodDiscriminatedUnionOption<Discriminator>[]
  ? T
  : never;

type ZodPickedDiscriminatedUnionOptions<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<Discriminator>[],
  K extends string | number | symbol,
> = AsDiscriminatorUnionOptions<
  {
    [I in keyof Options]: Options[I] extends ZodObject<infer Shape, infer UnknownKeys, infer Catchall, any, any>
      ? ZodObject<Pick<Shape, Extract<keyof Shape, K> | Discriminator>, UnknownKeys, Catchall>
      : Options[I] extends ZodDiscriminatedUnion<infer D, infer O>
      ? ZodDiscriminatedUnion<D, ZodPickedDiscriminatedUnionOptions<D, O, K | Discriminator>>
      : never;
  },
  Discriminator
>;

type ZodUnknownKeysDiscriminatedUnionOptions<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<Discriminator>[],
  UnknownKeys extends UnknownKeysParam,
> = {
  [I in keyof Options]: Options[I] extends ZodObject<infer Shape, any, infer Catchall, any, any>
    ? ZodObject<Shape, UnknownKeys, Catchall>
    : Options[I] extends ZodDiscriminatedUnion<infer D, infer O>
    ? ZodDiscriminatedUnion<D, ZodUnknownKeysDiscriminatedUnionOptions<D, O, UnknownKeys>>
    : never;
};

type ZodCatchallDiscriminatedUnionOptions<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<Discriminator>[],
  Catchall extends ZodTypeAny,
> = AsDiscriminatorUnionOptions<
  {
    [I in keyof Options]: Options[I] extends ZodObject<infer Shape, infer UnknownKeys, any, any, any>
      ? ZodObject<Shape, UnknownKeys, Catchall>
      : Options[I] extends ZodDiscriminatedUnion<infer D, infer O>
      ? ZodDiscriminatedUnion<D, ZodCatchallDiscriminatedUnionOptions<D, O, Catchall>>
      : never;
  },
  Discriminator
>;

type ZodPartialDiscriminatedUnionOptions<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<Discriminator>[],
  Keys extends string | number | symbol,
> = AsDiscriminatorUnionOptions<
  {
    [I in keyof Options]: Options[I] extends ZodObject<infer Shape, infer UnknownKeys, infer Catchall, any, any>
      ? ZodObject<
          noNever<{
            [k in keyof Shape]: k extends Exclude<Keys, Discriminator> ? ZodOptional<Shape[k]> : Shape[k];
          }>,
          UnknownKeys,
          Catchall
        >
      : Options[I] extends ZodDiscriminatedUnion<infer D, infer O>
      ? ZodDiscriminatedUnion<D, ZodPartialDiscriminatedUnionOptions<D, O, Exclude<Keys, Discriminator>>>
      : never;
  },
  Discriminator
>;

type ZodRequiredDiscriminatedUnionOptions<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<Discriminator>[],
  Keys extends string | number | symbol,
> = AsDiscriminatorUnionOptions<
  {
    [I in keyof Options]: Options[I] extends ZodObject<infer Shape, infer UnknownKeys, infer Catchall, any, any>
      ? ZodObject<
          noNever<{
            [k in keyof Shape]: k extends Keys ? deoptional<Shape[k]> : Shape[k];
          }>,
          UnknownKeys,
          Catchall
        >
      : Options[I] extends ZodDiscriminatedUnion<infer D, infer O>
      ? ZodDiscriminatedUnion<D, ZodRequiredDiscriminatedUnionOptions<D, O, Keys>>
      : never;
  },
  Discriminator
>;

type ZodDeepPartialDiscriminatedUnionOptions<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<Discriminator>[],
  ParentDiscriminators extends string = never,
> = AsDiscriminatorUnionOptions<
  {
    [I in keyof Options]: Options[I] extends ZodObject<infer Shape, infer UnknownKeys, infer Catchall, any, any>
      ? ZodObject<
          {
            [k in keyof Shape]: k extends Discriminator | ParentDiscriminators ? Shape[k] : ZodOptional<DeepPartial<Shape[k]>>;
          },
          UnknownKeys,
          Catchall
        >
      : Options[I] extends ZodDiscriminatedUnion<infer D, infer O>
      ? ZodDiscriminatedUnion<D, ZodDeepPartialDiscriminatedUnionOptions<D, O, ParentDiscriminators | Discriminator>>
      : never;
  },
  Discriminator
>;

const homologueOptions = <Discriminator extends string>(
  discriminator: Discriminator,
  options: ZodDiscriminatedUnionOption<Discriminator>[],
): ZodDiscriminatedUnionOption<Discriminator>[] => {
  const homologueAssertion = (
    option: ZodDiscriminatedUnionOption<Discriminator>,
  ): option is ZodDiscriminatedUnion<Discriminator, any> =>
    option instanceof ZodDiscriminatedUnion && option.discriminator === discriminator;

  const duHomologues = options.filter(homologueAssertion);

  const nonDuHomologues = options.filter(option => !homologueAssertion(option));

  return [...duHomologues.flatMap(du => du.options), ...nonDuHomologues];
};

const toOptionsMap = <Discriminator extends string>(
  discriminator: Discriminator,
  options: ZodDiscriminatedUnionOption<Discriminator>[],
): Map<Primitive, ZodDiscriminatedUnionOption<Discriminator>> => {
  // compact DU tree by "flattening" child DUs with same discriminator

  const optionsMap: Map<Primitive, ZodDiscriminatedUnionOption<Discriminator>> = new Map();

  const addUniqueDiscriminatorValues = (values: Primitive[], type: ZodDiscriminatedUnionOption<Discriminator>) => {
    for (const value of values) {
      if (optionsMap.has(value)) {
        throw new Error(`Discriminator property \`${discriminator}\` has duplicate value \`${String(value)}\``);
      }

      optionsMap.set(value, type);
    }
  };

  for (const type of options) {
    if (type instanceof ZodDiscriminatedUnion) {
      const values = type._enforceParentDiscriminator(discriminator);
      addUniqueDiscriminatorValues(values, type);
    } else {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }

      addUniqueDiscriminatorValues(discriminatorValues, type);
    }
  }

  return optionsMap;
};

export class ZodDiscriminatedUnion<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<Discriminator>[],
> extends ZodType<output<Options[number]>, ZodDiscriminatedUnionDef<Discriminator, Options>, input<Options[number]>> {
  _parse(input: ParseInput): ParseReturnType<this['_output']> {
    const { ctx } = this._processInputParams(input);

    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType,
      });
      return INVALID;
    }

    const discriminator = this.discriminator;
    const discriminatorValue: string = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);

    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator],
      });
      return INVALID;
    }

    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx,
      }) as any;
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx,
      }) as any;
    }
  }

  get discriminator() {
    return this._def.discriminator;
  }

  get options() {
    return this._def.options;
  }

  get optionsMap() {
    return this._def.optionsMap;
  }

  private getKeys(option: ZodDiscriminatedUnionOption<any>): string[] {
    if (option instanceof ZodDiscriminatedUnion) {
      return option.options.flatMap(o => this.getKeys(o));
    }
    return util.objectKeys(option.shape);
  }

  private get _fullMask(): Record<KeyofObjectUnion<Options>, true> {
    return this.options
      .flatMap(option => this.getKeys(option))
      .reduce((prev, next) => ({ ...prev, [next]: true }), {} as Record<KeyofObjectUnion<Options>, true>);
  }

  private _map<MappedOptions extends ZodDiscriminatedUnionOption<Discriminator>[]>(
    mapper: (option: ZodDiscriminatedUnionOption<Discriminator>) => ZodDiscriminatedUnionOption<Discriminator>,
  ): ZodDiscriminatedUnion<Discriminator, MappedOptions> {
    const options = this.options.map(mapper);
    const homologuedOptions = homologueOptions(this.discriminator, options);
    const optionsMap = toOptionsMap(this.discriminator, homologuedOptions);

    return new ZodDiscriminatedUnion({
      ...this._def,
      options: homologuedOptions as MappedOptions,
      optionsMap,
    });
  }

  strict(
    message?: ErrMessage,
  ): ZodDiscriminatedUnion<Discriminator, ZodUnknownKeysDiscriminatedUnionOptions<Discriminator, Options, 'strict'>> {
    return this._map(option => option.strict(message));
  }

  strip(): ZodDiscriminatedUnion<Discriminator, ZodUnknownKeysDiscriminatedUnionOptions<Discriminator, Options, 'strip'>> {
    return this._map(option => option.strip());
  }

  passthrough(): ZodDiscriminatedUnion<
    Discriminator,
    ZodUnknownKeysDiscriminatedUnionOptions<Discriminator, Options, 'passthrough'>
  > {
    return this._map(option => option.passthrough());
  }

  catchall<Index extends ZodTypeAny>(
    index: Index,
  ): ZodDiscriminatedUnion<Discriminator, ZodCatchallDiscriminatedUnionOptions<Discriminator, Options, Index>> {
    return this._map(option => option.catchall(index) as ZodDiscriminatedUnionOption<Discriminator>);
  }

  pick<Mask extends { [k in KeyofObjectUnion<Options>]?: true }>(
    mask: Mask,
  ): ZodDiscriminatedUnion<Discriminator, ZodPickedDiscriminatedUnionOptions<Discriminator, Options, keyof Mask>> {
    const maskWithDiscriminator = { ...mask, [this.discriminator]: true };
    return this._map(option => (option.pick as any)(maskWithDiscriminator));
  }

  omit<
    Mask extends {
      [k in Exclude<KeyofObjectUnion<Options>, Discriminator>]?: true;
    },
  >(
    mask: Mask,
  ): ZodDiscriminatedUnion<
    Discriminator,
    ZodPickedDiscriminatedUnionOptions<Discriminator, Options, Exclude<KeyofObjectUnion<Options>, keyof Mask>>
  > {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [this.discriminator]: discriminator, ...maskWithoutDiscriminator } = mask;
    return this._map(option => (option.omit as any)(maskWithoutDiscriminator));
  }

  deepPartial(): ZodDiscriminatedUnion<Discriminator, ZodDeepPartialDiscriminatedUnionOptions<Discriminator, Options>> {
    return this._map(option =>
      (option.deepPartial().required as any)({
        [this.discriminator]: true,
      }),
    );
  }

  partial(): ZodDiscriminatedUnion<
    Discriminator,
    ZodPartialDiscriminatedUnionOptions<Discriminator, Options, KeyofObjectUnion<Options>>
  >;
  partial<
    Mask extends {
      [k in Exclude<KeyofObjectUnion<Options>, Discriminator>]?: true;
    },
  >(mask: Mask): ZodDiscriminatedUnion<Discriminator, ZodPartialDiscriminatedUnionOptions<Discriminator, Options, keyof Mask>>;
  partial(mask?: any) {
    const unsafeMask = mask || this._fullMask;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [this.discriminator]: discriminator, ...safeMask } = unsafeMask;

    return this._map(option => (option.partial as any)(safeMask));
  }

  required(): ZodDiscriminatedUnion<
    Discriminator,
    ZodRequiredDiscriminatedUnionOptions<Discriminator, Options, KeyofObjectUnion<Options>>
  >;
  required<
    Mask extends {
      [k in KeyofObjectUnion<Options>]?: true;
    },
  >(mask: Mask): ZodDiscriminatedUnion<Discriminator, ZodRequiredDiscriminatedUnionOptions<Discriminator, Options, keyof Mask>>;
  required(mask?: any) {
    return this._map(option => (option.required as any)(mask));
  }
  _enforceParentDiscriminator(discriminator: string) {
    const valueSet = new Set<Primitive>();
    for (const type of this._def.options) {
      if (type instanceof ZodObject) {
        const discriminatorValues = getDiscriminator(type.shape[discriminator]);
        if (!discriminatorValues.length) {
          throw new Error(
            `A discriminator value for key \`${discriminator}\` ` + `could not be extracted from all schema options`,
          );
        }
        discriminatorValues.forEach(el => valueSet.add(el));
      } else if (type instanceof ZodDiscriminatedUnion) {
        const values = type._enforceParentDiscriminator(discriminator);
        if (values.length < 1) {
          throw new Error(
            `No value for key \`${discriminator}\` was found for DiscriminatedUnion with discriminator \`${type.discriminator}\``,
          );
        }
        values.forEach(el => valueSet.add(el));
      }
    }
    const valueArray = Array.from(valueSet);
    if (!valueArray.length) {
      throw new Error(`at least one value must be present for \`${discriminator}\` in DiscriminatedUnion for all children DUs`);
    }
    return valueArray;
  }

  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */

  static create<
    Discriminator extends string,
    Types extends [ZodDiscriminatedUnionOption<Discriminator>, ...ZodDiscriminatedUnionOption<Discriminator>[]],
  >(discriminator: Discriminator, options: Types, params?: RawCreateParams): ZodDiscriminatedUnion<Discriminator, Types> {
    const homologuedOptions = homologueOptions(discriminator, options);

    return new ZodDiscriminatedUnion<Discriminator, Types>({
      typeName: ZodDiscriminatedUnionTypeName,
      discriminator,
      options: homologuedOptions as Types,
      optionsMap: toOptionsMap(discriminator, homologuedOptions),
      ...processCreateParams(params),
    });
  }
}
const discriminatedUnionType = ZodDiscriminatedUnion.create;

export { discriminatedUnionType as discriminatedUnion };
