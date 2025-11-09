export type QueueItem<T> = {
  data: T;
  time: Date;
};

export class SortedQueue<T> {
  // Items are sorted by time, so the next item to be processed is the first
  // item. Using an array is inefficient, but it's good enough for an
  // non-production use case. If we want better performance then maybe we can
  // use something like a min-heap
  private items: QueueItem<T>[] = [];

  add(item: QueueItem<T>): void {
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

  getNext(): QueueItem<T> | undefined {
    const next = this.items[0];
    if (next === undefined) {
      return undefined;
    }
    if (next.time > new Date()) {
      return undefined;
    }
    this.items = this.items.slice(1);
    return next;
  }

  handle(callback: (item: QueueItem<T>) => unknown): () => void {
    const interval = setInterval(() => {
      const item = this.getNext();
      if (item === undefined) {
        return;
      }
      callback(item);
    }, 50);

    const stop = (): void => {
      clearInterval(interval);
    };
    return stop;
  }
}
