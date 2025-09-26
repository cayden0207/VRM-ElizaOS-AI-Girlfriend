// ElizaOS Action implementation

// VRM动画类型定义
const animationTypes = {
  // 基础表情
  expressions: {
    happy: '开心表情',
    sad: '伤心表情',
    surprised: '惊讶表情',
    angry: '生气表情',
    shy: '害羞表情',
    love: '爱意表情',
    neutral: '中性表情',
    excited: '兴奋表情'
  },

  // 手势动作
  gestures: {
    wave: '挥手',
    point: '指向',
    thumbsUp: '点赞',
    heart: '比心',
    bow: '鞠躬',
    clap: '拍手',
    think: '思考手势',
    refuse: '拒绝手势'
  },

  // 身体动作
  poses: {
    idle: '闲置姿态',
    walk: '走路',
    sit: '坐下',
    dance: '跳舞',
    stretch: '伸展',
    lean: '倾身',
    jump: '跳跃',
    spin: '转圈'
  }
};

/**
 * 验证是否应该触发VRM动画
 */
const validate = async (runtime, message, state) => {
  try {
    const content = message.content?.text?.toLowerCase() || '';

    // 检查是否包含动作触发词
    const actionTriggers = [
      '挥手', '招手', '你好', 'hello', 'hi',
      '开心', '高兴', '笑', '哈哈',
      '伤心', '难过', '哭',
      '生气', '愤怒',
      '惊讶', '震惊', '哇',
      '害羞', '脸红',
      '爱你', '喜欢', '心动',
      '跳舞', '舞蹈',
      '坐下', '休息',
      '跳跃', '兴奋'
    ];

    const hasActionTrigger = actionTriggers.some(trigger => content.includes(trigger));

    // 或者随机触发 (10% 概率)
    const randomTrigger = Math.random() < 0.1;

    return hasActionTrigger || randomTrigger;
  } catch (error) {
    console.error('❌ VRMAnimationAction validation error:', error);
    return false;
  }
};

/**
 * 执行VRM动画Action
 */
const handler = async (runtime, message, state, options, callback) => {
  try {
    const content = message.content?.text?.toLowerCase() || '';

    // 分析需要的动画类型
    const animationPlan = analyzeAnimation(content);

    console.log(`🎭 VRM Animation triggered: ${animationPlan.emotion} - ${animationPlan.action}`);

    return {
      type: 'vrm_animation',
      animation_plan: animationPlan,
      duration_ms: 3000, // 默认3秒
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ VRMAnimationAction execution error:', error);
    return null;
  }
};

/**
 * 分析动画类型
 */
const analyzeAnimation = (content) => {
  const plan = {
    emotion: 'neutral',
    action: 'idle',
    gesture: null,
    intensity: 'medium'
  };

  // 情感分析
  if (content.includes('开心') || content.includes('高兴') || content.includes('笑')) {
    plan.emotion = 'happy';
    plan.action = 'dance';
    plan.gesture = 'thumbsUp';
  } else if (content.includes('伤心') || content.includes('难过')) {
    plan.emotion = 'sad';
    plan.action = 'sit';
  } else if (content.includes('爱你') || content.includes('喜欢')) {
    plan.emotion = 'love';
    plan.action = 'lean';
    plan.gesture = 'heart';
  } else if (content.includes('你好') || content.includes('hello')) {
    plan.emotion = 'happy';
    plan.action = 'idle';
    plan.gesture = 'wave';
  } else if (content.includes('惊讶') || content.includes('震惊')) {
    plan.emotion = 'surprised';
    plan.action = 'jump';
  } else if (content.includes('害羞')) {
    plan.emotion = 'shy';
    plan.action = 'idle';
    plan.gesture = 'think';
  }

  return plan;
};

/**
 * 获取Action示例
 */
const getExamples = () => {
  return [
    [
      {
        user: "{{user1}}",
        content: { text: "我爱你！" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "我也爱你～♡ *害羞地比心*",
          action: "vrm_animation"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "你好呀~" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "你好！很高兴见到你~ *开心地挥手*",
          action: "vrm_animation"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "太棒了！！！" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "哇！真的吗？好兴奋啊～ *开心地跳跃*",
          action: "vrm_animation"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "我今天有点伤心..." }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "怎么了？来，我陪着你... *关切地坐在身边*",
          action: "vrm_animation"
        }
      }
    ]
  ];
};

// Export Action object
export const vrmAnimationAction = {
  name: 'vrm_animation',
  similes: ['VRM_ANIMATION', 'ANIMATION', 'GESTURE', 'EXPRESSION'],
  description: '根据对话内容和情感状态触发VRM角色的动画、表情和姿态',
  validate,
  handler,
  examples: getExamples()
};