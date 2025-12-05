import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from '@poster-parlor-api/config';
import { ConfigModule } from '@nestjs/config';

import { buildMongoConfig } from './database.config';
import { setupMongoConnection } from './database.connection';
import { DatabaseHealthService } from './database-health.service';
import { DatabaseHealthController } from './database-health.controller';
import { Connection } from 'mongoose';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: async (appConfigService: AppConfigService) => {
        return {
          ...buildMongoConfig(appConfigService),
          connectionFactory: (connection: Connection) =>
            setupMongoConnection(
              connection,
              appConfigService.appConfig.dbname,
              appConfigService.isProduction
            ),
        };
      },
    }),
  ],
  controllers: [DatabaseHealthController],
  providers: [DatabaseHealthService],
  exports: [MongooseModule, DatabaseHealthService],
})
export class DataAccessModule implements OnModuleInit {
  private readonly logger = new Logger(DataAccessModule.name);

  async onModuleInit() {
    this.logger.log('Database module initialized');
  }
}
