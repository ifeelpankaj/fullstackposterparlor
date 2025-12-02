/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MongoError, MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';
import { AppLogger } from '@poster-parler/logger';

export interface ErrorResponse {
  success: boolean;
  message: string;
  error: {
    code: string;
    details?: any;
    validationErrors?: ValidationError[];
  };
  statusCode: number;
  timestamp: string;
  path: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext('HTTP');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { method, url, ip, headers } = request;
    const user = (request as any).user;

    let errorResponse: ErrorResponse;

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      errorResponse = this.handleHttpException(exception, url);
    } else if (this.isMongoError(exception)) {
      errorResponse = this.handleMongoError(exception as any, url);
    } else if (exception instanceof MongooseError.ValidationError) {
      errorResponse = this.handleMongooseValidationError(exception, url);
    } else if (exception instanceof MongooseError.CastError) {
      errorResponse = this.handleMongoCastError(exception, url);
    } else {
      errorResponse = this.handleGenericError(exception, url);
    }

    // Add request ID header if present
    const requestId = (request as any).id;
    if (requestId) {
      response.setHeader('X-Request-ID', requestId);
    }

    // Log error with proper context
    this.logError(exception, errorResponse, {
      method,
      url,
      userId: user?.id || user?.sub,
      ip: (headers['x-forwarded-for'] as string) || ip,
      userAgent: headers['user-agent'] || 'unknown',
      requestId,
    });

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private isMongoError(exception: unknown): boolean {
    return (
      exception instanceof MongoError ||
      exception instanceof MongoServerError ||
      (exception as any)?.name === 'MongoServerError' ||
      (exception as any)?.name === 'MongoError' ||
      typeof (exception as any)?.code === 'number'
    );
  }

  private handleHttpException(
    exception: HttpException,
    path: string
  ): ErrorResponse {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = 'An error occurred';
    let validationErrors: ValidationError[] = [];
    let details: any = undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const response = exceptionResponse as any;
      message = response.message || response.error || message;

      if (response.message && Array.isArray(response.message)) {
        validationErrors = response.message.map((msg: string) => ({
          field: this.extractFieldFromMessage(msg),
          message: msg,
        }));
        message = 'Validation failed';
      }

      details = response.details;
    }

    return {
      success: false,
      message,
      error: {
        code: this.getErrorCode(status),
        ...(details && { details }),
        ...(validationErrors.length > 0 && { validationErrors }),
      },
      statusCode: status,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private handleMongoError(exception: any, path: string): ErrorResponse {
    let message = 'Database error occurred';
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let details: any = undefined;

    if (exception.code === 11000) {
      message = 'Resource already exists';
      statusCode = HttpStatus.CONFLICT;

      const field = this.extractDuplicateField(exception);
      details = {
        field,
        message: `${field} already exists`,
      };
    }

    return {
      success: false,
      message,
      error: {
        code: exception.code === 11000 ? 'DUPLICATE_KEY' : 'DATABASE_ERROR',
        details:
          process.env['NODE_ENV'] === 'development'
            ? details || exception.message
            : details,
      },
      statusCode,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private extractDuplicateField(exception: any): string {
    try {
      if (exception.keyPattern) {
        return Object.keys(exception.keyPattern)[0];
      }

      const match = exception.message?.match(/index: (\w+)_\d+/);
      if (match) return match[1];

      const dupKeyMatch = exception.message?.match(/dup key: \{ (\w+):/);
      if (dupKeyMatch) return dupKeyMatch[1];
    } catch (e) {
      // Silent fail
      void e;
    }

    return 'field';
  }

  private handleMongooseValidationError(
    exception: MongooseError.ValidationError,
    path: string
  ): ErrorResponse {
    const validationErrors: ValidationError[] = Object.values(
      exception.errors
    ).map((error) => ({
      field: error.path,
      message: error.message,
    }));

    return {
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        validationErrors,
      },
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private handleMongoCastError(
    exception: MongooseError.CastError,
    path: string
  ): ErrorResponse {
    return {
      success: false,
      message: `Invalid ${exception.path}: ${exception.value}`,
      error: {
        code: 'INVALID_ID',
        details: {
          field: exception.path,
          value: exception.value,
        },
      },
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private handleGenericError(exception: unknown, path: string): ErrorResponse {
    const message =
      exception instanceof Error ? exception.message : 'Internal server error';

    return {
      success: false,
      message: 'Internal server error',
      error: {
        code: 'INTERNAL_ERROR',
        details:
          process.env['NODE_ENV'] === 'development' ? message : undefined,
      },
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private getErrorCode(status: HttpStatus): string {
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
    };
    return codes[status] || 'UNKNOWN_ERROR';
  }

  private extractFieldFromMessage(message: string): string {
    const words = message.split(' ');
    return words[0] || 'unknown';
  }

  private logError(
    exception: unknown,
    errorResponse: ErrorResponse,
    metadata: Record<string, any>
  ) {
    const { statusCode, error, message } = errorResponse;
    const { method, url, userId, ip, userAgent, requestId } = metadata;

    // Build log message (like Go's format)
    const logMessage = `✗ ${method} ${url} ${statusCode} - ${message}`;

    const logMetadata = {
      statusCode,
      errorCode: error.code,
      method,
      url,
      userId,
      ip,
      userAgent,
      ...(requestId && { requestId }),
      ...(error.validationErrors && {
        validationErrors: error.validationErrors,
      }),
    };

    // Log based on severity (like Go)
    if (statusCode >= 500) {
      this.logger.errorWithMetadata(
        logMessage,
        exception as Error,
        logMetadata
      );
    } else {
      // Other informational logs
      this.logger.logWithMetadata(logMessage, logMetadata);
    }
  }
}
