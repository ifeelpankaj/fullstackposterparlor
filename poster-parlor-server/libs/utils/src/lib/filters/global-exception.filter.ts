import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';

import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { MongoError } from 'mongodb';
import { AppLogger } from '@poster-parlor-api/logger';
import { ErrorResponse } from '@poster-parlor-api/shared';
import { handleHttpError } from './handler/http-error.handler';
import { handleMongoError } from './handler/mongo-erro.handler';
import { handleMongooseValidationError } from './handler/validation-error.handler';
import { handleMongooseCastError } from './handler/mongocast-error.handler';
import { handleGenericError } from './handler/generic-error.handlet';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext('HTTP');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const path = req.url;

    const errorResponse = this.resolveError(exception, path);

    // Clean structured logging with simplified stack trace
    const metadata: Record<string, unknown> = {
      statusCode: errorResponse.statusCode,
      errorCode: errorResponse.error.code,
      path,
      method: req.method,
      timestamp: errorResponse.timestamp,
    };

    // Add development-only information
    if (process.env.NODE_ENV === 'development') {
      if (exception instanceof Error) {
        const stackFrames = parseStackTrace(exception, 3);
        if (stackFrames.length > 0) {
          metadata.trace = stackFrames;
        }
      }

      if (errorResponse.error.details) {
        metadata.details = errorResponse.error.details;
      }

      if (errorResponse.error.validationErrors) {
        metadata.validationErrors = errorResponse.error.validationErrors;
      }
    }

    // Log using errorWithMetadata method
    const logMessage = `${req.method} ${path} - ${errorResponse.statusCode} - ${errorResponse.message}`;

    if (exception instanceof Error) {
      this.logger.errorWithMetadata(logMessage, exception, metadata);
    } else {
      // For non-Error exceptions, create a generic Error
      this.logger.errorWithMetadata(
        logMessage,
        new Error(String(exception)),
        metadata
      );
    }

    res.status(errorResponse.statusCode).json(errorResponse);
  }

  private resolveError(exception: unknown, path: string): ErrorResponse {
    // Check HttpException first (most common)
    if (exception instanceof HttpException) {
      return handleHttpError(exception, path);
    }

    // Check Mongoose-specific errors
    if (exception instanceof MongooseError.ValidationError) {
      return handleMongooseValidationError(exception, path);
    }

    if (exception instanceof MongooseError.CastError) {
      return handleMongooseCastError(exception, path);
    }

    // Check MongoDB driver errors
    if (exception instanceof MongoError) {
      return handleMongoError(exception, path);
    }

    // Generic fallback
    return handleGenericError(exception, path);
  }
}
interface StackFrame {
  function: string;
  file: string;
  line?: number;
  column?: number;
}

export function parseStackTrace(error: Error, limit = 3): StackFrame[] {
  if (!error.stack) return [];

  const lines = error.stack.split('\n');
  const frames: StackFrame[] = [];

  // Skip the first line (error message)
  for (let i = 1; i < lines.length && frames.length < limit; i++) {
    const line = lines[i].trim();

    // Match patterns like:
    // at FunctionName (path/to/file.ts:line:column)
    // at path/to/file.ts:line:column
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);

    if (match) {
      const [, funcName, filePath, lineNum, colNum] = match;

      // Extract only the relevant part of the file path
      const cleanPath = filePath
        .split(/[/\\]/)
        .slice(-3) // Last 3 parts: folder/subfolder/file.ts
        .join('/');

      // Skip node_modules entries
      if (cleanPath.includes('node_modules')) continue;

      frames.push({
        function: funcName?.trim() || 'anonymous',
        file: cleanPath,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
      });
    }
  }

  return frames;
}
