/**
 * ElizaOS Providers Index
 * 导出所有自定义Providers
 */

import TimeProvider from './TimeProvider.js';
import UserContextProvider from './UserContextProvider.js';
import RelationshipProvider from './RelationshipProvider.js';

// 导出所有Provider类
export {
    TimeProvider,
    UserContextProvider,
    RelationshipProvider
};

/**
 * 创建所有Providers的实例数组
 * 按优先级排序（priority越小越优先）
 * @returns {Array} Provider实例数组
 */
export function createProviders() {
    const providers = [
        new RelationshipProvider(),  // priority: 0 (最高)
        new TimeProvider(),          // priority: 1
        new UserContextProvider()    // priority: 2
    ];

    // 按优先级排序
    providers.sort((a, b) => a.priority - b.priority);

    console.log('🔌 Created providers:', providers.map(p => `${p.name} (priority: ${p.priority})`).join(', '));

    return providers;
}

/**
 * 获取Provider配置信息
 * @returns {Object} Provider配置
 */
export function getProviderConfig() {
    return {
        count: 3,
        types: ['relationship', 'time', 'userContext'],
        required: ['relationship'],
        optional: ['time', 'userContext']
    };
}

export default {
    TimeProvider,
    UserContextProvider,
    RelationshipProvider,
    createProviders,
    getProviderConfig
};