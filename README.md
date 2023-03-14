[![codecov](https://codecov.io/gh/teunmooij/zod-discriminated-union/branch/main/graph/badge.svg?token=trryg8OpjZ)](https://codecov.io/gh/teunmooij/zod-discriminated-union)
[![snyk](https://snyk.io/test/github/teunmooij/zod.discriminatedunion/badge.svg)](https://snyk.io/test/github/teunmooij/zod.discriminatedunion)
[![npm version](https://badge.fury.io/js/zod.discriminatedunion.svg)](https://badge.fury.io/js/zod.discriminatedunion)

# zod.discriminatedunion

[Zod](https://zod.dev) DiscriminatedUnion type.

Zod plans to deprecate the very useful `DiscriminatedUnion` type and will not continue improving it with some much-needed enhancements. We will.

## Installation

```shell
$ npm install zod.discriminatedunion
```

`zod.discriminatedunion` requires `zod` as a peer dependency.

```shell
$ npm install zod
```

## Usage

A discriminated union is a union of object schemas and or other discriminated union schemas that all share a particular key.

```ts
type MyUnion =
  | { status: "success"; data: string }
  | { status: "failed"; error: Error };
```

Such unions can be represented with the `z.discriminatedUnion` method. This enables faster evaluation, because the _discriminator key_ (`status` in the example above) can be checked to determine which schema should be used to parse the input. This makes parsing more efficient and lets Zod report friendlier errors.

With the basic union method the input is tested against each of the provided "options", and in the case of invalidity, issues for all the "options" are shown in the zod error. On the other hand, the discriminated union allows for selecting just one of the "options", testing against it, and showing only the issues related to this "option".

```ts
const myUnion = y.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.string() }),
  z.object({ status: z.literal("failed"), error: z.instanceof(Error) }),
]);

myUnion.parse({ status: "success", data: "yippie ki yay" });
```

### `.strict/.strip/.passthrough/.catchall/.pick/.omit/.deepPartial/.partial/.required`

These methods apply schema alterations to all the "options", similar to the methods on the [Objects](https://github.com/colinhacks/zod#objects) schema, but they do not effect the _discriminator_.

```ts
const myUnion = y.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.string() }),
  z.object({ status: z.literal("failed"), error: z.instanceof(Error) }),
]);

const strictSchema = myUnion.strict();
const stripSchema = myUnion.strip();
const pasthroughSchema = myUnion.pasthrough();
const catchallSchema = myUnion.catchall(z.number());

const pickSchema = myUnion.pick({ data: true }); // discriminator is allways picked
const omitSchema = myUnion.omit({ error: true }); // discriminator cannot be omitted

const deepPartialSchema = myUnion.deepPartial(); // discriminator is still required

const partialSchema = myUnion.partial();  // discriminator is still required
const partialWithMaskSchema = myUnion.partial({ error: true }); // discriminator cannot be made optional

const requiredSchema = myUnion.required();
const requiredWithMaskSchema = myUnion.required({ data: true });
```

## Version history

### 1.0.0
- Object schema functions

### 0.1.0

- DiscriminatedUnion as option for a discriminatedUnion

### 0.0.1

- Baseline, similar to `z.discriminatedUnion` in [Zod](https://zod.dev) version 3.21.4
