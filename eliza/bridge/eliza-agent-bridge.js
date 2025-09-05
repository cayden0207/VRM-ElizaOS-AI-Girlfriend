import express from 'express';
import cors from 'cors';
import { AgentRuntime, ModelProviderName, elizaLogger } from '@ai16z/eliza';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    
    // Supabase客户端
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
      console.log('✅ Supabase initialized for memory storage');
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
      
      // 创建AgentRuntime实例
      const runtime = new AgentRuntime({
        character,
        databaseAdapter: this.supabase ? {
          // 使用Supabase作为记忆存储
          async getMemories(roomId, count = 10) {
            const { data } = await this.supabase
              .from('memories')
              .select('*')
              .eq('room_id', roomId)
              .order('created_at', { ascending: false })
              .limit(count);
            return data || [];
          },
          
          async createMemory(memory) {
            const { data } = await this.supabase
              .from('memories')
              .insert(memory)
              .select()
              .single();
            return data;
          },
          
          async searchMemories(query, roomId) {
            const { data } = await this.supabase
              .from('memories')
              .select('*')
              .eq('room_id', roomId)
              .textSearch('content', query)
              .limit(5);
            return data || [];
          }
        } : undefined,
        providers: [],
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
    
    // 聊天端点 - 使用真正的ElizaOS Agent
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { userId, characterId, message } = req.body;
        
        // 获取或创建Agent
        const agent = await this.getOrCreateAgent(characterId);
        
        // 创建会话房间ID
        const roomId = `${userId}-${characterId}`;
        
        // 使用ElizaOS Agent处理消息
        const response = await agent.processMessage({
          userId,
          roomId,
          content: { text: message },
          createdAt: Date.now()
        });
        
        // 返回响应
        res.json({
          success: true,
          data: {
            response: response.text || response.content?.text || '...',
            emotion: response.action || 'neutral',
            memories: response.memories || [],
            context: response.context || {}
          }
        });
        
      } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
          success: false,
          error: error.message
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
    
    const port = process.env.PORT || 3000;
    this.app.listen(port, () => {
      console.log(`🚀 ElizaOS Agent Bridge running on port ${port}`);
      console.log(`✅ Full ElizaOS integration with AgentRuntime`);
      console.log(`🧠 Memory system: ${this.supabase ? 'Supabase' : 'In-memory'}`);
    });
  }
}

// 启动服务
const bridge = new ElizaAgentBridge();
bridge.start();