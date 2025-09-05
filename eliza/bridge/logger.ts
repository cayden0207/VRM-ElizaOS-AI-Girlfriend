/**
 * 日志记录器
 * 统一的日志管理和格式化
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export interface LogContext {
    [key: string]: any;
}

export class Logger {
    private service: string;
    private logLevel: LogLevel;

    constructor(service: string) {
        this.service = service;
        this.logLevel = this.getLogLevel();
    }

    private getLogLevel(): LogLevel {
        const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
        return LogLevel[level as keyof typeof LogLevel] || LogLevel.INFO;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.logLevel;
    }

    private formatMessage(level: string, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const baseLog = {
            timestamp,
            level,
            service: this.service,
            message
        };

        const logEntry = context ? { ...baseLog, ...context } : baseLog;

        if (process.env.LOG_FORMAT === 'json') {
            return JSON.stringify(logEntry);
        }

        // 简单格式
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] ${level} [${this.service}] ${message}${contextStr}`;
    }

    debug(message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage('DEBUG', message, context));
        }
    }

    info(message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage('INFO', message, context));
        }
    }

    warn(message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage('WARN', message, context));
        }
    }

    error(message: string, error?: Error | LogContext): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            let context: LogContext = {};
            
            if (error instanceof Error) {
                context = {
                    error: error.message,
                    stack: error.stack
                };
            } else if (error) {
                context = error;
            }
            
            console.error(this.formatMessage('ERROR', message, context));
        }
    }
}