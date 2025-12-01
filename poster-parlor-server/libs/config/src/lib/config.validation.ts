import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Staging = 'staging',
}
class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @IsNumber()
  @IsNotEmpty()
  PORT!: number;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  DB_NAME!: string;

  @IsString()
  GOOGLE_CLIENT_ID!: string;

  @IsString()
  FRONTEND_URL!: string;

  @IsString()
  GOOGLE_CLIENT_SECRET!: string;

  @IsString()
  GOOGLE_CALLBACK_URL!: string;

  @IsString()
  JWT_REFRESH_TOKEN_EXPIRATION!: string;
  @IsString()
  JWT_REFRESH_TOKEN_SECRET!: string;

  @IsString()
  JWT_ACCESS_TOKEN_EXPIRATION!: string;

  @IsString()
  JWT_ACCESS_TOKEN_SECRET!: string;

  @IsString()
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  CLOUDINARY_API_KEY!: string;

  @IsString()
  CLOUDINARY_API_SECRET!: string;

  @IsString()
  RAZORPAY_API_KEY!: string;

  @IsString()
  RAZORPAY_API_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true, // ✅ converts strings to numbers
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    console.error(errors); // debug
    throw new Error(
      'Config validation error: ' +
        errors
          .map((err) => Object.values(err.constraints || {}).join(', '))
          .join('; ')
    );
  }

  return validatedConfig;
}
