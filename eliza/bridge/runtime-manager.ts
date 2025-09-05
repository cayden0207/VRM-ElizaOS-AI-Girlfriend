/**
 * ElizaOS Runtime 管理器
 * 负责管理 25 个角色的 AgentRuntime 实例
 */

import { AgentRuntime, Character, IAgentRuntime } from '@ai16z/eliza';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    CharacterConfig,
    RuntimeHealth,
    RuntimeManagerStatus,
    ProcessOptions,
    ProcessedResponse,
    BridgeError,
    ErrorType,
    LogEntry
} from './types.js';
import { Logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ElizaRuntimeManager {
    private runtimes: Map<string, IAgentRuntime> = new Map();
    private healthStatus: Map<string, RuntimeHealth> = new Map();
    private supabaseClient: SupabaseClient;
    private initialized: boolean = false;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private logger: Logger;
    private charactersPath: string;

    constructor() {
        this.logger = new Logger('RuntimeManager');
        this.charactersPath = path.join(__dirname, '../characters');
        
        // 初始化 Supabase 客户端
        this.supabaseClient = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
        );
    }

    /**
     * 初始化 Runtime 管理器
     */
    async initialize(): Promise<void> {
        this.logger.info('🚀 初始化 ElizaOS Runtime 管理器...');

        try {
            // 验证环境配置
            await this.validateEnvironment();

            // 加载角色配置
            const characters = await this.loadCharacterConfigs();
            this.logger.info(`📋 发现 ${characters.length} 个角色配置`);

            // 并行初始化 Runtime 实例
            const initPromises = characters.map(char => 
                this.initializeCharacterRuntime(char)
            );

            const results = await Promise.allSettled(initPromises);
            await this.logInitializationResults(results);

            // 启动健康监控
            this.startHealthMonitoring();

            this.initialized = true;
            this.logger.info(`✅ Runtime 管理器初始化完成: ${this.runtimes.size}/25 个 Runtime 就绪`);

        } catch (error) {
            this.logger.error('❌ Runtime 管理器初始化失败:', error);
            throw new BridgeError(
                `Runtime 管理器初始化失败: ${error.message}`,
                ErrorType.UNKNOWN_ERROR
            );
        }
    }

    /**
     * 验证环境配置
     */
    private async validateEnvironment(): Promise<void> {
        const requiredEnvVars = [
            'SUPABASE_URL',
            'SUPABASE_SERVICE_KEY',
            'OPENAI_API_KEY'
        ];

        const missing = requiredEnvVars.filter(key => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`缺少必需的环境变量: ${missing.join(', ')}`);
        }

        // 测试 Supabase 连接
        try {
            const { data, error } = await this.supabaseClient
                .from('memory_vectors')
                .select('count', { count: 'exact', head: true })
                .limit(1);

            if (error) {
                throw new Error(`Supabase 连接测试失败: ${error.message}`);
            }

            this.logger.info('✅ Supabase 连接验证成功');
        } catch (error) {
            throw new Error(`无法连接到 Supabase: ${error.message}`);
        }
    }

    /**
     * 加载角色配置文件
     */
    private async loadCharacterConfigs(): Promise<CharacterConfig[]> {
        const characters: CharacterConfig[] = [];

        try {
            if (!fs.existsSync(this.charactersPath)) {
                throw new Error(`角色配置目录不存在: ${this.charactersPath}`);
            }

            const files = fs.readdirSync(this.charactersPath)
                .filter(file => file.endsWith('.json') && file !== 'character-index.json');

            for (const file of files) {
                try {
                    const configPath = path.join(this.charactersPath, file);
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    const config = JSON.parse(configContent) as CharacterConfig;

                    // 验证配置
                    if (!config.name) {
                        this.logger.warn(`⚠️ 角色配置 ${file} 缺少 name 字段，跳过`);
                        continue;
                    }

                    characters.push(config);
                } catch (error) {
                    this.logger.error(`❌ 加载角色配置 ${file} 失败:`, error);
                }
            }

            return characters;
        } catch (error) {
            throw new Error(`加载角色配置失败: ${error.message}`);
        }
    }

    /**
     * 初始化单个角色的 Runtime
     */
    private async initializeCharacterRuntime(character: CharacterConfig): Promise<void> {
        const startTime = Date.now();

        try {
            // 创建 AgentRuntime 实例
            const runtime = new AgentRuntime({
                character: character as Character,
                databaseAdapter: this.supabaseClient,
                token: process.env.OPENAI_API_KEY!,
                modelProvider: process.env.MODEL_PROVIDER || 'openai',
                serverUrl: process.env.SUPABASE_URL!,
                actions: [],
                evaluators: [],
                providers: []
            });

            // 初始化 Runtime
            await runtime.initialize();

            // 存储 Runtime 实例
            this.runtimes.set(character.name.toLowerCase(), runtime);

            // 初始化健康状态
            this.healthStatus.set(character.name.toLowerCase(), {
                status: 'healthy',
                lastCheck: new Date(),
                errorCount: 0,
                responseTime: Date.now() - startTime
            });

            this.logger.debug(`✅ ${character.name} Runtime 初始化成功 (${Date.now() - startTime}ms)`);

        } catch (error) {
            // 记录失败状态
            this.healthStatus.set(character.name.toLowerCase(), {
                status: 'unhealthy',
                lastCheck: new Date(),
                errorCount: 1,
                lastError: error.message,
                responseTime: Date.now() - startTime
            });

            this.logger.error(`❌ ${character.name} Runtime 初始化失败:`, error);
            throw error;
        }
    }

    /**
     * 记录初始化结果
     */
    private async logInitializationResults(results: PromiseSettledResult<void>[]): Promise<void> {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        this.logger.info(`📊 Runtime 初始化结果: ${successful} 成功, ${failed} 失败`);

        if (failed > 0) {
            const failedResults = results
                .filter(r => r.status === 'rejected') as PromiseRejectedResult[];
            
            for (const result of failedResults) {
                this.logger.error('初始化失败详情:', result.reason);
            }
        }
    }

    /**
     * 获取指定角色的 Runtime
     */
    getRuntime(characterId: string): IAgentRuntime {
        if (!this.initialized) {
            throw new BridgeError(
                'Runtime 管理器尚未初始化',
                ErrorType.RUNTIME_NOT_FOUND
            );
        }

        const runtime = this.runtimes.get(characterId.toLowerCase());
        if (!runtime) {
            throw new BridgeError(
                `角色 ${characterId} 的 Runtime 未找到`,
                ErrorType.RUNTIME_NOT_FOUND,
                characterId
            );
        }

        const health = this.healthStatus.get(characterId.toLowerCase());
        if (health?.status === 'unhealthy') {
            throw new BridgeError(
                `角色 ${characterId} 的 Runtime 状态异常: ${health.lastError}`,
                ErrorType.RUNTIME_UNHEALTHY,
                characterId
            );
        }

        return runtime;
    }

    /**
     * 处理消息
     */
    async processMessage(
        userId: string,
        characterId: string,
        message: string,
        options: ProcessOptions = {}
    ): Promise<ProcessedResponse> {
        const startTime = Date.now();
        const logContext = { userId, characterId, messageLength: message.length };

        try {
            // 获取 Runtime
            const runtime = this.getRuntime(characterId);
            const roomId = `${userId}_${characterId}`;

            // 设置超时
            const timeout = options.timeout || 10000;
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('请求超时')), timeout)
            );

            // 处理消息
            const messagePromise = runtime.messageManager.createMemory({
                userId: userId,
                content: { text: message },
                roomId: roomId,
                agentId: characterId
            });

            const memory = await Promise.race([messagePromise, timeoutPromise]);

            // 生成响应
            const responsePromise = runtime.chat({
                userId: userId,
                content: { text: message },
                roomId: roomId
            });

            const response = await Promise.race([responsePromise, timeoutPromise]);

            // 构建处理结果
            const processedResponse: ProcessedResponse = {
                text: response.text || '',
                characterId: characterId,
                emotion: this.extractEmotion(response),
                confidence: response.confidence || 0.8,
                memoryUpdated: true,
                responseTime: Date.now() - startTime,
                metadata: {
                    userId: userId,
                    roomId: roomId,
                    timestamp: new Date().toISOString(),
                    source: 'eliza-os'
                }
            };

            // 记录成功调用
            this.recordSuccess(characterId, processedResponse.responseTime);

            this.logger.info('✅ 消息处理成功', {
                ...logContext,
                responseTime: processedResponse.responseTime,
                emotion: processedResponse.emotion
            });

            return processedResponse;

        } catch (error) {
            const errorMessage = error.message || '未知错误';
            this.recordError(characterId, error);

            this.logger.error('❌ 消息处理失败', {
                ...logContext,
                error: errorMessage,
                responseTime: Date.now() - startTime
            });

            throw new BridgeError(
                `ElizaOS 处理消息失败: ${errorMessage}`,
                this.getErrorType(error),
                characterId,
                userId
            );
        }
    }

    /**
     * 从响应中提取情感信息
     */
    private extractEmotion(response: any): string {
        if (response.emotion) return response.emotion;
        if (response.mood) return response.mood;

        // 基于文本内容推断情感
        const text = (response.text || '').toLowerCase();
        
        const emotionPatterns = {
            happy: ['哈哈', '开心', '高兴', '快乐', '😊', '😃', '😄', '💃', '🎉'],
            sad: ['难过', '伤心', '悲伤', '😢', '😭', '💔'],
            angry: ['生气', '愤怒', '气愤', '😠', '😡', '🤬'],
            surprised: ['惊讶', '震惊', '意外', '😮', '😯', '😲'],
            excited: ['兴奋', '激动', '刺激', '🤩', '😍'],
            shy: ['害羞', '不好意思', '😳', '🙈'],
            thinking: ['思考', '想想', '考虑', '🤔', '💭']
        };

        for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
            if (patterns.some(pattern => text.includes(pattern))) {
                return emotion;
            }
        }

        return 'neutral';
    }

    /**
     * 记录成功调用
     */
    private recordSuccess(characterId: string, responseTime: number): void {
        const health = this.healthStatus.get(characterId.toLowerCase());
        if (health) {
            this.healthStatus.set(characterId.toLowerCase(), {
                ...health,
                status: 'healthy',
                lastCheck: new Date(),
                errorCount: Math.max(0, health.errorCount - 1), // 成功时减少错误计数
                responseTime: responseTime
            });
        }
    }

    /**
     * 记录错误
     */
    private recordError(characterId: string, error: Error): void {
        const health = this.healthStatus.get(characterId.toLowerCase());
        if (health) {
            const errorCount = health.errorCount + 1;
            this.healthStatus.set(characterId.toLowerCase(), {
                ...health,
                status: errorCount > 3 ? 'unhealthy' : 'degraded',
                lastCheck: new Date(),
                errorCount: errorCount,
                lastError: error.message
            });
        }
    }

    /**
     * 启动健康监控
     */
    private startHealthMonitoring(): void {
        const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');
        
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, interval);

        this.logger.info(`🔍 健康监控已启动 (间隔: ${interval}ms)`);
    }

    /**
     * 执行健康检查
     */
    private async performHealthCheck(): Promise<void> {
        const startTime = Date.now();
        let healthyCount = 0;
        let degradedCount = 0;
        let unhealthyCount = 0;

        for (const [characterId, runtime] of this.runtimes) {
            try {
                // 发送测试消息
                await Promise.race([
                    runtime.messageManager.createMemory({
                        userId: 'health_check',
                        content: { text: 'ping' },
                        roomId: 'health_check'
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('健康检查超时')), 5000)
                    )
                ]);

                // 更新健康状态
                const currentHealth = this.healthStatus.get(characterId);
                this.healthStatus.set(characterId, {
                    status: 'healthy',
                    lastCheck: new Date(),
                    errorCount: Math.max(0, (currentHealth?.errorCount || 0) - 1),
                    responseTime: Date.now() - startTime
                });

                healthyCount++;

            } catch (error) {
                const currentHealth = this.healthStatus.get(characterId);
                const errorCount = (currentHealth?.errorCount || 0) + 1;
                const status = errorCount > 3 ? 'unhealthy' : 'degraded';

                this.healthStatus.set(characterId, {
                    status: status,
                    lastCheck: new Date(),
                    errorCount: errorCount,
                    lastError: error.message,
                    responseTime: Date.now() - startTime
                });

                if (status === 'unhealthy') unhealthyCount++;
                else degradedCount++;

                this.logger.warn(`⚠️ ${characterId} 健康检查失败 (${errorCount}/3):`, error.message);
            }
        }

        this.logger.debug(`🔍 健康检查完成: ${healthyCount} 健康, ${degradedCount} 降级, ${unhealthyCount} 异常`);
    }

    /**
     * 获取错误类型
     */
    private getErrorType(error: Error): ErrorType {
        const message = error.message.toLowerCase();
        
        if (message.includes('timeout')) return ErrorType.TIMEOUT;
        if (message.includes('rate limit')) return ErrorType.RATE_LIMIT;
        if (message.includes('openai')) return ErrorType.OPENAI_ERROR;
        if (message.includes('supabase')) return ErrorType.SUPABASE_ERROR;
        if (message.includes('runtime')) return ErrorType.RUNTIME_NOT_FOUND;
        
        return ErrorType.UNKNOWN_ERROR;
    }

    /**
     * 获取管理器状态
     */
    getStatus(): RuntimeManagerStatus {
        const runtimeStatuses: { [key: string]: RuntimeHealth } = {};
        let healthyCount = 0;
        let degradedCount = 0;
        let unhealthyCount = 0;

        for (const [characterId, health] of this.healthStatus) {
            runtimeStatuses[characterId] = { ...health };
            
            switch (health.status) {
                case 'healthy': healthyCount++; break;
                case 'degraded': degradedCount++; break;
                case 'unhealthy': unhealthyCount++; break;
            }
        }

        return {
            initialized: this.initialized,
            totalRuntimes: this.runtimes.size,
            healthyCount,
            degradedCount,
            unhealthyCount,
            runtimes: runtimeStatuses
        };
    }

    /**
     * 优雅关闭
     */
    async shutdown(): Promise<void> {
        this.logger.info('🔄 正在关闭 Runtime 管理器...');

        // 停止健康监控
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        // 关闭所有 Runtime
        const shutdownPromises = Array.from(this.runtimes.entries()).map(
            async ([characterId, runtime]) => {
                try {
                    // ElizaOS Runtime 目前可能没有 shutdown 方法
                    // 这里做清理工作
                    this.logger.debug(`关闭 ${characterId} Runtime`);
                } catch (error) {
                    this.logger.error(`关闭 ${characterId} Runtime 失败:`, error);
                }
            }
        );

        await Promise.allSettled(shutdownPromises);

        // 清理状态
        this.runtimes.clear();
        this.healthStatus.clear();
        this.initialized = false;

        this.logger.info('✅ Runtime 管理器已关闭');
    }
}