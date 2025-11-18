import { type QueueItem, type SortedQueue } from "../common/queue";

export class InMemorySortedQueue<T> implements SortedQueue<T> {
  // Items are sorted by time, so the next item to be processed is the first
  // item. Using an array is inefficient, but it's good enough for an
  // non-production use case. If we want better performance then maybe we can
  // use something like a min-heap
  private items: QueueItem<T>[];

  constructor() {
    this.items = [];
  }

  async add(item: QueueItem<T>): Promise<void> {
    const index = this.items.findIndex((i) => item.time < i.time);
    if (index === -1) {
      this.items = [...this.items, item];
    } else {
      this.items = [
        ...this.items.slice(0, index),
        item,
        ...this.items.slice(index),
      ];
    }
  }

  async getNext(): Promise<QueueItem<T> | undefined> {
    const next = this.items[0];
    if (next === undefined) {
      return undefined;
    }
    if (next.time > Date.now()) {
      return undefined;
    }
    this.items = this.items.slice(1);
    return next;
  }

  handle(callback: (item: QueueItem<T>) => unknown): () => void {
    const interval = setInterval(() => {
      this.getNext()
        .then((item) => {
          if (item !== undefined) {
            callback(item);
          }
        })
        .catch((error: unknown) => {
          console.error("Error processing queue item:", error);
        });
    }, 50);

    const stop = (): void => {
      clearInterval(interval);
    };
    return stop;
  }
}
