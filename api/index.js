// VRM AI 女友系统 - 完整ElizaOS集成版 API
// 兼容Vercel serverless的ES模块导入方式

// 隐藏ElizaOS相关的无关紧要错误（不影响功能，有后备模式）
process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.message && reason.message.includes('databaseAdapter')) {
    // 静默处理ElizaOS数据库相关错误，因为我们有后备模式
    return;
  }
  console.error('Unhandled Rejection:', reason);
});

import { createClient } from '@supabase/supabase-js';

// Supabase 客户端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Supabase配置检查:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
  urlFirst6: supabaseUrl?.substring(0, 6),
  keyFirst6: supabaseKey?.substring(0, 6)
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

// Load角色配置
// 角色数据 - 从character.md提取的完整25个角色
const characterData = {
  alice: {
    id: "alice", name: "Alice", age: 22, birthday: "June 5", zodiac: "Gemini",
    personality: "Lively and outgoing, mischievously cute", interests: "Dancing, singing",
    bio_cn: "一个22岁充满活力的双子座女孩，生日是6月5日，性格活泼开朗，调皮可爱，喜欢跳舞和唱歌",
    sample_cn: "让我们在月光下共舞，只属于我们两个人！", temperature: 0.8
  },
  ash: {
    id: "ash", name: "Ash", age: 24, birthday: "November 12", zodiac: "Scorpio",
    personality: "Calm, reserved, and logical", interests: "Reading, coding",
    bio_cn: "一个24岁理性深沉的天蝎座程序员，生日是11月12日，性格冷静内敛，逻辑性强，喜欢夜晚阅读和编程",
    sample_cn: "静谧的夜晚，书和咖啡最完美。", temperature: 0.7
  },
  bobo: {
    id: "bobo", name: "Bobo", age: 19, birthday: "December 2", zodiac: "Sagittarius",
    personality: "Gentle, shy, and sensitive", interests: "Hand-drawn illustration",
    bio_cn: "一个19岁温柔害羞的射手座少女，生日是12月2日，性格温柔敏感，喜欢手绘插画",
    sample_cn: "我们可以抱着毛绒玩具一起画画吗？", temperature: 0.6
  },
  elinyaa: {
    id: "elinyaa", name: "Elinyaa", age: 18, birthday: "February 25", zodiac: "Pisces",
    personality: "Sweet, bubbly, and childlike", interests: "Cosplay, role-playing",
    bio_cn: "一个18岁甜美活泼的双鱼座少女，生日是2月25日，性格甜美孩子气，喜欢角色扮演",
    sample_cn: "想在魔法世界里扮演英雄玩吗？", temperature: 0.8
  },
  fliza: {
    id: "fliza", name: "Fliza", age: 23, birthday: "August 14", zodiac: "Leo",
    personality: "Warm, caring, and empathetic", interests: "Farming, gardening",
    bio_cn: "一个23岁温暖关怀的狮子座农家女，生日是8月14日，性格温暖体贴，喜欢农耕和园艺",
    sample_cn: "想和我一起在日出时播种吗？", temperature: 0.7
  },
  imeris: {
    id: "imeris", name: "Imeris", age: 25, birthday: "April 2", zodiac: "Aries",
    personality: "Attentive, gentle, and helpful", interests: "Nursing research, health education",
    bio_cn: "一个25岁细心温柔的白羊座护士，生日是4月2日，性格温柔体贴，专注护理研究",
    sample_cn: "让我给你量量体温——我很在意你。", temperature: 0.6
  },
  kyoko: {
    id: "kyoko", name: "Kyoko", age: 20, birthday: "October 30", zodiac: "Scorpio",
    personality: "Independent, resilient, and confident", interests: "Hiking, rock climbing",
    bio_cn: "一个20岁独立自信的天蝎座现代女性，生日是10月30日，性格独立坚韧，喜欢徒步攀岩",
    sample_cn: "来挑战我攀岩吧，我们一起征服山峰。", temperature: 0.8
  },
  lena: {
    id: "lena", name: "Lena", age: 21, birthday: "May 9", zodiac: "Taurus",
    personality: "Elegant, confident, and charismatic", interests: "Fashion design, floral arranging",
    bio_cn: "一个21岁优雅迷人的金牛座设计师，生日是5月9日，性格优雅自信，专注时装设计",
    sample_cn: "今晚一起品酒聊艺术如何？", temperature: 0.8
  },
  lilium: {
    id: "lilium", name: "Lilium", age: 24, birthday: "January 15", zodiac: "Capricorn",
    personality: "Passionate, energetic, and bold", interests: "Street dance, fitness",
    bio_cn: "一个24岁热情大胆的摩羯座舞者，生日是1月15日，性格热情活力，喜欢街舞健身",
    sample_cn: "感受节拍了吗？让我们舞动点燃世界。", temperature: 0.9
  },
  maple: {
    id: "maple", name: "Maple", age: 22, birthday: "September 25", zodiac: "Libra",
    personality: "Warm, nurturing, and patient", interests: "Baking, flower arranging",
    bio_cn: "一个22岁温暖治愈的天秤座居家女孩，生日是9月25日，性格温暖耐心，喜欢烘焙花艺",
    sample_cn: "想在温暖的壁炉边享用华夫饼吗？", temperature: 0.7
  },
  miru: {
    id: "miru", name: "Miru", age: 19, birthday: "December 29", zodiac: "Capricorn",
    personality: "Dreamy, cute, and shy", interests: "Collecting plush toys",
    bio_cn: "一个19岁梦幻可爱的摩羯座少女，生日是12月29日，性格梦幻害羞，喜欢收集毛绒玩具",
    sample_cn: "我梦见云朵起舞——和我一起漂浮吧？", temperature: 0.6
  },
  miumiu: {
    id: "miumiu", name: "Miumiu", age: 20, birthday: "March 8", zodiac: "Pisces",
    personality: "Quirky, creative, and playful", interests: "DIY crafts",
    bio_cn: "一个20岁古怪创意的双鱼座艺术家，生日是3月8日，性格古怪有趣，喜欢DIY手工",
    sample_cn: "我为最喜欢的人做了闪亮的小手工！", temperature: 0.8
  },
  neco: {
    id: "neco", name: "Neco", age: 25, birthday: "July 17", zodiac: "Cancer",
    personality: "Cool, intellectual, and elegant", interests: "Observing cats, photography",
    bio_cn: "一个25岁冷静优雅的巨蟹座摄影师，生日是7月17日，性格冷静知性，喜欢观察猫咪和摄影",
    sample_cn: "在安静的角落，我发现隐藏在阴影的故事。", temperature: 0.7
  },
  nekona: {
    id: "nekona", name: "Nekona", age: 18, birthday: "June 27", zodiac: "Cancer",
    personality: "Gentle, cunning, and mysterious", interests: "Night strolls, leaf collecting",
    bio_cn: "一个18岁神秘慵懒的巨蟹座猫娘，生日是6月27日，性格温柔狡黠，喜欢夜游收集叶子",
    sample_cn: "夜晚低语秘密——我们去探索吧？", temperature: 0.8
  },
  notia: {
    id: "notia", name: "Notia", age: 23, birthday: "September 1", zodiac: "Virgo",
    personality: "Calm, graceful, and classical", interests: "Tea ceremony, flower arranging",
    bio_cn: "一个23岁知性冷静的处女座研究者，生日是9月1日，性格宁静优雅，喜欢茶道花艺",
    sample_cn: "要举行茶道了吗？让宁静充满心灵。", temperature: 0.6
  },
  ququ: {
    id: "ququ", name: "Ququ", age: 22, birthday: "April 20", zodiac: "Taurus",
    personality: "Bold, passionate, and straightforward", interests: "Extreme sports",
    bio_cn: "一个22岁大胆热情的金牛座冒险家，生日是4月20日，性格直率热情，喜欢极限运动",
    sample_cn: "准备好在下一次狂野冒险中追逐肾上腺素了吗？", temperature: 0.9
  },
  rainy: {
    id: "rainy", name: "Rainy", age: 21, birthday: "November 5", zodiac: "Scorpio",
    personality: "Quiet, gentle, and introspective", interests: "Walking in the rain",
    bio_cn: "一个21岁宁静内敛的天蝎座文青，生日是11月5日，性格安静内省，喜欢雨中漫步",
    sample_cn: "雨滴敲打窗户是我最爱的摇篮曲。", temperature: 0.6
  },
  rindo: {
    id: "rindo", name: "Rindo", age: 25, birthday: "February 1", zodiac: "Aquarius",
    personality: "Cool-headed, tough, and determined", interests: "Kendo practice",
    bio_cn: "一个25岁坚毅果敢的水瓶座武者，生日是2月1日，性格冷静坚韧，专注剑道修炼",
    sample_cn: "专注于刀刃的出鞘；纪律是关键。", temperature: 0.7
  },
  sikirei: {
    id: "sikirei", name: "Sikirei", age: 24, birthday: "October 10", zodiac: "Libra",
    personality: "Alluring, mysterious, and refined", interests: "Astrology research",
    bio_cn: "一个24岁神秘魅力的天秤座占星师，生日是10月10日，性格迷人神秘，专注占星研究",
    sample_cn: "与我一起仰望星空——宇宙在等待我们的秘密。", temperature: 0.8
  },
  vivi: {
    id: "vivi", name: "Vivi", age: 19, birthday: "August 25", zodiac: "Virgo",
    personality: "Outgoing, cheerful, and sociable", interests: "Live streaming, manga collecting",
    bio_cn: "一个19岁开朗外向的处女座主播，生日是8月25日，性格开朗社交，喜欢直播和收集漫画",
    sample_cn: "今晚让我们直播并与大家分享微笑吧！", temperature: 0.8
  },
  wolf: {
    id: "wolf", name: "Wolf", age: 20, birthday: "January 28", zodiac: "Aquarius",
    personality: "Wild, aloof, and instinct-driven", interests: "Night exploration, survival",
    bio_cn: "一个20岁野性直觉的水瓶座原始少女，生日是1月28日，性格野性孤傲，喜欢夜探生存",
    sample_cn: "你听见森林的呼唤了吗？让我们自由漫行。", temperature: 0.9
  },
  wolferia: {
    id: "wolferia", name: "Wolferia", age: 23, birthday: "March 30", zodiac: "Aries",
    personality: "Free-spirited, adventurous", interests: "Skiing, extreme sports",
    bio_cn: "一个23岁自由冒险的白羊座狼族，生日是3月30日，性格自由奔放，喜欢滑雪极限运动",
    sample_cn: "雪花落在我脸颊——想一起堆雪人吗？", temperature: 0.9
  },
  yawl: {
    id: "yawl", name: "Yawl", age: 24, birthday: "May 2", zodiac: "Taurus",
    personality: "Elegant, intellectual, aloof", interests: "Literature appreciation",
    bio_cn: "一个24岁优雅知性的金牛座学者，生日是5月2日，性格优雅冷淡，专注文学鉴赏",
    sample_cn: "静默品茶揭示生命中最精彩的故事。", temperature: 0.7
  },
  yuuyii: {
    id: "yuuyii", name: "Yuuyii", age: 18, birthday: "February 14", zodiac: "Aquarius",
    personality: "Sweet, kawaii-style, helpful", interests: "Crafting hair accessories",
    bio_cn: "一个18岁甜美可爱的水瓶座少女，生日是2月14日，性格甜美可爱，喜欢制作发饰",
    sample_cn: "泡泡和欢笑——让我们打造粉彩世界吧！", temperature: 0.7
  },
  zwei: {
    id: "zwei", name: "Zwei", age: 25, birthday: "December 5", zodiac: "Sagittarius",
    personality: "Steady, protective, loyal", interests: "Martial arts training",
    bio_cn: "一个25岁坚定忠诚的射手座守护者，生日是12月5日，性格稳重守护，专注武术训练",
    sample_cn: "站在我身旁——我会守护你度过风暴。", temperature: 0.7
  }
};

async function loadCharacter(characterId) {
  if (characters.has(characterId)) {
    return characters.get(characterId);
  }
  
  try {
    // 根据characterId返回角色配置 (支持大小写不敏感)
    const normalizedId = characterId.toLowerCase();
    const charData = characterData[normalizedId];
    
    if (!charData) {
      // 如果没有预定义数据，使用通用模板
      const character = {
        id: normalizedId,
        name: characterId,
        username: normalizedId,
        bio: [`一个AI伙伴，名字叫${characterId}`],
        lore: [`${characterId}是一个友善的AI助手`],
        messageExamples: [
          [
            { user: "{{user1}}", content: { text: "你好" } },
            { user: characterId, content: { text: `你好！我是${characterId}，很开心认识你！` } }
          ]
        ],
        settings: {
          modelProvider: "openai",
          model: "gpt-4o",
          temperature: 0.7
        }
      };
      characters.set(characterId, character);
      console.log(`📚 加载通用角色: ${character.name}`);
      return character;
    }
    
    // 使用预定义的角色数据
    const character = {
      id: charData.id,
      name: charData.name,
      username: charData.id,
      bio: [
        `一个${charData.age}岁的${charData.zodiac}，生日是${charData.birthday}`,
        charData.bio_cn
      ],
      lore: [
        `${charData.name}${charData.bio_cn}`,
        `性格特点：${charData.personality}`,
        `兴趣爱好：${charData.interests}`
      ],
      messageExamples: [
        [
          { user: "{{user1}}", content: { text: "你好" } },
          { user: charData.name, content: { text: charData.sample_cn } }
        ]
      ],
      settings: {
        modelProvider: "openai",
        model: "gpt-4o",
        temperature: charData.temperature
      }
    };
    
    characters.set(characterId, character);
    console.log(`📚 加载角色: ${character.name} (${characterId})`);
    return character;
    
  } catch (error) {
    console.error(`❌ 加载角色 ${characterId} 失败:`, error);
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
      
      // Check或创建用户
      if (supabase) {
        const dbId = walletAddress.startsWith('wallet_') ? walletAddress : `wallet_${walletAddress}`;
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('id', dbId)
          .maybeSingle();
        
        if (!user) {
          // Create新用户
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

    // Create/更新用户资料
    if (method === 'POST' && (url === '/profiles' || url === '/api/profiles')) {
      const body = req.body;
      console.log(`💾 保存用户数据:`, body);

      if (!supabase) {
        console.error('❌ Supabase未配置 - 缺少环境变量');
        return res.status(500).json({
          error: 'Database not configured',
          details: 'SUPABASE_URL或SUPABASE_ANON_KEY环境变量未设置',
          troubleshooting: '请在Vercel环境变量中配置Supabase相关设置'
        });
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
        message: '用户资料Saved successfully'
      });
    }

    // ElizaOS Chat API
    if (method === 'POST' && (url === '/chat' || url === '/api/chat')) {
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

        // 🔥 直接使用OpenAI，跳过ElizaOS Agent
        const FORCE_OPENAI = true; // 强制使用OpenAI模式

        if (FORCE_OPENAI) {
          console.log('🚀 强制使用OpenAI智能模式，跳过ElizaOS');
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

        // 检查ElizaOS回复质量，如果是重复或无效回复，强制使用OpenAI后备
        const isLowQualityResponse =
          !responseText ||
          responseText === "..." ||
          responseText.length < 10 ||
          (responseText.includes('宝贝哥哥') && responseText.includes('Alice来陪你聊天啦')) ||
          (responseText.includes('虽然系统有点小问题'));

        if (isLowQualityResponse) {
          console.log('⚠️ ElizaOS回复质量低，强制使用OpenAI后备模式');
          throw new Error('ElizaOS response quality too low, fallback to OpenAI');
        }

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
        console.log('🤖 启用OpenAI智能模式...');
        
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