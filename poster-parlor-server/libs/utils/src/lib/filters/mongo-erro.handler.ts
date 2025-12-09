import { HttpStatus } from '@nestjs/common';
import { ErrorResponse } from '@poster-parlor-api/shared';
import { MongoError } from 'mongodb';

export function handleMongoError(
  exception: MongoError,
  path: string
): ErrorResponse {
  const isDuplicate = exception.code === 11000;

  // MongoError with code 11000 has keyPattern property
  const keyPattern = (
    exception as MongoError & { keyPattern?: Record<string, number> }
  ).keyPattern;

  return {
    success: false,
    message: isDuplicate ? 'Resource already exists' : 'Database Error',
    statusCode: isDuplicate
      ? HttpStatus.CONFLICT
      : HttpStatus.INTERNAL_SERVER_ERROR,
    path,
    timestamp: new Date().toISOString(),
    error: {
      code: isDuplicate ? 'DUPLICATE_KEY' : 'DATABASE_ERROR',
      ...(isDuplicate &&
        keyPattern && {
          details: {
            field: Object.keys(keyPattern)[0],
          },
        }),
    },
  };
}
