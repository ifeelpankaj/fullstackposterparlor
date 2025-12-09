import { HttpStatus } from '@nestjs/common';
import { ErrorResponse } from '@poster-parlor-api/shared';
import { Error as MongooseError } from 'mongoose';

export function handleMongooseValidationError(
  exception: MongooseError.ValidationError,
  path: string
): ErrorResponse {
  const validationErrors = Object.values(exception.errors).map((err) => ({
    field: err.path,
    message: err.message,
  }));

  return {
    success: false,
    message: 'Validation failed',
    statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    path,
    timestamp: new Date().toISOString(),
    error: {
      code: 'VALIDATION_ERROR',
      validationErrors,
    },
  };
}
