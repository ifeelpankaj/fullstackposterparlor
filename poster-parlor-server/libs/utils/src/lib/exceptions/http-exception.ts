/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpException, HttpStatus } from '@nestjs/common';
export class CustomHttpException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    code?: string,
    details?: any
  ) {
    super(
      {
        message,
        code: code || 'INTERNAL_ERROR',
        details,
      },
      statusCode
    );
  }
}

export class BadRequestException extends CustomHttpException {
  constructor(message = 'Bad Request', details?: any) {
    super(message, HttpStatus.BAD_REQUEST, 'BAD_REQUEST', details);
  }
}
export class UnauthorizedException extends CustomHttpException {
  constructor(message = 'Unauthorized', details?: any) {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', details);
  }
}
export class ForbiddenException extends CustomHttpException {
  constructor(message = 'Forbidden', details?: any) {
    super(message, HttpStatus.FORBIDDEN, 'FORBIDDEN', details);
  }
}
export class NotFoundException extends CustomHttpException {
  constructor(message = 'Resource not found', details?: any) {
    super(message, HttpStatus.NOT_FOUND, 'NOT_FOUND', details);
  }
}
export class ConflictException extends CustomHttpException {
  constructor(message = 'Conflict', details?: any) {
    super(message, HttpStatus.CONFLICT, 'CONFLICT', details);
  }
}

export class ValidationException extends CustomHttpException {
  constructor(message = 'Validation failed', validationErrors?: any[]) {
    super(
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      'VALIDATION_ERROR',
      validationErrors
    );
  }
}
