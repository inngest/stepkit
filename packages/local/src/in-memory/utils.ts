export class UnreachableError extends Error {
  constructor(message: string) {
    super(`unreachable: ${message}`);
    this.name = this.constructor.name;
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
