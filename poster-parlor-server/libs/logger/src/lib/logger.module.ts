import { Module, Global, DynamicModule } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LoggerConfig } from './logger.config';

export interface LoggerModuleOptions {
  serviceName?: string;
  logsDir?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableConsole?: boolean;
  enableSensitiveDataMasking?: boolean;
}

@Global()
@Module({})
export class LoggerModule {
  static forRoot(options?: LoggerModuleOptions): DynamicModule {
    const config = new LoggerConfig(options);

    return {
      module: LoggerModule,
      providers: [
        {
          provide: 'LOGGER_CONFIG',
          useValue: config,
        },
        LoggerService,
      ],
      exports: [LoggerService],
    };
  }
}
