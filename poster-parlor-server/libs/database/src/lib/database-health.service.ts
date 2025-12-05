

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

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseHealthMonitor } from './health/health-monitor';
import { DatabaseHealthChecker } from './health/health-checker';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DBhealthService implements OnModuleDestroy, OnModuleInit {
  private monitor!: DatabaseHealthMonitor;
  private checker!: DatabaseHealthChecker;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    // Fixed: was OnModuleInit (capital O)
    this.checker = new DatabaseHealthChecker(this.connection);
    this.checker = new DatabaseHealthChecker(this.connection);
    await this.waitForConnection();
    this.monitor = new DatabaseHealthMonitor(this.checker, 30000); // Fixed: pass interval to constructor
    this.monitor.start(); // Fixed: start() takes no parameters
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
}
