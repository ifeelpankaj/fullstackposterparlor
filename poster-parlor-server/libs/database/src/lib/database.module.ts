import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from '@poster-parlor-api/config';
import { ConfigModule } from '@nestjs/config';
import { DatabaseHealthService } from './database-health.service';
import { Connection } from 'mongoose';
import { DatabaseHealthController } from './database-health.controller';

@Module({
  imports: [
    ConfigModule,

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (appConfigService: AppConfigService) => {
        const logger = new Logger('DatabaseModule');

        // Validate required configuration
        const dbUrl = appConfigService.appConfig.dburl;
        const dbName = appConfigService.appConfig.dbname;

        // Enhanced validation with helpful error messages
        if (!dbUrl) {
          const error =
            'DATABASE_URL (dburl) is not configured in AppConfigService';
          logger.error(error);
          logger.error(
            'Available config:',
            JSON.stringify(appConfigService.appConfig, null, 2)
          );
          throw new Error(error);
        }

        if (!dbName) {
          const error =
            'DB_NAME (dbname) is not configured in AppConfigService';
          logger.error(error);
          throw new Error(error);
        }

        logger.log(
          `Connecting to database: ${dbName} at ${dbUrl.replace(
            /\/\/.*:.*@/,
            '//***:***@'
          )}`
        ); // Mask credentials

        // Environment-specific configuration
        const isProduction = appConfigService.isProduction;
        const poolSize = 10;
        const minPoolSize = Math.floor(poolSize * 0.2);

        return {
          uri: dbUrl,
          dbName: dbName,

          // Connection timeouts - production optimized
          serverSelectionTimeoutMS: isProduction ? 30000 : 5000,
          socketTimeoutMS: 45000,
          connectTimeoutMS: 10000,
          heartbeatFrequencyMS: 10000,

          // Connection pool settings
          maxPoolSize: poolSize,
          minPoolSize: minPoolSize,
          maxIdleTimeMS: 30000,
          waitQueueTimeoutMS: 10000,

          // Retry logic for resilience
          retryAttempts: 5,
          retryDelay: 2000,

          // Production safety settings
          autoIndex: !isProduction, // Disable auto-indexing in production
          autoCreate: !isProduction, // Disable auto-collection creation in production

          // Security settings
          tls: isProduction,
          tlsAllowInvalidCertificates: false,

          // Read/Write concerns for data consistency
          readPreference: 'primaryPreferred',
          w: 'majority',
          journal: true,

          // Compression for network efficiency
          compressors: ['zlib'],
          zlibCompressionLevel: 6,

          // Connection lifecycle management
          connectionFactory: (connection: Connection) => {
            connection.on('connected', () => {
              logger.log(`MongoDB connected successfully to ${dbName}`);
              logger.log(
                `Connection state: ${connection.readyState} (1 = connected)`
              );
            });

            connection.on('reconnected', () => {
              logger.log(' MongoDB reconnected successfully');
            });

            connection.on('disconnected', () => {
              logger.warn(' MongoDB disconnected');
            });

            connection.on('error', (err) => {
              logger.error(' MongoDB connection error:', err.stack);
            });

            connection.on('close', () => {
              logger.warn(' MongoDB connection closed');
            });

            // Monitor slow queries in production
            if (isProduction) {
              const queryTimes = new Map<string, number>();

              connection.on('commandStarted', (event) => {
                if (
                  event.commandName === 'find' ||
                  event.commandName === 'aggregate' ||
                  event.commandName === 'insert' ||
                  event.commandName === 'update' ||
                  event.commandName === 'delete'
                ) {
                  queryTimes.set(event.requestId.toString(), Date.now());
                }
              });

              connection.on('commandSucceeded', (event) => {
                const requestId = event.requestId.toString();
                const startTime = queryTimes.get(requestId);

                if (startTime) {
                  const duration = Date.now() - startTime;
                  queryTimes.delete(requestId);

                  if (duration > 1000) {
                    logger.warn(
                      `Slow query detected: ${event.commandName} took ${duration}ms`,
                      `Collection: ${event.reply?.cursor?.ns || 'unknown'}`
                    );
                  }
                }
              });

              connection.on('commandFailed', (event) => {
                const requestId = event.requestId.toString();
                queryTimes.delete(requestId);
                logger.error(
                  ` Query failed: ${event.commandName}`,
                  `Reason: ${event.failure}`
                );
              });
            }

            return connection;
          },
        };
      },
      inject: [AppConfigService], // ⚠️ CRITICAL FIX: Inject AppConfigService, not ConfigService
    }),
  ],
  controllers: [DatabaseHealthController],
  providers: [DatabaseHealthService],
  exports: [MongooseModule, DatabaseHealthService],
})
export class DataAccessModule implements OnModuleInit {
  private readonly logger = new Logger(DataAccessModule.name);

  async onModuleInit() {
    this.logger.log(' Database module initialized successfully');
  }
}
