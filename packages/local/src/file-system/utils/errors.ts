export class UnreachableError extends Error {
  constructor(message: string) {
    super(`unreachable: ${message}`);
    this.name = this.constructor.name;
  }
}
