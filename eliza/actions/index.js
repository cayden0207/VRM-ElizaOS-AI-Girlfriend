import { emotionAction } from './EmotionAction.js';
import { memoryUpdateAction } from './MemoryUpdateAction.js';
import { relationshipAction } from './RelationshipAction.js';
import { vrmAnimationAction } from './VRMAnimationAction.js';

/**
 * Action系统管理器
 * 创建和配置所有可用的Actions
 */
export function createActions() {
  const actions = [
    emotionAction,
    memoryUpdateAction,
    relationshipAction,
    vrmAnimationAction
  ];

  console.log(`🎭 Actions loaded: ${actions.map(a => a.name).join(', ')}`);
  return actions;
}

/**
 * 获取Actions配置信息
 */
export function getActionConfig() {
  return {
    count: 4,
    types: ['emotion', 'memory_update', 'relationship', 'vrm_animation'],
    required: ['emotion', 'relationship']
  };
}

export {
  emotionAction,
  memoryUpdateAction,
  relationshipAction,
  vrmAnimationAction
};