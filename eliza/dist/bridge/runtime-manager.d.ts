/**
 * ElizaOS Runtime 管理器
 * 负责管理 25 个角色的 AgentRuntime 实例
 */
import { IAgentRuntime } from '@ai16z/eliza';
import { RuntimeManagerStatus, ProcessOptions, ProcessedResponse } from './types.js';
export declare class ElizaRuntimeManager {
    private runtimes;
    private healthStatus;
    private supabaseClient;
    private initialized;
    private healthCheckInterval;
    private logger;
    private charactersPath;
    constructor();
    /**
     * 初始化 Runtime 管理器
     */
    initialize(): Promise<void>;
    /**
     * 验证环境配置
     */
    private validateEnvironment;
    /**
     * 加载角色配置文件
     */
    private loadCharacterConfigs;
    /**
     * 初始化单个角色的 Runtime
     */
    private initializeCharacterRuntime;
    /**
     * 记录初始化结果
     */
    private logInitializationResults;
    /**
     * 获取指定角色的 Runtime
     */
    getRuntime(characterId: string): IAgentRuntime;
    /**
     * 处理消息
     */
    processMessage(userId: string, characterId: string, message: string, options?: ProcessOptions): Promise<ProcessedResponse>;
    /**
     * 从响应中提取情感信息
     */
    private extractEmotion;
    /**
     * 记录成功调用
     */
    private recordSuccess;
    /**
     * 记录错误
     */
    private recordError;
    /**
     * 启动健康监控
     */
    private startHealthMonitoring;
    /**
     * 执行健康检查
     */
    private performHealthCheck;
    /**
     * 获取错误类型
     */
    private getErrorType;
    /**
     * 获取管理器状态
     */
    getStatus(): RuntimeManagerStatus;
    /**
     * 优雅关闭
     */
    shutdown(): Promise<void>;
}
