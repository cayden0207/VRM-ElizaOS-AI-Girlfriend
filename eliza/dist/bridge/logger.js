/**
 * 日志记录器
 * 统一的日志管理和格式化
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
export class Logger {
    service;
    logLevel;
    constructor(service) {
        this.service = service;
        this.logLevel = this.getLogLevel();
    }
    getLogLevel() {
        const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
        return LogLevel[level] || LogLevel.INFO;
    }
    shouldLog(level) {
        return level >= this.logLevel;
    }
    formatMessage(level, message, context) {
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
    debug(message, context) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage('DEBUG', message, context));
        }
    }
    info(message, context) {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage('INFO', message, context));
        }
    }
    warn(message, context) {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage('WARN', message, context));
        }
    }
    error(message, error) {
        if (this.shouldLog(LogLevel.ERROR)) {
            let context = {};
            if (error instanceof Error) {
                context = {
                    error: error.message,
                    stack: error.stack
                };
            }
            else if (error) {
                context = error;
            }
            console.error(this.formatMessage('ERROR', message, context));
        }
    }
}
