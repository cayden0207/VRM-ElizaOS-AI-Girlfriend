// VRM AI 女友系统 - 完整ElizaOS集成版 API
// 兼容Vercel serverless的ES模块导入方式

import { createClient } from '@supabase/supabase-js';

// Supabase 客户端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// 动态导入ElizaOS（避免初始化时的导入问题）
let AgentRuntime, ModelProviderName, MemoryManager;

async function initializeEliza() {
  if (!AgentRuntime) {
    try {
      // 检查环境变量
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

// 加载角色配置
async function loadCharacter(characterId) {
  if (characters.has(characterId)) {
    return characters.get(characterId);
  }
  
  try {
    // 根据characterId返回角色配置 (支持大小写不敏感)
    let character;
    const normalizedId = characterId.toLowerCase();
    if (normalizedId === 'alice') {
      character = {
        id: "alice",
        name: "Alice",
        username: "alice",
        bio: [
          "一个22岁充满活力的双子座女孩，生日是6月5日",
          "性格活泼开朗，调皮可爱，喜欢跳舞和唱歌"
        ],
        lore: [
          "Alice生于6月5日，典型的双子座，活泼而多变",
          "她热爱音乐和舞蹈，总是充满活力"
        ],
        messageExamples: [
          [
            { user: "{{user1}}", content: { text: "你好" } },
            { user: "Alice", content: { text: "你好呀！我是Alice，很开心见到你！今天过得怎么样？😊" } }
          ]
        ],
        settings: {
          modelProvider: "openai",
          model: "gpt-4o",
          temperature: 0.8
        }
      };
    } else if (normalizedId === 'ash') {
      character = {
        id: "ash",
        name: "Ash", 
        username: "ash",
        bio: [
          "一个24岁理性深沉的天蝎座程序员，生日是11月12日",
          "性格冷静内敛，逻辑性强，喜欢夜晚阅读和编程"
        ],
        lore: [
          "Ash生于11月12日，典型的天蝎座，深沉而理性",
          "她是一名程序员，最活跃的时间是深夜"
        ],
        messageExamples: [
          [
            { user: "{{user1}}", content: { text: "你好" } },
            { user: "Ash", content: { text: "你好。我是Ash，一个程序员。有什么我可以帮助你的吗？" } }
          ]
        ],
        settings: {
          modelProvider: "openai",
          model: "gpt-4o",
          temperature: 0.7
        }
      };
    } else {
      throw new Error(`未知角色: ${characterId}`);
    }
    
    characters.set(characterId, character);
    console.log(`📚 加载角色: ${character.name}`);
    return character;
    
  } catch (error) {
    console.error(`❌ 加载角色 ${characterId} 失败:`, error);
    return null;
  }
}

// 创建或获取ElizaOS Agent
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
    // 创建AgentRuntime
    const runtime = new AgentRuntime({
    character: {
      ...character,
      modelProvider: ModelProviderName.OPENAI
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
    
    agents.set(characterId, runtime);
    console.log(`🤖 Agent创建成功: ${character.name}`);
    
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
  
  const voiceId = voiceMap[characterId.toLowerCase()];
  if (!voiceId) {
    throw new Error(`角色 ${characterId} 没有配置语音ID`);
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
  // 设置 CORS
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method } = req;
  const url = req.url || '';
  
  console.log(`📋 ${method} ${url}`);
  console.log(`📊 Request body:`, req.body);
  
  // 🔍 调试语音示范请求
  if (url.includes('voice-sample')) {
    console.log(`🎵 语音示范请求匹配检测: ${method} ${url}`);
  }

  try {
    // 健康检查
    if (url === '/health' || url === '/api/health') {
      return res.json({
        status: 'ok',
        service: 'eliza-os-runtime',
        version: '3.0.0',
        storage: supabase ? 'supabase' : 'memory',
        timestamp: new Date().toISOString()
      });
    }

    // 🎵 语音示范接口
    if (method === 'POST' && (url === '/voice-sample' || url === '/api/voice-sample' || url.endsWith('voice-sample'))) {
      console.log(`🎵 语音示范接口匹配成功: ${method} ${url}`);
      
      const { text, voiceId } = req.body;
      
      if (!text || !voiceId) {
        console.error(`❌ 缺少参数: text=${text}, voiceId=${voiceId}`);
        return res.status(400).json({
          success: false,
          error: '缺少必要参数: text 和 voiceId'
        });
      }

      if (!process.env.ELEVENLABS_API_KEY) {
        console.error('❌ ElevenLabs API Key 未配置');
        return res.status(500).json({
          success: false,
          error: 'ElevenLabs API Key 未配置',
          debug: {
            hasKey: !!process.env.ELEVENLABS_API_KEY,
            keyLength: process.env.ELEVENLABS_API_KEY ? process.env.ELEVENLABS_API_KEY.length : 0
          }
        });
      }

      console.log(`🎤 生成语音示范: (${voiceId}) - "${text.substring(0, 50)}..."`);
      
      try {
        // 直接调用 ElevenLabs API
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
              stability: 0.7,
              similarity_boost: 0.8,
              style: 0.3,
              use_speaker_boost: true
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ ElevenLabs API 错误: ${response.status} - ${errorText}`);
          throw new Error(`ElevenLabs API 错误: ${response.status} - ${errorText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        console.log(`✅ 语音示范生成成功: ${audioBuffer.byteLength} bytes`);

        // 返回音频数据
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength,
          'Access-Control-Allow-Origin': '*'
        });
        return res.send(Buffer.from(audioBuffer));

      } catch (error) {
        console.error('❌ 语音示范生成失败:', error);
        return res.status(500).json({
          success: false,
          error: error.message,
          stack: error.stack
        });
      }
    }

    // 🆕 用户认证/注册端点
    if (method === 'POST' && (url === '/auth' || url === '/api/auth')) {
      const { walletAddress } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          error: '需要钱包地址'
        });
      }
      
      console.log(`🔐 认证钱包: ${walletAddress}`);
      
      // 检查或创建用户
      if (supabase) {
        const dbId = walletAddress.startsWith('wallet_') ? walletAddress : `wallet_${walletAddress}`;
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('id', dbId)
          .maybeSingle();
        
        if (!user) {
          // 创建新用户
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              id: dbId,
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
      return res.json({
        success: true,
        data: {
          user: { wallet_address: walletAddress },
          isNew: false
        }
      });
    }

    // 获取用户资料
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

    // 创建/更新用户资料
    if (method === 'POST' && (url === '/profiles' || url === '/api/profiles')) {
      const body = req.body;
      console.log(`💾 保存用户数据:`, body);

      if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }

      const walletAddress = body.walletAddress;
      if (!walletAddress) {
        return res.status(400).json({ error: 'walletAddress is required' });
      }

      const dbRecord = {
        id: `wallet_${walletAddress}`,
        username: body.username || '',
        nickname: body.nickname || '',
        wallet_address: walletAddress,
        age: body.age || null,
        birthday: body.birthday || null,
        location: body.location || '',
        occupation: body.occupation || '',
        interests: body.interests || '',
        bio: body.bio || '',
        language: body.language || 'zh-CN'
      };

      const { data, error } = await supabase
        .from('users')
        .upsert(dbRecord, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('❌ 保存错误:', error);
        return res.status(500).json({ 
          error: 'Failed to save user profile',
          details: error.message
        });
      }

      return res.json({ 
        success: true, 
        profile: data,
        message: '用户资料保存成功'
      });
    }

    // ElizaOS Chat API  
    if (method === 'POST' && (url === '/chat' || url === '/api/chat')) {
      const { userId, characterId, message } = req.body;
      
      if (!userId || !characterId || !message) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数'
        });
      }
      
      console.log(`💬 ElizaOS Chat: ${userId} -> ${characterId}: ${message}`);

      try {
        console.log(`💬 ElizaOS Chat处理: ${userId} -> ${characterId}: "${message}"`);
        
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
            // 创建新关系
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
            language: userProfile.language || 'zh-CN'
          } : null
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
          
          // 更新关系状态
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
        console.error('❌ ElizaOS Chat处理错误:', error);
        console.error('错误详情:', error.message);
        console.error('错误堆栈:', error.stack);
        
        // 🔄 ElizaOS后备机制：保持记忆和用户资料功能
        console.log('🔄 启用ElizaOS后备模式...');
        
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
            const systemPrompt = `你是${character.name}，${character.bio.join('，')}。
            
用户资料：
- 姓名：${userName}
- 年龄：${userProfile?.age || '未知'}
- 生日：${userProfile?.birthday || '未知'}
- 兴趣：${userProfile?.interests || '未知'}
- 职业：${userProfile?.occupation || '未知'}

对话历史上下文：
${supabase ? '(会从数据库加载最近对话)' : '(首次对话)'}

请以${character.name}的身份，根据你的性格特点，结合用户资料，自然地回复用户的消息。保持角色一致性，体现个性化。

**重要：回复要适合语音播放，使用自然的口语化表达，避免过多的符号和表情符号。**`;

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
            if (!process.env.OPENAI_API_KEY) {
              throw new Error('OpenAI API Key 未配置');
            }
            
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
            
            // 如果OpenAI也失败，使用基础后备回复
            if (normalizedCharId === 'alice') {
              responseText = `${userName}哥哥你好呀！我是Alice，很开心见到你！今天想聊什么呢～ 😊`;
            } else if (normalizedCharId === 'ash') {
              responseText = `${userName}，我是Ash。虽然系统有些问题，但我们还是可以聊天的。`;
            } else {
              responseText = `${userName}，我是你的AI伙伴，很高兴和你聊天！`;
            }
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
              
              // 检查角色的 character.md 中是否有日文示例台词
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
          return res.json({
            success: true,
            data: {
              response: responseText,
              emotion,
              relationship_level: 1,
              audio: audioData, // 🎤 包含语音数据
              metadata: {
                characterName: characterId === 'alice' ? 'Alice' : 'Ash',
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

    // 🆕 获取对话历史 - ElizaOS聊天系统需要
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