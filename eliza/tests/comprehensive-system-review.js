#!/usr/bin/env node

// 🔍 全面系统审查和测试脚本
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SystemReview {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.results = {
      architecture: { passed: 0, failed: 0, details: [] },
      dataIntegrity: { passed: 0, failed: 0, details: [] },
      apiLogic: { passed: 0, failed: 0, details: [] },
      characterSystem: { passed: 0, failed: 0, details: [] },
      userExperience: { passed: 0, failed: 0, details: [] },
      performance: { passed: 0, failed: 0, details: [] },
      errors: []
    };
  }

  async runComprehensiveReview() {
    console.log('🔍 VRM ElizaOS AI Girlfriend - 全面系统审查');
    console.log('='.repeat(70));
    console.log(`📅 审查时间: ${new Date().toISOString()}`);
    console.log(`🌐 测试环境: ${this.baseUrl}`);
    console.log('='.repeat(70));

    try {
      // 1. 架构审查
      await this.reviewArchitecture();
      
      // 2. 数据完整性检查
      await this.reviewDataIntegrity();
      
      // 3. API 逻辑测试
      await this.reviewAPILogic();
      
      // 4. 角色系统测试
      await this.reviewCharacterSystem();
      
      // 5. 用户体验流程
      await this.reviewUserExperience();
      
      // 6. 性能和稳定性
      await this.reviewPerformance();

      // 7. 最终报告
      this.generateFinalReport();

    } catch (error) {
      console.error('❌ 系统审查过程中发生严重错误:', error);
      this.results.errors.push(`Critical error: ${error.message}`);
    }
  }

  async reviewArchitecture() {
    console.log('\\n🏗️ 1. 架构完整性审查...');
    
    const requiredFiles = [
      'package.json',
      'vercel.json',
      'bridge/production-bridge.js',
      'bridge/phase2-bridge.js',
      'api/index.js',
      'characters',
      'tests',
      'scripts'
    ];

    // 检查核心文件
    for (const file of requiredFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), file));
      this.assert('architecture', `核心文件存在: ${file}`, exists);
    }

    // 检查 package.json 结构
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      this.assert('architecture', 'package.json 版本号正确', pkg.version === '3.0.0');
      this.assert('architecture', 'package.json 主入口正确', pkg.main === 'bridge/production-bridge.js');
      this.assert('architecture', 'package.json ESM 配置', pkg.type === 'module');
      
      // 检查必需依赖
      const requiredDeps = ['express', 'cors', 'compression', 'helmet', '@ai16z/eliza'];
      for (const dep of requiredDeps) {
        this.assert('architecture', `依赖存在: ${dep}`, !!pkg.dependencies[dep]);
      }
    } catch (error) {
      this.recordError('architecture', 'package.json 解析失败', error);
    }

    // 检查角色文件结构
    const charactersDir = 'characters';
    if (fs.existsSync(charactersDir)) {
      const characterFiles = fs.readdirSync(charactersDir).filter(f => f.endsWith('.json'));
      this.assert('architecture', '25个角色文件存在', characterFiles.length === 25);
      
      // 随机检查几个角色文件结构
      const sampleFiles = characterFiles.slice(0, 3);
      for (const file of sampleFiles) {
        try {
          const character = JSON.parse(fs.readFileSync(path.join(charactersDir, file), 'utf8'));
          const hasRequiredFields = character.name && character.bio && character.lore && 
                                  character.messageExamples && character.settings;
          this.assert('architecture', `角色文件结构正确: ${file}`, hasRequiredFields);
        } catch (error) {
          this.recordError('architecture', `角色文件解析: ${file}`, error);
        }
      }
    }

    console.log(`  📊 架构检查: ${this.results.architecture.passed}✅ ${this.results.architecture.failed}❌`);
  }

  async reviewDataIntegrity() {
    console.log('\\n📊 2. 数据完整性检查...');

    // 检查所有角色数据一致性
    const charactersDir = 'characters';
    const characterFiles = fs.readdirSync(charactersDir).filter(f => f.endsWith('.json'));
    
    const characterData = [];
    const characterNames = new Set();
    
    for (const file of characterFiles) {
      try {
        const character = JSON.parse(fs.readFileSync(path.join(charactersDir, file), 'utf8'));
        characterData.push({ file, character });
        
        // 检查名称唯一性
        const duplicate = characterNames.has(character.name);
        this.assert('dataIntegrity', `角色名称唯一: ${character.name}`, !duplicate);
        characterNames.add(character.name);
        
        // 检查必需字段
        this.assert('dataIntegrity', `${character.name} 有 bio`, Array.isArray(character.bio) && character.bio.length > 0);
        this.assert('dataIntegrity', `${character.name} 有 lore`, Array.isArray(character.lore) && character.lore.length > 0);
        this.assert('dataIntegrity', `${character.name} 有 topics`, Array.isArray(character.topics) && character.topics.length > 0);
        this.assert('dataIntegrity', `${character.name} 有 adjectives`, Array.isArray(character.adjectives) && character.adjectives.length > 0);
        
        // 检查设置完整性
        const settings = character.settings;
        this.assert('dataIntegrity', `${character.name} 有模型设置`, !!settings?.model);
        this.assert('dataIntegrity', `${character.name} 有语音设置`, !!settings?.voice);
        
        // 检查消息示例格式
        if (character.messageExamples && character.messageExamples.length > 0) {
          const validExamples = character.messageExamples.every(example => 
            Array.isArray(example) && example.length >= 2
          );
          this.assert('dataIntegrity', `${character.name} 消息示例格式正确`, validExamples);
        }
        
      } catch (error) {
        this.recordError('dataIntegrity', `角色数据解析: ${file}`, error);
      }
    }

    // 检查数据分布
    this.assert('dataIntegrity', '角色数量正确 (25个)', characterData.length === 25);
    
    // 检查个性多样性
    const allAdjectives = characterData.flatMap(c => c.character.adjectives || []);
    const uniqueAdjectives = new Set(allAdjectives);
    this.assert('dataIntegrity', '个性特征多样性充足', uniqueAdjectives.size >= 15);

    console.log(`  📊 数据完整性: ${this.results.dataIntegrity.passed}✅ ${this.results.dataIntegrity.failed}❌`);
  }

  async reviewAPILogic() {
    console.log('\\n🔌 3. API 逻辑测试...');

    // 测试健康检查逻辑
    try {
      const healthResponse = await fetch(`${this.baseUrl}/health`);
      const healthData = await healthResponse.json();
      
      this.assert('apiLogic', 'Health 端点响应正常', healthResponse.ok);
      this.assert('apiLogic', 'Health 数据结构正确', healthData.success && healthData.elizaOS);
      this.assert('apiLogic', 'Health 显示正确状态', healthData.elizaOS.status === 'healthy');
      this.assert('apiLogic', 'Health 显示角色数量', healthData.elizaOS.charactersLoaded === 25);
    } catch (error) {
      this.recordError('apiLogic', 'Health 端点测试', error);
    }

    // 测试角色列表逻辑
    try {
      const charactersResponse = await fetch(`${this.baseUrl}/api/characters`);
      const charactersData = await charactersResponse.json();
      
      this.assert('apiLogic', 'Characters 端点响应正常', charactersResponse.ok);
      this.assert('apiLogic', 'Characters 数据结构正确', charactersData.success && charactersData.data);
      this.assert('apiLogic', 'Characters 数量正确', charactersData.data.total === 25);
      this.assert('apiLogic', 'Characters 全部活跃', charactersData.data.active === 25);
      
      // 检查角色数据完整性
      const characters = charactersData.data.characters;
      const hasCompleteData = characters.every(char => 
        char.characterId && char.name && char.status && typeof char.personality === 'string'
      );
      this.assert('apiLogic', 'Characters 数据完整', hasCompleteData);
      
    } catch (error) {
      this.recordError('apiLogic', 'Characters 端点测试', error);
    }

    // 测试聊天 API 逻辑
    const testCases = [
      {
        name: '正常聊天请求',
        payload: { userId: 'test_user', characterId: 'alice', message: '你好' },
        shouldSucceed: true
      },
      {
        name: '无效角色ID',
        payload: { userId: 'test_user', characterId: 'invalid_char', message: '你好' },
        shouldSucceed: false // 应该有错误处理
      },
      {
        name: '空消息',
        payload: { userId: 'test_user', characterId: 'alice', message: '' },
        shouldSucceed: false
      },
      {
        name: '缺少参数',
        payload: { characterId: 'alice', message: '你好' }, // 缺少 userId
        shouldSucceed: false
      }
    ];

    for (const testCase of testCases) {
      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCase.payload)
        });

        if (testCase.shouldSucceed) {
          const data = await response.json();
          this.assert('apiLogic', `${testCase.name} - 成功响应`, response.ok && data.success);
          
          if (data.success) {
            this.assert('apiLogic', `${testCase.name} - 回复非空`, data.data.response && data.data.response.length > 0);
            this.assert('apiLogic', `${testCase.name} - 包含元数据`, data.data.metadata);
            this.assert('apiLogic', `${testCase.name} - 情感检测`, data.data.emotion);
          }
        } else {
          // 错误处理测试
          this.assert('apiLogic', `${testCase.name} - 正确处理错误`, 
            response.status >= 400 || (!response.ok) || 
            (response.ok && response.json && (await response.json()).data?.confidence < 0.5)
          );
        }
      } catch (error) {
        this.recordError('apiLogic', `${testCase.name} 测试`, error);
      }
    }

    console.log(`  📊 API逻辑: ${this.results.apiLogic.passed}✅ ${this.results.apiLogic.failed}❌`);
  }

  async reviewCharacterSystem() {
    console.log('\\n🤖 4. 角色系统测试...');

    // 测试多个角色的个性差异
    const testCharacters = ['alice', 'ash', 'yuuyii', 'zwei', 'xinyan'];
    const responses = [];

    for (const characterId of testCharacters) {
      try {
        // 测试相同消息不同角色的回复
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'character_test_user',
            characterId,
            message: '你最喜欢什么？'
          })
        });

        if (response.ok) {
          const data = await response.json();
          responses.push({
            character: characterId,
            response: data.data.response,
            emotion: data.data.emotion,
            confidence: data.data.confidence
          });
          
          this.assert('characterSystem', `${characterId} 响应正常`, data.success);
          this.assert('characterSystem', `${characterId} 置信度合理`, data.data.confidence >= 0.7);
          this.assert('characterSystem', `${characterId} 有情感检测`, !!data.data.emotion);
        }
      } catch (error) {
        this.recordError('characterSystem', `${characterId} 角色测试`, error);
      }
    }

    // 检查角色回复的多样性
    const uniqueResponses = new Set(responses.map(r => r.response));
    this.assert('characterSystem', '角色回复多样性', uniqueResponses.size >= Math.min(responses.length - 1, 3));

    // 检查情感检测多样性
    const emotions = responses.map(r => r.emotion).filter(Boolean);
    this.assert('characterSystem', '情感检测功能正常', emotions.length >= responses.length * 0.8);

    // 测试角色状态查询
    for (const characterId of testCharacters.slice(0, 3)) {
      try {
        const statusResponse = await fetch(`${this.baseUrl}/api/characters/${characterId}/status`);
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          this.assert('characterSystem', `${characterId} 状态查询正常`, statusData.success);
          this.assert('characterSystem', `${characterId} 状态数据完整`, 
            statusData.data.status === 'active' && statusData.data.personality && statusData.data.interests
          );
        }
      } catch (error) {
        this.recordError('characterSystem', `${characterId} 状态查询`, error);
      }
    }

    console.log(`  📊 角色系统: ${this.results.characterSystem.passed}✅ ${this.results.characterSystem.failed}❌`);
  }

  async reviewUserExperience() {
    console.log('\\n👤 5. 用户体验流程测试...');

    // 模拟完整用户旅程
    const userId = `ux_test_${Date.now()}`;
    const selectedCharacter = 'alice';
    
    try {
      // 1. 用户获取角色列表
      const charactersResponse = await fetch(`${this.baseUrl}/api/characters`);
      const charactersData = await charactersResponse.json();
      
      this.assert('userExperience', 'UX1: 获取角色列表成功', 
        charactersResponse.ok && charactersData.data.characters.length === 25);

      // 2. 用户查看特定角色信息
      const charStatusResponse = await fetch(`${this.baseUrl}/api/characters/${selectedCharacter}/status`);
      const charStatusData = await charStatusResponse.json();
      
      this.assert('userExperience', 'UX2: 查看角色详情成功', 
        charStatusResponse.ok && charStatusData.data.personality);

      // 3. 用户开始对话
      const conversation = [
        '你好！',
        '你最喜欢做什么？', 
        '今天心情怎么样？',
        '能陪我聊天吗？'
      ];

      let conversationSuccess = 0;
      let responseQuality = 0;
      
      for (let i = 0; i < conversation.length; i++) {
        const chatResponse = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            characterId: selectedCharacter,
            message: conversation[i]
          })
        });

        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          if (chatData.success && chatData.data.response.length > 10) {
            conversationSuccess++;
            if (chatData.data.confidence >= 0.8) responseQuality++;
          }
        }
      }

      this.assert('userExperience', 'UX3: 多轮对话成功', conversationSuccess >= 3);
      this.assert('userExperience', 'UX4: 回复质量良好', responseQuality >= 2);

      // 4. 测试缓存效果（用户重复相同问题）
      const cacheTestMessage = '你好，很高兴认识你';
      
      const firstCacheResponse = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          characterId: selectedCharacter,
          message: cacheTestMessage
        })
      });

      await new Promise(resolve => setTimeout(resolve, 100)); // 短暂延迟

      const secondCacheResponse = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          characterId: selectedCharacter,
          message: cacheTestMessage
        })
      });

      if (firstCacheResponse.ok && secondCacheResponse.ok) {
        const firstData = await firstCacheResponse.json();
        const secondData = await secondCacheResponse.json();
        
        this.assert('userExperience', 'UX5: 缓存机制工作', 
          secondData.data.cached === true || secondData.responseTime < firstData.responseTime
        );
      }

    } catch (error) {
      this.recordError('userExperience', '用户体验流程', error);
    }

    console.log(`  📊 用户体验: ${this.results.userExperience.passed}✅ ${this.results.userExperience.failed}❌`);
  }

  async reviewPerformance() {
    console.log('\\n⚡ 6. 性能和稳定性测试...');

    // 响应时间测试
    const responseTimeTests = [];
    
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();
      
      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: `perf_test_${i}`,
            characterId: 'alice',
            message: `性能测试 ${i}`
          })
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        responseTimeTests.push(responseTime);

        if (response.ok) {
          this.assert('performance', `性能测试 ${i} 响应成功`, true);
          this.assert('performance', `性能测试 ${i} 响应时间 < 2秒`, responseTime < 2000);
        }
      } catch (error) {
        this.recordError('performance', `性能测试 ${i}`, error);
      }
    }

    // 计算平均响应时间
    const avgResponseTime = responseTimeTests.reduce((a, b) => a + b, 0) / responseTimeTests.length;
    this.assert('performance', '平均响应时间 < 500ms', avgResponseTime < 500);

    // 并发测试
    try {
      const concurrentRequests = [];
      
      for (let i = 0; i < 5; i++) {
        concurrentRequests.push(
          fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: `concurrent_test_${i}`,
              characterId: 'alice',
              message: `并发测试 ${i}`
            })
          })
        );
      }

      const concurrentResults = await Promise.all(concurrentRequests);
      const successCount = concurrentResults.filter(r => r.ok).length;
      
      this.assert('performance', '并发请求处理', successCount >= 4);
    } catch (error) {
      this.recordError('performance', '并发测试', error);
    }

    // 内存使用检查
    try {
      const healthResponse = await fetch(`${this.baseUrl}/health`);
      const healthData = await healthResponse.json();
      
      if (healthData.system?.memory) {
        const memoryUsage = healthData.system.memory.rss / (1024 * 1024); // MB
        this.assert('performance', '内存使用合理 < 200MB', memoryUsage < 200);
      }
    } catch (error) {
      this.recordError('performance', '内存检查', error);
    }

    console.log(`  📊 性能测试: ${this.results.performance.passed}✅ ${this.results.performance.failed}❌`);
    console.log(`  ⏱️ 平均响应时间: ${Math.round(avgResponseTime)}ms`);
  }

  assert(category, testName, condition) {
    if (condition) {
      this.results[category].passed++;
      this.results[category].details.push({ name: testName, status: 'PASS' });
    } else {
      this.results[category].failed++;
      this.results[category].details.push({ name: testName, status: 'FAIL' });
    }
  }

  recordError(category, testName, error) {
    this.results[category].failed++;
    this.results[category].details.push({ 
      name: testName, 
      status: 'ERROR', 
      error: error.message 
    });
    this.results.errors.push(`${category}/${testName}: ${error.message}`);
  }

  generateFinalReport() {
    console.log('\\n' + '='.repeat(70));
    console.log('📋 系统审查最终报告');
    console.log('='.repeat(70));

    const categories = ['architecture', 'dataIntegrity', 'apiLogic', 'characterSystem', 'userExperience', 'performance'];
    let totalPassed = 0;
    let totalFailed = 0;

    categories.forEach(category => {
      const result = this.results[category];
      totalPassed += result.passed;
      totalFailed += result.failed;
      
      const categoryName = {
        architecture: '🏗️ 架构完整性',
        dataIntegrity: '📊 数据完整性',
        apiLogic: '🔌 API逻辑',
        characterSystem: '🤖 角色系统',
        userExperience: '👤 用户体验',
        performance: '⚡ 性能稳定性'
      }[category];

      const passRate = result.passed + result.failed > 0 
        ? (result.passed / (result.passed + result.failed) * 100).toFixed(1)
        : '0.0';

      console.log(`${categoryName}: ${result.passed}✅ ${result.failed}❌ (${passRate}%)`);
      
      // 显示失败的测试
      const failures = result.details.filter(d => d.status !== 'PASS');
      if (failures.length > 0) {
        failures.forEach(failure => {
          console.log(`  ❌ ${failure.name}${failure.error ? ': ' + failure.error : ''}`);
        });
      }
    });

    const overallPassRate = (totalPassed / (totalPassed + totalFailed) * 100).toFixed(1);

    console.log('\\n' + '-'.repeat(70));
    console.log(`📊 总体结果: ${totalPassed}✅ ${totalFailed}❌ (${overallPassRate}% 通过率)`);

    // 系统健康评估
    console.log('\\n🎯 系统健康评估:');
    
    if (overallPassRate >= 95) {
      console.log('🟢 优秀 - 系统完全就绪，可以安全部署到生产环境');
    } else if (overallPassRate >= 90) {
      console.log('🟡 良好 - 系统基本就绪，建议修复少数问题后部署');
    } else if (overallPassRate >= 80) {
      console.log('🟠 一般 - 系统需要修复一些问题才能部署');
    } else {
      console.log('🔴 需要改进 - 系统存在较多问题，不建议部署');
    }

    // 关键功能状态
    console.log('\\n🔍 关键功能检查:');
    console.log(`  🤖 25个AI角色: ${this.results.dataIntegrity.details.some(d => d.name.includes('角色数量正确') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  💬 聊天功能: ${this.results.apiLogic.details.some(d => d.name.includes('正常聊天请求') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  🛡️ 错误处理: ${this.results.apiLogic.details.some(d => d.name.includes('错误') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  🚀 性能表现: ${this.results.performance.details.some(d => d.name.includes('响应时间') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  👤 用户体验: ${this.results.userExperience.details.some(d => d.name.includes('多轮对话') && d.status === 'PASS') ? '✅' : '❌'}`);

    // 严重错误
    if (this.results.errors.length > 0) {
      console.log('\\n⚠️ 发现的严重错误:');
      this.results.errors.slice(0, 5).forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    console.log('\\n' + '='.repeat(70));
    console.log(`🕒 审查完成时间: ${new Date().toISOString()}`);
    console.log('='.repeat(70));
  }
}

// 运行系统审查
const reviewer = new SystemReview();
reviewer.runComprehensiveReview().catch(error => {
  console.error('系统审查失败:', error);
  process.exit(1);
});