import { HttpException } from '@nestjs/common';
import { ErrorResponse } from '@poster-parlor-api/shared';

interface HttpExceptionResponse {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

export function handleHttpError(
  exception: HttpException,
  path: string
): ErrorResponse {
  const statusCode = exception.getStatus();
  const response = exception.getResponse() as HttpExceptionResponse;

  const isValidationError = Array.isArray(response.message);

  return {
    success: false,
    message: isValidationError
      ? 'Validation failed'
      : typeof response.message === 'string'
      ? response.message
      : 'Bad Request',
    statusCode,
    path,
    timestamp: new Date().toISOString(),
    error: {
      code: response.error || 'HTTP_EXCEPTION',
      ...(isValidationError && {
        validationErrors: (response.message as string[]).map((msg: string) => ({
          field: msg.split(' ')[0],
          message: msg,
        })),
      }),
    },
  };
}
