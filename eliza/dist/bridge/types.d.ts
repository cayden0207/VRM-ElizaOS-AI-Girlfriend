/**
 * ElizaOS 桥接层类型定义
 */
import { Character } from '@ai16z/eliza';
export interface CharacterConfig extends Character {
    name: string;
    voiceId?: string;
}
export interface RuntimeHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    errorCount: number;
    lastError?: string;
    responseTime?: number;
}
export interface RuntimeManagerStatus {
    initialized: boolean;
    totalRuntimes: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    runtimes: {
        [characterId: string]: RuntimeHealth;
    };
}
export interface ProcessOptions {
    generateVoice?: boolean;
    includeAnimation?: boolean;
    language?: string;
    timeout?: number;
    maxRetries?: number;
}
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
export interface VRMAnimationData {
    type: 'idle' | 'happy' | 'sad' | 'angry' | 'surprised' | 'dance' | 'wave' | 'nod' | 'shake';
    duration: number;
    intensity: number;
    loop?: boolean;
    triggers?: string[];
}
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
    characterUsage: {
        [characterId: string]: number;
    };
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    lastResetTime: Date;
}
export declare enum ErrorType {
    RUNTIME_NOT_FOUND = "RUNTIME_NOT_FOUND",
    RUNTIME_UNHEALTHY = "RUNTIME_UNHEALTHY",
    TIMEOUT = "TIMEOUT",
    RATE_LIMIT = "RATE_LIMIT",
    INVALID_REQUEST = "INVALID_REQUEST",
    OPENAI_ERROR = "OPENAI_ERROR",
    SUPABASE_ERROR = "SUPABASE_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
export declare class BridgeError extends Error {
    type: ErrorType;
    characterId?: string | undefined;
    userId?: string | undefined;
    constructor(message: string, type: ErrorType, characterId?: string | undefined, userId?: string | undefined);
}
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
export interface MemoryInfo {
    userId: string;
    characterId: string;
    content: string;
    importance: number;
    timestamp: Date;
    metadata?: Record<string, any>;
}
export interface ChatSession {
    userId: string;
    characterId: string;
    roomId: string;
    startTime: Date;
    lastActivity: Date;
    messageCount: number;
    isActive: boolean;
}
export declare enum WSMessageType {
    CHAT = "chat",
    STATUS = "status",
    MEMORY_UPDATE = "memory_update",
    ERROR = "error",
    HEARTBEAT = "heartbeat"
}
export interface WSMessage {
    type: WSMessageType;
    userId: string;
    characterId?: string;
    data: any;
    timestamp: string;
    requestId?: string;
}
