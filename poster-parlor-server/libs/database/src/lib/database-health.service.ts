import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DatabaseHealthService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseHealthService.name);

  constructor(@InjectConnection() private connection: Connection) {}

  async onModuleInit() {
    await this.waitForDatabaseConnection();
  }

  private waitForDatabaseConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Database connection timeout after 30 seconds'));
      }, 30000);

      if (this.connection.readyState === 1) {
        clearTimeout(timeout);
        this.logger.log('Database already connected');
        resolve();
        return;
      }

      const checkConnection = () => {
        if (this.connection.readyState === 1) {
          clearTimeout(timeout);
          this.connection.off('connected', checkConnection);
          this.connection.off('error', onError);
          this.logger.log('Database connected successfully');
          resolve();
        }
      };

      const onError = (error: Error) => {
        clearTimeout(timeout);
        this.connection.off('connected', checkConnection);
        this.connection.off('error', onError);
        this.logger.error('Database connection failed:', error.message);
        reject(error);
      };

      this.connection.on('connected', checkConnection);
      this.connection.on('error', onError);
    });
  }

  async checkHealth(): Promise<boolean> {
    return this.connection.readyState === 1;
  }
}
