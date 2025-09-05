/**
 * ElizaOS 桥接层类型定义
 */

import { Character } from '@ai16z/eliza';

// 角色配置接口
export interface CharacterConfig extends Character {
    name: string;
    voiceId?: string;
}

// Runtime 健康状态
export interface RuntimeHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    errorCount: number;
    lastError?: string;
    responseTime?: number;
}

// Runtime 管理器状态
export interface RuntimeManagerStatus {
    initialized: boolean;
    totalRuntimes: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    runtimes: { [characterId: string]: RuntimeHealth };
}

// 处理选项
export interface ProcessOptions {
    generateVoice?: boolean;
    includeAnimation?: boolean;
    language?: string;
    timeout?: number;
    maxRetries?: number;
}

// ElizaOS 处理后的响应
export interface ProcessedResponse {
    text: string;
    characterId: string;
    emotion: string;
    confidence: number;
    memoryUpdated: boolean;
    responseTime: number;
    metadata: {
        userId: string;
        roomId: string;
        timestamp: string;
        source: string;
    };
}

// 增强后的响应 (包含 VRM 动画和语音)
export interface EnhancedResponse extends ProcessedResponse {
    animation?: {
        type: string;
        duration: number;
        intensity: number;
        triggers?: string[];
    };
    audioUrl?: string;
    enhanced: boolean;
    enhancementTime: number;
}

// VRM 动画数据
export interface VRMAnimationData {
    type: 'idle' | 'happy' | 'sad' | 'angry' | 'surprised' | 'dance' | 'wave' | 'nod' | 'shake';
    duration: number;
    intensity: number;
    loop?: boolean;
    triggers?: string[];
}

// 桥接服务配置
export interface BridgeConfig {
    elizaEnabled: boolean;
    fallbackEnabled: boolean;
    elizaEndpoint?: string;
    maxConcurrentRequests: number;
    requestTimeout: number;
    healthCheckInterval: number;
    memoryLimit: number;
    logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

// 性能指标
export interface BridgeMetrics {
    totalRequests: number;
    elizaRequests: number;
    fallbackRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    elizaSuccessRate: number;
    fallbackSuccessRate: number;
    characterUsage: { [characterId: string]: number };
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    lastResetTime: Date;
}

// 错误类型
export enum ErrorType {
    RUNTIME_NOT_FOUND = 'RUNTIME_NOT_FOUND',
    RUNTIME_UNHEALTHY = 'RUNTIME_UNHEALTHY',
    TIMEOUT = 'TIMEOUT',
    RATE_LIMIT = 'RATE_LIMIT',
    INVALID_REQUEST = 'INVALID_REQUEST',
    OPENAI_ERROR = 'OPENAI_ERROR',
    SUPABASE_ERROR = 'SUPABASE_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 桥接错误类
export class BridgeError extends Error {
    constructor(
        message: string,
        public type: ErrorType,
        public characterId?: string,
        public userId?: string
    ) {
        super(message);
        this.name = 'BridgeError';
    }
}

// 日志条目接口
export interface LogEntry {
    timestamp: string;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    service: string;
    operation: string;
    userId?: string;
    characterId?: string;
    duration?: number;
    success: boolean;
    error?: string;
    source: 'eliza-os' | 'fallback' | 'bridge';
    metadata?: Record<string, any>;
}

// 内存信息
export interface MemoryInfo {
    userId: string;
    characterId: string;
    content: string;
    importance: number;
    timestamp: Date;
    metadata?: Record<string, any>;
}

// 聊天会话信息
export interface ChatSession {
    userId: string;
    characterId: string;
    roomId: string;
    startTime: Date;
    lastActivity: Date;
    messageCount: number;
    isActive: boolean;
}

// WebSocket 消息类型
export enum WSMessageType {
    CHAT = 'chat',
    STATUS = 'status',
    MEMORY_UPDATE = 'memory_update',
    ERROR = 'error',
    HEARTBEAT = 'heartbeat'
}

// WebSocket 消息接口
export interface WSMessage {
    type: WSMessageType;
    userId: string;
    characterId?: string;
    data: any;
    timestamp: string;
    requestId?: string;
}