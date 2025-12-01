import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { config_keys } from '@poster-parler/config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseHealthService } from './database-health.service';
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>(config_keys.DATABASE_URL),
        dbName: configService.get<string>(config_keys.DB_NAME),
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [],
  providers: [DatabaseHealthService],
  exports: [MongooseModule, DatabaseHealthService],
})
export class DataAccessModule {}
