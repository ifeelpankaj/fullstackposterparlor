

export interface DatabaseHealthMetrics {
  isConnected: boolean;
  readyState: number;
  readyStateText: string;
  host: string;
  port: number;
  dbName: string;
  serverVersion?: string;
  latency?: number;
  lastChecked: Date;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DatabaseHealthCheckResult {
  status: HealthStatus;
  metrics: DatabaseHealthMetrics;
  errors?: string[];
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { DatabaseHealthChecker } from './health-checker';
import { DatabaseHealthMonitor } from './health-monitor';

@Injectable()
export class DatabaseHealthService
  implements OnModuleInit, OnModuleDestroy
{
  private monitor: DatabaseHealthMonitor;
  private checker: DatabaseHealthChecker;

  constructor(
    @InjectConnection() private readonly connection: Connection
  ) {}

  async onModuleInit() {
    this.checker = new DatabaseHealthChecker(this.connection);
    this.monitor = new DatabaseHealthMonitor(this.checker);

    await this.waitForConnection();
    this.monitor.start(30000);
  }

  async onModuleDestroy() {
    this.monitor.stop();
    await this.connection.close();
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connection.readyState === 1) return resolve();
      this.connection.once('connected', () => resolve());
    });
  }

  async getHealth() {
    return this.monitor.getLast() ?? (await this.checker.check());
  }
}
