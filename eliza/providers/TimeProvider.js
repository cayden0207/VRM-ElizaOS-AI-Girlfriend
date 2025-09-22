/**
 * TimeProvider - 为Agent提供动态时间上下文信息
 * 符合ElizaOS Provider标准
 */
export class TimeProvider {
    constructor() {
        this.name = 'time';
        this.description = 'Provides current time and date context for conversations';
    }

    /**
     * 获取时间上下文信息
     * @param {AgentRuntime} runtime - Agent运行时实例
     * @param {Memory} message - 当前消息内存
     * @param {State} state - 当前状态
     * @returns {string} 时间上下文字符串
     */
    async get(runtime, message, state) {
        try {
            const now = new Date();

            // 获取用户时区（如果可用）
            const userTimezone = state?.userTimezone || 'Asia/Shanghai';

            // 格式化时间信息
            const timeInfo = {
                currentTime: now.toLocaleString('zh-CN', {
                    timeZone: userTimezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    weekday: 'long'
                }),
                timeOfDay: this.getTimeOfDay(now),
                dayOfWeek: now.toLocaleDateString('zh-CN', { weekday: 'long' }),
                isWeekend: this.isWeekend(now),
                timestamp: now.toISOString()
            };

            // 生成上下文文本
            const contextText = this.generateTimeContext(timeInfo);

            console.log('🕐 TimeProvider context:', contextText);

            return contextText;

        } catch (error) {
            console.error('❌ TimeProvider error:', error);
            return 'Current time context unavailable';
        }
    }

    /**
     * 获取一天中的时间段
     * @param {Date} date - 日期对象
     * @returns {string} 时间段描述
     */
    getTimeOfDay(date) {
        const hour = date.getHours();

        if (hour >= 5 && hour < 9) return '早晨';
        if (hour >= 9 && hour < 12) return '上午';
        if (hour >= 12 && hour < 14) return '中午';
        if (hour >= 14 && hour < 18) return '下午';
        if (hour >= 18 && hour < 22) return '晚上';
        return '深夜';
    }

    /**
     * 判断是否为周末
     * @param {Date} date - 日期对象
     * @returns {boolean} 是否为周末
     */
    isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6; // 0=周日, 6=周六
    }

    /**
     * 生成时间上下文文本
     * @param {Object} timeInfo - 时间信息对象
     * @returns {string} 上下文文本
     */
    generateTimeContext(timeInfo) {
        let context = `Current time: ${timeInfo.currentTime} (${timeInfo.timeOfDay})`;

        if (timeInfo.isWeekend) {
            context += ', it\'s weekend';
        }

        // 根据时间段添加适当的上下文提示
        const timeContexts = {
            '早晨': 'Good morning! A fresh start to the day.',
            '上午': 'Good morning! Perfect time for productivity.',
            '中午': 'It\'s lunchtime! Time for a break.',
            '下午': 'Good afternoon! The day is progressing well.',
            '晚上': 'Good evening! Time to wind down.',
            '深夜': 'It\'s quite late! Time for rest.'
        };

        const timeHint = timeContexts[timeInfo.timeOfDay];
        if (timeHint) {
            context += `. ${timeHint}`;
        }

        return context;
    }

    /**
     * Provider类型标识
     * @returns {string} Provider类型
     */
    get type() {
        return 'time';
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
        return 1;
    }
}

export default TimeProvider;