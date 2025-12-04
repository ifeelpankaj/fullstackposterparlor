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

// Update AppConfigModule
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      cache: true,
      expandVariables: true,
      validate: validateEnv,
    }),
  ],
  providers: [ConfigService, TypedConfigService],
  exports: [ConfigService, TypedConfigService],
})
export class AppConfigModule {}

