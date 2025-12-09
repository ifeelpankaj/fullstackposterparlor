import { HttpStatus } from '@nestjs/common';
import { ErrorResponse } from '@poster-parlor-api/shared';

export function handleGenericError(
  exception: Error | unknown,
  path: string
): ErrorResponse {
  const errorMessage =
    exception instanceof Error ? exception.message : 'Unknown error';

  return {
    success: false,
    message: 'Internal server error',
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    path,
    timestamp: new Date().toISOString(),
    error: {
      code: 'INTERNAL_ERROR',
      details:
        process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    },
  };
}
