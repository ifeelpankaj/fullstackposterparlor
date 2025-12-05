import { DatabaseHealthChecker } from './health-checker';
import { DatabaseHealthCheckResult } from './metrics.interface';

export class DatabaseHealthMonitor {
  private timer?: NodeJS.Timeout;
  private checker: DatabaseHealthChecker;
  private last?: DatabaseHealthCheckResult;
  private failures = 0;
  private readonly MAX = 3;

  constructor(checker: DatabaseHealthChecker) {
    this.checker = checker;
  }

  start(ms = 30000) {
    this.timer = setInterval(() => this.check(), ms);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async check() {
    const result = await this.checker.check();
    this.last = result;

    if (result.status !== 'healthy') {
      this.failures++;
    } else {
      this.failures = 0;
    }

    if (this.failures >= this.MAX) {
      result.status = 'unhealthy';
      result.errors?.push(`${this.MAX} consecutive failures`);
    }

    return result;
  }

  getLast() {
    return this.last;
  }
}
