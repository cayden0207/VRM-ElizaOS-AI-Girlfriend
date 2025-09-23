import express from 'express';
import cors from 'cors';
import { AgentRuntime, ModelProviderName, elizaLogger } from '@ai16z/eliza';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProviders, getProviderConfig } from '../providers/index.js';
import { createActions, getActionConfig } from '../actions/index.js';
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
  
  getConfig() {
    return {
      timeoutMs: parseInt(process.env.BRIDGE_TIMEOUT_MS || '12000', 10),
      retries: parseInt(process.env.BRIDGE_RETRIES || '1', 10),
      model: process.env.ELIZA_MODEL || 'gpt-4o-mini',
      maxTokens: parseInt(process.env.ELIZA_MAX_TOKENS || '160', 10)
    };
  }

  setupMiddleware() {
    this.app.use(cors({
      origin: true,
      credentials: true
    }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.set('trust proxy', 1);
  }

  normalizeId(id) {
    return (id || '').toString().trim().toLowerCase();
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
        messageExamples: (characterData.messageExamples || []).filter(example =>
          Array.isArray(example) && example.length > 0
        ),
        postExamples: characterData.postExamples || [],
        topics: characterData.topics || [],
        adjectives: characterData.adjectives || [],
        style: characterData.style || {},
        modelProvider: ModelProviderName.OPENAI,
        modelEndpointOverride: (process.env.ELIZA_MODEL || characterData.settings?.model || 'gpt-4o-mini'),
        settings: {
          secrets: {},
          voice: characterData.settings?.voice || {},
          model: process.env.ELIZA_MODEL || characterData.settings?.model || 'gpt-4o-mini',
          maxTokens: parseInt(process.env.ELIZA_MAX_TOKENS || '160', 10)
        }
      };
      
      // 创建AgentRuntime实例 - 使用完整的DatabaseAdapter
      const runtime = new AgentRuntime({
        character,
        databaseAdapter: this.databaseAdapter,
        providers: createProviders(),
        actions: createActions(),
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
          const characterId = this.normalizeId(characterData.name);
          
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
    const id = this.normalizeId(characterId);
    // 检查是否已有Agent
    if (this.agents.has(id)) {
      return this.agents.get(id);
    }
    
    // 获取角色配置
    let characterData = this.characters.get(id);
    if (!characterData) {
      // 尝试大小写不敏感匹配
      const fallbackKey = Array.from(this.characters.keys()).find(k => k.toLowerCase() === id);
      if (fallbackKey) characterData = this.characters.get(fallbackKey);
    }
    if (!characterData) {
      const available = Array.from(this.characters.keys()).slice(0, 10).join(', ');
      throw new Error(`Character ${characterId} not found. Available: ${available}${this.characters.size>10?'...':''}`);
    }
    
    // 创建新Agent
    const agent = await this.createAgent(characterData);
    this.agents.set(id, agent);
    
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
    
    // 用户认证端点 - 钱包地址登录/注册
    this.app.post('/api/auth', async (req, res) => {
      try {
        const { walletAddress } = req.body;

        // 输入验证
        if (!walletAddress) {
          return res.status(400).json({
            success: false,
            error: 'Wallet address is required'
          });
        }

        console.log(`🔑 User authentication request: ${walletAddress.slice(0, 8)}...`);

        // 检查用户是否存在
        let user = await this.databaseAdapter.getAccountByUsername(walletAddress);
        let isNew = false;

        if (!user) {
          // 创建新用户 (兼容钱包地址作为username)
          console.log(`👤 Creating new user: ${walletAddress.slice(0, 8)}...`);

          const newUserData = {
            username: walletAddress,
            name: `用户${walletAddress.slice(0, 6)}`,
            email: null,
            avatar_url: null,
            details: {
              walletAddress,
              registeredAt: new Date().toISOString(),
              loginCount: 1
            }
          };

          user = await this.databaseAdapter.createAccount(newUserData);

          if (!user) {
            return res.status(500).json({
              success: false,
              error: 'Failed to create user account'
            });
          }

          isNew = true;
          console.log(`✅ New user created: ${user.username}`);
        } else {
          // 更新登录计数
          console.log(`🔄 Existing user login: ${user.username}`);
          // 注意：实际生产中应该更新last_login等字段
        }

        // 返回前端期望的格式
        res.json({
          success: true,
          data: {
            user: {
              id: user.username,        // 前端期望的ID格式
              username: user.username,
              name: user.name,
              email: user.email,
              profile: {
                id: user.id,
                username: user.username,
                name: user.name,
                details: user.details
              }
            },
            isNew
          }
        });

        console.log(`✅ User authentication successful: ${user.username} (isNew: ${isNew})`);

      } catch (error) {
        console.error('❌ Authentication error:', {
          error: error.message,
          stack: error.stack,
          walletAddress: req.body?.walletAddress?.slice(0, 8) + '...',
          timestamp: new Date().toISOString()
        });

        res.status(500).json({
          success: false,
          error: 'Authentication failed',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // 用户profile保存端点 - 匹配前端调用
    this.app.post('/api/profiles', async (req, res) => {
      try {
        const { walletAddress, name, avatarUrl, personality, interests, relationshipStyle } = req.body;

        // 输入验证
        if (!walletAddress) {
          return res.status(400).json({
            success: false,
            error: 'Wallet address is required'
          });
        }

        console.log(`👤 Profile save request: ${walletAddress.slice(0, 8)}...`);

        // 检查用户是否存在
        let user = await this.databaseAdapter.getAccountByUsername(walletAddress);

        if (!user) {
          // 如果用户不存在，先创建账户
          const newUserData = {
            username: walletAddress,
            name: name || `用户${walletAddress.slice(0, 6)}`,
            email: null,
            avatar_url: avatarUrl || null,
            details: {
              walletAddress,
              registeredAt: new Date().toISOString(),
              loginCount: 1
            }
          };

          user = await this.databaseAdapter.createAccount(newUserData);
          console.log(`✅ New user created: ${user.username}`);
        }

        // 准备用户profile数据
        const profileData = {
          user_id: user.id,
          wallet_address: walletAddress,
          name: name || user.name,
          avatar_url: avatarUrl || user.avatar_url,
          personality: personality || null,
          interests: interests || null,
          relationship_style: relationshipStyle || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // 检查是否已有profile记录
        const { data: existingProfile } = await this.databaseAdapter.supabase
          .from('ai_girlfriend_user_profiles')
          .select('*')
          .eq('wallet_address', walletAddress)
          .single();

        let profileResult;
        if (existingProfile) {
          // 更新现有profile
          const { data, error } = await this.databaseAdapter.supabase
            .from('ai_girlfriend_user_profiles')
            .update({
              name: profileData.name,
              avatar_url: profileData.avatar_url,
              personality: profileData.personality,
              interests: profileData.interests,
              relationship_style: profileData.relationship_style,
              updated_at: profileData.updated_at
            })
            .eq('wallet_address', walletAddress)
            .select()
            .single();

          if (error) {
            console.error('❌ Profile update error:', error);
            return res.status(500).json({
              success: false,
              error: 'Failed to update user profile'
            });
          }

          profileResult = data;
          console.log(`✅ Profile updated: ${walletAddress.slice(0, 8)}...`);
        } else {
          // 创建新profile
          const { data, error } = await this.databaseAdapter.supabase
            .from('ai_girlfriend_user_profiles')
            .insert(profileData)
            .select()
            .single();

          if (error) {
            console.error('❌ Profile creation error:', error);
            return res.status(500).json({
              success: false,
              error: 'Failed to create user profile'
            });
          }

          profileResult = data;
          console.log(`✅ Profile created: ${walletAddress.slice(0, 8)}...`);
        }

        // 返回前端期望的格式
        res.json({
          success: true,
          data: {
            user: {
              id: user.username,
              username: user.username,
              name: profileResult.name,
              email: user.email,
              avatarUrl: profileResult.avatar_url,
              profile: profileResult
            }
          }
        });

      } catch (error) {
        console.error('❌ Profile save error:', {
          error: error.message,
          stack: error.stack,
          walletAddress: req.body?.walletAddress?.slice(0, 8) + '...',
          timestamp: new Date().toISOString()
        });

        res.status(500).json({
          success: false,
          error: 'Failed to save profile',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // 聊天端点 - 使用真正的ElizaOS Agent (增强错误处理)
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { userId, characterId, message } = req.body;
        const normalizedCharacterId = this.normalizeId(characterId);

        // 输入验证
        if (!userId || !characterId || !message) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: userId, characterId, message'
          });
        }

        console.log(`💬 Chat request: ${userId} → ${normalizedCharacterId}: "${message.substring(0, 50)}..."`);

        // 获取或创建Agent (with retry)
        let agent;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            agent = await this.getOrCreateAgent(normalizedCharacterId);
            break;
          } catch (agentError) {
            retryCount++;
            console.warn(`⚠️  Agent creation attempt ${retryCount}/${maxRetries} failed:`, agentError.message);
            if (retryCount >= maxRetries) throw agentError;
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
          }
        }

        // 创建会话房间ID
        const roomId = `${userId}-${normalizedCharacterId}`;

        // 使用ElizaOS Agent处理消息
        const messageObj = {
          userId,
          roomId,
          content: { text: message },
          createdAt: new Date().toISOString()
        };

        console.log(`🔄 Processing message for room: ${roomId}`);

        // 使用正确的ElizaOS方法名 (with timeout)
        const { timeoutMs, retries } = this.getConfig();
        const attempt = async () => {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Processing timeout')), timeoutMs)
          );
          const processMessage = async () => {
            const response = await agent.composeState(messageObj);
            const result = await agent.generateMessage(response);
            return { response, result };
          };
          return Promise.race([processMessage(), timeoutPromise]);
        };

        let response, result, err;
        for (let i = 0; i < Math.max(1, retries + 1); i++) {
          try {
            ({ response, result } = await attempt());
            err = null;
            if (i > 0) console.log(`✅ Chat attempt #${i+1} succeeded after retry`);
            break;
          } catch (e) {
            err = e;
            console.warn(`⚠️ Chat attempt #${i+1} failed:`, e.message);
            if (i === Math.max(1, retries + 1) - 1) throw e;
            await new Promise(r => setTimeout(r, 500));
          }
        }

        console.log(`✅ Message processed successfully for ${characterId}`);

        // 持久化对话到 conversations（便于后续回忆）
        try {
          if (this.databaseAdapter?.supabase) {
            const roomId = `${userId}-${normalizedCharacterId}`;
            const emotion = result.action || 'neutral';
            await this.databaseAdapter.supabase.from('conversations').insert([
              { room_id: roomId, user_id: userId, character_id: normalizedCharacterId, role: 'user', content: message, metadata: { timestamp: Date.now(), via: 'bridge' } },
              { room_id: roomId, user_id: userId, character_id: normalizedCharacterId, role: 'assistant', content: (result.text || result.content?.text || ''), metadata: { timestamp: Date.now(), emotion, via: 'bridge' } }
            ]);
          }
        } catch (persistErr) {
          console.warn('⚠️ Failed to persist conversations:', persistErr.message);
        }

        // 返回响应
        res.json({
          success: true,
          data: {
            response: result.text || result.content?.text || '抱歉，我现在无法回应。',
            emotion: result.action || 'neutral',
            memories: response.memories || [],
            context: response.context || {},
            timestamp: new Date().toISOString(),
            characterId: normalizedCharacterId,
            userId
          }
        });

      } catch (error) {
        console.error('❌ Chat error:', {
          error: error.message,
          stack: error.stack,
          userId: req.body?.userId,
          characterId: normalizedCharacterId || req.body?.characterId,
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
        id: this.normalizeId(c.name),
        name: c.name,
        bio: c.bio,
        topics: c.topics
      }));
      
      res.json({
        success: true,
        data: characters
      });
    });
    
    // 获取对话历史（返回 { conversations, relationship } 结构以兼容前端）
    this.app.get('/api/history/:userId/:characterId', async (req, res) => {
      try {
        const { userId, characterId } = req.params;
        const roomId = `${userId}-${characterId}`;
        const limit = parseInt(req.query?.limit) || 20;

        if (this.databaseAdapter?.supabase) {
          // conversations
          const { data: conversations } = await this.databaseAdapter.supabase
            .from('conversations')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false })
            .limit(limit);

          // relationship（如表不存在则返回 null）
          let relationship = null;
          try {
            const { data: rel } = await this.databaseAdapter.supabase
              .from('user_character_relations')
              .select('*')
              .eq('user_id', userId)
              .eq('character_id', characterId)
              .maybeSingle();
            relationship = rel || null;
          } catch (_) {
            relationship = null;
          }

          return res.json({
            success: true,
            data: {
              conversations: conversations || [],
              relationship
            }
          });
        }

        return res.json({ success: true, data: { conversations: [], relationship: null } });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取用户资料（与 serverless 保持兼容）
    this.app.get('/api/profiles/:userId', async (req, res) => {
      try {
        const userId = req.params.userId;
        if (!userId) return res.status(400).json({ error: 'User ID is required' });

        const dbId = userId.startsWith('wallet_') ? userId : `wallet_${userId}`;
        if (!this.databaseAdapter?.supabase) {
          return res.json({ success: true, profile: null });
        }

        const { data, error } = await this.databaseAdapter.supabase
          .from('users')
          .select('*')
          .eq('id', dbId)
          .maybeSingle();

        if (error) {
          console.error('❌ 数据库查询错误:', error);
          return res.status(500).json({ error: error.message });
        }

        return res.json({ success: true, profile: data });
      } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
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
      const cfg = this.getConfig();
      console.log(`⚙️ Bridge config → timeoutMs=${cfg.timeoutMs}, retries=${cfg.retries}, model=${cfg.model}, maxTokens=${cfg.maxTokens}`);
    });
  }

  logSystemStatus() {
    // Log Provider configuration
    const providerConfig = getProviderConfig();
    console.log('\n📊 SYSTEM STATUS REPORT:');
    console.log(`🔌 Provider system: ${providerConfig.count} providers loaded`);
    console.log(`📋 Provider types: ${providerConfig.types.join(', ')}`);
    console.log(`⚡ Required providers: ${providerConfig.required.join(', ')}`);

    // Log Action configuration
    const actionConfig = getActionConfig();
    console.log(`🎭 Action system: ${actionConfig.count} actions loaded`);
    console.log(`🎯 Action types: ${actionConfig.types.join(', ')}`);
    console.log(`⭐ Required actions: ${actionConfig.required.join(', ')}`);

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
        actions: getActionConfig(),
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
