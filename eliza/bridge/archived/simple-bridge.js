/**
 * 简化版 ElizaOS 桥接服务 (JavaScript)
 * 用于快速 POC 验证
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

class SimpleBridgeService {
    constructor() {
        this.app = express();
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Character-Id']
        }));
        
        this.app.use(express.json({ limit: '10mb' }));
        
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // 健康检查
        this.app.get('/health', (req, res) => {
            res.json({
                success: true,
                service: 'simple-eliza-bridge',
                version: '1.0.0-poc',
                timestamp: new Date().toISOString(),
                elizaOS: {
                    initialized: true,
                    totalRuntimes: 25,
                    healthyCount: 25,
                    runtimes: this.generateMockRuntimeStatus()
                },
                config: {
                    elizaEnabled: true,
                    fallbackEnabled: true,
                    nodeEnv: process.env.NODE_ENV || 'development'
                }
            });
        });

        // 角色状态
        this.app.get('/api/characters/:characterId/status', (req, res) => {
            const { characterId } = req.params;
            const validCharacters = ['alice', 'ash', 'bobo', 'elinyaa', 'fliza'];
            
            if (validCharacters.includes(characterId.toLowerCase())) {
                res.json({
                    success: true,
                    data: {
                        characterId: characterId,
                        status: 'healthy',
                        available: true,
                        lastCheck: new Date().toISOString(),
                        errorCount: 0,
                        responseTime: Math.floor(Math.random() * 200) + 50,
                        runtimeInitialized: true
                    }
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: `角色 ${characterId} 未找到`,
                    errorCode: 'RUNTIME_NOT_FOUND'
                });
            }
        });

        // 聊天接口 - 模拟 ElizaOS 响应
        this.app.post('/api/chat', async (req, res) => {
            const startTime = Date.now();
            
            try {
                const { userId, characterId, message, options = {} } = req.body;

                // 参数验证
                if (!userId || !characterId || !message) {
                    return res.status(400).json({
                        success: false,
                        error: '缺少必需参数: userId, characterId, message',
                        errorCode: 'INVALID_REQUEST'
                    });
                }

                // 模拟处理延迟
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

                // 生成模拟响应
                const mockResponse = this.generateMockResponse(characterId, message, userId);
                
                // 尝试保存到数据库 (模拟记忆)
                try {
                    await this.saveMockMemory(userId, characterId, message, mockResponse.text);
                    mockResponse.memoryUpdated = true;
                } catch (error) {
                    console.warn('模拟记忆保存失败:', error.message);
                    mockResponse.memoryUpdated = false;
                }

                mockResponse.responseTime = Date.now() - startTime;

                res.json({
                    success: true,
                    data: mockResponse,
                    source: 'mock-eliza-os',
                    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                });

            } catch (error) {
                console.error('聊天处理失败:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    errorCode: 'INTERNAL_SERVER_ERROR',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 错误处理
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not Found',
                errorCode: 'NOT_FOUND',
                path: req.originalUrl
            });
        });
    }

    generateMockRuntimeStatus() {
        const characters = ['alice', 'ash', 'bobo', 'elinyaa', 'fliza', 'imeris', 'kyoko', 'lena', 'lilium', 'maple'];
        const runtimes = {};
        
        for (const char of characters) {
            runtimes[char] = {
                status: 'healthy',
                lastCheck: new Date().toISOString(),
                errorCount: 0,
                responseTime: Math.floor(Math.random() * 200) + 50
            };
        }
        
        return runtimes;
    }

    generateMockResponse(characterId, message, userId) {
        // 角色特定的回复模板
        const characterResponses = {
            alice: [
                "哎呀，你说得对呀！让我们一起跳个舞庆祝一下吧~ 💃",
                "真的吗？太有趣了！我也想了解更多呢~",
                "哇哦！这听起来很棒！我们来聊聊你的想法吧！",
                "你知道吗？我觉得和你聊天真的很开心！✨"
            ],
            ash: [
                "嗯，这是个很有趣的观点。让我想想...",
                "从逻辑上分析，这确实有道理。",
                "我需要更多信息才能给出准确的判断。",
                "这个问题值得深入思考。"
            ],
            bobo: [
                "哦... 这样啊... 我觉得很温暖呢 💕",
                "嗯嗯，我也这么想... 你真的很善解人意",
                "谢谢你跟我分享这些... 感觉很安心",
                "我... 我也想和你一起... 🙈"
            ]
        };

        const responses = characterResponses[characterId.toLowerCase()] || [
            "很高兴和你聊天！",
            "这很有趣！",
            "我明白你的意思。",
            "谢谢你的分享。"
        ];

        // 简单的上下文感知
        let selectedResponse;
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('你好') || lowerMessage.includes('hello')) {
            selectedResponse = `你好！我是${characterId.charAt(0).toUpperCase() + characterId.slice(1)}，很高兴认识你！`;
        } else if (lowerMessage.includes('名字') || lowerMessage.includes('name')) {
            selectedResponse = `我的名字是${characterId.charAt(0).toUpperCase() + characterId.slice(1)}！你可以叫我${characterId}~`;
        } else if (lowerMessage.includes('喜欢') || lowerMessage.includes('爱好')) {
            const hobbies = {
                alice: '跳舞和唱歌',
                ash: '读书和编程',
                bobo: '画画和安静地思考'
            };
            selectedResponse = `我最喜欢${hobbies[characterId] || '和你聊天'}！你呢？`;
        } else {
            selectedResponse = responses[Math.floor(Math.random() * responses.length)];
        }

        // 检测情感
        let emotion = 'neutral';
        if (lowerMessage.includes('开心') || lowerMessage.includes('高兴') || lowerMessage.includes('哈哈')) {
            emotion = 'happy';
        } else if (lowerMessage.includes('难过') || lowerMessage.includes('伤心')) {
            emotion = 'sad';
        } else if (characterId === 'alice' && Math.random() > 0.5) {
            emotion = 'happy'; // Alice 倾向于开心
        }

        return {
            text: selectedResponse,
            characterId: characterId,
            emotion: emotion,
            confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
            memoryUpdated: false, // 稍后更新
            responseTime: 0, // 稍后更新
            animation: emotion !== 'neutral' ? {
                type: emotion,
                duration: 3000,
                intensity: 0.8
            } : undefined,
            metadata: {
                userId: userId,
                roomId: `${userId}_${characterId}`,
                timestamp: new Date().toISOString(),
                source: 'mock-eliza-os'
            }
        };
    }

    async saveMockMemory(userId, characterId, userMessage, botResponse) {
        // 模拟保存记忆到 Supabase
        try {
            const memoryEntry = {
                user_id: userId,
                character_id: characterId,
                content: `用户说: "${userMessage}" | 我回复: "${botResponse}"`,
                embedding: this.generateMockEmbedding(), // 模拟向量
                memory_type: 'conversation',
                importance_score: Math.random() * 0.5 + 0.5,
                metadata: {
                    timestamp: new Date().toISOString(),
                    source: 'mock-chat'
                },
                created_at: new Date().toISOString()
            };

            // 实际插入数据库 (如果连接正常)
            if (this.supabase) {
                await this.supabase
                    .from('memory_vectors')
                    .insert(memoryEntry);
                console.log(`保存记忆: ${userId} -> ${characterId}`);
            }
        } catch (error) {
            console.warn('记忆保存失败 (这是正常的，因为我们使用模拟数据):', error.message);
            throw error;
        }
    }

    generateMockEmbedding() {
        // 生成 1536 维的模拟向量 (与 text-embedding-3-small 兼容)
        return Array(1536).fill(0).map(() => (Math.random() - 0.5) * 2);
    }

    async start(port = 3001) {
        try {
            // 测试数据库连接
            try {
                await this.supabase.from('memory_vectors').select('count').limit(1);
                console.log('✅ Supabase 连接正常');
            } catch (error) {
                console.warn('⚠️ Supabase 连接失败，使用模拟模式:', error.message);
            }

            this.app.listen(port, () => {
                console.log('');
                console.log('🎉 简化版 ElizaOS 桥接服务已启动！');
                console.log(`📡 HTTP API: http://localhost:${port}`);
                console.log(`🏥 健康检查: http://localhost:${port}/health`);
                console.log(`💬 聊天测试: POST http://localhost:${port}/api/chat`);
                console.log('');
                console.log('📝 这是用于 POC 验证的简化版本');
                console.log('📝 支持基础对话、角色状态检查和模拟记忆功能');
                console.log('');
            });

        } catch (error) {
            console.error('❌ 服务启动失败:', error);
            throw error;
        }
    }
}

// 启动服务
const currentModuleUrl = new URL(import.meta.url).pathname;
const scriptPath = process.argv[1];
if (currentModuleUrl.endsWith(scriptPath) || import.meta.url.includes('simple-bridge.js')) {
    const service = new SimpleBridgeService();
    const port = parseInt(process.env.ELIZA_BRIDGE_PORT || '3001');
    
    service.start(port).catch(error => {
        console.error('服务启动失败:', error);
        process.exit(1);
    });
}

export { SimpleBridgeService };