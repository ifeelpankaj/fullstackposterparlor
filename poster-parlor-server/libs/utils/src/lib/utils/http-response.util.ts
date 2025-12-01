/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@poster-parler/common';

export class HttpResponseUtil {
  private static createResponse<T>(
    success: boolean,
    message: string,
    statusCode: HttpStatus,
    data?: T,
    error?: any,
    path?: string
  ): ApiResponse<T> {
    return {
      success,
      message,
      data,
      error,
      statusCode,
      timestamp: new Date().toISOString(),
      path: path || '',
    };
  }

  // Success responses
  static success<T>(
    data: T,
    message = 'Success',
    path?: string
  ): ApiResponse<T> {
    return this.createResponse(
      true,
      message,
      HttpStatus.OK,
      data,
      undefined,
      path
    );
  }

  static created<T>(
    data: T,
    message = 'Resource created successfully',
    path?: string
  ): ApiResponse<T> {
    return this.createResponse(
      true,
      message,
      HttpStatus.CREATED,
      data,
      undefined,
      path
    );
  }

  static updated<T>(
    data: T,
    message = 'Resource updated successfully',
    path?: string
  ): ApiResponse<T> {
    return this.createResponse(
      true,
      message,
      HttpStatus.OK,
      data,
      undefined,
      path
    );
  }

  static deleted(
    message = 'Resource deleted successfully',
    path?: string
  ): ApiResponse<null> {
    return this.createResponse(
      true,
      message,
      HttpStatus.OK,
      null,
      undefined,
      path
    );
  }

  // Error responses
  static error(
    message: string,
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    error?: any,
    path?: string
  ): ApiResponse {
    return this.createResponse(
      false,
      message,
      statusCode,
      undefined,
      error,
      path
    );
  }

  static badRequest(
    message = 'Bad request',
    error?: any,
    path?: string
  ): ApiResponse {
    return this.createResponse(
      false,
      message,
      HttpStatus.BAD_REQUEST,
      undefined,
      error,
      path
    );
  }

  static unauthorized(
    message = 'Unauthorized',
    error?: any,
    path?: string
  ): ApiResponse {
    return this.createResponse(
      false,
      message,
      HttpStatus.UNAUTHORIZED,
      undefined,
      error,
      path
    );
  }

  static forbidden(
    message = 'Forbidden',
    error?: any,
    path?: string
  ): ApiResponse {
    return this.createResponse(
      false,
      message,
      HttpStatus.FORBIDDEN,
      undefined,
      error,
      path
    );
  }

  static notFound(
    message = 'Resource not found',
    error?: any,
    path?: string
  ): ApiResponse {
    return this.createResponse(
      false,
      message,
      HttpStatus.NOT_FOUND,
      undefined,
      error,
      path
    );
  }

  static conflict(
    message = 'Conflict',
    error?: any,
    path?: string
  ): ApiResponse {
    return this.createResponse(
      false,
      message,
      HttpStatus.CONFLICT,
      undefined,
      error,
      path
    );
  }

  static validationError(
    message = 'Validation failed',
    errors?: any[],
    path?: string
  ): ApiResponse {
    return this.createResponse(
      false,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      undefined,
      { validationErrors: errors },
      path
    );
  }
}
