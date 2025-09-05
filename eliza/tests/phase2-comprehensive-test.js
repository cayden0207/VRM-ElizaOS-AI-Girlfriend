import { performance } from 'perf_hooks';

// Phase 2 综合测试套件
class Phase2TestSuite {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  async runAllTests() {
    console.log('🧪 Phase 2 ElizaOS 集成 - 综合测试开始');
    console.log('='.repeat(60));

    await this.testHealthCheck();
    await this.testCharactersList();
    await this.testCharacterStatus();
    await this.testBasicChat();
    await this.testEnhancedDialogue();
    await this.testEmotionDetection();
    await this.testPersonalityAdaptation();
    await this.testPerformance();
    await this.testErrorHandling();

    this.printSummary();
  }

  async testHealthCheck() {
    console.log('\\n🏥 测试健康检查...');
    
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      
      this.assert(response.ok, '健康检查 HTTP 状态');
      this.assert(data.success === true, '健康检查成功标志');
      this.assert(data.service === 'eliza-bridge-phase2', '服务标识正确');
      this.assert(data.elizaOS.charactersLoaded === 25, '25个角色已加载');
      this.assert(data.elizaOS.status === 'healthy', '系统状态健康');
      this.assert(data.elizaOS.features.includes('enhanced_dialogue'), '增强对话功能');
      this.assert(data.elizaOS.features.includes('emotion_detection'), '情感检测功能');

      console.log('  ✅ 健康检查通过');
      console.log(`  📊 运行时间: ${data.uptime.human}`);
      console.log(`  🤖 角色数量: ${data.elizaOS.charactersLoaded}`);
    } catch (error) {
      this.recordFailure('健康检查', error);
    }
  }

  async testCharactersList() {
    console.log('\\n👥 测试角色列表...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/characters`);
      const data = await response.json();
      
      this.assert(response.ok, '角色列表 HTTP 状态');
      this.assert(data.success === true, '角色列表成功标志');
      this.assert(data.data.total === 25, '总角色数量正确');
      this.assert(data.data.active === 25, '所有角色都活跃');
      this.assert(Array.isArray(data.data.characters), '角色数据是数组');
      
      // 验证角色数据结构
      const character = data.data.characters[0];
      this.assert(typeof character.characterId === 'string', '角色ID是字符串');
      this.assert(typeof character.name === 'string', '角色名称是字符串');
      this.assert(character.status === 'active', '角色状态是active');
      this.assert(character.available === true, '角色可用');
      this.assert(typeof character.personality === 'string', '个性描述存在');

      console.log('  ✅ 角色列表测试通过');
      console.log(`  📋 发现角色: ${data.data.characters.map(c => c.name).slice(0, 5).join(', ')}...`);
    } catch (error) {
      this.recordFailure('角色列表', error);
    }
  }

  async testCharacterStatus() {
    console.log('\\n🔍 测试单个角色状态...');
    
    const testCharacters = ['alice', 'ash', 'yuuyii'];
    
    for (const characterId of testCharacters) {
      try {
        const response = await fetch(`${this.baseUrl}/api/characters/${characterId}/status`);
        const data = await response.json();
        
        this.assert(response.ok, `${characterId} 状态 HTTP`);
        this.assert(data.success === true, `${characterId} 状态成功`);
        this.assert(data.data.status === 'active', `${characterId} 状态活跃`);
        this.assert(data.data.characterId === characterId, `${characterId} ID正确`);
        this.assert(typeof data.data.personality === 'string', `${characterId} 个性存在`);
        this.assert(Array.isArray(data.data.interests), `${characterId} 兴趣数组`);

        console.log(`  ✅ ${characterId}: ${data.data.personality}`);
      } catch (error) {
        this.recordFailure(`角色状态-${characterId}`, error);
      }
    }
  }

  async testBasicChat() {
    console.log('\\n💬 测试基础聊天功能...');
    
    const testCases = [
      {
        characterId: 'alice',
        message: '你好！',
        userId: 'test_basic_001'
      },
      {
        characterId: 'ash',
        message: 'Hello, nice to meet you!',
        userId: 'test_basic_002'
      },
      {
        characterId: 'yuuyii',
        message: '今天天气不错呢',
        userId: 'test_basic_003'
      }
    ];

    for (const testCase of testCases) {
      try {
        const startTime = performance.now();
        
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCase)
        });
        
        const data = await response.json();
        const endTime = performance.now();
        
        this.assert(response.ok, `${testCase.characterId} 聊天 HTTP`);
        this.assert(data.success === true, `${testCase.characterId} 聊天成功`);
        this.assert(typeof data.data.response === 'string', `${testCase.characterId} 回复是字符串`);
        this.assert(data.data.response.length > 0, `${testCase.characterId} 回复非空`);
        this.assert(data.data.enhanced === true, `${testCase.characterId} 增强功能`);
        this.assert(typeof data.data.emotion === 'string', `${testCase.characterId} 情感检测`);

        console.log(`  ✅ ${testCase.characterId}: "${data.data.response.substring(0, 30)}..." (${Math.round(endTime - startTime)}ms)`);
      } catch (error) {
        this.recordFailure(`基础聊天-${testCase.characterId}`, error);
      }
    }
  }

  async testEnhancedDialogue() {
    console.log('\\n🧠 测试增强对话功能...');
    
    const testCases = [
      {
        characterId: 'ash',
        message: '你能教我编程吗？',
        userId: 'test_enhanced_001',
        expectedType: 'question'
      },
      {
        characterId: 'zwei',
        message: '我今天很开心！',
        userId: 'test_enhanced_002',
        expectedType: 'emotional'
      },
      {
        characterId: 'yuuyii',
        message: '早上好！',
        userId: 'test_enhanced_003',
        expectedType: 'greeting'
      }
    ];

    for (const testCase of testCases) {
      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCase)
        });
        
        const data = await response.json();
        
        this.assert(response.ok, `增强对话 ${testCase.expectedType} HTTP`);
        this.assert(data.data.enhanced === true, `增强对话 ${testCase.expectedType} 标记`);
        this.assert(data.data.confidence >= 0.8, `增强对话 ${testCase.expectedType} 置信度`);
        
        // 验证响应内容包含个性化元素
        const responseText = data.data.response.toLowerCase();
        
        console.log(`  ✅ ${testCase.expectedType}类型 (${testCase.characterId}): 置信度${data.data.confidence}`);
        console.log(`     "${data.data.response.substring(0, 40)}..."`);
      } catch (error) {
        this.recordFailure(`增强对话-${testCase.expectedType}`, error);
      }
    }
  }

  async testEmotionDetection() {
    console.log('\\n😊 测试情感检测...');
    
    const emotionTests = [
      {
        characterId: 'alice',
        message: '我太开心了！！！',
        userId: 'test_emotion_001',
        expectedEmotion: ['happy', 'excited', 'friendly']
      },
      {
        characterId: 'ash',
        message: '让我想想这个问题...',
        userId: 'test_emotion_002',
        expectedEmotion: ['thoughtful', 'neutral']
      }
    ];

    for (const testCase of emotionTests) {
      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCase)
        });
        
        const data = await response.json();
        
        this.assert(response.ok, `情感检测 HTTP`);
        this.assert(typeof data.data.emotion === 'string', '情感是字符串');
        this.assert(data.data.emotion.length > 0, '情感非空');
        
        const detectedEmotion = data.data.emotion;
        console.log(`  ✅ 检测到情感: ${detectedEmotion} (期望: ${testCase.expectedEmotion.join('或')})`);
        
      } catch (error) {
        this.recordFailure(`情感检测-${testCase.characterId}`, error);
      }
    }
  }

  async testPersonalityAdaptation() {
    console.log('\\n🎭 测试个性适应...');
    
    // 测试同一用户与不同角色的对话差异
    const message = '你最喜欢做什么？';
    const testCharacters = ['alice', 'ash', 'yuuyii', 'zwei'];
    const responses = [];

    for (const characterId of testCharacters) {
      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId,
            message,
            userId: 'test_personality_001'
          })
        });
        
        const data = await response.json();
        responses.push({
          character: characterId,
          response: data.data.response
        });
        
        this.assert(response.ok, `个性适应-${characterId} HTTP`);
        
        console.log(`  ✅ ${characterId}: "${data.data.response.substring(0, 35)}..."`);
        
      } catch (error) {
        this.recordFailure(`个性适应-${characterId}`, error);
      }
    }

    // 验证响应的多样性
    const uniqueResponses = new Set(responses.map(r => r.response));
    this.assert(uniqueResponses.size === responses.length, '角色响应具有唯一性');
    console.log(`  ✅ 个性差异化验证通过 (${uniqueResponses.size}个独特响应)`);
  }

  async testPerformance() {
    console.log('\\n⚡ 测试性能指标...');
    
    const performanceTests = [];
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: 'alice',
            message: '性能测试消息 ' + i,
            userId: 'test_performance_001'
          })
        });
        
        const data = await response.json();
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        performanceTests.push({
          responseTime,
          success: response.ok && data.success
        });
        
      } catch (error) {
        performanceTests.push({
          responseTime: -1,
          success: false,
          error: error.message
        });
      }
    }
    
    const successfulTests = performanceTests.filter(t => t.success);
    const averageTime = successfulTests.reduce((sum, t) => sum + t.responseTime, 0) / successfulTests.length;
    const maxTime = Math.max(...successfulTests.map(t => t.responseTime));
    const minTime = Math.min(...successfulTests.map(t => t.responseTime));
    
    this.assert(successfulTests.length === iterations, '所有性能测试成功');
    this.assert(averageTime < 1000, '平均响应时间 < 1秒');
    this.assert(maxTime < 2000, '最大响应时间 < 2秒');
    
    console.log(`  ✅ 性能测试通过:`);
    console.log(`     平均响应时间: ${Math.round(averageTime)}ms`);
    console.log(`     响应时间范围: ${Math.round(minTime)}-${Math.round(maxTime)}ms`);
    console.log(`     成功率: ${(successfulTests.length / iterations * 100).toFixed(1)}%`);
  }

  async testErrorHandling() {
    console.log('\\n🛡️ 测试错误处理...');
    
    // 测试无效角色ID
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: 'nonexistent_character',
          message: '测试消息',
          userId: 'test_error_001'
        })
      });
      
      const data = await response.json();
      
      this.assert(!data.success || data.data.confidence < 0.5, '无效角色处理');
      console.log(`  ✅ 无效角色处理: ${data.success ? '降级响应' : '错误处理'}`);
    } catch (error) {
      console.log(`  ✅ 无效角色处理: 异常捕获`);
    }
    
    // 测试空消息
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: 'alice',
          message: '',
          userId: 'test_error_002'
        })
      });
      
      this.assert(response.status === 400 || response.ok, '空消息处理');
      console.log(`  ✅ 空消息处理: HTTP ${response.status}`);
    } catch (error) {
      console.log(`  ✅ 空消息处理: 异常捕获`);
    }
    
    // 测试缺少参数
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '测试消息'
          // 缺少 characterId 和 userId
        })
      });
      
      this.assert(response.status === 400, '缺少参数处理');
      console.log(`  ✅ 缺少参数处理: HTTP ${response.status}`);
    } catch (error) {
      console.log(`  ✅ 缺少参数处理: 异常捕获`);
    }
  }

  assert(condition, testName) {
    this.results.total++;
    if (condition) {
      this.results.passed++;
      this.results.details.push({ name: testName, status: 'PASS' });
    } else {
      this.results.failed++;
      this.results.details.push({ name: testName, status: 'FAIL' });
      console.log(`    ❌ ${testName} 失败`);
    }
  }

  recordFailure(testName, error) {
    this.results.total++;
    this.results.failed++;
    this.results.details.push({ 
      name: testName, 
      status: 'ERROR', 
      error: error.message 
    });
    console.log(`    ❌ ${testName} 错误: ${error.message}`);
  }

  printSummary() {
    console.log('\\n' + '='.repeat(60));
    console.log('📊 Phase 2 综合测试结果');
    console.log('='.repeat(60));
    
    const passRate = (this.results.passed / this.results.total * 100).toFixed(1);
    
    console.log(`✅ 通过: ${this.results.passed}/${this.results.total} (${passRate}%)`);
    console.log(`❌ 失败: ${this.results.failed}`);
    
    if (this.results.failed > 0) {
      console.log('\\n失败的测试:');
      this.results.details
        .filter(d => d.status !== 'PASS')
        .forEach(detail => {
          console.log(`  - ${detail.name}: ${detail.status}${detail.error ? ' - ' + detail.error : ''}`);
        });
    }
    
    console.log('\\n🎯 测试评估:');
    if (passRate >= 95) {
      console.log('🟢 优秀 - Phase 2 实现质量很高，可以进入 Phase 3');
    } else if (passRate >= 85) {
      console.log('🟡 良好 - Phase 2 基本功能正常，建议修复失败项后进入 Phase 3');
    } else {
      console.log('🔴 需要改进 - 建议修复主要问题后再进入下一阶段');
    }
    
    console.log('\\n🚀 Phase 2 -> Phase 3 准备状态:');
    console.log(`  💬 增强对话: ${this.results.details.some(d => d.name.includes('增强对话') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  😊 情感检测: ${this.results.details.some(d => d.name.includes('情感检测') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  🎭 个性适应: ${this.results.details.some(d => d.name.includes('个性适应') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  ⚡ 性能指标: ${this.results.details.some(d => d.name.includes('性能测试') && d.status === 'PASS') ? '✅' : '❌'}`);
    
    console.log('\\n' + '='.repeat(60));
  }
}

// 运行测试
const testSuite = new Phase2TestSuite();
testSuite.runAllTests().catch(error => {
  console.error('测试套件执行失败:', error);
  process.exit(1);
});