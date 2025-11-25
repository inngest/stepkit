import type pg from "pg";

import type { QueueItem, SortedQueue } from "../common/queue";

type QueueType = "event" | "exec";

export class PostgresQueue<T> implements SortedQueue<T> {
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
    }, this.pollInterval);

    const stop = (): void => {
      clearInterval(interval);
    };
    return stop;
  }

  private getTableName(): string {
    return this.queueType === "event" ? "event_queue" : "exec_queue";
  }
}
