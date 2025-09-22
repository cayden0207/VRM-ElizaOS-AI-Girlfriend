// ElizaOS Action implementation

// 记忆类型定义
const memoryTypes = {
  personal: '个人信息',      // 用户基本信息
  preference: '偏好喜好',    // 用户偏好
  experience: '共同经历',    // 互动经历
  emotion: '情感记录',       // 情感状态
  relationship: '关系里程碑', // 关系发展
  habit: '习惯特点',         // 用户习惯
  goal: '目标愿望'           // 用户目标
};

/**
 * 验证是否需要更新记忆
 */
const validate = async (runtime, message, state) => {
  try {
    const content = message.content?.text || '';

    // 检查是否包含值得记录的信息
    const memoryIndicators = [
      // 个人信息类
      '我是', '我叫', '我的名字', '我来自', '我住在',
      // 偏好类
      '我喜欢', '我不喜欢', '我爱', '我讨厌',
      // 经历类
      '我们一起', '记得吗', '还记得', '第一次',
      // 目标类
      '我想', '我希望', '我的梦想', '我的目标',
      // 习惯类
      '我通常', '我经常', '我总是', '我从不'
    ];

    const hasMemoryContent = memoryIndicators.some(indicator =>
      content.includes(indicator)
    );

    // 或者消息比较长，可能包含重要信息
    const isDetailedMessage = content.length > 20;

    return hasMemoryContent || isDetailedMessage;
  } catch (error) {
    console.error('❌ MemoryUpdateAction validation error:', error);
    return false;
  }
};

/**
 * 执行记忆更新Action
 */
const handler = async (runtime, message, state, options, callback) => {
  try {
    const content = message.content?.text || '';
    const userId = message.userId;

    // 提取关键信息
    const extractedInfo = extractKeyInformation(content);

    // 分类记忆类型
    const memoryCategory = categorizeMemory(extractedInfo);

    // 存储到数据库
    const memoryRecord = await storeMemory(runtime, userId, extractedInfo, memoryCategory);

    console.log(`🧠 Memory updated: ${memoryCategory} - ${extractedInfo.summary}`);

    return {
      type: 'memory_update',
      category: memoryCategory,
      extracted_info: extractedInfo,
      memory_id: memoryRecord?.id,
      importance: calculateImportance(extractedInfo),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ MemoryUpdateAction execution error:', error);
    return null;
  }
};

/**
 * 提取关键信息
 */
const extractKeyInformation = (content) => {
  const info = {
    summary: '',
    details: {},
    keywords: [],
    entities: []
  };

  // 提取个人信息
  const personalPatterns = {
    name: /我叫(.+)|我的名字是(.+)|我是(.+)/g,
    location: /我住在(.+)|我来自(.+)|我在(.+)/g,
    age: /我今年(.+)岁|我(.+)岁/g,
    job: /我的工作是(.+)|我是(.+)工作|我在(.+)上班/g
  };

  for (const [key, pattern] of Object.entries(personalPatterns)) {
    const matches = content.match(pattern);
    if (matches) {
      info.details[key] = matches[0];
    }
  }

  // 提取偏好信息
  const preferencePatterns = {
    likes: /我喜欢(.+)|我爱(.+)/g,
    dislikes: /我不喜欢(.+)|我讨厌(.+)/g
  };

  for (const [key, pattern] of Object.entries(preferencePatterns)) {
    const matches = content.match(pattern);
    if (matches) {
      info.details[key] = matches[0];
    }
  }

  // 生成摘要
  info.summary = content.length > 50 ? content.substring(0, 50) + '...' : content;

  // 提取关键词
  info.keywords = extractKeywords(content);

  return info;
};

/**
 * 提取关键词
 */
const extractKeywords = (content) => {
  const commonWords = ['的', '了', '是', '我', '你', '他', '她', '在', '有', '和', '与', '或', '但', '及'];
  const words = content.split(/[，。！？；：\s]+/).filter(word =>
    word.length > 1 && !commonWords.includes(word)
  );

  return words.slice(0, 5); // 返回前5个关键词
};

/**
 * 分类记忆类型
 */
const categorizeMemory = (extractedInfo) => {
  const content = extractedInfo.summary.toLowerCase();

  if (extractedInfo.details.name || extractedInfo.details.age || extractedInfo.details.job) {
    return 'personal';
  }

  if (extractedInfo.details.likes || extractedInfo.details.dislikes) {
    return 'preference';
  }

  if (content.includes('我们') || content.includes('一起')) {
    return 'experience';
  }

  if (content.includes('想') || content.includes('希望') || content.includes('梦想')) {
    return 'goal';
  }

  if (content.includes('通常') || content.includes('经常') || content.includes('总是')) {
    return 'habit';
  }

  if (content.includes('开心') || content.includes('伤心') || content.includes('爱')) {
    return 'emotion';
  }

  return 'general';
};

/**
 * 存储记忆到数据库
 */
const storeMemory = async (runtime, userId, extractedInfo, category) => {
  try {
    if (!runtime.databaseAdapter) {
      console.log('📝 No database adapter, memory stored in memory only');
      return { id: Date.now().toString() };
    }

    const memoryRecord = {
      user_id: userId,
      category: category,
      content: extractedInfo.summary,
      details: JSON.stringify(extractedInfo.details),
      keywords: extractedInfo.keywords.join(','),
      importance: calculateImportance(extractedInfo),
      created_at: new Date().toISOString()
    };

    const { data, error } = await runtime.databaseAdapter.supabase
      .from('user_memories')
      .insert(memoryRecord)
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to store memory:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Memory storage error:', error);
    return null;
  }
};

/**
 * 计算记忆重要性
 */
const calculateImportance = (extractedInfo) => {
  let score = 1; // 基础分数

  // 个人信息更重要
  if (extractedInfo.details.name || extractedInfo.details.age) score += 3;
  if (extractedInfo.details.job || extractedInfo.details.location) score += 2;

  // 偏好信息也很重要
  if (extractedInfo.details.likes || extractedInfo.details.dislikes) score += 2;

  // 长文本通常包含更多信息
  if (extractedInfo.summary.length > 30) score += 1;

  // 关键词多的内容更重要
  score += extractedInfo.keywords.length * 0.5;

  return Math.min(score, 5); // 最高5分
};

/**
 * 获取Action示例
 */
const getExamples = () => {
  return [
    {
      user: "我叫小明，今年25岁，是个程序员",
      action: {
        type: 'memory_update',
        category: 'personal',
        importance: 4
      }
    },
    {
      user: "我喜欢听音乐和看电影",
      action: {
        type: 'memory_update',
        category: 'preference',
        importance: 2
      }
    }
  ];
};

// 导出Action对象
export const memoryUpdateAction = {
  name: 'memory_update',
  similes: ['MEMORY_UPDATE', 'REMEMBER', 'STORE_INFO'],
  description: '分析对话内容，提取并存储重要的用户信息和互动记忆',
  validate,
  handler,
  examples: getExamples()
};