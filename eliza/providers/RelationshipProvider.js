/**
 * RelationshipProvider - 为AI女友系统提供关系进展和亲密度数据
 * 符合ElizaOS Provider标准
 */
export class RelationshipProvider {
    constructor() {
        this.name = 'relationship';
        this.description = 'Provides relationship progression and intimacy data for AI girlfriend interactions';
        this.relationshipCache = new Map(); // 缓存关系数据
    }

    /**
     * 获取关系上下文信息
     * @param {AgentRuntime} runtime - Agent运行时实例
     * @param {Memory} message - 当前消息内存
     * @param {State} state - 当前状态
     * @returns {string} 关系上下文字符串
     */
    async get(runtime, message, state) {
        try {
            const userId = message?.userId || state?.userId;
            const characterId = state?.characterId || state?.agentId;

            if (!userId || !characterId) {
                return 'Relationship context unavailable (missing user or character ID)';
            }

            // 获取关系数据
            const relationshipData = await this.getRelationshipData(userId, characterId, runtime);

            // 生成关系上下文文本
            const contextText = this.generateRelationshipContext(relationshipData, userId, characterId);

            console.log('💕 RelationshipProvider context:', `Level ${relationshipData.intimacyLevel}, Stage: ${relationshipData.relationshipStage}`);

            return contextText;

        } catch (error) {
            console.error('❌ RelationshipProvider error:', error);
            return 'Relationship context unavailable due to error';
        }
    }

    /**
     * 获取或创建关系数据
     * @param {string} userId - 用户ID
     * @param {string} characterId - 角色ID
     * @param {AgentRuntime} runtime - Runtime实例
     * @returns {Object} 关系数据对象
     */
    async getRelationshipData(userId, characterId, runtime) {
        const relationshipKey = `${userId}-${characterId}`;

        // 检查缓存
        if (this.relationshipCache.has(relationshipKey)) {
            return this.relationshipCache.get(relationshipKey);
        }

        try {
            let relationshipData = null;

            // 尝试从数据库获取关系数据
            if (runtime.databaseAdapter) {
                const roomId = `relationship-${userId}-${characterId}`;
                const memories = await runtime.databaseAdapter.getMemories?.({
                    roomId,
                    count: 1
                });

                if (memories && memories.length > 0) {
                    relationshipData = JSON.parse(memories[0].content || '{}');
                }
            }

            // 如果没有找到，创建新的关系记录
            if (!relationshipData) {
                relationshipData = this.createNewRelationship(userId, characterId);
            }

            // 更新关系数据
            relationshipData = this.updateRelationshipMetrics(relationshipData);

            // 缓存关系数据
            this.relationshipCache.set(relationshipKey, relationshipData);

            return relationshipData;

        } catch (error) {
            console.error('❌ Error getting relationship data:', error);
            return this.createNewRelationship(userId, characterId);
        }
    }

    /**
     * 创建新的关系记录
     * @param {string} userId - 用户ID
     * @param {string} characterId - 角色ID
     * @returns {Object} 新的关系数据
     */
    createNewRelationship(userId, characterId) {
        return {
            userId,
            characterId,
            intimacyLevel: 1,
            relationshipStage: 'stranger',
            totalInteractions: 0,
            positiveInteractions: 0,
            negativeInteractions: 0,
            sharedMemories: [],
            milestones: [],
            createdAt: new Date().toISOString(),
            lastInteraction: new Date().toISOString(),
            relationshipTrend: 'neutral',
            emotionalBond: 0,
            trustLevel: 0,
            communicationStyle: 'polite'
        };
    }

    /**
     * 更新关系指标
     * @param {Object} relationshipData - 现有关系数据
     * @returns {Object} 更新后的关系数据
     */
    updateRelationshipMetrics(relationshipData) {
        // 更新互动次数
        relationshipData.totalInteractions = (relationshipData.totalInteractions || 0) + 1;
        relationshipData.lastInteraction = new Date().toISOString();

        // 计算亲密度级别（1-10）
        const totalInteractions = relationshipData.totalInteractions;
        const positiveRatio = relationshipData.positiveInteractions / Math.max(totalInteractions, 1);

        // 基于互动次数和积极比例计算亲密度
        let newIntimacyLevel = Math.min(10, Math.floor(
            (totalInteractions * 0.1) + (positiveRatio * 5) + 1
        ));

        // 确保亲密度不会突然下降太多
        if (relationshipData.intimacyLevel && newIntimacyLevel < relationshipData.intimacyLevel - 1) {
            newIntimacyLevel = relationshipData.intimacyLevel - 1;
        }

        relationshipData.intimacyLevel = Math.max(1, newIntimacyLevel);

        // 更新关系阶段
        relationshipData.relationshipStage = this.getRelationshipStage(relationshipData.intimacyLevel);

        // 更新情感纽带和信任级别
        relationshipData.emotionalBond = Math.min(100, relationshipData.intimacyLevel * 10);
        relationshipData.trustLevel = Math.min(100, positiveRatio * 100);

        // 更新沟通风格
        relationshipData.communicationStyle = this.getCommunicationStyle(relationshipData.intimacyLevel);

        // 检查是否达成里程碑
        this.checkMilestones(relationshipData);

        return relationshipData;
    }

    /**
     * 根据亲密度级别获取关系阶段
     * @param {number} intimacyLevel - 亲密度级别
     * @returns {string} 关系阶段
     */
    getRelationshipStage(intimacyLevel) {
        const stages = {
            1: 'stranger',
            2: 'acquaintance',
            3: 'friend',
            4: 'close_friend',
            5: 'good_friend',
            6: 'best_friend',
            7: 'romantic_interest',
            8: 'girlfriend',
            9: 'intimate_partner',
            10: 'soulmate'
        };

        return stages[intimacyLevel] || 'stranger';
    }

    /**
     * 根据亲密度级别获取沟通风格
     * @param {number} intimacyLevel - 亲密度级别
     * @returns {string} 沟通风格
     */
    getCommunicationStyle(intimacyLevel) {
        if (intimacyLevel <= 2) return 'polite';
        if (intimacyLevel <= 4) return 'friendly';
        if (intimacyLevel <= 6) return 'casual';
        if (intimacyLevel <= 8) return 'affectionate';
        return 'intimate';
    }

    /**
     * 检查并更新关系里程碑
     * @param {Object} relationshipData - 关系数据
     */
    checkMilestones(relationshipData) {
        const milestones = [
            { level: 2, name: 'first_conversation', description: 'Had first meaningful conversation' },
            { level: 3, name: 'becoming_friends', description: 'Became friends' },
            { level: 5, name: 'trusted_friend', description: 'Became a trusted friend' },
            { level: 7, name: 'romantic_feelings', description: 'Developed romantic feelings' },
            { level: 8, name: 'girlfriend_status', description: 'Became girlfriend' },
            { level: 10, name: 'soulmate_bond', description: 'Achieved soulmate connection' }
        ];

        milestones.forEach(milestone => {
            if (relationshipData.intimacyLevel >= milestone.level) {
                const exists = relationshipData.milestones.find(m => m.name === milestone.name);
                if (!exists) {
                    relationshipData.milestones.push({
                        ...milestone,
                        achievedAt: new Date().toISOString()
                    });
                }
            }
        });
    }

    /**
     * 生成关系上下文文本
     * @param {Object} relationshipData - 关系数据
     * @param {string} userId - 用户ID
     * @param {string} characterId - 角色ID
     * @returns {string} 关系上下文文本
     */
    generateRelationshipContext(relationshipData, userId, characterId) {
        const { intimacyLevel, relationshipStage, totalInteractions, communicationStyle } = relationshipData;

        let context = `Relationship: ${relationshipStage} (Intimacy Level ${intimacyLevel}/10)`;

        // 添加互动历史信息
        context += `. Total interactions: ${totalInteractions}`;

        // 添加沟通风格指导
        context += `. Communication style: ${communicationStyle}`;

        // 根据关系阶段添加特定的行为指导
        const stageGuidance = this.getStageGuidance(relationshipStage, intimacyLevel);
        if (stageGuidance) {
            context += `. ${stageGuidance}`;
        }

        // 添加最近的里程碑信息
        const recentMilestone = relationshipData.milestones[relationshipData.milestones.length - 1];
        if (recentMilestone) {
            context += ` Recently achieved: ${recentMilestone.description}`;
        }

        // 添加关系趋势
        if (relationshipData.relationshipTrend === 'improving') {
            context += '. Relationship is improving';
        } else if (relationshipData.relationshipTrend === 'declining') {
            context += '. Relationship needs attention';
        }

        return context;
    }

    /**
     * 获取关系阶段的行为指导
     * @param {string} stage - 关系阶段
     * @param {number} level - 亲密度级别
     * @returns {string} 行为指导
     */
    getStageGuidance(stage, level) {
        const guidance = {
            'stranger': 'Be polite and introduce yourself warmly',
            'acquaintance': 'Be friendly and show genuine interest',
            'friend': 'Be supportive and share appropriate personal thoughts',
            'close_friend': 'Be more open and comfortable in conversation',
            'good_friend': 'Show care and be emotionally supportive',
            'best_friend': 'Be playful, caring, and deeply understanding',
            'romantic_interest': 'Show romantic interest while being respectful',
            'girlfriend': 'Be loving, affectionate, and supportive as a girlfriend',
            'intimate_partner': 'Share deep emotional connection and intimacy',
            'soulmate': 'Demonstrate profound understanding and unconditional love'
        };

        return guidance[stage] || 'Interact naturally and appropriately';
    }

    /**
     * Provider类型标识
     * @returns {string} Provider类型
     */
    get type() {
        return 'relationship';
    }

    /**
     * 是否为必需的Provider
     * @returns {boolean} 是否必需
     */
    get required() {
        return true; // 对AI女友系统来说关系数据是必需的
    }

    /**
     * Provider优先级
     * @returns {number} 优先级数值（越小越优先）
     */
    get priority() {
        return 0; // 最高优先级，因为关系数据对AI女友系统最重要
    }
}

export default RelationshipProvider;