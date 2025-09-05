// ElevenLabs Voice Service
class ElevenLabsVoiceService {
  constructor() {
    this.apiKey = null; // 将从环境变量获取
    this.baseURL = 'https://api.elevenlabs.io/v1';
    
    // 从 character.md 中提取的语音映射
    this.voiceMap = {
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
  }
  
  // 初始化 API Key
  init(apiKey) {
    this.apiKey = apiKey;
    console.log('🎤 ElevenLabs Voice Service 初始化完成');
  }
  
  // 获取角色的语音ID
  getVoiceId(characterId) {
    const normalizedId = characterId.toLowerCase();
    return this.voiceMap[normalizedId] || null;
  }
  
  // 生成语音
  async generateVoice(text, characterId, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('ElevenLabs API Key 未配置');
      }
      
      const voiceId = this.getVoiceId(characterId);
      if (!voiceId) {
        throw new Error(`角色 ${characterId} 没有配置语音ID`);
      }
      
      console.log(`🎤 生成语音: ${characterId} (${voiceId}) - "${text.substring(0, 50)}..."`);
      
      const response = await fetch(`${this.baseURL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
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
      
    } catch (error) {
      console.error('❌ 语音生成失败:', error.message);
      return {
        success: false,
        error: error.message,
        characterId: characterId
      };
    }
  }
  
  // 批量获取语音信息
  getAllVoices() {
    return Object.keys(this.voiceMap).map(characterId => ({
      characterId,
      voiceId: this.voiceMap[characterId]
    }));
  }
  
  // 检查角色是否有语音配置
  hasVoice(characterId) {
    return !!this.getVoiceId(characterId);
  }
}

// 全局实例
const voiceService = new ElevenLabsVoiceService();

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = voiceService;
} else {
  window.voiceService = voiceService;
}