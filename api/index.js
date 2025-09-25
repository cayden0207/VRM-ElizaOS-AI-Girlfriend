// VRM AI 女友系统 - 完整ElizaOS集成版 API
// 兼容Vercel serverless的ES模块导入方式

// 调试控制：设置 DEBUG_ELIZA=1 可显示完整错误日志
const DEBUG_ELIZA = process.env.DEBUG_ELIZA === '1' || process.env.DEBUG_ELIZA === 'true';

// 之前静默的错误现在可通过环境变量控制输出
process.on('unhandledRejection', (reason, promise) => {
  if (!DEBUG_ELIZA && reason && reason.message && reason.message.includes('databaseAdapter')) {
    console.warn('[silenced] Unhandled Rejection (databaseAdapter):', reason?.message);
    return;
  }
  console.error('Unhandled Rejection:', reason);
});

import { createClient } from '@supabase/supabase-js';

// Supabase 客户端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL || '';

console.log('🔍 Supabase配置检查:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
  urlFirst6: supabaseUrl?.substring(0, 6),
  keyFirst6: supabaseKey?.substring(0, 6)
});
console.log('🌉 Bridge配置检查:', {
  enabled: !!BRIDGE_URL,
  target: BRIDGE_URL ? BRIDGE_URL.replace(/(https?:\/\/)([^\s]+)/, '$1***') : null
});

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.warn('⚠️ Supabase未配置，用户档案保存功能将不可用');
}

// 动态导入ElizaOS（避免初始化时的导入问题）
let AgentRuntime, ModelProviderName, MemoryManager;

async function initializeEliza() {
  if (!AgentRuntime) {
    try {
      // Check环境变量
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
      console.log('🔑 API Keys 状态:', {
        openai: hasOpenAI ? '✅ 已配置' : '❌ 未配置',
        elevenlabs: hasElevenLabs ? '✅ 已配置' : '❌ 未配置'
      });
      
      const elizaModule = await import('@ai16z/eliza');
      AgentRuntime = elizaModule.AgentRuntime;
      ModelProviderName = elizaModule.ModelProviderName;
      MemoryManager = elizaModule.MemoryManager;
      console.log('✅ ElizaOS模块加载成功');
    } catch (error) {
      console.warn('⚠️ ElizaOS模块加载失败，使用简化版:', error.message);
      // 使用简化的模拟版本
      AgentRuntime = class MockAgentRuntime {
        constructor(config) {
          this.character = config.character;
        }
        async initialize() {}
        async processMessage(messageObj) {
          return {
            text: `我是${this.character.name}，很高兴和你聊天！`,
            content: { text: `我是${this.character.name}，很高兴和你聊天！` }
          };
        }
      };
      ModelProviderName = { OPENAI: 'openai' };
    }
  }
}

// ElizaOS Agent 缓存
const agents = new Map();
const characters = new Map();

import { promises as fs } from 'fs';
import path from 'path';

// Helper function to get the directory name in ES modules
// Note: __dirname is not available in ES modules by default.
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

/**
 * Parses the character.md file to dynamically load character profiles.
 * This makes character.md the single source of truth for character data.
 */
async function loadCharactersFromMarkdown() {
    const characters = {};
    try {
        // Correctly resolve path to character.md in the project root
        const mdPath = path.resolve(__dirname, '..', 'character.md');
        const mdContent = await fs.readFile(mdPath, 'utf-8');

        // Split profiles by the --- separator
        const profiles = mdContent.split(/\n---\n/);

        for (const profile of profiles) {
            if (profile.trim() === '' || profile.startsWith('#')) continue; // Skip empty parts or the main header

            const lines = profile.trim().split('\n');
            const nameMatch = lines.find(line => line.startsWith('## '));
            if (!nameMatch) continue;

            const name = nameMatch.substring(3).trim();
            const id = name.toLowerCase().replace(/\s+/g, '').replace('yii','yuuyii'); // Handle special case for Yuu Yii
            
            const charData = { id, name };

            const regex = /- \*\*(.*?)\*\*: (.*)/;
            for (const line of lines) {
                const match = line.match(regex);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim();

                    // Skip sample lines as specifically requested by the user
                    if (key.startsWith('Sample Line') || key.startsWith('示例台词') || key.startsWith('サンプルセリフ')) {
                        continue;
                    }

                    // Map markdown keys to object keys
                    switch (key) {
                        case 'Age':
                            charData.age = parseInt(value, 10);
                            break;
                        case 'Birthday':
                            charData.birthday = value;
                            break;
                        case 'Zodiac':
                            charData.zodiac = value;
                            break;
                        case 'Personality':
                            charData.personality = value;
                            break;
                        case 'Daily Interests':
                            charData.interests = value;
                            break;
                        case 'Likes & Dislikes':
                            charData.likes_and_dislikes = value;
                            break;
                        case 'Favorite Foods':
                            charData.favorite_foods = value;
                            break;
                        case 'Favorite Music':
                            charData.favorite_music = value;
                            break;
                        case 'Favorite Movies':
                            charData.favorite_movies = value;
                            break;
                        case 'Favorite Games':
                            charData.favorite_games = value;
                            break;
                        case 'Voice ID':
                            charData.voice_id = value;
                            break;
                    }
                }
            }
            characters[id] = charData;
        }
        console.log(`✅ Dynamically loaded ${Object.keys(characters).length} characters from character.md`);
        return characters;
    } catch (error) {
        console.error('❌ Failed to load characters from character.md:', error);
        // Return an empty object on failure to prevent server crash
        return {};
    }
}

// This will hold the dynamically loaded character data.
let characterData = {};

// Initialize character data at startup.
(async () => {
    characterData = await loadCharactersFromMarkdown();
})();

async function loadCharacter(characterId) {
  if (characters.has(characterId)) {
    return characters.get(characterId);
  }
  
  try {
    const normalizedId = characterId.toLowerCase();
    const charData = characterData[normalizedId];
    
    if (!charData) {
      // Fallback for generic characters not in character.md
      const character = {
        id: normalizedId,
        name: characterId,
        username: normalizedId,
        bio: [`An AI companion named ${characterId}`],
        lore: [`${characterId} is a friendly AI assistant.`],
        messageExamples: [], // Empty as per user request
        settings: {
          modelProvider: "openai",
          model: "gpt-4o",
          temperature: 0.7
        }
      };
      characters.set(characterId, character);
      console.log(`📚 Loaded generic character: ${character.name}`);
      return character;
    }
    
    // --- Build Rich Lore from Parsed Markdown Data ---
    const lore = [];
    if (charData.personality) lore.push(`Personality: ${charData.personality}.`);
    if (charData.interests) lore.push(`Daily Interests: ${charData.interests}.`);
    if (charData.likes_and_dislikes) lore.push(`Likes & Dislikes: ${charData.likes_and_dislikes}.`);
    if (charData.favorite_foods) lore.push(`Favorite Foods: ${charData.favorite_foods}.`);
    if (charData.favorite_music) lore.push(`Favorite Music: ${charData.favorite_music}.`);
    if (charData.favorite_movies) lore.push(`Favorite Movies: ${charData.favorite_movies}.`);
    if (charData.favorite_games) lore.push(`Favorite Games: ${charData.favorite_games}.`);

    const character = {
      id: charData.id,
      name: charData.name,
      username: charData.id,
      bio: [
        `You are ${charData.name}, a ${charData.age}-year-old ${charData.zodiac}. Your birthday is on ${charData.birthday}.`,
        `Your personality is described as: ${charData.personality}.`
      ],
      lore: lore, // Use the rich lore we just built
      messageExamples: [], // Explicitly empty as per user request
      settings: {
        modelProvider: "openai",
        model: "gpt-4o",
        temperature: 0.8 // Can be customized later if needed
      }
    };
    
    characters.set(characterId, character);
    console.log(`📚 Loaded rich character profile: ${character.name} (${characterId})`);
    return character;
    
  } catch (error) {
    console.error(`❌ Failed to load character ${characterId}:`, error);
    return null;
  }
}

// Create或获取ElizaOS Agent
async function getOrCreateAgent(characterId) {
  if (agents.has(characterId)) {
    console.log(`♻️ 使用缓存的Agent: ${characterId}`);
    return agents.get(characterId);
  }
  
  try {
    console.log(`🔄 初始化ElizaOS模块...`);
    await initializeEliza();
    
    console.log(`📚 加载角色配置: ${characterId}`);
    const character = await loadCharacter(characterId);
    if (!character) {
      throw new Error(`角色 ${characterId} 不存在`);
    }
    
    console.log(`🏗️ 创建AgentRuntime for ${character.name}`);
    console.log('🔍 Character配置详情:', {
      name: character.name,
      bio: character.bio,
      hasMessageExamples: !!character.messageExamples?.length,
      model: character.settings?.model,
      plugins: character.plugins
    });

    // 检查OpenAI密钥
    console.log('🔑 ElizaOS OpenAI密钥检查:', {
      hasEnvKey: !!process.env.OPENAI_API_KEY,
      modelProvider: ModelProviderName.OPENAI
    });

    // CreateAgentRuntime
    const runtime = new AgentRuntime({
    character: {
      ...character,
      modelProvider: ModelProviderName.OPENAI,
      // 确保传递API密钥
      settings: {
        ...character.settings,
        secrets: {
          ...character.settings?.secrets,
          openai: process.env.OPENAI_API_KEY
        }
      }
    },
    
    // 数据库适配器（使用Supabase）
    databaseAdapter: supabase ? {
      async getMemories(roomId, count = 10) {
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(count);
        return data || [];
      },
      
      async createMemory(memory) {
        const { data } = await supabase
          .from('conversations')
          .insert(memory)
          .select()
          .single();
        return data;
      },
      
      async searchMemories(roomId, query) {
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .eq('room_id', roomId)
          .ilike('content', `%${query}%`)
          .limit(5);
        return data || [];
      },
      
      // 🆕 获取用户资料
      async getUserProfile(userId) {
        const dbId = userId.startsWith('wallet_') ? userId : `wallet_${userId}`;
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', dbId)
          .maybeSingle();
        return data;
      },
      
      // 🆕 获取用户偏好和关系状态
      async getUserRelationship(userId, characterId) {
        const { data } = await supabase
          .from('user_character_relations')
          .select('*')
          .eq('user_id', userId)
          .eq('character_id', characterId)
          .maybeSingle();
        return data;
      }
    } : undefined,
    
    providers: [],
    actions: character.actions || [],
    evaluators: character.evaluators || [],
    plugins: []
    });
    
    console.log(`⚙️ 初始化AgentRuntime...`);
    await runtime.initialize();
    
    console.log(`🤖 Agent创建成功: ${character.name}`);
    console.log('🔧 Runtime配置验证:', {
      hasCharacter: !!runtime.character,
      modelProvider: runtime.character?.modelProvider,
      hasSecrets: !!runtime.character?.settings?.secrets?.openai,
      pluginsCount: runtime.character?.plugins?.length
    });

    agents.set(characterId, runtime);
    
    return runtime;
    
  } catch (error) {
    console.error(`❌ Agent创建失败 (${characterId}):`, error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    throw new Error(`Failed to create agent for ${characterId}: ${error.message}`);
  }
}

// 情感检测
function detectEmotion(text) {
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

// ElevenLabs 语音生成
async function generateVoice(text, characterId, options = {}) {
  const voiceMap = {
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
    'miumiu': 'SU7BtMmgc7KhQiC6G24B',
    'neco': 't9ZwnJtpA3lWrJ4W7pAl',
    'nekona': 'kcg1KQQGuCGzH6FUjsZQ',
    'notia': 'abz2RylgxmJx76xNpaj1',
    'ququ': 'tfQFvzjodQp63340jz2r',
    'rainy': '1ghrzLZQ7Dza7Xs9OkhY',
    'rindo': 'nclQ39ewSlJMu5Nidnsf',
    'sikirei': 'n263mAk9k8VWEuZSmuMl',
    'vivi': '4lWJNy00PxQAOMgQTiIS',
    'wolf': 'WW3EvqkXGmu65ga8TYqa',
    'wolferia': '3SeVwPUl5aO6J2GETjox',
    'yawl': 'c6wjO0u66VyvwAC4UTqx',
    'yuuyii': 'UPwKM85l2CG7nbF2u1or',
    'zwei': '0EzDWfDZDlAIeQQOjhoC'
  };
  
  // Process角色名中的空格和大小写问题
  let normalizedCharacterId = characterId.toLowerCase().replace(/\s+/g, '');
  
  // 特殊名称映射处理
  const nameMapping = {
    'yuuyii': 'yuuyii',
    'yuuYii': 'yuuyii', 
    'miumiu': 'miumiu',
    'miuMiu': 'miumiu'
  };
  
  if (nameMapping[normalizedCharacterId]) {
    normalizedCharacterId = nameMapping[normalizedCharacterId];
  }
  
  const voiceId = voiceMap[normalizedCharacterId];
  if (!voiceId) {
    throw new Error(`角色 ${characterId} (${normalizedCharacterId}) 没有配置语音ID`);
  }
  
  console.log(`🎤 生成语音: ${characterId} (${voiceId}) - "${text.substring(0, 50)}..."`);
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: options.model || 'eleven_multilingual_v2',
      voice_settings: {
        stability: options.stability || 0.7,
        similarity_boost: options.similarity_boost || 0.8,
        style: options.style || 0.3,
        use_speaker_boost: options.use_speaker_boost || true
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API 错误: ${response.status} - ${errorText}`);
  }
  
  const audioBuffer = await response.arrayBuffer();
  console.log(`✅ 语音生成成功: ${audioBuffer.byteLength} bytes`);
  
  return {
    success: true,
    audioData: audioBuffer,
    mimeType: 'audio/mpeg',
    characterId: characterId,
    voiceId: voiceId
  };
}

// CORS 设置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default async function handler(req, res) {
  // Setup CORS
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method } = req;
  const url = req.url || '';
  const path = (url.split('?')[0] || '').replace(/\/+$/, ''); // strip query + trailing slash
  
  console.log(`📋 ${method} ${url} (path=${path})`);
  console.log(`📊 Request body:`, req.body);
  
  // 🔍 调试语音示范请求
  if (url.includes('voice-sample')) {
    console.log(`🎵 语音示范请求匹配检测: ${method} ${url}`);
  }

  try {
    // 健康检查
    if (url === '/health' || url === '/api/health') {
      if (BRIDGE_URL) {
        try {
          const r = await fetch(`${BRIDGE_URL}/api/health`);
          const j = await r.json().catch(() => ({}));
          return res.json({
            proxied: true,
            bridge: BRIDGE_URL,
            upstream: j
          });
        } catch (e) {
          console.warn('⚠️ Bridge health check failed, falling back:', e.message);
        }
      }
      return res.json({
        status: 'ok',
        service: 'eliza-os-runtime',
        version: '3.0.0',
        storage: supabase ? 'supabase' : 'memory',
        timestamp: new Date().toISOString()
      });
    }

    // 版本/状态诊断端点（便于验证是否已走桥接 + 配置）
    if (method === 'GET' && (url === '/version' || url === '/api/version')) {
      const info = {
        service: 'eliza-os-runtime-proxy',
        mode: BRIDGE_URL ? 'proxy_to_bridge' : 'local_runtime',
        bridge: BRIDGE_URL || null,
        forceOpenAI: process.env.FORCE_OPENAI === '1' || process.env.FORCE_OPENAI === 'true' || false,
        debugEliza: process.env.DEBUG_ELIZA === '1' || process.env.DEBUG_ELIZA === 'true' || false,
        supabase: {
          configured: !!supabase,
          urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 12) : null
        },
        timestamp: new Date().toISOString()
      };
      if (BRIDGE_URL) {
        try {
          const r = await fetch(`${BRIDGE_URL}/api/system/status`);
          const upstream = await r.json().catch(() => ({}));
          return res.json({ proxied: true, bridge: BRIDGE_URL, info, upstream });
        } catch (e) {
          return res.json({ proxied: true, bridge: BRIDGE_URL, info, upstream: { error: e.message } });
        }
      }
      return res.json({ proxied: false, info });
    }

    // 🧪 语音 API 测试端点
    if (method === 'GET' && (url === '/voice-test' || url === '/api/voice-test')) {
      return res.json({
        success: true,
        message: '语音 API 路由正常',
        elevenlabsConfigured: !!process.env.ELEVENLABS_API_KEY,
        keyLength: process.env.ELEVENLABS_API_KEY ? process.env.ELEVENLABS_API_KEY.length : 0,
        timestamp: new Date().toISOString()
      });
    }

    // 代理桥接的系统状态和角色列表，便于验证
    if (method === 'GET' && (url === '/api/system/status' || url === '/system/status')) {
      if (BRIDGE_URL) {
        try {
          console.log('🌉 Proxy → Bridge /api/system/status');
          const upstream = await fetch(`${BRIDGE_URL}/api/system/status`);
          const data = await upstream.json();
          return res.json({ proxied: true, bridge: BRIDGE_URL, ...data });
        } catch (e) {
          return res.status(502).json({ proxied: true, bridge: BRIDGE_URL, error: e.message });
        }
      }
      return res.status(404).json({ error: 'No local system status' });
    }

    if (method === 'GET' && (url === '/api/characters' || url === '/characters')) {
      if (BRIDGE_URL) {
        try {
          console.log('🌉 Proxy → Bridge /api/characters');
          const upstream = await fetch(`${BRIDGE_URL}/api/characters`);
          const data = await upstream.json();
          return res.json({ proxied: true, bridge: BRIDGE_URL, ...data });
        } catch (e) {
          return res.status(502).json({ proxied: true, bridge: BRIDGE_URL, error: e.message });
        }
      }
      // 无桥接则返回空
      return res.json({ success: true, data: [] });
    }

    // 🎵 语音示范接口 - 简化版本
    if (method === 'POST' && (url === '/voice-sample' || url === '/api/voice-sample' || url.endsWith('voice-sample'))) {
      console.log(`🎵 语音示范接口匹配成功: ${method} ${url}`);
      
      try {
        const { text, voiceId } = req.body || {};
        
        if (!text || !voiceId) {
          console.error(`❌ 缺少参数: text=${text}, voiceId=${voiceId}`);
          return res.status(400).json({
            success: false,
            error: '缺少必要参数: text 和 voiceId',
            received: { text: !!text, voiceId: !!voiceId }
          });
        }

        if (!process.env.ELEVENLABS_API_KEY) {
          console.error('❌ ElevenLabs API Key 未配置');
          return res.status(500).json({
            success: false,
            error: 'ElevenLabs API Key 未配置'
          });
        }

        console.log(`🎤 开始生成语音: voiceId=${voiceId}, text="${text.substring(0, 30)}..."`);
        
        // Setup较短的超时时间
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

        // 调用 ElevenLabs API
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.7
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ ElevenLabs API 错误: ${response.status} - ${errorText}`);
          return res.status(502).json({
            success: false,
            error: `ElevenLabs API 错误: ${response.status}`,
            details: errorText.substring(0, 200)
          });
        }

        const audioBuffer = await response.arrayBuffer();
        console.log(`✅ 语音生成成功: ${audioBuffer.byteLength} bytes`);

        // 返回音频数据
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Length', audioBuffer.byteLength.toString());
        
        return res.end(Buffer.from(audioBuffer));

      } catch (error) {
        if (error.name === 'AbortError') {
          console.error('❌ Request timeout');
          return res.status(408).json({
            success: false,
            error: 'Request timeout，请重试'
          });
        }
        
        console.error('❌ 语音生成失败:', error.message);
        return res.status(500).json({
          success: false,
          error: '服务器内部错误',
          message: error.message
        });
      }
    }

    // 🆕 用户认证/注册端点（使用新的三表模型）
    if (method === 'POST' && (url === '/auth' || url === '/api/auth')) {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'walletAddress is required' });
        }

        if (!supabase) {
            // Fallback for no database
            return res.json({ success: true, data: { user: { name: 'Guest', wallet_address: walletAddress }, isNew: false } });
        }

        try {
            console.log(`🔐 Authenticating wallet: ${walletAddress}`);

            // 1. Check if an identity with this wallet address already exists.
            const { data: identity, error: identityError } = await supabase
                .from('account_identities')
                .select('account_id')
                .eq('provider', 'wallet')
                .eq('identifier', walletAddress)
                .single();

            if (identity && identity.account_id) {
                // --- EXISTING USER ---
                console.log(`👤 Existing user found for wallet. Account ID: ${identity.account_id}`);
                
                // Fetch the full profile from user_profiles table
                const { data: user, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('account_id', identity.account_id)
                    .single();

                if (profileError) {
                    throw new Error(`Failed to fetch user profile: ${profileError.message}`);
                }

                return res.json({ success: true, data: { user, isNew: false } });

            } else {
                // --- NEW USER ---
                console.log(`✨ New user registration for wallet: ${walletAddress}`);

                // Call an RPC function to atomically create a new user across 3 tables.
                const { data: newUser, error: rpcError } = await supabase.rpc('create_new_user', {
                    p_wallet_address: walletAddress,
                    p_username: walletAddress // Use wallet address as initial username
                });

                if (rpcError) {
                    console.error('❌ RPC create_new_user failed:', rpcError);
                    throw new Error(`User creation failed: ${rpcError.message}`);
                }

                console.log(`🎉 New user created successfully via RPC.`, newUser);
                return res.json({ success: true, data: { user: newUser, isNew: true } });
            }
        } catch (error) {
            console.error('❌ Error during authentication:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // 获取用户资料（固定本地实现）
    if (method === 'GET' && url.includes('/profiles/')) {
      console.log(`🛣️ Profile路由匹配，URL: ${url}`);
      
      let userId = null;
      if (url.includes('/api/profiles/')) {
        userId = url.split('/api/profiles/')[1];
      } else if (url.includes('/profiles/')) {
        userId = url.split('/profiles/')[1];
      }
      
      if (userId) {
        userId = userId.split('?')[0].split('#')[0];
      }
      
      console.log(`🔍 提取的用户ID: ${userId}`);
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const dbId = userId.startsWith('wallet_') ? userId : `wallet_${userId}`;
      console.log(`🔍 查询数据库ID: ${dbId}`);

      if (!supabase) {
        return res.json({ success: true, profile: null });
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', dbId)
        .maybeSingle();

      if (error) {
        console.error('❌ 数据库查询错误:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`📊 查询结果:`, data);
      return res.json({ success: true, profile: data });
    }

    // Create/更新用户资料（固定本地实现）
    if (method === 'POST' && (url === '/profiles' || url === '/api/profiles')) {
      const { walletAddress, profileData, customData } = req.body;

      if (!walletAddress || !profileData || !customData) {
          return res.status(400).json({ success: false, error: 'Missing required fields: walletAddress, profileData, customData' });
      }

      if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
      }

      try {
          // 1. Find the account_id from the wallet address
          const { data: identity, error: identityError } = await supabase
              .from('account_identities')
              .select('account_id')
              .eq('provider', 'wallet')
              .eq('identifier', walletAddress)
              .single();

          if (identityError || !identity) {
              console.error('Error finding identity for wallet:', walletAddress, identityError);
              return res.status(404).json({ success: false, error: 'User account not found for this wallet. Please log in again.' });
          }

          const accountId = identity.account_id;

          // 2. Upsert the canonical profile data into user_profiles
          const { data: updatedProfile, error: profileError } = await supabase
              .from('user_profiles')
              .upsert({
                  account_id: accountId,
                  name: profileData.name,
                  avatar_url: profileData.avatar_url,
                  personality: profileData.personality,
                  interests: profileData.interests,
                  relationship_style: profileData.relationship_style,
                  updated_at: new Date().toISOString()
              }, { onConflict: 'account_id' })
              .select()
              .single();

          if (profileError) {
              console.error('Error upserting user_profiles:', profileError);
              throw new Error(`Failed to update profile: ${profileError.message}`);
          }

          // 3. Update the custom data in the accounts.details JSONB column
          const { data: account, error: accountError } = await supabase
              .from('accounts')
              .select('details')
              .eq('id', accountId)
              .single();

          if (accountError) {
              console.error('Error fetching account details:', accountError);
              throw new Error(`Failed to fetch account for update: ${accountError.message}`);
          }

          const newDetails = { ...(account.details || {}), ...customData };

          const { error: updateDetailsError } = await supabase
              .from('accounts')
              .update({ details: newDetails, updated_at: new Date().toISOString() })
              .eq('id', accountId);

          if (updateDetailsError) {
              console.error('Error updating account details:', updateDetailsError);
              throw new Error(`Failed to update custom details: ${updateDetailsError.message}`);
          }

          console.log(`✅ Profile updated successfully for account ${accountId}`);
          return res.json({ success: true, profile: updatedProfile, message: 'Profile updated successfully' });

      } catch (error) {
          console.error('❌ Error processing profile update:', error);
          return res.status(500).json({ success: false, error: error.message });
      }
    }

    // ElizaOS Chat API
    if (method === 'POST' && (path === '/chat' || path === '/api/chat')) {
      // Proxy to Bridge if configured
      if (BRIDGE_URL) {
        try {
          const proxyTimeoutMs = parseInt(process.env.BRIDGE_PROXY_TIMEOUT_MS || '18000', 10);
          console.log('🌉 Proxy → Bridge /api/chat', { proxyTimeoutMs });
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), proxyTimeoutMs);
          const upstream = await fetch(`${BRIDGE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
            signal: controller.signal
          });
          clearTimeout(timeout);
          if (!upstream.ok) {
            console.warn('⚠️ Upstream /api/chat not OK:', upstream.status, upstream.statusText);
            throw new Error(`Upstream status ${upstream.status}`);
          }
          let data;
          try {
            data = await upstream.json();
          } catch (parseErr) {
            console.error('⚠️ Upstream /api/chat JSON parse failed:', parseErr.message);
            throw parseErr;
          }
          // If upstream explicitly reports failure or missing payload, fall back locally
          if (data && (data.success === false || (data.status === 'error') || (!data.data && data.error))) {
            console.warn('⚠️ Upstream /api/chat indicated failure, falling back locally:', data);
            throw new Error('Upstream indicated failure');
          }
          // Otherwise persist conversation locally for continuity, then return upstream result
          try {
            if (supabase && req.body?.userId && req.body?.characterId && data?.success && data?.data?.response) {
              const userId = req.body.userId;
              const characterId = req.body.characterId;
              const roomId = `${userId}-${characterId}`;
              const emotion = data.data.emotion || 'neutral';
              await supabase.from('conversations').insert([
                { room_id: roomId, user_id: userId, character_id: characterId, role: 'user', content: req.body.message, metadata: { timestamp: Date.now(), via: 'bridge' } },
                { room_id: roomId, user_id: userId, character_id: characterId, role: 'assistant', content: data.data.response, metadata: { timestamp: Date.now(), emotion, via: 'bridge' } }
              ]);
            }
          } catch (persistErr) {
            console.warn('⚠️ Failed to persist conversation after bridge response:', persistErr.message);
          }
          return res.json({ proxied: true, bridge: BRIDGE_URL, ...data });
        } catch (e) {
          console.error('❌ Bridge proxy failed (/api/chat), using local handling:', e.message);
          // fall through to local handling
        }
      }
      console.log('🎯 API /api/chat请求到达！', {
        method,
        url,
        bodyKeys: Object.keys(req.body || {}),
        timestamp: new Date().toISOString()
      });

      const { userId, characterId, message, language = 'en' } = req.body;

      console.log('📝 提取的请求参数:', {
        userId: userId?.substring(0, 10) + '...',
        characterId,
        message: message?.substring(0, 50) + '...',
        language
      });
      
      if (!userId || !characterId || !message) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数'
        });
      }
      
      console.log(`💬 ElizaOS Chat: ${userId} -> ${characterId}: ${message}`);

      try {
        console.log(`💬 处理聊天请求: ${userId} -> ${characterId}: "${message}"`);

        // 🔥 仅当设置环境变量时才强制使用OpenAI，默认不强制
        const FORCE_OPENAI = process.env.FORCE_OPENAI === '1' || process.env.FORCE_OPENAI === 'true';
        if (FORCE_OPENAI) {
          console.warn('🚀 [FORCE_OPENAI=ON] 强制使用OpenAI智能模式，跳过ElizaOS');
          throw new Error('FORCE_OPENAI_MODE');
        }

        // 获取或创建ElizaOS Agent (保持原有逻辑)
        const agent = await getOrCreateAgent(characterId);
        
        // 房间ID（确保每个用户-角色对话独立）
        const roomId = `${userId}-${characterId}`;
        
        // 🆕 获取用户资料（供ElizaOS使用）
        let userProfile = null;
        let relationship = null;
        if (supabase) {
          // 获取用户个人资料
          const dbId = userId.startsWith('wallet_') ? userId : `wallet_${userId}`;
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', dbId)
            .maybeSingle();
          userProfile = profile;
          
          // 获取用户-角色关系状态
          const { data } = await supabase
            .from('user_character_relations')
            .select('*')
            .eq('user_id', userId)
            .eq('character_id', characterId)
            .maybeSingle();
          
          if (!data) {
            // Create新关系
            const { data: newRel } = await supabase
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
        
        // 构建消息对象（包含用户资料）
        const messageObj = {
          userId,
          roomId,
          content: { text: message },
          createdAt: Date.now(),
          relationship: relationship?.relationship_level || 1,
          // 🆕 ElizaOS现在可以访问用户的完整资料！
          userProfile: userProfile ? {
            name: userProfile.nickname || userProfile.username || 'Friend',
            age: userProfile.age,
            birthday: userProfile.birthday,
            location: userProfile.location,
            occupation: userProfile.occupation,
            interests: userProfile.interests,
            bio: userProfile.bio,
            language: userProfile.language || language // 使用前端传递的语言设置，或用户profile中的语言
          } : { language: language }, // 如果没有用户profile，至少传递语言信息
          requestLanguage: language // 明确指定请求的响应语言
        };
        
        // 使用ElizaOS Agent处理消息
        console.log(`💬 处理消息: ${roomId}`, {
          userId,
          characterId,
          message: message.substring(0, 50) + '...',
          hasAgent: !!agent,
          agentType: agent?.constructor?.name
        });
        const response = await agent.processMessage(messageObj);
        console.log('🔍 ElizaOS原始响应:', {
          text: response.text,
          content: response.content,
          message: response.message,
          fullResponse: response
        });

        // 提取回复
        const responseText = response.text ||
                           response.content?.text ||
                           response.message ||
                           "...";

        console.log('📝 ElizaOS提取的回复:', responseText);

        // ElizaOS响应直接使用，不进行质量检查和回退
        console.log('📝 ElizaOS回复已接受:', responseText);

        // 检测情感
        const emotion = detectEmotion(responseText);
        
        // 保存对话到Supabase
        if (supabase) {
          // 保存用户消息
          await supabase.from('conversations').insert({
            room_id: roomId,
            user_id: userId,
            character_id: characterId,
            role: 'user',
            content: message,
            metadata: { timestamp: Date.now() }
          });
          
          // 保存AI回复
          await supabase.from('conversations').insert({
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
          
          // Update关系状态
          await supabase
            .from('user_character_relations')
            .update({
              last_interaction: new Date().toISOString(),
              total_messages: (relationship?.total_messages || 0) + 1,
              emotional_state: emotion
            })
            .eq('user_id', userId)
            .eq('character_id', characterId);
        }
        
        const apiResponse = {
          success: true,
          data: {
            response: responseText,
            emotion,
            relationship_level: relationship?.relationship_level || 1,
            metadata: {
              characterName: characters.get(characterId)?.name,
              timestamp: Date.now()
            }
          }
        };
        
        console.log('🚀 API返回响应:', JSON.stringify(apiResponse, null, 2));
        return res.json(apiResponse);
        
      } catch (error) {
        // 检查是否是强制OpenAI模式
        if (error.message !== 'FORCE_OPENAI_MODE') {
          console.error('❌ ElizaOS Chat处理错误:', error);
          console.error('错误详情:', error.message);
          console.error('错误堆栈:', error.stack);
        }

        // 🔄 直接使用OpenAI智能模式
        console.warn('🤖 启用OpenAI智能模式（ElizaOS路径失败或被强制）:', {
          reason: error?.message,
          forced: error?.message === 'FORCE_OPENAI_MODE'
        });
        
        try {
          // 获取用户资料（保持个性化）
          let userProfile = null;
          if (supabase) {
            const dbId = userId.startsWith('wallet_') ? userId : `wallet_${userId}`;
            const { data: profile } = await supabase
              .from('users')
              .select('*')
              .eq('id', dbId)
              .maybeSingle();
            userProfile = profile;
          }
          
          // 🧠 智能后备模式：使用OpenAI API生成真正的AI回复
          let responseText;
          const userName = userProfile?.nickname || userProfile?.username || '朋友';
          const normalizedCharId = characterId.toLowerCase();
          
          try {
            console.log('🤖 启用OpenAI智能后备模式...');
            
            // 构建角色系统提示
            const character = await loadCharacter(characterId);
            
            // 根据语言设置选择系统提示词模板
            const languageInstructions = {
              'en': `You are ${character.name}. Always respond in English only, regardless of the user's language.`,
              'zh': `你是${character.name}。请用中文回复。`,
              'ja': `あなたは${character.name}です。日本語で返答してください。`
            };
            
            // Force English as default - only use other languages if explicitly requested
            const actualLanguage = (language === 'zh' || language === 'ja') ? language : 'en';
            const languageInstruction = languageInstructions[actualLanguage];
            
            const systemPrompt = `${languageInstruction}

Character: ${character.name}
Bio: ${character.bio ? character.bio.join(', ') : 'AI girlfriend character'}

User Profile:
- Name: ${userName}
- Age: ${userProfile?.age || 'Unknown'}
- Birthday: ${userProfile?.birthday || 'Unknown'}
- Interests: ${userProfile?.interests || 'Unknown'}
- Occupation: ${userProfile?.occupation || 'Unknown'}

Conversation Context:
${supabase ? '(Recent conversation history will be loaded from database)' : '(First conversation)'}

Please respond as ${character.name} based on your personality traits and the user's profile. Maintain character consistency and show personalization.

**Important: Your response should be suitable for voice playback. Use natural, conversational language and avoid excessive symbols or emojis.**

Language: ${actualLanguage === 'zh' ? 'Respond in Chinese' : actualLanguage === 'ja' ? 'Respond in Japanese' : 'Always respond in English only'}`;

            // 获取最近对话历史作为上下文
            let conversationHistory = [];
            if (supabase) {
              const { data: history } = await supabase
                .from('conversations')
                .select('role, content')
                .eq('room_id', `${userId}-${characterId}`)
                .order('created_at', { ascending: true })
                .limit(10);
              
              if (history && history.length > 0) {
                conversationHistory = history.map(h => ({
                  role: h.role === 'user' ? 'user' : 'assistant',
                  content: h.content
                }));
              }
            }

            // 调用OpenAI API
            // 检查OpenAI API密钥
            if (!process.env.OPENAI_API_KEY) {
              console.error('❌ OPENAI_API_KEY未设置');
              throw new Error('OpenAI API key not configured');
            }

            console.log('🔑 OpenAI API密钥状态:', {
              hasKey: !!process.env.OPENAI_API_KEY,
              keyPrefix: process.env.OPENAI_API_KEY?.substring(0, 7)
            });

            const OpenAI = (await import('openai')).default;
            const openai = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY
            });

            const messages = [
              { role: 'system', content: systemPrompt },
              ...conversationHistory,
              { role: 'user', content: message }
            ];

            console.log('💭 发送到OpenAI:', { 
              character: character.name, 
              messageCount: messages.length,
              userMessage: message 
            });

            const completion = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: messages,
              max_tokens: 200,
              temperature: 0.8
            });

            responseText = completion.choices[0].message.content;
            console.log('✨ OpenAI智能回复:', responseText);
            
          } catch (aiError) {
            console.error('❌ OpenAI智能模式失败:', aiError.message);
            console.error('❌ 详细错误信息:', {
              name: aiError.name,
              message: aiError.message,
              code: aiError.code,
              status: aiError.status,
              type: aiError.type
            });

            // 如果OpenAI也失败，使用多样化的后备回复
            const fallbackResponses = {
              'alice': [
                `${userName}哥哥你好呀！我是Alice，很开心见到你！今天想聊什么呢～ 😊`,
                `${userName}哥哥～Alice在这里！虽然系统有点小问题，但我们还是可以聊天的呢！`,
                `${userName}哥哥，Alice来陪你聊天啦！有什么想说的吗？`
              ],
              'ash': [
                `${userName}，我是Ash。虽然系统有些问题，但我们还是可以聊天的。`,
                `${userName}，Ash在这里。让我们聊聊吧，有什么想谈的吗？`,
                `${userName}，我是Ash，准备好和我对话了吗？`
              ],
              'miru': [
                `${userName}，我是Miru～很高兴遇见你！`,
                `${userName}，Miru在这里等你呢！想聊什么？`,
                `${userName}，我是可爱的Miru，来和我说话吧～`
              ]
            };

            const characterResponses = fallbackResponses[normalizedCharId] || [
              `${userName}，我是你的AI伙伴，很高兴和你聊天！`,
              `${userName}，虽然系统有点问题，但我们可以继续聊天！`,
              `${userName}，我在这里陪你，有什么想说的吗？`
            ];

            // 随机选择一个回复
            responseText = characterResponses[Math.floor(Math.random() * characterResponses.length)];
            console.log('🔄 使用后备回复:', responseText);
          }
          
          const emotion = detectEmotion(responseText);
          const roomId = `${userId}-${characterId}`;
          
          // 🎤 生成语音 (默认开启，如果配置了 ElevenLabs API)
          let audioData = null;
          if (process.env.ELEVENLABS_API_KEY) {
            try {
              console.log('🎤 开始生成语音...');
              
              // 🇯🇵 准备日文版本的回复 (用于语音)
              let voiceText = responseText;
              
              // Check角色的 character.md 中是否有日文示例台词
              const character = await loadCharacter(characterId);
              if (character && character.sampleJP) {
                // 如果有日文示例，可以生成日文版本的回复
                try {
                  console.log('🇯🇵 准备生成日文语音...');
                  
                  // 使用GPT生成日文版本
                  const OpenAI = (await import('openai')).default;
                  const openai = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY
                  });
                  
                  const japanesePrompt = `请将以下回复翻译成自然的日文，保持${character.name}的性格特点：

原文："${responseText}"

角色信息：
- 姓名：${character.name}
- 性格：${character.bio?.[0] || ''}
- 日文示例台词：${character.sampleJP || ''}

要求：
1. 保持角色的说话风格
2. 使用自然的日语表达
3. 适合语音合成
4. 长度控制在50个字符内`;

                  const japaneseResponse = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: japanesePrompt }],
                    max_tokens: 100,
                    temperature: 0.7
                  });
                  
                  voiceText = japaneseResponse.choices[0].message.content.trim();
                  console.log('🇯🇵 日文版本:', voiceText);
                  
                } catch (jpError) {
                  console.warn('⚠️ 日文生成失败，使用原文:', jpError.message);
                  voiceText = responseText;
                }
              }
              
              const voiceResult = await generateVoice(voiceText, normalizedCharId, {
                model: 'eleven_multilingual_v2', // 支持多语言
                stability: 0.8,
                similarity_boost: 0.8,
                style: 0.4
              });
              
              if (voiceResult.success) {
                audioData = {
                  mimeType: voiceResult.mimeType,
                  data: Array.from(new Uint8Array(voiceResult.audioData)),
                  voiceId: voiceResult.voiceId,
                  language: character && character.sampleJP ? 'jp' : 'zh',
                  originalText: responseText,
                  voiceText: voiceText
                };
                console.log('✅ 语音生成完成 (语言:', audioData.language, ')');
              }
            } catch (voiceError) {
              console.warn('⚠️ 语音生成失败，继续文字回复:', voiceError.message);
              
              // 即使语音失败，也尝试简单生成
              try {
                const fallbackResult = await generateVoice(responseText, normalizedCharId);
                if (fallbackResult.success) {
                  audioData = {
                    mimeType: fallbackResult.mimeType,
                    data: Array.from(new Uint8Array(fallbackResult.audioData)),
                    voiceId: fallbackResult.voiceId,
                    language: 'zh',
                    originalText: responseText,
                    voiceText: responseText
                  };
                  console.log('✅ 后备语音生成完成');
                }
              } catch (fallbackError) {
                console.error('❌ 后备语音也失败:', fallbackError.message);
              }
            }
          }
          
          // 保存对话到Supabase（保持记忆功能）
          if (supabase) {
            await supabase.from('conversations').insert([
              {
                room_id: roomId,
                user_id: userId,
                character_id: characterId,
                role: 'user',
                content: message,
                metadata: { timestamp: Date.now(), fallback_mode: true }
              },
              {
                room_id: roomId,
                user_id: userId,
                character_id: characterId,
                role: 'assistant',
                content: responseText,
                metadata: { emotion, timestamp: Date.now(), fallback_mode: true }
              }
            ]);
          }
          
          console.log('✅ ElizaOS后备模式成功');
          // 规范化角色名称用于前端展示
          let metaCharacterName = characterId;
          try {
            const c = await loadCharacter(characterId);
            if (c?.name) metaCharacterName = c.name;
          } catch(_) {}
          return res.json({
            success: true,
            data: {
              response: responseText,
              emotion,
              relationship_level: 1,
              audio: audioData, // 🎤 包含语音数据
              metadata: {
                characterName: metaCharacterName,
                timestamp: Date.now(),
                fallback_mode: true
              }
            }
          });
          
        } catch (fallbackError) {
          console.error('❌ 后备模式也失败:', fallbackError);
          return res.status(500).json({
            success: false,
            error: 'System temporarily unavailable'
          });
        }
      }
    }

    // 🆕 获取对话历史 - 为保持兼容性，固定使用本地实现（返回 conversations/relationship 结构）
    if (method === 'GET' && url.includes('/api/history/')) {
      try {
        // 解析URL: /api/history/{userId}/{characterId}
        const urlParts = url.split('/');
        const historyIndex = urlParts.findIndex(part => part === 'history');
        
        if (historyIndex < 0 || historyIndex + 2 >= urlParts.length) {
          return res.status(400).json({ error: 'Invalid history URL format' });
        }
        
        const userId = urlParts[historyIndex + 1];
        const characterId = urlParts[historyIndex + 2];
        const limit = parseInt(req.query?.limit) || 20;
        
        console.log(`📚 获取对话历史: ${userId} -> ${characterId} (limit: ${limit})`);
        
        if (!supabase) {
          return res.json({
            success: true,
            data: {
              conversations: [],
              relationship: null
            }
          });
        }
        
        const roomId = `${userId}-${characterId}`;
        
        // 获取对话历史
        const { data: conversations } = await supabase
          .from('conversations')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(limit);
        
        // 获取关系状态
        const { data: relationship } = await supabase
          .from('user_character_relations')
          .select('*')
          .eq('user_id', userId)
          .eq('character_id', characterId)
          .maybeSingle();
        
        console.log(`📊 历史记录: ${conversations?.length || 0} 条对话`);
        
        return res.json({
          success: true,
          data: {
            conversations: conversations || [],
            relationship: relationship || null
          }
        });
        
      } catch (error) {
        console.error('❌ 获取历史记录错误:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }

    // Memory API endpoints
    if (method === 'POST' && url === '/api/memory-batch') {
      console.log('📝 批量保存记忆:', req.body);
      return res.json({ success: true, saved: req.body?.memories?.length || 0 });
    }

    if (method === 'GET' && url.includes('/api/memory')) {
      console.log('🧠 查询记忆:', req.query);
      return res.json({ memories: [], total: 0 });
    }

    return res.status(404).json({ error: 'Not found' });

  } catch (error) {
    console.error('💥 API错误:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
