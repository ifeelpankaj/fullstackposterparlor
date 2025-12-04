/* eslint-disable @typescript-eslint/no-explicit-any */
import { Module } from '@nestjs/common';
import * as path from 'path';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config.validation';

const env = process.env['NODE_ENV'] || 'development';

const envFilePath = path.resolve(
  process.cwd(),
  'libs/config/src/env',
  `${env}.env`
);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validate: (config: Record<string, any>) => {
        validateEnv(config as Record<string, unknown>);
        return config;
      },
    }),
  ],
})
export class AppConfigModule {}
