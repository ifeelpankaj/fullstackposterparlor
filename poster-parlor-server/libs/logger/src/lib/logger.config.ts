export class LoggerConfig {
  serviceName: string;
  logsDir: string;
  maxFileSize: number;
  maxFiles: number;
  enableConsole: boolean;
  enableSensitiveDataMasking: boolean;

  constructor(options?: Partial<LoggerConfig>) {
    this.serviceName = options?.serviceName || 'ecommerce-app';
    this.logsDir = options?.logsDir || 'logs';
    this.maxFileSize = options?.maxFileSize || 10485760; // 10MB
    this.maxFiles = options?.maxFiles || 10;
    this.enableConsole =
      options?.enableConsole ?? process.env['NODE_ENV'] !== 'production';
    this.enableSensitiveDataMasking =
      options?.enableSensitiveDataMasking ?? true;
  }
}
