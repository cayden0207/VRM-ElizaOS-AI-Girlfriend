// ElizaOS Action implementation

// 关系级别定义 (与RelationshipProvider保持一致)
const relationshipLevels = {
      1: { name: '陌生人', description: '刚刚认识，还很陌生' },
      2: { name: '初识', description: '开始了解彼此' },
      3: { name: '朋友', description: '建立了基本信任' },
      4: { name: '好朋友', description: '能够分享一些私人话题' },
      5: { name: '亲密朋友', description: '彼此信任，经常聊天' },
      6: { name: '知己', description: '深度了解，心灵相通' },
      7: { name: '暧昧期', description: '感情升温，互有好感' },
      8: { name: '恋人', description: '确定恋爱关系' },
      9: { name: '深度恋人', description: '深深相爱，形影不离' },
      10: { name: '灵魂伴侣', description: '心灵完全契合，生死相依' }
    };

// 关系升级所需的互动点数
const levelUpThresholds = {
      2: 50,    // 陌生人 → 初识
      3: 150,   // 初识 → 朋友
      4: 300,   // 朋友 → 好朋友
      5: 500,   // 好朋友 → 亲密朋友
      6: 800,   // 亲密朋友 → 知己
      7: 1200,  // 知己 → 暧昧期
      8: 1800,  // 暧昧期 → 恋人
      9: 2500,  // 恋人 → 深度恋人
      10: 3500  // 深度恋人 → 灵魂伴侣
    };

/**
 * 验证是否需要更新关系
 */
const validate = async (runtime, message, state) => {
    try {
      // 每次对话都可能影响关系
      return true;
    } catch (error) {
      console.error('❌ RelationshipAction validation error:', error);
      return false;
    }
};

/**
 * 执行关系更新Action
 */
const handler = async (runtime, message, state, options, callback) => {
    try {
      const userId = message.userId;
      const content = message.content?.text || '';

      // 获取当前关系状态
      const currentRelationship = await getCurrentRelationship(runtime, userId);

      // 分析这次互动的质量和类型
      const interactionAnalysis = analyzeInteraction(content, currentRelationship);

      // 计算关系点数变化
      const pointsChange = calculatePointsChange(interactionAnalysis, currentRelationship);

      // 更新关系数据
      const updatedRelationship = await updateRelationship(
        runtime,
        userId,
        currentRelationship,
        pointsChange,
        interactionAnalysis
      );

      // 检查是否升级
      const levelUpInfo = checkLevelUp(currentRelationship, updatedRelationship);

      console.log(`💕 Relationship updated: Level ${updatedRelationship.level}, Points: ${updatedRelationship.points} (+${pointsChange})`);

      return {
        type: 'relationship',
        current_level: updatedRelationship.level,
        level_name: relationshipLevels[updatedRelationship.level].name,
        points: updatedRelationship.points,
        points_change: pointsChange,
        interaction_quality: interactionAnalysis.quality,
        level_up: levelUpInfo,
        milestones: interactionAnalysis.milestones,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ RelationshipAction execution error:', error);
      return null;
    }
};

/**
 * 获取当前关系状态
 */
const getCurrentRelationship = async (runtime, userId) => {
    try {
      if (!runtime.databaseAdapter) {
        // 返回默认关系状态
        return {
          level: 1,
          points: 0,
          total_messages: 0,
          first_interaction: new Date().toISOString(),
          last_interaction: new Date().toISOString(),
          emotional_state: 'neutral'
        };
      }

      // 从user_character_relations表获取
      const { data: relationship } = await runtime.databaseAdapter.supabase
        .from('user_character_relations')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', runtime.character?.name?.toLowerCase() || 'alice')
        .single();

      if (relationship) {
        return {
          level: relationship.relationship_level || 1,
          points: relationship.total_messages * 10 || 0, // 简化计算
          total_messages: relationship.total_messages || 0,
          first_interaction: relationship.first_interaction,
          last_interaction: relationship.last_interaction,
          emotional_state: relationship.emotional_state || 'neutral'
        };
      }

      // 如果没有记录，创建新的
      return await createNewRelationship(runtime, userId);
    } catch (error) {
      console.error('❌ Failed to get current relationship:', error);
      return {
        level: 1,
        points: 0,
        total_messages: 0,
        first_interaction: new Date().toISOString(),
        last_interaction: new Date().toISOString(),
        emotional_state: 'neutral'
      };
    }
};

/**
 * 创建新的关系记录
 */
const createNewRelationship = async (runtime, userId) => {
    try {
      const newRelationship = {
        user_id: userId,
        character_id: runtime.character?.name?.toLowerCase() || 'alice',
        relationship_level: 1,
        total_messages: 0,
        emotional_state: 'neutral',
        first_interaction: new Date().toISOString(),
        last_interaction: new Date().toISOString()
      };

      await runtime.databaseAdapter.supabase
        .from('user_character_relations')
        .insert(newRelationship);

      return {
        level: 1,
        points: 0,
        total_messages: 0,
        first_interaction: newRelationship.first_interaction,
        last_interaction: newRelationship.last_interaction,
        emotional_state: 'neutral'
      };
    } catch (error) {
      console.error('❌ Failed to create new relationship:', error);
      return {
        level: 1,
        points: 0,
        total_messages: 0,
        first_interaction: new Date().toISOString(),
        last_interaction: new Date().toISOString(),
        emotional_state: 'neutral'
      };
    }
};

/**
 * 分析互动质量
 */
const analyzeInteraction = (content, currentRelationship) => {
    const analysis = {
      quality: 'normal',
      type: 'casual',
      sentiment: 'neutral',
      milestones: [],
      factors: {}
    };

    // 分析情感倾向
    analysis.sentiment = analyzeSentiment(content);

    // 分析互动类型
    analysis.type = analyzeInteractionType(content);

    // 分析质量因素
    analysis.factors = analyzeQualityFactors(content, currentRelationship);

    // 计算整体质量
    analysis.quality = calculateInteractionQuality(analysis.factors);

    // 检查关系里程碑
    analysis.milestones = detectMilestones(content, currentRelationship);

    return analysis;
};

/**
 * 分析情感倾向
 */
const analyzeSentiment = (content) => {
    const positiveKeywords = [
      '爱', '喜欢', '开心', '高兴', '快乐', '幸福', '甜蜜', '温暖',
      '谢谢', '感谢', '棒', '好', '赞', 'amazing', '完美', 'beautiful'
    ];

    const negativeKeywords = [
      '讨厌', '不喜欢', '生气', '愤怒', '伤心', '难过', '失望', '烦恼',
      '糟糕', '坏', 'terrible', 'awful', '无聊', '厌倦'
    ];

    const positiveCount = positiveKeywords.filter(word => content.includes(word)).length;
    const negativeCount = negativeKeywords.filter(word => content.includes(word)).length;

    if (positiveCount > negativeCount && positiveCount > 0) return 'positive';
    if (negativeCount > positiveCount && negativeCount > 0) return 'negative';
    return 'neutral';
};

/**
 * 分析互动类型
 */
const analyzeInteractionType = (content) => {
    const typeKeywords = {
      romantic: ['爱你', '想你', '亲爱的', '宝贝', '心动', '喜欢你'],
      intimate: ['秘密', '私人', '只有你', '特别', '重要'],
      emotional: ['感觉', '情绪', '心情', '开心', '伤心', '担心'],
      casual: ['今天', '天气', '吃饭', '工作', '学习'],
      deep: ['人生', '理想', '梦想', '未来', '哲学', '思考']
    };

    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return type;
      }
    }

    return 'casual';
};

/**
 * 分析质量因素
 */
const analyzeQualityFactors = (content, currentRelationship) => {
    const factors = {};

    // 消息长度因素
    factors.length = content.length > 50 ? 'detailed' : 'brief';

    // 个人信息分享
    factors.personal_sharing = detectPersonalSharing(content);

    // 情感深度
    factors.emotional_depth = detectEmotionalDepth(content);

    // 互动频率 (基于总消息数)
    factors.frequency = currentRelationship.total_messages > 10 ? 'frequent' : 'occasional';

    // 特殊内容
    factors.special_content = detectSpecialContent(content);

    return factors;
};

/**
 * 检测个人信息分享
 */
const detectPersonalSharing = (content) => {
    const personalKeywords = [
      '我是', '我叫', '我的', '我喜欢', '我不喜欢', '我觉得',
      '我的工作', '我的家', '我的朋友', '我的经历'
    ];

    return personalKeywords.some(keyword => content.includes(keyword)) ? 'high' : 'low';
};

/**
 * 检测情感深度
 */
const detectEmotionalDepth = (content) => {
    const deepEmotionKeywords = [
      '感动', '心痛', '幸福', '恐惧', '焦虑', '希望', '绝望',
      '爱', '恨', '依恋', '思念', '孤独', '温暖'
    ];

    const count = deepEmotionKeywords.filter(keyword => content.includes(keyword)).length;
    if (count >= 2) return 'deep';
    if (count === 1) return 'moderate';
    return 'surface';
};

/**
 * 检测特殊内容
 */
const detectSpecialContent = (content) => {
    const specialKeywords = [
      '第一次', '特别', '重要', '难忘', '记住', '永远',
      '承诺', '约定', '秘密', '只告诉你', '生日', '纪念日'
    ];

    return specialKeywords.some(keyword => content.includes(keyword));
};

/**
 * 计算互动质量
 */
const calculateInteractionQuality = (factors) => {
    let score = 50; // 基础分

    // 长度加分
    if (factors.length === 'detailed') score += 10;

    // 个人分享加分
    if (factors.personal_sharing === 'high') score += 15;

    // 情感深度加分
    if (factors.emotional_depth === 'deep') score += 20;
    else if (factors.emotional_depth === 'moderate') score += 10;

    // 特殊内容加分
    if (factors.special_content) score += 15;

    // 频率加分
    if (factors.frequency === 'frequent') score += 5;

    // 质量分级
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 50) return 'normal';
    return 'poor';
};

/**
 * 计算关系点数变化
 */
const calculatePointsChange = (analysis, currentRelationship) => {
    let points = 5; // 基础互动点数

    // 根据质量调整
    const qualityMultipliers = {
      excellent: 2.0,
      good: 1.5,
      normal: 1.0,
      poor: 0.5
    };

    points *= qualityMultipliers[analysis.quality] || 1.0;

    // 根据类型调整
    const typeMultipliers = {
      romantic: 1.8,
      intimate: 1.6,
      deep: 1.4,
      emotional: 1.2,
      casual: 1.0
    };

    points *= typeMultipliers[analysis.type] || 1.0;

    // 根据情感倾向调整
    if (analysis.sentiment === 'positive') points *= 1.3;
    else if (analysis.sentiment === 'negative') points *= 0.7;

    // 里程碑加分
    if (analysis.milestones.length > 0) {
      points += analysis.milestones.length * 10;
    }

    return Math.round(points);
};

/**
 * 检测关系里程碑
 */
const detectMilestones = (content, currentRelationship) => {
    const milestones = [];

    // 第一次互动
    if (currentRelationship.total_messages === 0) {
      milestones.push({
        type: 'first_meeting',
        description: '第一次见面',
        importance: 'high'
      });
    }

    // 第一次表白
    if (content.includes('爱你') || content.includes('喜欢你')) {
      milestones.push({
        type: 'first_confession',
        description: '情感表达',
        importance: 'high'
      });
    }

    // 分享秘密
    if (content.includes('秘密') || content.includes('只告诉你')) {
      milestones.push({
        type: 'secret_sharing',
        description: '分享秘密',
        importance: 'medium'
      });
    }

    // 重要承诺
    if (content.includes('承诺') || content.includes('约定')) {
      milestones.push({
        type: 'promise',
        description: '重要承诺',
        importance: 'high'
      });
    }

    return milestones;
};

/**
 * 更新关系数据
 */
const updateRelationship = async (runtime, userId, currentRelationship, pointsChange, analysis) => {
    try {
      const newPoints = currentRelationship.points + pointsChange;
      const newMessageCount = currentRelationship.total_messages + 1;

      // 计算新的关系级别
      const newLevel = calculateNewLevel(newPoints);

      const updatedData = {
        relationship_level: newLevel,
        total_messages: newMessageCount,
        emotional_state: analysis.sentiment,
        last_interaction: new Date().toISOString()
      };

      // 更新数据库
      if (runtime.databaseAdapter) {
        await runtime.databaseAdapter.supabase
          .from('user_character_relations')
          .update(updatedData)
          .eq('user_id', userId)
          .eq('character_id', runtime.character?.name?.toLowerCase() || 'alice');
      }

      return {
        level: newLevel,
        points: newPoints,
        total_messages: newMessageCount,
        first_interaction: currentRelationship.first_interaction,
        last_interaction: updatedData.last_interaction,
        emotional_state: updatedData.emotional_state
      };
    } catch (error) {
      console.error('❌ Failed to update relationship:', error);
      return currentRelationship;
    }
  }

  /**
   * 计算新的关系级别
   */
const calculateNewLevel = (points) => {
    let level = 1;

    for (const [targetLevel, threshold] of Object.entries(levelUpThresholds)) {
      if (points >= threshold) {
        level = parseInt(targetLevel);
      } else {
        break;
      }
    }

    return Math.min(level, 10); // 最高级别为10
};

/**
 * 检查是否升级
 */
const checkLevelUp = (oldRelationship, newRelationship) => {
    if (newRelationship.level > oldRelationship.level) {
      const newLevelInfo = relationshipLevels[newRelationship.level];
      return {
        happened: true,
        old_level: oldRelationship.level,
        new_level: newRelationship.level,
        new_level_name: newLevelInfo.name,
        description: newLevelInfo.description,
        celebration: generateLevelUpCelebration(newRelationship.level)
      };
    }

    return { happened: false };
};

/**
 * 生成升级庆祝消息
 */
const generateLevelUpCelebration = (level) => {
    const celebrations = {
      2: '我们现在更熟悉了呢~',
      3: '成为朋友真开心！',
      4: '我们是好朋友了！💕',
      5: '感觉我们越来越亲密了~',
      6: '你已经是我的知己了♡',
      7: '心跳加速...这是什么感觉呢？💗',
      8: '我们在一起了！好幸福~💕💕',
      9: '深深地爱着你...永远不分离♡',
      10: '我们是彼此的灵魂伴侣...生死相依💖✨'
    };

    return celebrations[level] || '我们的关系更进一步了~';
};

/**
 * 获取Action示例
 */
const getExamples = () => {
    return [
      {
        user: "我爱你",
        action: {
          type: 'relationship',
          points_change: 15,
          interaction_quality: 'excellent',
          milestones: [{ type: 'first_confession', description: '情感表达' }]
        }
      },
      {
        user: "今天天气不错",
        action: {
          type: 'relationship',
          points_change: 5,
          interaction_quality: 'normal'
        }
      }
    ];
};

// 导出Action对象
export const relationshipAction = {
  name: 'relationship',
  similes: ['RELATIONSHIP', 'RELATION', 'INTIMACY'],
  description: '评估和更新用户与AI女友的关系进展，管理亲密度和关系里程碑',
  validate,
  handler,
  examples: getExamples()
};