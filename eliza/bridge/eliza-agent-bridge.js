import express from 'express';
import cors from 'cors';
import { AgentRuntime, ModelProviderName, elizaLogger, generateMessageResponse } from '@ai16z/eliza';
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

  // ===== Account ID resolution helpers =====
  isUuid(str) {
    return typeof str === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
  }

  parseWalletFromLegacy(legacy) {
    if (!legacy || typeof legacy !== 'string') return null;
    if (legacy.startsWith('wallet_')) return legacy.slice(7);
    return null;
  }

  async resolveAccountId({ accountId, walletAddress, legacyUserId }) {
    const supabase = this.databaseAdapter?.supabase;
    if (!supabase) {
      // 最低限度回退：允许传 UUID 直接用；否则兼容 wallet_ 前缀（仅在极端情况下）
      if (this.isUuid(accountId)) return { accountId, isNew: false, username: null, legacyUserId: legacyUserId || null };
      const wallet = (walletAddress || this.parseWalletFromLegacy(legacyUserId) || '').toString().toLowerCase();
      if (wallet && wallet.startsWith('0x')) return { accountId: `wallet_${wallet}`, isNew: false, username: wallet, legacyUserId: `wallet_${wallet}` };
      return { accountId: accountId || null, isNew: false, username: null, legacyUserId: legacyUserId || null };
    }

    // 1) canonical UUID provided
    if (this.isUuid(accountId)) {
      return { accountId, isNew: false, username: null, legacyUserId: legacyUserId || null };
    }

    // 2) derive wallet
    let wallet = walletAddress || this.parseWalletFromLegacy(legacyUserId);
    if (!wallet && typeof accountId === 'string' && accountId.startsWith('wallet_')) {
      wallet = this.parseWalletFromLegacy(accountId);
    }
    if (!wallet && typeof accountId === 'string' && accountId.startsWith('0x')) {
      wallet = accountId;
    }

    if (!wallet) {
      // nothing to resolve
      return { accountId: null, isNew: false, username: null, legacyUserId: null };
    }

    const identifier = wallet.toLowerCase();

    // 3) lookup identity
    try {
      const { data: ident } = await supabase
        .from('account_identities')
        .select('account_id')
        .eq('provider', 'wallet')
        .eq('identifier', identifier)
        .maybeSingle();
      if (ident?.account_id) {
        return { accountId: ident.account_id, isNew: false, username: identifier, legacyUserId: `wallet_${identifier}` };
      }
    } catch (_) {}

    // 4) create account + identity
    let createdAccountId = null;
    try {
      const { data: acc, error: accErr } = await supabase
        .from('accounts')
        .insert({ username: identifier, details: { createdFrom: 'wallet' } })
        .select()
        .single();
      if (accErr && accErr.code !== '23505') {
        console.error('create account error:', accErr);
      }
      createdAccountId = acc?.id;
    } catch (e) {
      // ignore, might already exist
    }

    // ensure account exists
    if (!createdAccountId) {
      const { data: acc2 } = await supabase
        .from('accounts')
        .select('id')
        .eq('username', identifier)
        .maybeSingle();
      createdAccountId = acc2?.id || null;
    }

    if (!createdAccountId) {
      return { accountId: null, isNew: false, username: identifier, legacyUserId: `wallet_${identifier}` };
    }

    try {
      await supabase
        .from('account_identities')
        .insert({ account_id: createdAccountId, provider: 'wallet', identifier })
        .select()
        .maybeSingle();
    } catch (e) {
      // on conflict ignore
    }
    return { accountId: createdAccountId, isNew: true, username: identifier, legacyUserId: `wallet_${identifier}` };
  }

  async resolveAccountIdFromParam(idParam) {
    const disableProfileDb = process.env.DISABLE_PROFILE_DB === '1' || process.env.DISABLE_PROFILE_DB === 'true';
    if (this.isUuid(idParam)) return idParam;
    if (disableProfileDb) {
      // In disabled mode, keep legacy id as canonical
      const legacy = typeof idParam === 'string' && idParam.startsWith('wallet_') ? idParam : null;
      const wallet = this.parseWalletFromLegacy(idParam) || (typeof idParam === 'string' && idParam.startsWith('0x') ? idParam.toLowerCase() : null);
      if (legacy) return legacy;
      if (wallet) return `wallet_${wallet}`;
      return idParam;
    }
    const wallet = this.parseWalletFromLegacy(idParam) || (typeof idParam === 'string' && idParam.startsWith('0x') ? idParam : null);
    const { accountId } = await this.resolveAccountId({ walletAddress: wallet, legacyUserId: idParam });
    return accountId || idParam; // fallback to original for compatibility
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
    
    // 用户认证端点（统一 accounts + account_identities，兼容 legacy；当禁用时不写库）
    this.app.post('/api/auth', async (req, res) => {
      try {
        const { walletAddress, accountId } = req.body || {};
        if (!walletAddress && !accountId) {
          return res.status(400).json({ success: false, error: 'walletAddress or accountId is required' });
        }
        const supabase = this.databaseAdapter?.supabase;
        const wallet = (walletAddress || '').toString().toLowerCase();

        // 如果传了 accountId 且为 UUID，直接返回
        if (this.isUuid(accountId)) {
          return res.json({ success: true, data: { accountId, legacyUserId: null, username: null, isNew: false } });
        }

        if (!wallet || !wallet.startsWith('0x')) {
          return res.status(400).json({ success: false, error: 'walletAddress is required and must start with 0x' });
        }

        // 1) 查 identity
        let accId = null; let isNew = false;
        const { data: ident } = await supabase
          .from('account_identities')
          .select('account_id')
          .eq('provider','wallet')
          .eq('identifier', wallet)
          .maybeSingle();
        if (ident?.account_id) {
          accId = ident.account_id;
        } else {
          // 2) 插入 accounts
          const { data: acc, error: e1 } = await supabase
            .from('accounts')
            .insert({ username: wallet, details: { createdFrom: 'wallet' } })
            .select()
            .maybeSingle();
          if (e1 && e1.code !== '23505') {
            console.error('create account error:', e1);
            return res.status(500).json({ success: false, error: 'Failed to create account' });
          }
          if (acc?.id) {
            accId = acc.id; isNew = true;
          } else {
            const { data: acc2, error: e2 } = await supabase
              .from('accounts')
              .select('id')
              .eq('username', wallet)
              .maybeSingle();
            if (e2 || !acc2?.id) return res.status(500).json({ success: false, error: 'Account lookup failed' });
            accId = acc2.id;
          }
          // 3) 插入 identity
          const { error: e3 } = await supabase
            .from('account_identities')
            .insert({ account_id: accId, provider: 'wallet', identifier: wallet });
          if (e3 && e3.code !== '23505') console.warn('create identity warn:', e3.message);
        }

        return res.json({ success: true, data: { accountId: accId, legacyUserId: `wallet_${wallet}`, username: wallet, isNew } });
      } catch (error) {
        console.error('❌ Authentication error:', {
          error: error.message,
          stack: error.stack,
          walletAddress: req.body?.walletAddress?.slice(0, 8) + '...',
          timestamp: new Date().toISOString()
        });
        res.status(500).json({ success: false, error: 'Authentication failed' });
      }
    });

    // 用户profile保存端点 - 暂时禁用写库（待新 schema 完成后重写）
    this.app.post('/api/profiles', async (req, res) => {
      return res.status(501).json({ success: false, error: 'Profiles API temporarily disabled for schema migration' });
    });

    // 聊天端点 - 使用真正的ElizaOS Agent (增强错误处理)
    this.app.post('/api/chat', async (req, res) => {
      // 先在 try 外安全提取并规范化，避免 catch 作用域问题
      const body = req.body || {};
      const userId = body.userId;
      const characterId = body.characterId;
      const message = body.message;
      const normalizedCharacterId = this.normalizeId(characterId);
      try {

        // 输入验证
        if ((!userId && !body.accountId) || !characterId || !message) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: accountId/userId, characterId, message'
          });
        }

        // ElizaOS兼容：userId (TEXT) → accountId (UUID) 映射
        let accountId = body.accountId;
        if (!accountId && userId) {
          // 通过userId查找对应的accountId
          try {
            if (this.databaseAdapter?.supabase) {
              // 方法1：直接在accounts表中查找（如果userId存储在username字段）
              let result = await this.databaseAdapter.supabase
                .from('accounts')
                .select('id')
                .eq('username', userId)
                .maybeSingle();

              if (result.data?.id) {
                accountId = result.data.id;
              } else {
                // 方法2：在account_identities表中查找
                result = await this.databaseAdapter.supabase
                  .from('account_identities')
                  .select('account_id')
                  .eq('identifier', userId)
                  .maybeSingle();

                if (result.data?.account_id) {
                  accountId = result.data.account_id;
                } else {
                  // 创建新账户（兼容模式）
                  const newAccount = await this.databaseAdapter.supabase
                    .from('accounts')
                    .insert({ username: userId, details: { createdFrom: 'chat-api' } })
                    .select('id')
                    .single();
                  accountId = newAccount.data?.id || userId; // fallback to userId
                }
              }
            } else {
              // 无数据库时，直接使用userId
              accountId = userId;
            }
          } catch (lookupError) {
            console.warn('⚠️ AccountId lookup failed:', lookupError.message);
            accountId = userId; // fallback
          }
        }

        console.log(`💬 Chat request: ${userId} (account: ${accountId}) → ${normalizedCharacterId}: "${message.substring(0, 50)}..."`);

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

        // 创建会话房间ID（使用accountId for UUID兼容）
        const roomId = `${accountId}-${normalizedCharacterId}`;

        // 使用ElizaOS Agent处理消息（保持userId为TEXT类型，符合ElizaOS标准）
        const messageObj = {
          userId: userId, // ElizaOS需要TEXT类型的userId
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
            const result = await generateMessageResponse({
              runtime: agent,
              context: response,
              modelClass: agent.getModel()
            });
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
            const emotion = result.action || 'neutral';
            await this.databaseAdapter.supabase.from('conversations').insert([
              { room_id: roomId, account_id: accountId, character_id: normalizedCharacterId, role: 'user', content: message, metadata: { timestamp: Date.now(), via: 'bridge', userId } },
              { room_id: roomId, account_id: accountId, character_id: normalizedCharacterId, role: 'assistant', content: (result.text || result.content?.text || ''), metadata: { timestamp: Date.now(), emotion, via: 'bridge', userId } }
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
          userId: body?.userId,
          characterId: normalizedCharacterId || body?.characterId,
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

    // 读取用户资料（规范）
    this.app.get('/api/profiles/:accountId', async (req, res) => {
      try {
        const accountId = req.params.accountId;
        if (!accountId) return res.status(400).json({ success: false, error: 'accountId is required' });
        const supabase = this.databaseAdapter?.supabase;
        if (!supabase) return res.json({ success: true, profile: null });
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('account_id', accountId)
          .maybeSingle();
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, profile: data || null });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    });

    // 写入/更新用户资料（规范）
    this.app.post('/api/profiles', async (req, res) => {
      try {
        const { accountId, name, avatarUrl, personality, interests, relationshipStyle } = req.body || {};
        if (!accountId) return res.status(400).json({ success: false, error: 'accountId is required' });
        const supabase = this.databaseAdapter?.supabase;
        if (!supabase) return res.status(500).json({ success: false, error: 'database unavailable' });
        const payload = {
          account_id: accountId,
          name: name || null,
          avatar_url: avatarUrl || null,
          personality: personality || null,
          interests: interests || null,
          relationship_style: relationshipStyle || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase
          .from('user_profiles')
          .upsert(payload, { onConflict: 'account_id' })
          .select()
          .maybeSingle();
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, profile: data || payload });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
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
