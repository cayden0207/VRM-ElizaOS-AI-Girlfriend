/**
 * ElizaOS API 桥接服务
 * 统一接口，连接现有系统与 ElizaOS
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { SimplifiedRealElizaRuntime } from './simplified-real-runtime.js';
import {
    BridgeConfig,
    BridgeMetrics,
    EnhancedResponse,
    ProcessOptions,
    BridgeError,
    ErrorType,
    VRMAnimationData,
    WSMessage,
    WSMessageType
} from './types.js';
import { Logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ElizaBridgeService {
    private app: express.Application;
    private server: any;
    private wss: WebSocketServer | null = null;
    private runtimeManager: SimplifiedRealElizaRuntime;
    private logger: Logger;
    private config: BridgeConfig;
    private metrics: BridgeMetrics;
    private startTime: Date;

    // 声音 ID 映射
    private readonly voiceMapping = {
        'alice': 'rEJAAHKQqr6yTNCh8xS0',
        'ash': 'bY4cOgafbv5vatmokfg0',
        'bobo': 'I7CpaIqk2oGPGCKvOPO9',
        'elinyaa': '4cxHntmhK38NT4QMBr9m',
        'fliza': 's9lrHYk7TIJ2UO7UNbje',
        'imeris': 'eVItLK1UvXctxuaRV2Oq',
        'kyoko': 'ATSlMe1wEISLjgGhZEKK',
        'lena': 'uEn2ClE3OziJMlhQS91c',
        'lilium': 'yRRXNdbFeQpIK5MAhenr',
        'maple': 'B8gJV1IhpuegLxdpXFOE',
        'miru': 'eVJCDcwCTZBLNdQdbdmd',
        'nekona': 'kcg1KQQGuCGzH6FUjsZQ',
        'notia': 'abz2RylgxmJx76xNpaj1',
        'ququ': 'tfQFvzjodQp63340jz2r',
        'rindo': 'nclQ39ewSlJMu5Nidnsf',
        'rainy': '1ghrzLZQ7Dza7Xs9OkhY',
        'rika': 'n263mAk9k8VWEuZSmuMl',
        'ruan': 'SU7BtMmgc7KhQiC6G24B',
        'vivi': '4lWJNy00PxQAOMgQTiIS',
        'whisper': 't9ZwnJtpA3lWrJ4W7pAl',
        'wolferia': '3SeVwPUl5aO6J2GETjox',
        'xinyan': 'WW3EvqkXGmu65ga8TYqa',
        'yawl': 'c6wjO0u66VyvwAC4UTqx',
        'yuuyii': 'UPwKM85l2CG7nbF2u1or',
        'zwei': '0EzDWfDZDlAIeQQOjhoC'
    };

    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.runtimeManager = new SimplifiedRealElizaRuntime();
        this.logger = new Logger('BridgeService');
        this.startTime = new Date();
        
        this.config = {
            elizaEnabled: process.env.ELIZA_ENABLED === 'true',
            fallbackEnabled: process.env.ELIZA_FALLBACK_ENABLED === 'true',
            maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '50'),
            requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '10000'),
            healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
            memoryLimit: parseInt(process.env.MEMORY_LIMIT || '512'),
            logLevel: (process.env.LOG_LEVEL as any) || 'INFO'
        };

        this.metrics = this.initializeMetrics();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    /**
     * 初始化指标
     */
    private initializeMetrics(): BridgeMetrics {
        return {
            totalRequests: 0,
            elizaRequests: 0,
            fallbackRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            p95ResponseTime: 0,
            p99ResponseTime: 0,
            elizaSuccessRate: 0,
            fallbackSuccessRate: 0,
            characterUsage: {},
            memoryUsage: 0,
            cpuUsage: 0,
            activeConnections: 0,
            lastResetTime: new Date()
        };
    }

    /**
     * 设置中间件
     */
    private setupMiddleware(): void {
        // CORS 配置
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type', 
                'Authorization', 
                'X-User-Id', 
                'X-Character-Id',
                'X-Request-ID'
            ],
            credentials: false
        }));

        // JSON 解析
        this.app.use(express.json({ 
            limit: '10mb',
            verify: (req: any, res, buf) => {
                req.rawBody = buf;
            }
        }));

        // 请求 ID 生成
        this.app.use((req: any, res, next) => {
            req.requestId = req.headers['x-request-id'] || 
                            `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            res.setHeader('X-Request-ID', req.requestId);
            next();
        });

        // 速率限制
        if (process.env.NODE_ENV === 'production') {
            const limiter = rateLimit({
                windowMs: parseInt(process.env.API_RATE_WINDOW || '60000'),
                max: parseInt(process.env.API_RATE_LIMIT || '100'),
                message: { 
                    success: false, 
                    error: '请求过于频繁，请稍后再试',
                    errorCode: 'RATE_LIMIT_EXCEEDED'
                },
                standardHeaders: true,
                legacyHeaders: false
            });
            this.app.use('/api/', limiter);
        }

        // 请求日志
        this.app.use((req: any, res, next) => {
            const startTime = Date.now();
            req.startTime = startTime;
            
            this.logger.debug('收到请求', {
                method: req.method,
                path: req.path,
                userAgent: req.headers['user-agent'],
                ip: req.ip || req.connection.remoteAddress,
                requestId: req.requestId
            });

            // 响应完成时记录
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                this.updateMetrics(req, res, duration);
                
                this.logger.info('请求完成', {
                    method: req.method,
                    path: req.path,
                    status: res.statusCode,
                    duration: duration,
                    requestId: req.requestId
                });
            });

            next();
        });
    }

    /**
     * 设置路由
     */
    private setupRoutes(): void {
        // 健康检查
        this.app.get('/health', async (req, res) => {
            const runtimeStatus = await this.runtimeManager.getHealthStatus();
            const uptime = Date.now() - this.startTime.getTime();

            res.json({
                success: true,
                service: 'eliza-bridge',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                uptime: {
                    ms: uptime,
                    human: this.formatUptime(uptime)
                },
                config: {
                    elizaEnabled: this.config.elizaEnabled,
                    fallbackEnabled: this.config.fallbackEnabled,
                    nodeEnv: process.env.NODE_ENV
                },
                elizaOS: runtimeStatus,
                system: {
                    memory: process.memoryUsage(),
                    platform: process.platform,
                    nodeVersion: process.version
                }
            });
        });

        // 详细状态
        this.app.get('/status', async (req, res) => {
            res.json({
                success: true,
                runtime: await this.runtimeManager.getHealthStatus(),
                metrics: this.getMetrics(),
                config: this.config
            });
        });

        // 主要聊天接口 - 兼容现有格式
        this.app.post('/api/chat', async (req: any, res) => {
            await this.handleChatRequest(req, res);
        });

        // ElizaOS 专用接口
        this.app.post('/api/eliza/message', async (req: any, res) => {
            await this.handleElizaMessage(req, res);
        });

        // 角色状态查询
        this.app.get('/api/characters/:characterId/status', async (req, res) => {
            try {
                const { characterId } = req.params;
                const characterStatus = await this.runtimeManager.getCharacterStatus(characterId);

                res.json({
                    success: true,
                    data: {
                        characterId: characterId,
                        status: characterStatus.status || 'unknown',
                        name: characterStatus.name,
                        model: characterStatus.model,
                        memoryEnabled: characterStatus.memoryEnabled,
                        uptime: characterStatus.uptime,
                        lastActivity: characterStatus.lastActivity,
                        available: characterStatus.status === 'active'
                    }
                });
            } catch (error) {
                this.handleError(res, error, req.requestId);
            }
        });

        // 所有角色列表
        this.app.get('/api/characters', async (req, res) => {
            try {
                const characterIds = await this.runtimeManager.getAllCharacters();
                const characters = await Promise.all(
                    characterIds.map(async (characterId) => {
                        const status = await this.runtimeManager.getCharacterStatus(characterId);
                        return {
                            characterId,
                            name: status.name,
                            status: status.status,
                            available: status.status === 'active',
                            model: status.model,
                            voiceId: this.voiceMapping[characterId as keyof typeof this.voiceMapping]
                        };
                    })
                );

                res.json({
                    success: true,
                    data: {
                        total: characters.length,
                        active: characters.filter(c => c.status === 'active').length,
                        characters: characters
                    }
                });
            } catch (error) {
                this.handleError(res, error, req.requestId);
            }
        });

        // 指标端点
        this.app.get('/metrics', (req, res) => {
            const metrics = this.getMetrics();
            
            // Prometheus 格式 (简化版)
            const prometheusFormat = `
# HELP eliza_bridge_requests_total Total number of requests
# TYPE eliza_bridge_requests_total counter
eliza_bridge_requests_total ${metrics.totalRequests}

# HELP eliza_bridge_success_rate Success rate of requests
# TYPE eliza_bridge_success_rate gauge
eliza_bridge_success_rate ${metrics.successfulRequests / Math.max(1, metrics.totalRequests)}

# HELP eliza_bridge_response_time_ms Average response time in milliseconds
# TYPE eliza_bridge_response_time_ms gauge
eliza_bridge_response_time_ms ${metrics.averageResponseTime}
            `.trim();

            res.set('Content-Type', 'text/plain');
            res.send(prometheusFormat);
        });

        // 错误处理中间件
        this.app.use((error: Error, req: any, res: any, next: any) => {
            this.handleError(res, error, req.requestId);
        });

        // 404 处理
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not Found',
                errorCode: 'NOT_FOUND',
                path: req.originalUrl
            });
        });
    }

    /**
     * 处理聊天请求
     */
    private async handleChatRequest(req: any, res: any): Promise<void> {
        const startTime = Date.now();
        
        try {
            const { userId, characterId, message, options = {} } = req.body;

            // 参数验证
            if (!userId || !characterId || !message) {
                throw new BridgeError(
                    '缺少必需参数: userId, characterId, message',
                    ErrorType.INVALID_REQUEST
                );
            }

            // 处理消息
            const response = await this.processMessage(
                userId, characterId, message, options, req.requestId
            );

            res.json({
                success: true,
                data: response,
                responseTime: Date.now() - startTime,
                requestId: req.requestId
            });

        } catch (error) {
            this.handleError(res, error, req.requestId);
        }
    }

    /**
     * 处理 ElizaOS 消息
     */
    private async handleElizaMessage(req: any, res: any): Promise<void> {
        // 专门的 ElizaOS 接口实现
        await this.handleChatRequest(req, res);
    }

    /**
     * 处理消息的核心逻辑
     */
    private async processMessage(
        userId: string,
        characterId: string,
        message: string,
        options: ProcessOptions,
        requestId: string
    ): Promise<EnhancedResponse> {
        const startTime = Date.now();
        
        try {
            // 使用 ElizaOS 处理
            if (this.config.elizaEnabled) {
                const elizaResponse = await this.runtimeManager.processMessage(
                    userId, characterId, message, options
                );

                // 增强响应
                const enhancedResponse = await this.enhanceResponse(
                    elizaResponse, characterId, options
                );

                this.metrics.elizaRequests++;
                
                this.logger.info('✅ ElizaOS 处理成功', {
                    userId, characterId, 
                    responseTime: enhancedResponse.responseTime,
                    requestId
                });

                return enhancedResponse;
            }

            throw new Error('ElizaOS 未启用');

        } catch (error) {
            this.logger.warn('ElizaOS 处理失败，尝试降级', {
                userId, characterId, error: error.message, requestId
            });

            // 降级处理
            if (this.config.fallbackEnabled) {
                const fallbackResponse = await this.handleFallback(
                    userId, characterId, message, options, requestId
                );
                
                this.metrics.fallbackRequests++;
                return fallbackResponse;
            }

            throw error;
        }
    }

    /**
     * 增强响应 - 添加 VRM 动画和语音
     */
    private async enhanceResponse(
        elizaResponse: any,
        characterId: string,
        options: ProcessOptions
    ): Promise<EnhancedResponse> {
        const enhancementStart = Date.now();

        // VRM 动画数据
        let animationData: VRMAnimationData | undefined;
        if (elizaResponse.emotion && elizaResponse.emotion !== 'neutral') {
            animationData = this.getAnimationData(elizaResponse.emotion);
        }

        // 语音合成 (模拟实现)
        let audioUrl: string | undefined;
        if (elizaResponse.text && options.generateVoice !== false) {
            audioUrl = await this.generateVoiceUrl(elizaResponse.text, characterId);
        }

        const enhancedResponse: EnhancedResponse = {
            ...elizaResponse,
            animation: animationData,
            audioUrl: audioUrl,
            enhanced: true,
            enhancementTime: Date.now() - enhancementStart
        };

        return enhancedResponse;
    }

    /**
     * 获取 VRM 动画数据
     */
    private getAnimationData(emotion: string): VRMAnimationData {
        const animationMap: Record<string, VRMAnimationData> = {
            happy: {
                type: 'happy',
                duration: 3000,
                intensity: 0.8,
                triggers: ['smile', 'bounce']
            },
            sad: {
                type: 'sad',
                duration: 2500,
                intensity: 0.6,
                triggers: ['frown', 'slump']
            },
            angry: {
                type: 'angry',
                duration: 2000,
                intensity: 0.9,
                triggers: ['scowl', 'cross_arms']
            },
            surprised: {
                type: 'surprised',
                duration: 1500,
                intensity: 0.7,
                triggers: ['gasp', 'wide_eyes']
            },
            excited: {
                type: 'dance',
                duration: 4000,
                intensity: 0.9,
                loop: true,
                triggers: ['dance', 'jump']
            }
        };

        return animationMap[emotion] || {
            type: 'idle',
            duration: 1000,
            intensity: 0.3
        };
    }

    /**
     * 生成语音 URL (模拟实现)
     */
    private async generateVoiceUrl(text: string, characterId: string): Promise<string> {
        // 这里应该调用 ElevenLabs API 或其他 TTS 服务
        // 现在返回模拟 URL
        const voiceId = this.voiceMapping[characterId as keyof typeof this.voiceMapping];
        
        if (!voiceId) {
            throw new Error(`角色 ${characterId} 的语音 ID 未找到`);
        }

        // 模拟 TTS API 调用
        this.logger.debug('生成语音', { characterId, voiceId, textLength: text.length });
        
        // 返回模拟的音频 URL
        return `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/audio?text=${encodeURIComponent(text)}`;
    }

    /**
     * 降级处理
     */
    private async handleFallback(
        userId: string,
        characterId: string,
        message: string,
        options: ProcessOptions,
        requestId: string
    ): Promise<EnhancedResponse> {
        // 模拟降级系统响应
        const fallbackResponse: EnhancedResponse = {
            text: `我现在有点忙，不过很高兴和你聊天！你刚才说："${message}"`,
            characterId: characterId,
            emotion: 'neutral',
            confidence: 0.6,
            memoryUpdated: false,
            responseTime: 100,
            enhanced: false,
            enhancementTime: 0,
            metadata: {
                userId: userId,
                roomId: `${userId}_${characterId}`,
                timestamp: new Date().toISOString(),
                source: 'fallback'
            }
        };

        this.logger.info('使用降级响应', { userId, characterId, requestId });
        return fallbackResponse;
    }

    /**
     * 设置 WebSocket
     */
    private setupWebSocket(): void {
        this.wss = new WebSocketServer({ 
            server: this.server,
            path: '/ws'
        });

        this.wss.on('connection', (ws, req) => {
            this.metrics.activeConnections++;
            const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            this.logger.info('WebSocket 连接建立', { 
                connectionId,
                ip: req.socket.remoteAddress 
            });

            ws.on('message', async (data) => {
                try {
                    const message: WSMessage = JSON.parse(data.toString());
                    await this.handleWebSocketMessage(ws, message, connectionId);
                } catch (error) {
                    this.logger.error('WebSocket 消息处理失败', error);
                    ws.send(JSON.stringify({
                        type: WSMessageType.ERROR,
                        data: { error: 'Invalid message format' },
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            ws.on('close', () => {
                this.metrics.activeConnections--;
                this.logger.info('WebSocket 连接关闭', { connectionId });
            });

            // 发送欢迎消息
            ws.send(JSON.stringify({
                type: WSMessageType.STATUS,
                data: { 
                    connected: true, 
                    connectionId,
                    availableCharacters: Object.keys(this.voiceMapping)
                },
                timestamp: new Date().toISOString()
            }));
        });
    }

    /**
     * 处理 WebSocket 消息
     */
    private async handleWebSocketMessage(
        ws: any, 
        message: WSMessage, 
        connectionId: string
    ): Promise<void> {
        try {
            switch (message.type) {
                case WSMessageType.CHAT:
                    if (message.characterId && message.data?.message) {
                        const response = await this.processMessage(
                            message.userId,
                            message.characterId,
                            message.data.message,
                            message.data.options || {},
                            connectionId
                        );

                        ws.send(JSON.stringify({
                            type: WSMessageType.CHAT,
                            userId: message.userId,
                            characterId: message.characterId,
                            data: response,
                            timestamp: new Date().toISOString(),
                            requestId: message.requestId
                        }));
                    }
                    break;

                case WSMessageType.HEARTBEAT:
                    ws.send(JSON.stringify({
                        type: WSMessageType.HEARTBEAT,
                        data: { alive: true },
                        timestamp: new Date().toISOString()
                    }));
                    break;

                default:
                    ws.send(JSON.stringify({
                        type: WSMessageType.ERROR,
                        data: { error: `Unknown message type: ${message.type}` },
                        timestamp: new Date().toISOString()
                    }));
            }
        } catch (error) {
            this.logger.error('WebSocket 消息处理失败', error);
            ws.send(JSON.stringify({
                type: WSMessageType.ERROR,
                data: { error: error.message },
                timestamp: new Date().toISOString()
            }));
        }
    }

    /**
     * 错误处理
     */
    private handleError(res: any, error: Error, requestId?: string): void {
        this.metrics.failedRequests++;

        if (error instanceof BridgeError) {
            const statusCode = this.getHttpStatusCode(error.type);
            
            res.status(statusCode).json({
                success: false,
                error: error.message,
                errorCode: error.type,
                characterId: error.characterId,
                userId: error.userId,
                requestId,
                timestamp: new Date().toISOString()
            });
        } else {
            this.logger.error('未预期的错误', error);
            
            res.status(500).json({
                success: false,
                error: '内部服务器错误',
                errorCode: 'INTERNAL_SERVER_ERROR',
                requestId,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * 获取 HTTP 状态码
     */
    private getHttpStatusCode(errorType: ErrorType): number {
        const statusMap = {
            [ErrorType.INVALID_REQUEST]: 400,
            [ErrorType.RUNTIME_NOT_FOUND]: 404,
            [ErrorType.RUNTIME_UNHEALTHY]: 503,
            [ErrorType.TIMEOUT]: 408,
            [ErrorType.RATE_LIMIT]: 429,
            [ErrorType.OPENAI_ERROR]: 502,
            [ErrorType.SUPABASE_ERROR]: 502,
            [ErrorType.UNKNOWN_ERROR]: 500
        };

        return statusMap[errorType] || 500;
    }

    /**
     * 更新指标
     */
    private updateMetrics(req: any, res: any, duration: number): void {
        this.metrics.totalRequests++;
        
        if (res.statusCode < 400) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
        }

        // 更新平均响应时间
        const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
        this.metrics.averageResponseTime = (totalTime + duration) / this.metrics.totalRequests;

        // 更新字符使用统计
        const characterId = req.body?.characterId;
        if (characterId) {
            this.metrics.characterUsage[characterId] = 
                (this.metrics.characterUsage[characterId] || 0) + 1;
        }

        // 更新系统指标
        const memUsage = process.memoryUsage();
        this.metrics.memoryUsage = Math.round(memUsage.rss / 1024 / 1024); // MB
    }

    /**
     * 获取指标
     */
    private getMetrics(): BridgeMetrics {
        return {
            ...this.metrics,
            elizaSuccessRate: this.metrics.elizaRequests > 0 ? 
                (this.metrics.successfulRequests / this.metrics.elizaRequests) : 0,
            fallbackSuccessRate: this.metrics.fallbackRequests > 0 ? 
                (this.metrics.successfulRequests / this.metrics.fallbackRequests) : 0
        };
    }

    /**
     * 格式化运行时间
     */
    private formatUptime(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * 启动服务
     */
    async start(port: number = 3001): Promise<void> {
        try {
            // 初始化 Runtime 管理器
            this.logger.info('初始化 ElizaOS Runtime 管理器...');
            await this.runtimeManager.initialize();

            // 启动服务器
            this.server.listen(port, async () => {
                const runtimeStatus = await this.runtimeManager.getHealthStatus();
                const allCharacters = await this.runtimeManager.getAllCharacters();
                
                this.logger.info(`🚀 ElizaOS 桥接服务已启动`, {
                    port,
                    elizaEnabled: this.config.elizaEnabled,
                    fallbackEnabled: this.config.fallbackEnabled,
                    charactersLoaded: `${runtimeStatus.charactersLoaded}/${allCharacters.length}`,
                    status: runtimeStatus.status
                });

                console.log('');
                console.log('🎉 ElizaOS 集成服务就绪！');
                console.log(`📡 HTTP API: http://localhost:${port}`);
                console.log(`🔌 WebSocket: ws://localhost:${port}/ws`);
                console.log(`🏥 健康检查: http://localhost:${port}/health`);
                console.log(`📊 指标监控: http://localhost:${port}/metrics`);
                console.log(`🤖 角色数量: ${runtimeStatus.charactersLoaded} 个`);
                console.log(`💾 记忆系统: ${runtimeStatus.memoryConnected ? '已连接' : '未连接'}`);
                console.log(`📈 系统状态: ${runtimeStatus.status}`);
                console.log('');
            });

        } catch (error) {
            this.logger.error('❌ 桥接服务启动失败', error);
            throw error;
        }
    }

    /**
     * 优雅关闭
     */
    async shutdown(): Promise<void> {
        this.logger.info('🔄 正在关闭桥接服务...');

        // 关闭 WebSocket 服务器
        if (this.wss) {
            this.wss.close();
        }

        // 关闭 HTTP 服务器
        if (this.server) {
            this.server.close();
        }

        // 关闭 Runtime 管理器
        await this.runtimeManager.shutdown();

        this.logger.info('✅ 桥接服务已关闭');
    }
}