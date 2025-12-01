/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  statusCode: number;
  timestamp: string;
  path: string;
}
export interface ValidationError {
  field: string;
  message: string;
}
export interface ErrorResponse {
  success: false;
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
