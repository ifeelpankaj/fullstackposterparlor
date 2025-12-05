import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface DatabaseHealthMetrics {
  isConnected: boolean;
  readyState: number;
  readyStateText: string;
  host: string;
  port: number;
  dbName: string;
  serverVersion?: string;
  connectionPoolStats?: {
    current: number;
    available: number;
    pending: number;
  };
  latency?: number;
  lastChecked: Date;
}

export interface DatabaseHealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: DatabaseHealthMetrics;
  errors?: string[];
}

@Injectable()
export class DatabaseHealthService implements OnModuleInit, OnModuleDestroy {
  // Replace NestJS Logger with your custom logger
  private readonly logger = new Logger('DatabaseHealthService');

  private healthCheckInterval?: NodeJS.Timeout;
  private lastHealthCheck?: DatabaseHealthCheckResult;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  constructor(
    @InjectConnection() private readonly connection: Connection // Inject your custom logger here // private readonly customLogger: CustomLogger,
  ) {}

  async onModuleInit() {
    this.logger.log?.('Initializing Database Health Service');
    await this.waitForDatabaseConnection();
    this.startHealthCheckMonitoring();
  }

  async onModuleDestroy() {
    this.logger.log?.('Shutting down Database Health Service');
    this.stopHealthCheckMonitoring();
    await this.gracefulShutdown();
  }

  private waitForDatabaseConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const error = new Error('Database connection timeout after 30 seconds');
        this.logger.error?.('Database connection timeout', error.stack);
        reject(error);
      }, 30000);

      if (this.connection.readyState === 1) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      const cleanup = () => {
        clearTimeout(timeout);
        this.connection.off('connected', onConnected);
        this.connection.off('error', onError);
      };

      const onConnected = () => {
        cleanup();
        this.logger.log?.('Database connected successfully');
        this.consecutiveFailures = 0;
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        this.consecutiveFailures++;
        this.logger.error?.(
          `Database connection failed (attempt ${this.consecutiveFailures}): ${error.message}`,
          error.stack
        );
        reject(error);
      };

      this.connection.on('connected', onConnected);
      this.connection.on('error', onError);
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.getDetailedHealth();
      return result.status === 'healthy';
    } catch (error) {
      this.logger.error?.('Health check failed', error);
      return false;
    }
  }

  async getDetailedHealth(): Promise<DatabaseHealthCheckResult> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';

    try {
      const isConnected = this.connection.readyState === 1;

      if (!isConnected) {
        errors.push('Database is not connected');
        this.consecutiveFailures++;
      } else {
        this.consecutiveFailures = 0;
      }

      // Perform ping test to measure latency
      let latency: number | undefined;
      let serverVersion: string | undefined;

      if (isConnected) {
        try {
          const db = this.connection.db;
          if (!db || typeof db.admin !== 'function') {
            errors.push('Database driver admin API not available');
            status = 'degraded';
          } else {
            const pingStart = Date.now();
            const adminDb = db.admin();
            await adminDb.ping();
            latency = Date.now() - pingStart;

            // Get server info
            const serverInfo = await adminDb.serverInfo();
            serverVersion = serverInfo['version'];

            if (latency > 1000) {
              errors.push(`High latency detected: ${latency}ms`);
              status = 'degraded';
            } else {
              status = 'healthy';
            }
          }
        } catch (error) {
          errors.push(`Ping test failed: ${(error as Error).message}`);
          status = 'degraded';
        }
      }

      const metrics: DatabaseHealthMetrics = {
        isConnected,
        readyState: this.connection.readyState,
        readyStateText: this.getReadyStateText(this.connection.readyState),
        host: this.connection.host || 'unknown',
        port: this.connection.port || 0,
        dbName: this.connection.name || 'unknown',
        serverVersion,
        // connectionPoolStats,
        latency,
        lastChecked: new Date(),
      };

      // Check consecutive failures
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        status = 'unhealthy';
        errors.push(
          `${this.consecutiveFailures} consecutive health check failures`
        );
      }

      const result: DatabaseHealthCheckResult = {
        status,
        metrics,
        ...(errors.length > 0 && { errors }),
      };

      this.lastHealthCheck = result;

      // Log health status changes
      if (status !== 'healthy') {
        this.logger.warn?.(
          `Database health check: ${status.toUpperCase()}`,
          JSON.stringify({ metrics, errors })
        );
      }

      return result;
    } catch (error) {
      this.consecutiveFailures++;
      this.logger.error?.(
        'Failed to perform health check',
        (error as Error).stack
      );

      return {
        status: 'unhealthy',
        metrics: {
          isConnected: false,
          readyState: this.connection.readyState,
          readyStateText: this.getReadyStateText(this.connection.readyState),
          host: 'unknown',
          port: 0,
          dbName: 'unknown',
          lastChecked: new Date(),
        },
        errors: [
          `Health check exception: ${(error as Error).message}`,
          ...errors,
        ],
      };
    }
  }

  getLastHealthCheck(): DatabaseHealthCheckResult | undefined {
    return this.lastHealthCheck;
  }

  private startHealthCheckMonitoring(intervalMs = 30000) {
    this.healthCheckInterval = setInterval(async () => {
      await this.getDetailedHealth();
    }, intervalMs);

    this.logger.log?.(
      `Health check monitoring started (interval: ${intervalMs}ms)`
    );
  }

  private stopHealthCheckMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      this.logger.log?.('Health check monitoring stopped');
    }
  }

  private async gracefulShutdown(): Promise<void> {
    try {
      if (this.connection.readyState === 1) {
        await this.connection.close();
        this.logger.log?.('Database connection closed gracefully');
      }
    } catch (error) {
      this.logger.error?.(
        'Error during graceful shutdown',
        (error as Error).stack
      );
    }
  }

  private getReadyStateText(state: number): string {
    const states: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized',
    };
    return states[state] ?? 'unknown';
  }

  // Utility method for health check endpoints
  async getHealthCheckResponse(): Promise<{
    status: number;
    body: {
      status: string;
      database: DatabaseHealthCheckResult;
      timestamp: string;
    };
  }> {
    const health = await this.getDetailedHealth();

    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
        ? 200 // Still operational
        : 503; // Unhealthy - service unavailable

    return {
      status: statusCode,
      body: {
        status: health.status,
        database: health,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
