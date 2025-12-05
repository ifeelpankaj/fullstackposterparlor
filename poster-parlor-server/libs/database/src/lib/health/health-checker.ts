import { Connection } from 'mongoose';
import {
  DatabaseHealthCheckResult,
  DatabaseHealthMetrics,
} from './metrics.interface';

export class DatabaseHealthChecker {
  constructor(private readonly connection: Connection) {}

  async check(): Promise<DatabaseHealthCheckResult> {
    const isConnected = this.connection.readyState === 1;

    let latency: number | undefined;
    let version: string | undefined;
    const errors = [];

    if (isConnected) {
      try {
        const pingStart = Date.now();
        const admin = this.connection.db.admin();

        await admin.ping();
        const info = await admin.serverInfo();

        version = info.version;
        latency = Date.now() - pingStart;
      } catch (e) {
        errors.push('Ping failed');
      }
    }

    const metrics: DatabaseHealthMetrics = {
      isConnected,
      readyState: this.connection.readyState,
      readyStateText: this.stateText(this.connection.readyState),
      host: this.connection.host,
      port: this.connection.port,
      dbName: this.connection.name,
      serverVersion: version,
      latency,
      lastChecked: new Date(),
    };

    const status = this.resolveStatus(isConnected, latency, errors);

    return { status, metrics, errors };
  }

  private resolveStatus(
    connected: boolean,
    latency?: number,
    errors?: string[]
  ) {
    if (!connected) return 'unhealthy';
    if (latency && latency > 1000) return 'degraded';
    if (errors?.length) return 'degraded';
    return 'healthy';
  }

  private stateText(code: number) {
    return {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized',
    }[code];
  }
}
