import { expectTypeOf, test } from "vitest";

type Wrapper<T> = T extends { schema: infer S } ? S : never;

export function foo<const T extends readonly { schema: unknown }[]>(
  arr: T
): Wrapper<T[number]>[] {
  return arr.map((item) => item.schema) as Wrapper<T[number]>[];
}

test("infers union of schema types with literal types", () => {
  const result = foo([{ schema: 1 }, { schema: "a" }]);
  expectTypeOf(result).toEqualTypeOf<(1 | "a")[]>();
});

test("infers object and boolean schema types with literal types", () => {
  const result = foo([{ schema: { x: 42 } }, { schema: true }]);
  expectTypeOf(result).toEqualTypeOf<({ readonly x: 42 } | true)[]>();
});

test("infers single-element array with literal type", () => {
  const result = foo([{ schema: 123 }]);
  expectTypeOf(result).toEqualTypeOf<123[]>();
});

test("preserves literal tuple inference when using const assertions", () => {
  const input = [{ schema: 1 }, { schema: "a" }] as const;
  const result = foo(input);
  expectTypeOf(result).toEqualTypeOf<(1 | "a")[]>();
});
