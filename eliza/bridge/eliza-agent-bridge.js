import express from 'express';
import cors from 'cors';
import { AgentRuntime, ModelProviderName, elizaLogger } from '@ai16z/eliza';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProviders, getProviderConfig } from '../providers/index.js';
import { SupabaseDatabaseAdapter } from '../database/SupabaseDatabaseAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 完整的ElizaOS Agent集成
 * 使用真正的AgentRuntime而不是手动构建提示词
 */
class ElizaAgentBridge {
  constructor() {
    this.app = express();
    this.agents = new Map(); // 存储AgentRuntime实例
    this.characters = new Map(); // 存储角色配置

    // 初始化DatabaseAdapter
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)) {
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      this.databaseAdapter = new SupabaseDatabaseAdapter(
        process.env.SUPABASE_URL,
        supabaseKey
      );
      console.log('✅ SupabaseDatabaseAdapter initialized with', process.env.SUPABASE_SERVICE_KEY ? 'SERVICE_KEY' : 'ANON_KEY');
    }

    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(cors({
      origin: true,
      credentials: true
    }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.set('trust proxy', 1);
  }
  
  /**
   * 创建真正的ElizaOS Agent
   */
  async createAgent(characterData) {
    try {
      // 转换agent JSON为ElizaOS Character格式
      const character = {
        id: characterData.name.toLowerCase(),
        name: characterData.name,
        username: characterData.name.toLowerCase(),
        bio: Array.isArray(characterData.bio) 
          ? characterData.bio 
          : [characterData.bio],
        lore: characterData.lore || [],
        knowledge: characterData.lore || [],
        messageExamples: characterData.messageExamples || [],
        postExamples: characterData.postExamples || [],
        topics: characterData.topics || [],
        adjectives: characterData.adjectives || [],
        style: characterData.style || {},
        modelProvider: ModelProviderName.OPENAI,
        modelEndpointOverride: characterData.settings?.model || 'gpt-4o',
        settings: {
          secrets: {},
          voice: characterData.settings?.voice || {}
        }
      };
      
      // 创建AgentRuntime实例 - 使用完整的DatabaseAdapter
      const runtime = new AgentRuntime({
        character,
        databaseAdapter: this.databaseAdapter,
        providers: createProviders(),
        actions: [],
        evaluators: [],
        plugins: []
      });
      
      await runtime.initialize();
      console.log(`✅ Agent created: ${character.name}`);
      
      return runtime;
    } catch (error) {
      console.error(`❌ Failed to create agent: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 加载所有角色并创建Agent
   */
  async loadAgents() {
    const agentsDir = path.join(__dirname, '../agents');
    
    try {
      const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const filePath = path.join(agentsDir, file);
          const characterData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const characterId = characterData.name.toLowerCase();
          
          // 存储角色配置
          this.characters.set(characterId, characterData);
          
          // 为前3个角色预创建Agent（节省资源）
          if (['alice', 'ash', 'bobo'].includes(characterId)) {
            const agent = await this.createAgent(characterData);
            this.agents.set(characterId, agent);
          }
        } catch (error) {
          console.error(`❌ Failed to load ${file}: ${error.message}`);
        }
      }
      
      console.log(`✅ Loaded ${this.characters.size} characters`);
      console.log(`✅ Pre-created ${this.agents.size} agents`);
    } catch (error) {
      console.error('❌ Failed to load agents:', error);
    }
  }
  
  /**
   * 获取或创建Agent
   */
  async getOrCreateAgent(characterId) {
    // 检查是否已有Agent
    if (this.agents.has(characterId)) {
      return this.agents.get(characterId);
    }
    
    // 获取角色配置
    const characterData = this.characters.get(characterId);
    if (!characterData) {
      throw new Error(`Character ${characterId} not found`);
    }
    
    // 创建新Agent
    const agent = await this.createAgent(characterData);
    this.agents.set(characterId, agent);
    
    // 限制内存中的Agent数量
    if (this.agents.size > 5) {
      const firstKey = this.agents.keys().next().value;
      this.agents.delete(firstKey);
      console.log(`🗑️ Removed agent ${firstKey} to save memory`);
    }
    
    return agent;
  }
  
  setupRoutes() {
    // 健康检查
    this.app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        service: 'eliza-agent-bridge',
        version: '2.0.0',
        agents: {
          loaded: this.characters.size,
          active: this.agents.size
        }
      });
    });
    
    // 聊天端点 - 使用真正的ElizaOS Agent (增强错误处理)
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { userId, characterId, message } = req.body;

        // 输入验证
        if (!userId || !characterId || !message) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: userId, characterId, message'
          });
        }

        console.log(`💬 Chat request: ${userId} → ${characterId}: "${message.substring(0, 50)}..."`);

        // 获取或创建Agent (with retry)
        let agent;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            agent = await this.getOrCreateAgent(characterId);
            break;
          } catch (agentError) {
            retryCount++;
            console.warn(`⚠️  Agent creation attempt ${retryCount}/${maxRetries} failed:`, agentError.message);
            if (retryCount >= maxRetries) throw agentError;
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
          }
        }

        // 创建会话房间ID
        const roomId = `${userId}-${characterId}`;

        // 使用ElizaOS Agent处理消息
        const messageObj = {
          userId,
          roomId,
          content: { text: message },
          createdAt: Date.now()
        };

        console.log(`🔄 Processing message for room: ${roomId}`);

        // 使用正确的ElizaOS方法名 (with timeout)
        const processingTimeout = 30000; // 30 seconds
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Processing timeout')), processingTimeout)
        );

        const processMessage = async () => {
          const response = await agent.composeState(messageObj);
          const result = await agent.generateMessage(response);
          return { response, result };
        };

        const { response, result } = await Promise.race([
          processMessage(),
          timeoutPromise
        ]);

        console.log(`✅ Message processed successfully for ${characterId}`);

        // 返回响应
        res.json({
          success: true,
          data: {
            response: result.text || result.content?.text || '抱歉，我现在无法回应。',
            emotion: result.action || 'neutral',
            memories: response.memories || [],
            context: response.context || {},
            timestamp: new Date().toISOString(),
            characterId,
            userId
          }
        });

      } catch (error) {
        console.error('❌ Chat error:', {
          error: error.message,
          stack: error.stack,
          userId: req.body?.userId,
          characterId: req.body?.characterId,
          timestamp: new Date().toISOString()
        });

        // 不同类型的错误返回不同状态码
        let statusCode = 500;
        let errorMessage = '内部服务器错误';

        if (error.message.includes('timeout')) {
          statusCode = 408;
          errorMessage = '请求超时，请稍后重试';
        } else if (error.message.includes('not found')) {
          statusCode = 404;
          errorMessage = '找不到指定的角色';
        } else if (error.message.includes('validation')) {
          statusCode = 400;
          errorMessage = '请求参数无效';
        }

        res.status(statusCode).json({
          success: false,
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // 获取角色列表
    this.app.get('/api/characters', (req, res) => {
      const characters = Array.from(this.characters.values()).map(c => ({
        id: c.name.toLowerCase(),
        name: c.name,
        bio: c.bio,
        topics: c.topics
      }));
      
      res.json({
        success: true,
        data: characters
      });
    });
    
    // 获取对话历史
    this.app.get('/api/history/:userId/:characterId', async (req, res) => {
      try {
        const { userId, characterId } = req.params;
        const roomId = `${userId}-${characterId}`;
        
        if (this.supabase) {
          const { data } = await this.supabase
            .from('memories')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false })
            .limit(20);
          
          res.json({
            success: true,
            data: data || []
          });
        } else {
          res.json({
            success: true,
            data: []
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }
  
  async start() {
    await this.loadAgents();

    // Enhanced monitoring and error tracking
    this.logSystemStatus();
    this.setupHealthMonitoring();

    const port = process.env.PORT || 3000;
    this.app.listen(port, () => {
      console.log(`🚀 ElizaOS Agent Bridge running on port ${port}`);
      console.log(`✅ Full ElizaOS integration with AgentRuntime + Providers`);
      this.logEnvironmentStatus();
    });
  }

  logSystemStatus() {
    // Log Provider configuration
    const providerConfig = getProviderConfig();
    console.log('\n📊 SYSTEM STATUS REPORT:');
    console.log(`🔌 Provider system: ${providerConfig.count} providers loaded`);
    console.log(`📋 Provider types: ${providerConfig.types.join(', ')}`);
    console.log(`⚡ Required providers: ${providerConfig.required.join(', ')}`);

    // Log database status
    console.log(`🧠 Database: ${this.databaseAdapter ? 'SupabaseDatabaseAdapter' : 'None'}`);
    if (this.databaseAdapter) {
      console.log(`📡 Supabase URL: ${process.env.SUPABASE_URL ? 'Configured' : 'Missing'}`);
      console.log(`🔑 Supabase Key: ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ? 'Configured' : 'Missing'}`);
    }

    // Log OpenAI status
    console.log(`🤖 OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Missing'}`);
    console.log('\n');
  }

  logEnvironmentStatus() {
    console.log('\n🌍 ENVIRONMENT STATUS:');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🏠 Loaded characters: ${this.characters.size}`);
    console.log(`🚀 Active agents: ${this.agents.size}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log('\n');
  }

  setupHealthMonitoring() {
    // Health monitoring endpoint with detailed status
    this.app.get('/api/system/status', (req, res) => {
      const status = {
        service: 'eliza-agent-bridge',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        providers: getProviderConfig(),
        database: {
          adapter: this.databaseAdapter ? 'SupabaseDatabaseAdapter' : null,
          configured: !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY))
        },
        agents: {
          loaded: this.characters.size,
          active: this.agents.size,
          preloaded: ['alice', 'ash', 'bobo']
        },
        apis: {
          openai: !!process.env.OPENAI_API_KEY,
          elevenlabs: !!process.env.ELEVENLABS_API_KEY
        }
      };

      res.json({
        success: true,
        data: status
      });
    });

    // Performance monitoring
    this.app.use('/api/chat', (req, res, next) => {
      req.startTime = Date.now();
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - req.startTime;
        console.log(`📊 Chat API Response: ${responseTime}ms | Character: ${req.body?.characterId || 'unknown'} | User: ${req.body?.userId || 'unknown'}`);
        if (responseTime > 2000) {
          console.warn(`⚠️  SLOW RESPONSE: ${responseTime}ms exceeds 2000ms threshold`);
        }
        originalSend.call(this, data);
      };
      next();
    });
  }
}

// 启动服务
const bridge = new ElizaAgentBridge();
bridge.start();