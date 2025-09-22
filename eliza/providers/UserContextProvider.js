/**
 * UserContextProvider - 为Agent提供用户状态和上下文信息
 * 符合ElizaOS Provider标准
 */
export class UserContextProvider {
    constructor() {
        this.name = 'userContext';
        this.description = 'Provides user state, preferences, and contextual information';
        this.userProfiles = new Map(); // 缓存用户档案
    }

    /**
     * 获取用户上下文信息
     * @param {AgentRuntime} runtime - Agent运行时实例
     * @param {Memory} message - 当前消息内存
     * @param {State} state - 当前状态
     * @returns {string} 用户上下文字符串
     */
    async get(runtime, message, state) {
        try {
            const userId = message?.userId || state?.userId;
            const characterId = state?.characterId || state?.agentId;

            if (!userId) {
                return 'User context unavailable (no user ID)';
            }

            // 获取用户档案
            const userProfile = await this.getUserProfile(userId, runtime);

            // 获取用户与当前角色的互动历史
            const interactionHistory = await this.getInteractionHistory(userId, characterId, runtime);

            // 生成上下文文本
            const contextText = this.generateUserContext(userProfile, interactionHistory, state);

            console.log('👤 UserContextProvider context for user:', userId.slice(0, 8) + '...');

            return contextText;

        } catch (error) {
            console.error('❌ UserContextProvider error:', error);
            return 'User context unavailable due to error';
        }
    }

    /**
     * 获取或创建用户档案
     * @param {string} userId - 用户ID
     * @param {AgentRuntime} runtime - Runtime实例
     * @returns {Object} 用户档案对象
     */
    async getUserProfile(userId, runtime) {
        // 首先检查缓存
        if (this.userProfiles.has(userId)) {
            return this.userProfiles.get(userId);
        }

        try {
            // 尝试从数据库获取用户档案
            let userProfile = null;

            if (runtime.databaseAdapter) {
                const memories = await runtime.databaseAdapter.getMemories?.({
                    roomId: `user-profile-${userId}`,
                    count: 1
                });

                if (memories && memories.length > 0) {
                    userProfile = JSON.parse(memories[0].content || '{}');
                }
            }

            // 如果没有找到，创建默认档案
            if (!userProfile) {
                userProfile = {
                    userId,
                    createdAt: new Date().toISOString(),
                    preferences: {
                        language: 'zh-CN',
                        timezone: 'Asia/Shanghai',
                        communicationStyle: 'friendly'
                    },
                    interactionCount: 0,
                    lastSeen: new Date().toISOString(),
                    mood: 'neutral',
                    topics: [],
                    personalInfo: {}
                };
            }

            // 更新最后见面时间和互动次数
            userProfile.lastSeen = new Date().toISOString();
            userProfile.interactionCount = (userProfile.interactionCount || 0) + 1;

            // 缓存用户档案
            this.userProfiles.set(userId, userProfile);

            return userProfile;

        } catch (error) {
            console.error('❌ Error getting user profile:', error);
            return this.getDefaultUserProfile(userId);
        }
    }

    /**
     * 获取用户与角色的互动历史摘要
     * @param {string} userId - 用户ID
     * @param {string} characterId - 角色ID
     * @param {AgentRuntime} runtime - Runtime实例
     * @returns {Object} 互动历史摘要
     */
    async getInteractionHistory(userId, characterId, runtime) {
        try {
            if (!runtime.databaseAdapter || !characterId) {
                return { totalMessages: 0, recentTopics: [], lastInteraction: null };
            }

            const roomId = `${userId}-${characterId}`;
            const recentMemories = await runtime.databaseAdapter.getMemories?.({
                roomId,
                count: 10
            });

            if (!recentMemories || recentMemories.length === 0) {
                return { totalMessages: 0, recentTopics: [], lastInteraction: null };
            }

            // 分析最近的对话主题
            const recentTopics = this.extractTopicsFromMemories(recentMemories);

            return {
                totalMessages: recentMemories.length,
                recentTopics,
                lastInteraction: recentMemories[0]?.createdAt || null,
                conversationMood: this.analyzeConversationMood(recentMemories)
            };

        } catch (error) {
            console.error('❌ Error getting interaction history:', error);
            return { totalMessages: 0, recentTopics: [], lastInteraction: null };
        }
    }

    /**
     * 从记忆中提取对话主题
     * @param {Array} memories - 记忆数组
     * @returns {Array} 主题数组
     */
    extractTopicsFromMemories(memories) {
        const topics = new Set();

        memories.forEach(memory => {
            const content = memory.content || '';

            // 简单的关键词提取逻辑
            const keywords = [
                '工作', '学习', '吃饭', '睡觉', '音乐', '电影', '游戏', '运动',
                '旅行', '心情', '天气', '朋友', '家人', '爱好', '计划', '梦想'
            ];

            keywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    topics.add(keyword);
                }
            });
        });

        return Array.from(topics).slice(0, 5); // 最多返回5个主题
    }

    /**
     * 分析对话情绪
     * @param {Array} memories - 记忆数组
     * @returns {string} 情绪状态
     */
    analyzeConversationMood(memories) {
        // 简单的情绪分析逻辑
        const positiveWords = ['开心', '高兴', '快乐', '喜欢', '爱', '好的', '不错'];
        const negativeWords = ['难过', '生气', '失望', '讨厌', '不好', '糟糕'];

        let positiveCount = 0;
        let negativeCount = 0;

        memories.forEach(memory => {
            const content = memory.content || '';
            positiveWords.forEach(word => {
                if (content.includes(word)) positiveCount++;
            });
            negativeWords.forEach(word => {
                if (content.includes(word)) negativeCount++;
            });
        });

        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }

    /**
     * 生成用户上下文文本
     * @param {Object} userProfile - 用户档案
     * @param {Object} interactionHistory - 互动历史
     * @param {Object} state - 当前状态
     * @returns {string} 上下文文本
     */
    generateUserContext(userProfile, interactionHistory, state) {
        let context = `User: ${userProfile.userId.slice(0, 8)}... `;

        // 用户基本信息
        context += `(${userProfile.interactionCount} interactions)`;

        // 最近互动信息
        if (interactionHistory.totalMessages > 0) {
            context += `. Recent conversation mood: ${interactionHistory.conversationMood}`;

            if (interactionHistory.recentTopics.length > 0) {
                context += `. Recent topics: ${interactionHistory.recentTopics.join(', ')}`;
            }

            // 判断是否为回头客
            const lastInteraction = new Date(interactionHistory.lastInteraction);
            const now = new Date();
            const hoursSinceLastInteraction = (now - lastInteraction) / (1000 * 60 * 60);

            if (hoursSinceLastInteraction < 1) {
                context += '. Continuing recent conversation';
            } else if (hoursSinceLastInteraction < 24) {
                context += '. Returning user from earlier today';
            } else {
                context += '. Returning user after some time';
            }
        } else {
            context += '. First time interacting with this character';
        }

        // 用户偏好
        if (userProfile.preferences) {
            context += `. Prefers ${userProfile.preferences.communicationStyle} communication`;
        }

        return context;
    }

    /**
     * 获取默认用户档案
     * @param {string} userId - 用户ID
     * @returns {Object} 默认用户档案
     */
    getDefaultUserProfile(userId) {
        return {
            userId,
            createdAt: new Date().toISOString(),
            preferences: {
                language: 'zh-CN',
                timezone: 'Asia/Shanghai',
                communicationStyle: 'friendly'
            },
            interactionCount: 1,
            lastSeen: new Date().toISOString(),
            mood: 'neutral',
            topics: [],
            personalInfo: {}
        };
    }

    /**
     * Provider类型标识
     * @returns {string} Provider类型
     */
    get type() {
        return 'userContext';
    }

    /**
     * 是否为必需的Provider
     * @returns {boolean} 是否必需
     */
    get required() {
        return false;
    }

    /**
     * Provider优先级
     * @returns {number} 优先级数值（越小越优先）
     */
    get priority() {
        return 2;
    }
}

export default UserContextProvider;