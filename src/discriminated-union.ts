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
  ZodDefault,
  ZodEffects,
  ZodEnum,
  ZodErrorMap,
  ZodIssueCode,
  ZodLazy,
  ZodLiteral,
  ZodNativeEnum,
  ZodNull,
  ZodObject,
  ZodOptional,
  ZodParsedType,
  ZodRawShape,
  ZodType,
  ZodTypeAny,
  ZodTypeDef,
  ZodUndefined,
} from 'zod';

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
  | ZodDiscriminatedUnion<string, ZodDiscriminatedUnionOption<string>[]>;

export interface ZodDiscriminatedUnionDef<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<string>[] = ZodDiscriminatedUnionOption<string>[],
> extends ZodTypeDef {
  discriminator: Discriminator;
  options: Options;
  optionsMap: Map<Primitive, ZodDiscriminatedUnionOption<Discriminator>>;
  typeName: ZodDiscriminatedUnionTypeName;
}

export class ZodDiscriminatedUnion<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<string>[],
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
        discriminatorValues.map(el => valueSet.add(el));
      } else if (type instanceof ZodDiscriminatedUnion) {
        const values = type._enforceParentDiscriminator(discriminator);
        if (values.length < 1) {
          throw new Error(
            `No value for key \`${discriminator}\` was found for DiscriminatedUnion with discriminator \`${type.discriminator}\``,
          );
        }
        values.map(el => valueSet.add(el));
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
    // compact DU tree by "flattening" child DUs with same discriminator
    const homologueAssertion = (option: Types[number]) =>
      option instanceof ZodDiscriminatedUnion && option.discriminator === discriminator;

    const duHomologues = options.filter(homologueAssertion) as ZodDiscriminatedUnion<Discriminator, Types>[];

    const nonDuHomologues = options.filter(option => !homologueAssertion(option));

    const availableOptions = [...duHomologues.flatMap(du => du.options), ...nonDuHomologues] as Types;

    const optionsMap: Map<Primitive, Types[number]> = new Map();

    const addUniqueDiscriminatorValues = (values: Primitive[], type: Types[number]) => {
      for (const value of values) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property \`${discriminator}\` has duplicate value \`${String(value)}\``);
        }

        optionsMap.set(value, type);
      }
    };

    for (const type of availableOptions) {
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

    return new ZodDiscriminatedUnion<Discriminator, Types>({
      typeName: ZodDiscriminatedUnionTypeName,
      discriminator,
      options: availableOptions,
      optionsMap,
      ...processCreateParams(params),
    });
  }
}
const discriminatedUnionType = ZodDiscriminatedUnion.create;

export { discriminatedUnionType as discriminatedUnion };
