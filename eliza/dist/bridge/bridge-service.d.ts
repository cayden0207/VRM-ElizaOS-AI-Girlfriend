/**
 * ElizaOS API 桥接服务
 * 统一接口，连接现有系统与 ElizaOS
 */
export declare class ElizaBridgeService {
    private app;
    private server;
    private wss;
    private runtimeManager;
    private logger;
    private config;
    private metrics;
    private startTime;
    private readonly voiceMapping;
    constructor();
    /**
     * 初始化指标
     */
    private initializeMetrics;
    /**
     * 设置中间件
     */
    private setupMiddleware;
    /**
     * 设置路由
     */
    private setupRoutes;
    /**
     * 处理聊天请求
     */
    private handleChatRequest;
    /**
     * 处理 ElizaOS 消息
     */
    private handleElizaMessage;
    /**
     * 处理消息的核心逻辑
     */
    private processMessage;
    /**
     * 增强响应 - 添加 VRM 动画和语音
     */
    private enhanceResponse;
    /**
     * 获取 VRM 动画数据
     */
    private getAnimationData;
    /**
     * 生成语音 URL (模拟实现)
     */
    private generateVoiceUrl;
    /**
     * 降级处理
     */
    private handleFallback;
    /**
     * 设置 WebSocket
     */
    private setupWebSocket;
    /**
     * 处理 WebSocket 消息
     */
    private handleWebSocketMessage;
    /**
     * 错误处理
     */
    private handleError;
    /**
     * 获取 HTTP 状态码
     */
    private getHttpStatusCode;
    /**
     * 更新指标
     */
    private updateMetrics;
    /**
     * 获取指标
     */
    private getMetrics;
    /**
     * 格式化运行时间
     */
    private formatUptime;
    /**
     * 启动服务
     */
    start(port?: number): Promise<void>;
    /**
     * 优雅关闭
     */
    shutdown(): Promise<void>;
}
