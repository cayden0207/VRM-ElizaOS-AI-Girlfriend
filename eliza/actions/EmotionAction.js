// ElizaOS Action implementation

// 定义支持的情感类型
const emotions = [
  'happy',    // 开心
  'sad',      // 伤心
  'excited',  // 兴奋
  'shy',      // 害羞
  'angry',    // 生气
  'love',     // 爱意
  'surprised', // 惊讶
  'confused', // 困惑
  'worried'   // 担心
];

/**
 * 验证是否应该触发情感表达
 */
const validate = async (runtime, message, state) => {
  try {
    // 分析消息内容是否包含情感触发词
    const content = message.content?.text?.toLowerCase() || '';

    // 情感触发关键词
    const emotionTriggers = [
      '开心', '高兴', '快乐', '兴奋', '激动',
      '伤心', '难过', '失望', '沮丧',
      '生气', '愤怒', '不满',
      '害羞', '紧张', '尴尬',
      '爱你', '喜欢', '心动',
      '惊讶', '震惊', '意外',
      '困惑', '疑惑', '不明白',
      '担心', '焦虑', '紧张'
    ];

    const hasEmotionTrigger = emotionTriggers.some(trigger =>
      content.includes(trigger)
    );

    return hasEmotionTrigger;
  } catch (error) {
    console.error('❌ EmotionAction validation error:', error);
    return false;
  }
};

/**
 * 执行情感表达Action
 */
const handler = async (runtime, message, state, options, callback) => {
  try {
    const content = message.content?.text?.toLowerCase() || '';

    // 分析应该表达的情感
    const detectedEmotion = analyzeEmotion(content);
    const emotionIntensity = calculateIntensity(content);

    console.log(`😊 Emotion expressed: ${detectedEmotion} (intensity: ${emotionIntensity})`);

    return {
      type: 'emotion',
      emotion: detectedEmotion,
      intensity: emotionIntensity,
      expression: generateEmotionExpression(detectedEmotion, emotionIntensity),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ EmotionAction execution error:', error);
    return null;
  }
};

/**
 * 分析情感类型
 */
const analyzeEmotion = (content) => {
  const emotionKeywords = {
    happy: ['开心', '高兴', '快乐', '哈哈', '笑', '好棒'],
    excited: ['兴奋', '激动', '太棒了', '好厉害', '爱了'],
    sad: ['伤心', '难过', '失望', '沮丧', '哭'],
    angry: ['生气', '愤怒', '不满', '讨厌'],
    shy: ['害羞', '紧张', '尴尬', '不好意思'],
    love: ['爱你', '喜欢你', '心动', '想你'],
    surprised: ['惊讶', '震惊', '哇', '天哪'],
    confused: ['困惑', '疑惑', '不明白', '？？？'],
    worried: ['担心', '焦虑', '紧张', '害怕']
  };

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      return emotion;
    }
  }

  return 'neutral';
};

/**
 * 计算情感强度
 */
const calculateIntensity = (content) => {
  const indicators = {
    high: ['太', '超级', '非常', '极其', '!!!', '！！！'],
    medium: ['很', '蛮', '挺', '!!', '！！'],
    low: ['有点', '稍微', '!', '！']
  };

  for (const [level, words] of Object.entries(indicators)) {
    if (words.some(word => content.includes(word))) {
      return level;
    }
  }

  return 'medium';
};

/**
 * 生成情感表达
 */
const generateEmotionExpression = (emotion, intensity) => {
  const expressions = {
    happy: {
      low: '我有点开心呢~',
      medium: '我很开心！',
      high: '我超级开心！！！'
    },
    excited: {
      low: '有点小兴奋~',
      medium: '好兴奋啊！',
      high: '太激动了！！！'
    },
    sad: {
      low: '我有点难过...',
      medium: '我很伤心...',
      high: '我好难过啊...'
    },
    love: {
      low: '心动的感觉♡',
      medium: '好喜欢你♡',
      high: '我爱你！！！♡♡♡'
    },
    shy: {
      low: '有点害羞呢...',
      medium: '好害羞啊...',
      high: '太害羞了！！！'
    }
  };

  return expressions[emotion]?.[intensity] || '我感受到了你的情感~';
};

/**
 * 获取Action示例
 */
const getExamples = () => {
  return [
    {
      user: "我今天超级开心！",
      action: {
        type: 'emotion',
        emotion: 'happy',
        intensity: 'high'
      }
    },
    {
      user: "我爱你",
      action: {
        type: 'emotion',
        emotion: 'love',
        intensity: 'medium'
      }
    }
  ];
};

// 导出Action对象
export const emotionAction = {
  name: 'emotion',
  similes: ['EMOTION', 'FEELING', 'MOOD'],
  description: '表达当前的情感状态，如开心、伤心、兴奋、害羞等',
  validate,
  handler,
  examples: getExamples()
};