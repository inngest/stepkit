// TODO
export type Context = any;

export interface StepOptions {
  /**
   * The ID to use to memoize the result of this step, ensuring it is run only
   * once. Changing this ID in an existing function will cause the step to be
   * run again for in-progress runs; it is recommended to use a stable ID.
   */
  id: string;

  /**
   * The display name to use for this step in the Inngest UI. This can be
   * changed at any time without affecting the step's behaviour.
   */
  name?: string;
}

export type Op = {
  /**
   * The unique code for this operation.
   */
  // TODO
  op: string;

  /**
   * Any additional data required for this operation to send to Inngest. This
   * is not compared when confirming that the operation was completed; use `id`
   * for this.
   */
  opts?: Record<string, unknown>;

  /**
   * Any data present for this operation. If data is present, this operation is
   * treated as completed.
   */
  data?: unknown;

  /**
   * An error present for this operation. If an error is present, this operation
   * is treated as completed, but failed. When this is read from the op stack,
   * the SDK will throw the error via a promise rejection when it is read.
   *
   * This allows users to handle step failures using common tools such as
   * try/catch or `.catch()`.
   */
  error?: unknown;
};

export type HashedOp = Op & {
  /**
   * The hashed identifier for this operation, used to confirm that the
   * operation was completed when it is received from Inngest.
   */
  id: string;
};

export type OutgoingOp = Pick<
  HashedOp,
  "id" | "op" | "opts" | "data" | "error"
>;
