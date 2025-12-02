import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app/app.module';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { config_keys } from '@poster-parler/config';
import { DatabaseHealthService } from '@poster-parler/database';
import {
  GlobalExceptionFilter,
  ResponseInterceptor,
} from '@poster-parler/utils';
import { JwtAuthGuard } from '@poster-parler/auth';
import { AppLogger } from '@poster-parler/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until logger is ready
  });
  // Get the logger instance and use it globally
  const logger = app.get(AppLogger);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  const globalPrefix = 'api/v1';
  const config = app.get(ConfigService);

  // Middleware
  app.use(cookieParser());

  app.enableCors({
    origin: config.get(config_keys.CORS_ORIGIN),
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // // Global filters and interceptors (inject logger)
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new ResponseInterceptor(logger));

  // Global guards
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // // Database health check
  const db = app.get(DatabaseHealthService);
  await db.onModuleInit();

  logger.log('Database connection established', 'Bootstrap');

  app.setGlobalPrefix(globalPrefix);

  const port = config.get(config_keys.PORT) || 3000;

  await app.listen(port);

  logger.log(
    `Application is running on: http://localhost:${port}/${globalPrefix} {Environment: ${
      process.env['NODE_ENV'] || 'development'
    }}`,
    'Bootstrap'
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.log(
      `Received ${signal}, closing application gracefully...`,
      'Bootstrap'
    );

    await app.close();

    logger.log('Application closed successfully', 'Bootstrap');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
