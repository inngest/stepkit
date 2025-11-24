import type pg from "pg";

import type { QueueItem, SortedQueue } from "../common/queue";

type QueueType = "event" | "exec";

export class PostgresQueue<T> implements SortedQueue<T> {
  private stopHandler: (() => void) | null = null;
  private pollInterval: number;

  constructor(
    private pool: pg.Pool,
    private queueType: QueueType,
    options: { pollInterval?: number } = {}
  ) {
    this.pollInterval = options.pollInterval ?? 100;
  }

  async add(item: QueueItem<T>): Promise<void> {
    const tableName = this.getTableName();
    await this.pool.query(
      `INSERT INTO ${tableName} (time, data) VALUES ($1, $2)`,
      [item.time, JSON.stringify(item.data)]
    );
  }

  async getNext(): Promise<QueueItem<T> | undefined> {
    const tableName = this.getTableName();
    const client = await this.pool.connect();

    try {
      // Use FOR UPDATE SKIP LOCKED for atomic dequeue
      const result = await client.query<{
        id: number;
        time: string;
        data: T;
      }>(
        `
        DELETE FROM ${tableName}
        WHERE id = (
          SELECT id
          FROM ${tableName}
          WHERE time <= $1
          ORDER BY time, id
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, time, data
      `,
        [Date.now()]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      if (row === undefined) {
        return undefined;
      }
      return {
        time: parseInt(row.time, 10),
        data: row.data,
      };
    } finally {
      client.release();
    }
  }

  handle(callback: (item: QueueItem<T>) => unknown): () => void {
    let currentInterval = this.pollInterval;
    let timeoutId: NodeJS.Timeout | null = null;

    const poll = async (): Promise<void> => {
      try {
        const item = await this.getNext();
        if (item !== undefined) {
          // Reset interval on successful dequeue
          currentInterval = this.pollInterval;
          await callback(item);
        } else {
          // Exponential backoff when queue is empty
          currentInterval = Math.min(currentInterval * 1.5, 1000);
        }
      } catch (error) {
        console.error(`Error processing ${this.queueType} queue item:`, error);
      } finally {
        if (this.stopHandler !== null) {
          timeoutId = setTimeout(() => void poll(), currentInterval);
        }
      }
    };

    // Start polling
    void poll();

    const stop = (): void => {
      this.stopHandler = null;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    this.stopHandler = stop;
    return stop;
  }

  private getTableName(): string {
    return this.queueType === "event" ? "event_queue" : "exec_queue";
  }
}
