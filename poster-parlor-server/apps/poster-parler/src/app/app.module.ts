import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataAccessModule } from '@poster-parler/database';
import { AuthModule } from '@poster-parler/auth';
import { ConfigModule } from '@nestjs/config';
import { InventoryModule } from '@poster-parler/inventory';
import { ReviewModule } from '@poster-parler/review';
import { LoggerModule } from '@poster-parler/logger';
import { OrdersModule } from '@poster-parler/orders';
@Module({
  imports: [
    LoggerModule.forRoot({
      serviceName: 'poster-parler-api',
      enableSensitiveDataMasking: true,
      logsDir: 'logs',
      maxFileSize: 10485760, // 10MB
      maxFiles: 10,
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    DataAccessModule,
    AuthModule,
    InventoryModule,
    ReviewModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
