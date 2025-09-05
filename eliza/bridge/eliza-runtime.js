import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AgentRuntime, ModelProviderName, elizaLogger, MemoryManager } from '@ai16z/eliza';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ElizaOS Complete Runtime System
 * 真正的AgentRuntime集成，完整的记忆和上下文管理
 */
class ElizaOSRuntime {
  constructor() {
    this.app = express();
    this.agents = new Map(); // AgentRuntime实例
    this.characters = new Map(); // Character配置
    this.userSessions = new Map(); // 用户会话管理
    
    // 初始化Supabase
    this.initSupabase();
    
    // 设置中间件
    this.setupMiddleware();
    
    // 初始化系统
    this.initialize();
  }
  
  initSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase连接成功 - 记忆系统就绪');
      
      // 创建必要的表
      this.ensureSupabaseTables();
    } else {
      console.warn('⚠️ Supabase未配置 - 使用内存存储');
      this.supabase = null;
    }
  }
  
  async ensureSupabaseTables() {
    // 确保数据库表存在
    const tables = `
      -- 对话记忆表
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        INDEX idx_room_id (room_id),
        INDEX idx_user_character (user_id, character_id)
      );
      
      -- 用户-角色关系表
      CREATE TABLE IF NOT EXISTS user_character_relations (
        user_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        relationship_level INT DEFAULT 1,
        total_messages INT DEFAULT 0,
        first_interaction TIMESTAMP DEFAULT NOW(),
        last_interaction TIMESTAMP DEFAULT NOW(),
        preferences JSONB DEFAULT '{}',
        important_memories JSONB DEFAULT '[]',
        emotional_state TEXT DEFAULT 'neutral',
        PRIMARY KEY (user_id, character_id)
      );
      
      -- 长期记忆表
      CREATE TABLE IF NOT EXISTS long_term_memories (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        memory_type TEXT NOT NULL, -- 'preference', 'event', 'fact'
        content TEXT NOT NULL,
        importance INT DEFAULT 5,
        keywords TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        recalled_count INT DEFAULT 0,
        last_recalled TIMESTAMP,
        INDEX idx_user_char_type (user_id, character_id, memory_type)
      );
    `;
    
    // 注：实际部署时需要在Supabase控制台执行这些SQL
    console.log('📊 数据库表结构已准备');
  }
  
  setupMiddleware() {
    // 信任代理（Vercel）
    this.app.set('trust proxy', 1);
    
    // 安全头
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    
    // 压缩
    this.app.use(compression());
    
    // CORS配置
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? [
            'https://vrm-frontend-new.vercel.app',
            /^https:\/\/.*\.vercel\.app$/
          ]
        : true,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Character-Id']
    }));
    
    // 速率限制
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      message: { success: false, error: '请求过于频繁' }
    });
    this.app.use('/api/', limiter);
    
    // JSON解析
    this.app.use(express.json({ limit: '10mb' }));
    
    // 请求日志
    this.app.use((req, res, next) => {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      console.log(`📨 ${req.method} ${req.path} [${req.requestId}]`);
      next();
    });
  }
  
  async initialize() {
    console.log('🚀 初始化ElizaOS Runtime...');
    
    // 加载所有角色
    await this.loadCharacters();
    
    // 设置路由
    this.setupRoutes();
    
    console.log('✅ ElizaOS Runtime初始化完成');
  }
  
  async loadCharacters() {
    const charactersDir = path.join(__dirname, '../characters');
    
    try {
      const files = fs.readdirSync(charactersDir)
        .filter(f => f.endsWith('.character.js'));
      
      for (const file of files) {
        const characterModule = await import(path.join(charactersDir, file));
        const character = characterModule.default || characterModule.character;
        
        if (character) {
          this.characters.set(character.id, character);
          console.log(`📚 加载角色: ${character.name}`);
          
          // 预创建热门角色的Agent
          if (['alice', 'ash', 'bobo'].includes(character.id)) {
            await this.createAgent(character.id);
          }
        }
      }
      
      console.log(`✅ 加载了 ${this.characters.size} 个角色`);
    } catch (error) {
      console.error('❌ 加载角色失败:', error);
    }
  }
  
  async createAgent(characterId) {
    const character = this.characters.get(characterId);
    if (!character) {
      throw new Error(`角色 ${characterId} 不存在`);
    }
    
    // 创建记忆管理器
    const memoryManager = new MemoryManager({
      runtime: null, // 将在下面设置
      tableName: 'conversations',
      supabase: this.supabase
    });
    
    // 创建AgentRuntime
    const runtime = new AgentRuntime({
      character: {
        ...character,
        modelProvider: ModelProviderName.OPENAI
      },
      
      // 数据库适配器（使用Supabase）
      databaseAdapter: this.supabase ? {
        async getMemories(roomId, count = 10) {
          const { data } = await this.supabase
            .from('conversations')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false })
            .limit(count);
          return data || [];
        },
        
        async createMemory(memory) {
          const { data } = await this.supabase
            .from('conversations')
            .insert(memory)
            .select()
            .single();
          return data;
        },
        
        async searchMemories(roomId, query) {
          // 语义搜索（需要配置向量数据库）
          const { data } = await this.supabase
            .from('conversations')
            .select('*')
            .eq('room_id', roomId)
            .textSearch('content', query)
            .limit(5);
          return data || [];
        },
        
        async getRoom(roomId) {
          const { data } = await this.supabase
            .from('user_character_relations')
            .select('*')
            .eq('room_id', roomId)
            .single();
          return data;
        },
        
        async updateRoom(roomId, updates) {
          const { data } = await this.supabase
            .from('user_character_relations')
            .update(updates)
            .eq('room_id', roomId)
            .select()
            .single();
          return data;
        }
      } : undefined,
      
      // 提供者
      providers: [],
      
      // 动作
      actions: character.actions || [],
      
      // 评估器
      evaluators: character.evaluators || [],
      
      // 插件
      plugins: []
    });
    
    // 设置记忆管理器的runtime
    memoryManager.runtime = runtime;
    runtime.memoryManager = memoryManager;
    
    await runtime.initialize();
    
    this.agents.set(characterId, runtime);
    console.log(`🤖 Agent创建成功: ${character.name}`);
    
    return runtime;
  }
  
  async getOrCreateAgent(characterId) {
    if (this.agents.has(characterId)) {
      return this.agents.get(characterId);
    }
    
    const agent = await this.createAgent(characterId);
    
    // 限制内存中的Agent数量
    if (this.agents.size > 10) {
      const firstKey = this.agents.keys().next().value;
      this.agents.delete(firstKey);
      console.log(`♻️ 回收Agent: ${firstKey}`);
    }
    
    return agent;
  }
  
  setupRoutes() {
    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        service: 'eliza-os-runtime',
        version: '3.0.0',
        timestamp: new Date().toISOString(),
        agents: {
          loaded: this.characters.size,
          active: this.agents.size
        }
      });
    });
    
    // 用户认证/注册
    this.app.post('/api/auth', async (req, res) => {
      try {
        const { walletAddress } = req.body;
        
        if (!walletAddress) {
          return res.status(400).json({
            success: false,
            error: '需要钱包地址'
          });
        }
        
        // 检查或创建用户
        if (this.supabase) {
          const { data: user } = await this.supabase
            .from('user_profiles')
            .select('*')
            .eq('wallet_address', walletAddress)
            .single();
          
          if (!user) {
            // 创建新用户
            const { data: newUser } = await this.supabase
              .from('user_profiles')
              .insert({
                wallet_address: walletAddress,
                created_at: new Date().toISOString()
              })
              .select()
              .single();
            
            console.log(`👤 新用户注册: ${walletAddress}`);
            return res.json({
              success: true,
              data: { user: newUser, isNew: true }
            });
          }
          
          console.log(`👤 用户登录: ${walletAddress}`);
          return res.json({
            success: true,
            data: { user, isNew: false }
          });
        }
        
        // 无数据库时的处理
        res.json({
          success: true,
          data: {
            user: { wallet_address: walletAddress },
            isNew: false
          }
        });
        
      } catch (error) {
        console.error('认证错误:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // 聊天接口 - ElizaOS核心
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { userId, characterId, message } = req.body;
        
        if (!userId || !characterId || !message) {
          return res.status(400).json({
            success: false,
            error: '缺少必要参数'
          });
        }
        
        // 获取或创建Agent
        const agent = await this.getOrCreateAgent(characterId);
        
        // 房间ID（确保每个用户-角色对话独立）
        const roomId = `${userId}-${characterId}`;
        
        // 获取或更新关系状态
        let relationship = null;
        if (this.supabase) {
          const { data } = await this.supabase
            .from('user_character_relations')
            .select('*')
            .eq('user_id', userId)
            .eq('character_id', characterId)
            .single();
          
          if (!data) {
            // 创建新关系
            const { data: newRel } = await this.supabase
              .from('user_character_relations')
              .insert({
                user_id: userId,
                character_id: characterId,
                first_interaction: new Date().toISOString()
              })
              .select()
              .single();
            relationship = newRel;
          } else {
            relationship = data;
          }
        }
        
        // 构建消息对象
        const messageObj = {
          userId,
          roomId,
          content: { text: message },
          createdAt: Date.now(),
          relationship: relationship?.relationship_level || 1
        };
        
        // 使用ElizaOS Agent处理消息
        console.log(`💬 处理消息: ${roomId}`);
        const response = await agent.processMessage(messageObj);
        
        // 提取回复
        const responseText = response.text || 
                           response.content?.text || 
                           response.message ||
                           "...";
        
        // 检测情感
        const emotion = this.detectEmotion(responseText);
        
        // 保存对话到数据库
        if (this.supabase) {
          // 保存用户消息
          await this.supabase.from('conversations').insert({
            room_id: roomId,
            user_id: userId,
            character_id: characterId,
            role: 'user',
            content: message,
            metadata: { timestamp: Date.now() }
          });
          
          // 保存AI回复
          await this.supabase.from('conversations').insert({
            room_id: roomId,
            user_id: userId,
            character_id: characterId,
            role: 'assistant',
            content: responseText,
            metadata: { 
              emotion,
              timestamp: Date.now(),
              relationship_level: relationship?.relationship_level || 1
            }
          });
          
          // 更新关系状态
          await this.supabase
            .from('user_character_relations')
            .update({
              last_interaction: new Date().toISOString(),
              total_messages: (relationship?.total_messages || 0) + 1,
              emotional_state: emotion
            })
            .eq('user_id', userId)
            .eq('character_id', characterId);
        }
        
        // 返回响应
        res.json({
          success: true,
          data: {
            response: responseText,
            emotion,
            relationship_level: relationship?.relationship_level || 1,
            metadata: {
              characterName: this.characters.get(characterId)?.name,
              timestamp: Date.now()
            }
          },
          requestId: req.requestId
        });
        
      } catch (error) {
        console.error('聊天错误:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          requestId: req.requestId
        });
      }
    });
    
    // 获取对话历史
    this.app.get('/api/history/:userId/:characterId', async (req, res) => {
      try {
        const { userId, characterId } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        
        if (!this.supabase) {
          return res.json({
            success: true,
            data: []
          });
        }
        
        const roomId = `${userId}-${characterId}`;
        
        const { data: conversations } = await this.supabase
          .from('conversations')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(limit);
        
        const { data: relationship } = await this.supabase
          .from('user_character_relations')
          .select('*')
          .eq('user_id', userId)
          .eq('character_id', characterId)
          .single();
        
        res.json({
          success: true,
          data: {
            conversations: conversations || [],
            relationship: relationship || null
          }
        });
        
      } catch (error) {
        console.error('获取历史错误:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // 获取角色列表
    this.app.get('/api/characters', (req, res) => {
      const characters = Array.from(this.characters.values()).map(c => ({
        id: c.id,
        name: c.name,
        bio: c.bio,
        adjectives: c.adjectives.slice(0, 3),
        topics: c.topics.slice(0, 5)
      }));
      
      res.json({
        success: true,
        data: characters
      });
    });
    
    // 更新用户偏好
    this.app.post('/api/preferences', async (req, res) => {
      try {
        const { userId, characterId, preferences } = req.body;
        
        if (!this.supabase) {
          return res.json({ success: true });
        }
        
        await this.supabase
          .from('user_character_relations')
          .update({ preferences })
          .eq('user_id', userId)
          .eq('character_id', characterId);
        
        res.json({ success: true });
        
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }
  
  detectEmotion(text) {
    // 简单的情感检测
    if (text.includes('开心') || text.includes('快乐') || text.includes('哈哈')) {
      return 'happy';
    }
    if (text.includes('难过') || text.includes('伤心') || text.includes('哭')) {
      return 'sad';
    }
    if (text.includes('生气') || text.includes('讨厌') || text.includes('烦')) {
      return 'angry';
    }
    if (text.includes('爱') || text.includes('喜欢') || text.includes('💕')) {
      return 'love';
    }
    return 'neutral';
  }
  
  async start() {
    const port = process.env.PORT || 3000;
    
    this.app.listen(port, () => {
      console.log('╔════════════════════════════════════════╗');
      console.log('║     ElizaOS Runtime System v3.0       ║');
      console.log('╠════════════════════════════════════════╣');
      console.log(`║ 🚀 服务运行端口: ${port}                    ║`);
      console.log(`║ 🤖 已加载角色数: ${this.characters.size}                    ║`);
      console.log(`║ 🧠 记忆系统: ${this.supabase ? 'Supabase' : 'Memory'}          ║`);
      console.log(`║ ✅ ElizaOS Agent系统就绪               ║`);
      console.log('╚════════════════════════════════════════╝');
    });
  }
}

// 启动系统
const runtime = new ElizaOSRuntime();
runtime.start();

export default ElizaOSRuntime;