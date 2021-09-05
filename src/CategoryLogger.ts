import { Logger } from 'homebridge';

export class CategoryLogger {
  private readonly category: string;

  constructor(
    private readonly logger: Logger,
    category: string,
    private readonly parentLogger: CategoryLogger | undefined = undefined,
  ) {
    if (parentLogger !== undefined) {
      this.category = `${parentLogger.category}[${category}]`;
    } else {
      this.category = `[${category}]`;
    }
  }

  info(message: string, ...args: unknown[]): void {
    this.logger.info(this.category, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(this.category, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.logger.error(this.category, message, ...args);
  }
}