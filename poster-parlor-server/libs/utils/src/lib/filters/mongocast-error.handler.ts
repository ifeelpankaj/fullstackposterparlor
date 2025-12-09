import { HttpStatus } from '@nestjs/common';
import { ErrorResponse } from '@poster-parlor-api/shared';
import { Error as MongooseError } from 'mongoose';

export function handleMongooseCastError(
  exception: MongooseError.CastError,
  path: string
): ErrorResponse {
  return {
    success: false,
    message: `Invalid ${exception.path}: ${exception.value}`,
    statusCode: HttpStatus.BAD_REQUEST,
    path,
    timestamp: new Date().toISOString(),
    error: {
      code: 'INVALID_ID',
      details: {
        field: exception.path,
        value: exception.value,
      },
    },
  };
}
