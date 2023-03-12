[![codecov](https://codecov.io/gh/teunmooij/jest-nest/branch/main/graph/badge.svg?token=RD1WJQ36WN)](https://codecov.io/gh/teunmooij/jest-nest)
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

A discriminated union is a union of object schemas that all share a particular key.

```ts
type MyUnion = { status: 'success'; data: string } | { status: 'failed'; error: Error };
```

Such unions can be represented with the `z.discriminatedUnion` method. This enables faster evaluation, because Zod can check the _discriminator key_ (`status` in the example above) to determine which schema should be used to parse the input. This makes parsing more efficient and lets Zod report friendlier errors.

With the basic union method, the input is tested against each of the provided "options", and in the case of invalidity, issues for all the "options" are shown in the zod error. On the other hand, the discriminated union allows for selecting just one of the "options", testing against it, and showing only the issues related to this "option".

```ts
const myUnion = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), data: z.string() }),
  z.object({ status: z.literal('failed'), error: z.instanceof(Error) }),
]);

myUnion.parse({ status: 'success', data: 'yippie ki yay' });
```

## Version history

### 0.1.0

- DiscriminatedUnion as option for a discriminatedUnion

### 0.0.1

- Baseline, similar to `z.discriminatedUnion` in [Zod](https://zod.dev) version 3.21.4
