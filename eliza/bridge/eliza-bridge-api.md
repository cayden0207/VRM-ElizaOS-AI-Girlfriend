# 🌉 ElizaOS API 桥接层设计文档

## 📋 概述

API 桥接层是连接现有 VRM AI 女友系统与 ElizaOS 框架的核心组件，采用渐进式集成策略，确保系统稳定性和可扩展性。

---

## 🏗️ 架构设计

### 整体架构图
```
┌─────────────────────────────────────────────────────────────┐
│                    前端界面层                                │
│  (character-select.html + index.html + VRM 渲染)           │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────────────────────────────┐
│                API 桥接层                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   路由管理   │  │  请求转换   │  │  降级处理   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────▼──────────┐         ┌─────────────────────┐
        │   ElizaOS Core     │         │   现有系统 (备用)   │
        │  ┌───────────────┐ │         │  ┌───────────────┐  │
        │  │ Runtime 管理  │ │         │  │ Chat System   │  │
        │  │ 记忆系统      │ │  ◀────▶ │  │ Memory V2     │  │
        │  │ Agent 调度    │ │         │  │ VRM 动画      │  │
        │  └───────────────┘ │         │  │ 语音合成      │  │
        └────────────────────┘         │  └───────────────┘  │
                  │                    └─────────────────────┘
                  ▼
        ┌─────────────────────┐
        │   Supabase 数据库   │
        │  ┌───────────────┐  │
        │  │ memory_vectors│  │
        │  │ 用户会话      │  │
        │  │ 角色记忆      │  │
        │  └───────────────┘  │
        └─────────────────────┘
```

---

## 🔧 核心组件

### 1. ElizaOS Runtime 管理器

#### 功能职责
- 初始化和管理 25 个角色的 Runtime 实例
- 处理角色切换和会话隔离
- 监控 Runtime 健康状态
- 提供统一的 API 接口

#### 实现设计
```typescript
// eliza-runtime-manager.ts
import { AgentRuntime } from "@ai16z/eliza";

interface RuntimeConfig {
    characterId: string;
    supabaseClient: SupabaseClient;
    modelProvider: string;
    settings: RuntimeSettings;
}

class ElizaRuntimeManager {
    private runtimes: Map<string, AgentRuntime> = new Map();
    private healthStatus: Map<string, RuntimeHealth> = new Map();
    private initialized: boolean = false;
    
    async initialize(): Promise<void> {
        console.log('🚀 初始化 ElizaOS Runtime 管理器...');
        
        const characters = await this.loadCharacterConfigs();
        const initPromises = characters.map(char => 
            this.initializeCharacterRuntime(char)
        );
        
        const results = await Promise.allSettled(initPromises);
        this.logInitializationResults(results);
        
        this.initialized = true;
        this.startHealthMonitoring();
    }
    
    private async initializeCharacterRuntime(character: CharacterConfig): Promise<void> {
        try {
            const runtime = new AgentRuntime({
                character: character,
                modelProvider: process.env.MODEL_PROVIDER || "openai",
                supabaseClient: this.supabaseClient,
                settings: {
                    memory: {
                        enabled: true,
                        provider: "supabase",
                        tableName: "memory_vectors"
                    },
                    embedding: {
                        model: "text-embedding-3-small",
                        dimensions: 1536
                    }
                }
            });
            
            await runtime.initialize();
            this.runtimes.set(character.name.toLowerCase(), runtime);
            this.healthStatus.set(character.name.toLowerCase(), {
                status: 'healthy',
                lastCheck: new Date(),
                errorCount: 0
            });
            
            console.log(`✅ ${character.name} Runtime 初始化成功`);
        } catch (error) {
            console.error(`❌ ${character.name} Runtime 初始化失败:`, error);
            throw error;
        }
    }
    
    getRuntime(characterId: string): AgentRuntime {
        if (!this.initialized) {
            throw new Error('Runtime 管理器尚未初始化');
        }
        
        const runtime = this.runtimes.get(characterId.toLowerCase());
        if (!runtime) {
            throw new Error(`角色 ${characterId} 的 Runtime 未找到`);
        }
        
        const health = this.healthStatus.get(characterId.toLowerCase());
        if (health?.status !== 'healthy') {
            throw new Error(`角色 ${characterId} 的 Runtime 状态异常`);
        }
        
        return runtime;
    }
    
    async processMessage(
        userId: string, 
        characterId: string, 
        message: string,
        options: ProcessOptions = {}
    ): Promise<ProcessedResponse> {
        const startTime = Date.now();
        
        try {
            const runtime = this.getRuntime(characterId);
            const roomId = `${userId}_${characterId}`;
            
            const response = await runtime.processMessage({
                userId: userId,
                content: { text: message },
                roomId: roomId,
                agentId: characterId
            });
            
            const processedResponse: ProcessedResponse = {
                text: response.text || '',
                emotion: this.extractEmotion(response),
                confidence: response.confidence || 0.8,
                memoryUpdated: response.memoryUpdated || false,
                responseTime: Date.now() - startTime,
                characterId: characterId,
                metadata: {
                    userId: userId,
                    roomId: roomId,
                    timestamp: new Date().toISOString()
                }
            };
            
            // 记录成功调用
            this.recordSuccess(characterId, processedResponse.responseTime);
            
            return processedResponse;
            
        } catch (error) {
            this.recordError(characterId, error);
            throw new Error(`ElizaOS 处理消息失败: ${error.message}`);
        }
    }
    
    private extractEmotion(response: any): string {
        // 从 ElizaOS 响应中提取情感信息
        if (response.emotion) return response.emotion;
        if (response.mood) return response.mood;
        
        // 基于文本内容推断情感
        const text = response.text?.toLowerCase() || '';
        if (text.includes('哈哈') || text.includes('开心')) return 'happy';
        if (text.includes('难过') || text.includes('伤心')) return 'sad';
        if (text.includes('生气') || text.includes('愤怒')) return 'angry';
        if (text.includes('惊讶') || text.includes('震惊')) return 'surprised';
        
        return 'neutral';
    }
    
    private startHealthMonitoring(): void {
        setInterval(() => {
            this.performHealthCheck();
        }, 30000); // 每30秒检查一次
    }
    
    private async performHealthCheck(): Promise<void> {
        for (const [characterId, runtime] of this.runtimes) {
            try {
                // 简单的健康检查 - 发送测试消息
                await runtime.processMessage({
                    userId: 'health_check',
                    content: { text: 'ping' },
                    roomId: 'health_check'
                });
                
                this.healthStatus.set(characterId, {
                    status: 'healthy',
                    lastCheck: new Date(),
                    errorCount: 0
                });
            } catch (error) {
                const currentHealth = this.healthStatus.get(characterId);
                const errorCount = (currentHealth?.errorCount || 0) + 1;
                
                this.healthStatus.set(characterId, {
                    status: errorCount > 3 ? 'unhealthy' : 'degraded',
                    lastCheck: new Date(),
                    errorCount: errorCount,
                    lastError: error.message
                });
                
                console.warn(`⚠️ ${characterId} 健康检查失败 (${errorCount}/3):`, error.message);
            }
        }
    }
    
    getStatus(): RuntimeManagerStatus {
        const runtimeStatuses: { [key: string]: RuntimeHealth } = {};
        for (const [characterId, health] of this.healthStatus) {
            runtimeStatuses[characterId] = health;
        }
        
        return {
            initialized: this.initialized,
            totalRuntimes: this.runtimes.size,
            healthyCount: Array.from(this.healthStatus.values())
                .filter(h => h.status === 'healthy').length,
            runtimes: runtimeStatuses
        };
    }
}
```

### 2. API 桥接服务

#### 核心功能
- 统一 API 入口，兼容现有接口
- 请求格式转换和参数验证
- 智能降级和错误处理
- 性能监控和日志记录

#### 实现设计
```typescript
// eliza-bridge-service.ts
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

class ElizaBridgeService {
    private app: express.Application;
    private runtimeManager: ElizaRuntimeManager;
    private legacySystem: AIGirlfriendChatSystemV2;
    private fallbackEnabled: boolean = true;
    
    constructor() {
        this.app = express();
        this.runtimeManager = new ElizaRuntimeManager();
        this.legacySystem = new AIGirlfriendChatSystemV2();
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    private setupMiddleware(): void {
        // CORS 配置
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Character-Id']
        }));
        
        // 速率限制
        const limiter = rateLimit({
            windowMs: 60 * 1000, // 1 分钟
            max: 100, // 每分钟最多 100 个请求
            message: { error: '请求过于频繁，请稍后再试' }
        });
        this.app.use('/api/', limiter);
        
        // JSON 解析
        this.app.use(express.json({ limit: '10mb' }));
        
        // 请求日志
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }
    
    private setupRoutes(): void {
        // 健康检查
        this.app.get('/health', (req, res) => {
            const status = this.runtimeManager.getStatus();
            res.json({
                success: true,
                service: 'eliza-bridge',
                timestamp: new Date().toISOString(),
                elizaOS: status,
                fallback: {
                    enabled: this.fallbackEnabled,
                    system: 'legacy-chat-system-v2'
                }
            });
        });
        
        // 主要聊天接口 - 兼容现有格式
        this.app.post('/api/chat', async (req, res) => {
            try {
                const { userId, characterId, message, options = {} } = req.body;
                
                // 参数验证
                if (!userId || !characterId || !message) {
                    return res.status(400).json({
                        success: false,
                        error: '缺少必需参数: userId, characterId, message'
                    });
                }
                
                const response = await this.processMessage(
                    userId, characterId, message, options
                );
                
                res.json({
                    success: true,
                    data: response,
                    source: 'eliza-os'
                });
                
            } catch (error) {
                console.error('聊天接口错误:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    source: 'eliza-bridge'
                });
            }
        });
        
        // ElizaOS 特定接口
        this.app.post('/api/eliza/message', async (req, res) => {
            try {
                const response = await this.handleElizaMessage(req.body);
                res.json({ success: true, data: response });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // 角色状态查询
        this.app.get('/api/characters/:characterId/status', (req, res) => {
            try {
                const { characterId } = req.params;
                const runtime = this.runtimeManager.getRuntime(characterId);
                
                res.json({
                    success: true,
                    data: {
                        characterId: characterId,
                        status: 'active',
                        runtimeInitialized: true
                    }
                });
            } catch (error) {
                res.json({
                    success: false,
                    error: error.message,
                    fallbackAvailable: this.fallbackEnabled
                });
            }
        });
        
        // 记忆管理接口
        this.app.get('/api/memory/:userId/:characterId', async (req, res) => {
            try {
                const { userId, characterId } = req.params;
                const memories = await this.getCharacterMemories(userId, characterId);
                res.json({ success: true, data: memories });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }
    
    private async processMessage(
        userId: string,
        characterId: string,
        message: string,
        options: any
    ): Promise<any> {
        const startTime = Date.now();
        
        try {
            // 尝试使用 ElizaOS
            const elizaResponse = await this.runtimeManager.processMessage(
                userId, characterId, message, options
            );
            
            // 增强响应 - 添加 VRM 动画和语音
            const enhancedResponse = await this.enhanceResponse(
                elizaResponse, characterId, options
            );
            
            console.log(`✅ ElizaOS 响应成功: ${Date.now() - startTime}ms`);
            return enhancedResponse;
            
        } catch (error) {
            console.warn('ElizaOS 处理失败，使用降级方案:', error.message);
            
            if (this.fallbackEnabled) {
                return await this.legacySystem.sendMessage(
                    userId, characterId, message, options
                );
            }
            
            throw error;
        }
    }
    
    private async enhanceResponse(
        elizaResponse: ProcessedResponse,
        characterId: string,
        options: any
    ): Promise<EnhancedResponse> {
        // VRM 动画触发
        let animationData = null;
        if (elizaResponse.emotion && elizaResponse.emotion !== 'neutral') {
            animationData = this.legacySystem.getAnimationData(elizaResponse.emotion);
        }
        
        // 语音合成
        let audioUrl = null;
        if (elizaResponse.text && options.generateVoice !== false) {
            try {
                const voiceId = this.getCharacterVoiceId(characterId);
                audioUrl = await this.legacySystem.generateVoice(
                    elizaResponse.text, voiceId
                );
            } catch (error) {
                console.warn('语音生成失败:', error.message);
            }
        }
        
        return {
            ...elizaResponse,
            animation: animationData,
            audioUrl: audioUrl,
            enhanced: true,
            enhancementTime: Date.now() - (elizaResponse.metadata?.timestamp ? 
                new Date(elizaResponse.metadata.timestamp).getTime() : Date.now())
        };
    }
    
    private getCharacterVoiceId(characterId: string): string {
        const voiceMapping = {
            'alice': 'rEJAAHKQqr6yTNCh8xS0',
            'ash': 'bY4cOgafbv5vatmokfg0',
            'bobo': 'I7CpaIqk2oGPGCKvOPO9',
            // ... 其他角色映射
        };
        
        return voiceMapping[characterId.toLowerCase()] || 'default-voice-id';
    }
    
    async start(port: number = 3001): Promise<void> {
        try {
            // 初始化 ElizaOS Runtime 管理器
            await this.runtimeManager.initialize();
            
            // 初始化现有系统 (降级备用)
            await this.legacySystem.initialize();
            
            // 启动服务器
            this.app.listen(port, () => {
                console.log(`🚀 ElizaOS 桥接服务已启动: http://localhost:${port}`);
                console.log(`📊 Runtime 状态: ${this.runtimeManager.getStatus().healthyCount}/25 健康`);
                console.log(`🔄 降级模式: ${this.fallbackEnabled ? '已启用' : '已禁用'}`);
            });
            
        } catch (error) {
            console.error('❌ 桥接服务启动失败:', error);
            throw error;
        }
    }
}

// 启动服务
if (require.main === module) {
    const service = new ElizaBridgeService();
    const port = parseInt(process.env.ELIZA_BRIDGE_PORT || '3001');
    
    service.start(port).catch(error => {
        console.error('服务启动失败:', error);
        process.exit(1);
    });
}

export { ElizaBridgeService };
```

### 3. 前端集成适配器

#### 功能职责
- 修改现有前端代码以支持 ElizaOS
- 提供无缝切换机制
- 保持向后兼容性
- 处理新功能特性

#### 实现设计
```javascript
// chat-system-eliza-adapter.js
class ElizaChatSystemAdapter {
    constructor(config = {}) {
        this.elizaEnabled = config.enableEliza !== false;
        this.elizaEndpoint = config.elizaEndpoint || 'http://localhost:3001';
        this.fallbackEnabled = config.enableFallback !== false;
        this.legacySystem = new AIGirlfriendChatSystemV2(config);
        
        // 性能监控
        this.metrics = {
            totalRequests: 0,
            elizaRequests: 0,
            fallbackRequests: 0,
            averageResponseTime: 0,
            errorRate: 0
        };
    }
    
    async sendMessage(message, options = {}) {
        const startTime = Date.now();
        this.metrics.totalRequests++;
        
        try {
            if (this.elizaEnabled) {
                return await this.sendToEliza(message, options);
            } else {
                return await this.sendToLegacy(message, options);
            }
        } catch (error) {
            console.error('消息发送失败:', error);
            
            // 如果 ElizaOS 失败，尝试降级
            if (this.elizaEnabled && this.fallbackEnabled) {
                console.warn('ElizaOS 失败，使用降级模式');
                return await this.sendToLegacy(message, options);
            }
            
            throw error;
        } finally {
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime);
        }
    }
    
    async sendToEliza(message, options) {
        try {
            const requestData = {
                userId: this.userId || 'anonymous',
                characterId: this.currentCharacter,
                message: message,
                options: {
                    generateVoice: options.generateVoice,
                    includeAnimation: options.includeAnimation,
                    ...options
                }
            };
            
            const response = await fetch(`${this.elizaEndpoint}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': this.userId,
                    'X-Character-Id': this.currentCharacter
                },
                body: JSON.stringify(requestData),
                timeout: 10000 // 10秒超时
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'ElizaOS 响应错误');
            }
            
            this.metrics.elizaRequests++;
            
            // 处理 ElizaOS 响应
            return this.processElizaResponse(result.data);
            
        } catch (error) {
            console.error('ElizaOS 调用失败:', error);
            throw error;
        }
    }
    
    async sendToLegacy(message, options) {
        this.metrics.fallbackRequests++;
        return await this.legacySystem.sendMessage(message, options);
    }
    
    processElizaResponse(data) {
        // 处理 VRM 动画
        if (data.animation && this.vrmController) {
            this.vrmController.playAnimation(data.animation);
        }
        
        // 处理语音播放
        if (data.audioUrl) {
            this.playVoice(data.audioUrl);
        }
        
        // 处理情感表达
        if (data.emotion && this.emotionController) {
            this.emotionController.setEmotion(data.emotion);
        }
        
        // 返回统一格式
        return {
            text: data.text,
            characterId: data.characterId,
            emotion: data.emotion,
            audioUrl: data.audioUrl,
            responseTime: data.responseTime,
            source: 'eliza-os',
            metadata: data.metadata
        };
    }
    
    // 角色切换
    async switchCharacter(characterId) {
        this.currentCharacter = characterId;
        
        // 检查 ElizaOS 中角色状态
        if (this.elizaEnabled) {
            try {
                const response = await fetch(
                    `${this.elizaEndpoint}/api/characters/${characterId}/status`
                );
                const result = await response.json();
                
                if (!result.success) {
                    console.warn(`角色 ${characterId} 在 ElizaOS 中不可用，将使用降级模式`);
                    // 可以选择暂时禁用 ElizaOS 或继续使用降级
                }
            } catch (error) {
                console.warn('角色状态检查失败:', error);
            }
        }
        
        // 继续现有的角色切换逻辑
        return await this.legacySystem.switchCharacter(characterId);
    }
    
    // 记忆管理
    async getMemories(userId, characterId) {
        if (!this.elizaEnabled) {
            return await this.legacySystem.getMemories(userId, characterId);
        }
        
        try {
            const response = await fetch(
                `${this.elizaEndpoint}/api/memory/${userId}/${characterId}`
            );
            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.warn('ElizaOS 记忆获取失败，使用降级:', error);
            return await this.legacySystem.getMemories(userId, characterId);
        }
    }
    
    // 性能监控
    updateMetrics(responseTime) {
        const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
        this.metrics.averageResponseTime = (totalTime + responseTime) / this.metrics.totalRequests;
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            elizaUsageRate: this.metrics.elizaRequests / this.metrics.totalRequests,
            fallbackUsageRate: this.metrics.fallbackRequests / this.metrics.totalRequests
        };
    }
    
    // 配置管理
    updateConfig(config) {
        if (config.enableEliza !== undefined) {
            this.elizaEnabled = config.enableEliza;
            console.log(`ElizaOS 模式: ${this.elizaEnabled ? '启用' : '禁用'}`);
        }
        
        if (config.enableFallback !== undefined) {
            this.fallbackEnabled = config.enableFallback;
            console.log(`降级模式: ${this.fallbackEnabled ? '启用' : '禁用'}`);
        }
        
        if (config.elizaEndpoint) {
            this.elizaEndpoint = config.elizaEndpoint;
            console.log(`ElizaOS 端点: ${this.elizaEndpoint}`);
        }
    }
}

// 全局配置和初始化
window.ElizaConfig = {
    enableEliza: true,
    enableFallback: true,
    elizaEndpoint: '/api', // 生产环境下会通过反向代理
    debugMode: false
};

// 替换现有的聊天系统初始化
const chatSystem = new ElizaChatSystemAdapter(window.ElizaConfig);

// 兼容性包装 - 保持现有接口不变
window.sendMessage = (message, options) => chatSystem.sendMessage(message, options);
window.switchCharacter = (characterId) => chatSystem.switchCharacter(characterId);
window.getMemories = (userId, characterId) => chatSystem.getMemories(userId, characterId);

export { ElizaChatSystemAdapter };
```

---

## 📊 接口规范

### 1. HTTP API 接口

#### 基础聊天接口
```http
POST /api/chat
Content-Type: application/json

{
  "userId": "user123",
  "characterId": "alice",
  "message": "你好，Alice！",
  "options": {
    "generateVoice": true,
    "includeAnimation": true,
    "language": "zh-CN"
  }
}
```

**响应格式:**
```json
{
  "success": true,
  "data": {
    "text": "你好！很高兴见到你～让我们一起跳舞吧！💃",
    "characterId": "alice",
    "emotion": "happy",
    "confidence": 0.92,
    "responseTime": 245,
    "memoryUpdated": true,
    "animation": {
      "type": "dance",
      "duration": 3000,
      "intensity": 0.8
    },
    "audioUrl": "https://api.elevenlabs.io/v1/text-to-speech/...",
    "metadata": {
      "userId": "user123",
      "roomId": "user123_alice",
      "timestamp": "2024-01-15T10:30:00Z",
      "source": "eliza-os"
    }
  },
  "source": "eliza-os"
}
```

#### 错误响应格式
```json
{
  "success": false,
  "error": "角色 alice 的 Runtime 未找到",
  "errorCode": "RUNTIME_NOT_FOUND",
  "fallbackAvailable": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 2. WebSocket 接口 (可选扩展)

```typescript
// WebSocket 消息格式
interface WebSocketMessage {
    type: 'chat' | 'status' | 'memory_update' | 'error';
    userId: string;
    characterId?: string;
    data: any;
    timestamp: string;
}

// 客户端发送
{
    "type": "chat",
    "userId": "user123",
    "characterId": "alice",
    "data": {
        "message": "你好",
        "options": {}
    }
}

// 服务器响应
{
    "type": "chat",
    "userId": "user123",
    "characterId": "alice",
    "data": {
        // 与 HTTP 响应格式相同
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 🔄 降级策略

### 降级触发条件
1. **ElizaOS Runtime 异常**
   - Runtime 初始化失败
   - 连续 3 次健康检查失败
   - 响应时间超过 5 秒

2. **系统资源不足**
   - 内存使用超过 1GB
   - CPU 使用率持续超过 80%
   - 数据库连接异常

3. **错误率过高**
   - 5 分钟内错误率超过 10%
   - 连续 10 个请求失败

### 降级处理流程
```typescript
class FallbackHandler {
    private shouldFallback(characterId: string, error: Error): boolean {
        // 检查角色特定的降级条件
        const health = this.healthStatus.get(characterId);
        
        if (health?.errorCount > 3) return true;
        if (error.message.includes('timeout')) return true;
        if (error.message.includes('ECONNREFUSED')) return true;
        
        return false;
    }
    
    private async executeFallback(
        userId: string, 
        characterId: string, 
        message: string,
        options: any
    ): Promise<any> {
        console.warn(`🔄 执行降级策略: ${characterId}`);
        
        // 记录降级事件
        this.recordFallbackEvent(characterId, 'eliza_failure');
        
        // 使用现有系统处理
        const response = await this.legacySystem.sendMessage(
            userId, characterId, message, options
        );
        
        // 添加降级标记
        response.source = 'fallback';
        response.fallbackReason = 'eliza_unavailable';
        
        return response;
    }
}
```

---

## 📈 监控与日志

### 关键指标
```typescript
interface BridgeMetrics {
    // 性能指标
    totalRequests: number;
    elizaRequests: number;
    fallbackRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    
    // 可靠性指标
    successRate: number;
    elizaSuccessRate: number;
    fallbackSuccessRate: number;
    
    // 业务指标
    characterUsage: { [characterId: string]: number };
    userSatisfaction: number;
    conversationLength: number;
    
    // 系统指标
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    runtimeHealth: { [characterId: string]: RuntimeHealth };
}
```

### 日志格式
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "eliza-bridge",
  "operation": "process_message",
  "userId": "user123",
  "characterId": "alice",
  "duration": 245,
  "success": true,
  "source": "eliza-os",
  "metadata": {
    "messageLength": 12,
    "responseLength": 45,
    "memoryUpdated": true,
    "emotion": "happy"
  }
}
```

---

## 🚀 部署配置

### 环境变量
```bash
# ElizaOS 配置
ELIZA_ENABLED=true
ELIZA_FALLBACK_ENABLED=true
MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Supabase 配置
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=eyJ...

# 服务配置
ELIZA_BRIDGE_PORT=3001
ALLOWED_ORIGINS=https://vrm-ai-girlfriend.vercel.app
LOG_LEVEL=INFO

# 性能配置
MAX_CONCURRENT_REQUESTS=50
REQUEST_TIMEOUT=10000
HEALTH_CHECK_INTERVAL=30000
```

### Docker 配置
```dockerfile
# Dockerfile.eliza-bridge
FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY eliza/ ./eliza/
COPY bridge/ ./bridge/

# 设置权限
USER node

EXPOSE 3001

CMD ["node", "bridge/eliza-bridge-service.js"]
```

### Vercel 部署配置
```json
{
  "functions": {
    "eliza/bridge/index.js": {
      "maxDuration": 15,
      "memory": 512,
      "runtime": "nodejs20.x"
    }
  },
  "routes": [
    {
      "src": "/api/eliza/(.*)",
      "dest": "/eliza/bridge/index.js"
    }
  ],
  "env": {
    "ELIZA_ENABLED": "@eliza_enabled",
    "ELIZA_FALLBACK_ENABLED": "@eliza_fallback_enabled"
  }
}
```

---

## 🧪 测试策略

### 单元测试
```typescript
describe('ElizaRuntimeManager', () => {
    test('应该成功初始化所有角色 Runtime', async () => {
        const manager = new ElizaRuntimeManager();
        await manager.initialize();
        
        expect(manager.getStatus().totalRuntimes).toBe(25);
        expect(manager.getStatus().healthyCount).toBe(25);
    });
    
    test('应该正确处理角色消息', async () => {
        const response = await manager.processMessage(
            'test_user', 'alice', '你好'
        );
        
        expect(response.text).toBeDefined();
        expect(response.characterId).toBe('alice');
        expect(response.responseTime).toBeLessThan(1000);
    });
});
```

### 集成测试
```typescript
describe('ElizaBridgeService', () => {
    test('HTTP API 应该正常工作', async () => {
        const response = await request(app)
            .post('/api/chat')
            .send({
                userId: 'test_user',
                characterId: 'alice',
                message: '你好',
                options: { generateVoice: false }
            });
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.text).toBeDefined();
    });
});
```

---

## 📋 使用指南

### 快速开始
```bash
# 1. 安装依赖
npm install @ai16z/eliza @supabase/supabase-js

# 2. 配置环境变量
cp .env.example .env

# 3. 初始化角色配置
cd eliza && node scripts/generate-character.js all

# 4. 启动桥接服务
node bridge/eliza-bridge-service.js

# 5. 测试连接
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","characterId":"alice","message":"hello"}'
```

### 前端集成
```javascript
// 1. 替换现有初始化代码
const chatSystem = new ElizaChatSystemAdapter({
    enableEliza: true,
    enableFallback: true,
    elizaEndpoint: '/api/eliza'
});

// 2. 使用统一接口发送消息
const response = await chatSystem.sendMessage('你好', {
    generateVoice: true,
    includeAnimation: true
});

// 3. 处理响应
if (response.audioUrl) {
    await playAudio(response.audioUrl);
}
if (response.animation) {
    vrmController.playAnimation(response.animation);
}
```

---

**💡 总结**: API 桥接层提供了稳定、可扩展的集成方案，确保现有系统能够无缝升级到 ElizaOS，同时保持高可用性和性能表现。