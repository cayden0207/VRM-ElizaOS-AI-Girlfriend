/**
 * 日志记录器
 * 统一的日志管理和格式化
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export interface LogContext {
    [key: string]: any;
}
export declare class Logger {
    private service;
    private logLevel;
    constructor(service: string);
    private getLogLevel;
    private shouldLog;
    private formatMessage;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: Error | LogContext): void;
}
