import { afterEach, expect, it, vi } from "vitest";

import { InMemorySortedQueue } from "./queue";

it("sorted", async () => {
  const items: unknown[] = [];
  const queue = new InMemorySortedQueue<unknown>();

  const stop = queue.handle((item) => {
    items.push(item.data);
  });
  afterEach(stop);

  await queue.add({
    data: "first-added",
    time: Date.now(),
  });
  await queue.add({
    data: "second-added",
    time: Date.now() - 1000,
  });

  await vi.waitFor(() => {
    expect(items).toHaveLength(2);
  });

  // The second-added item is polled first because it's older than the
  // first-added item
  expect(items).toEqual(["second-added", "first-added"]);
});

it("future", async () => {
  const items: unknown[] = [];
  const queue = new InMemorySortedQueue<unknown>();
  const stop = queue.handle((item) => {
    items.push(item.data);
  });
  afterEach(stop);

  await queue.add({
    data: "item",
    time: Date.now() + 1000,
  });

  expect(items).toHaveLength(0);
  await sleep(500);
  expect(items).toHaveLength(0);
  await sleep(1000);
  expect(items).toHaveLength(1);
  expect(items).toEqual(["item"]);
});

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
