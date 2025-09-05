/**
 * ElizaOS 桥接层类型定义
 */
// 错误类型
export var ErrorType;
(function (ErrorType) {
    ErrorType["RUNTIME_NOT_FOUND"] = "RUNTIME_NOT_FOUND";
    ErrorType["RUNTIME_UNHEALTHY"] = "RUNTIME_UNHEALTHY";
    ErrorType["TIMEOUT"] = "TIMEOUT";
    ErrorType["RATE_LIMIT"] = "RATE_LIMIT";
    ErrorType["INVALID_REQUEST"] = "INVALID_REQUEST";
    ErrorType["OPENAI_ERROR"] = "OPENAI_ERROR";
    ErrorType["SUPABASE_ERROR"] = "SUPABASE_ERROR";
    ErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ErrorType || (ErrorType = {}));
// 桥接错误类
export class BridgeError extends Error {
    type;
    characterId;
    userId;
    constructor(message, type, characterId, userId) {
        super(message);
        this.type = type;
        this.characterId = characterId;
        this.userId = userId;
        this.name = 'BridgeError';
    }
}
// WebSocket 消息类型
export var WSMessageType;
(function (WSMessageType) {
    WSMessageType["CHAT"] = "chat";
    WSMessageType["STATUS"] = "status";
    WSMessageType["MEMORY_UPDATE"] = "memory_update";
    WSMessageType["ERROR"] = "error";
    WSMessageType["HEARTBEAT"] = "heartbeat";
})(WSMessageType || (WSMessageType = {}));
