import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  validateSync,
  ValidationError,
} from 'class-validator';
import { Logger } from '@nestjs/common';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariable {
  @IsEnum(Environment, {
    message: 'NODE_ENV must be one of: development, production, test',
  })
  @IsNotEmpty({ message: 'NODE_ENV is required' })
  NODE_ENV!: Environment;

  @IsNumber({}, { message: 'PORT must be a valid number' })
  @Min(1, { message: 'PORT must be at least 1' })
  @Max(65535, { message: 'PORT must be less than 65536' })
  @IsNotEmpty({ message: 'PORT is required' })
  PORT!: number;
}

const logger = new Logger('ConfigValidation');

function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((err) => {
      const constraints = err.constraints || {};
      const messages = Object.values(constraints);
      return `  ✗ ${err.property}: ${messages.join(', ')}`;
    })
    .join('\n');
}

export function validateEnv(config: Record<string, unknown>) {
  logger.log('Validating environment variables...');

  // Remove empty string values before validation
  const cleanedConfig = Object.entries(config).reduce((acc, [key, value]) => {
    acc[key] = value === '' ? undefined : value;
    return acc;
  }, {} as Record<string, unknown>);

  const validatedConfig = plainToInstance(EnvironmentVariable, cleanedConfig, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const formattedErrors = formatValidationErrors(errors);

    logger.error('Environment validation failed');
    logger.error(formattedErrors);

    // Clean exit without stack trace
    console.error(
      '\n✗ Please fix the above environment variables in your .env file\n'
    );
    process.exit(1);
  }

  logger.log('✓ Environment variables validated successfully');

  if (validatedConfig.NODE_ENV === 'development') {
    logger.debug(
      `Loaded config: NODE_ENV=${validatedConfig.NODE_ENV}, PORT=${validatedConfig.PORT}`
    );
  }

  return validatedConfig;
}
