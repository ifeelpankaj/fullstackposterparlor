// libs/config/src/lib/typed-config.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// libs/config/src/lib/config.interface.ts
export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
}
@Injectable()
export class TypedConfigService {
  constructor(private readonly configService: ConfigService) {}

  get appConfig(): AppConfig {
    return {
      nodeEnv: this.configService.getOrThrow<
        'development' | 'production' | 'test'
      >('NODE_ENV'),
      port: this.configService.getOrThrow<number>('PORT'),
    };
  }

  get isDevelopment(): boolean {
    return this.appConfig.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.appConfig.nodeEnv === 'production';
  }
}
