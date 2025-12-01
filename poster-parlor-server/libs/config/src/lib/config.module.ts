import { Module } from '@nestjs/common';
import * as path from 'path';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config.validation';
import { configValidationSchema } from './config.schema';

const env = process.env['NODE_ENV'] || 'development';
const envFilePath = path.resolve(
  process.cwd(),
  'libs/config/src/lib/env',
  `${env}.env`
);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validationSchema: configValidationSchema,
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
