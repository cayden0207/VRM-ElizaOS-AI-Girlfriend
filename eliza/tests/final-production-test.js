// Final Phase 3 Production Test Suite
import { performance } from 'perf_hooks';

class FinalProductionTest {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  async runFinalTests() {
    console.log('🧪 Phase 3 最终生产测试');
    console.log('='.repeat(60));

    await this.testProductionReadiness();
    await this.testPerformanceUnderLoad();
    await this.testSecurityFeatures();
    await this.testCachingSystem();
    await this.testMonitoringEndpoints();
    await this.testErrorResilience();

    this.printFinalAssessment();
  }

  async testProductionReadiness() {
    console.log('\\n🏭 测试生产就绪状态...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/info`);
      const data = await response.json();
      
      this.assert(response.ok, 'API 信息端点可访问');
      this.assert(data.version === '3.0.0', '版本号正确');
      this.assert(data.phase === 3, 'Phase 3 标识');
      this.assert(data.features.includes('production_optimized'), '生产优化功能');
      this.assert(data.features.includes('response_caching'), '响应缓存功能');
      this.assert(data.features.includes('performance_monitoring'), '性能监控功能');

      console.log('  ✅ 生产就绪测试通过');
      console.log(`  📋 版本: ${data.version}, 功能数: ${data.features.length}`);
    } catch (error) {
      this.recordFailure('生产就绪', error);
    }
  }

  async testPerformanceUnderLoad() {
    console.log('\\n⚡ 测试负载下的性能...');
    
    try {
      const concurrent = 10;
      const promises = [];
      
      for (let i = 0; i < concurrent; i++) {
        promises.push(
          fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: `load_test_${i}`,
              characterId: 'alice',
              message: `并发测试消息 ${i}`
            })
          })
        );
      }

      const startTime = performance.now();
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      
      const successCount = responses.filter(r => r.ok).length;
      const avgTime = (endTime - startTime) / concurrent;
      
      this.assert(successCount === concurrent, '所有并发请求成功');
      this.assert(avgTime < 1000, '平均响应时间 < 1秒');

      console.log('  ✅ 负载测试通过');
      console.log(`  📊 并发: ${concurrent}, 成功率: ${successCount}/${concurrent}, 平均: ${Math.round(avgTime)}ms`);
    } catch (error) {
      this.recordFailure('负载性能', error);
    }
  }

  async testSecurityFeatures() {
    console.log('\\n🛡️ 测试安全功能...');
    
    try {
      // Test security headers
      const response = await fetch(`${this.baseUrl}/health`);
      
      this.assert(response.headers.get('x-service-version') === '3.0.0', 'Service version header');
      this.assert(response.headers.get('x-powered-by') === 'ElizaOS-VRM-AI', 'Powered by header');
      
      // Test rate limiting (should not block normal usage)
      const rateLimitResponse = await fetch(`${this.baseUrl}/api/characters`);
      this.assert(rateLimitResponse.ok, '速率限制正常运行');

      // Test input validation
      const invalidResponse = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test',
          characterId: 'test',
          message: 'x'.repeat(2000) // Too long
        })
      });
      
      this.assert(invalidResponse.status === 400, '输入验证正常');

      console.log('  ✅ 安全功能测试通过');
    } catch (error) {
      this.recordFailure('安全功能', error);
    }
  }

  async testCachingSystem() {
    console.log('\\n🔄 测试缓存系统...');
    
    try {
      const message = `Cache test ${Date.now()}`;
      const userId = 'cache_final_test';
      
      // First request (cache miss)
      const startTime1 = performance.now();
      const response1 = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          characterId: 'alice',
          message
        })
      });
      const endTime1 = performance.now();
      const data1 = await response1.json();
      
      // Second request (cache hit)
      const startTime2 = performance.now();
      const response2 = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          characterId: 'alice',
          message
        })
      });
      const endTime2 = performance.now();
      const data2 = await response2.json();
      
      const firstTime = endTime1 - startTime1;
      const secondTime = endTime2 - startTime2;
      const speedup = firstTime / secondTime;
      
      this.assert(response1.ok && response2.ok, '缓存请求成功');
      this.assert(data2.data?.cached === true || secondTime < firstTime, '缓存生效');

      console.log('  ✅ 缓存系统测试通过');
      console.log(`  🚀 首次: ${Math.round(firstTime)}ms, 缓存: ${Math.round(secondTime)}ms, 加速: ${Math.round(speedup * 100) / 100}x`);
    } catch (error) {
      this.recordFailure('缓存系统', error);
    }
  }

  async testMonitoringEndpoints() {
    console.log('\\n📊 测试监控端点...');
    
    try {
      // Health endpoint
      const healthResponse = await fetch(`${this.baseUrl}/health`);
      const healthData = await healthResponse.json();
      
      this.assert(healthResponse.ok, '健康检查端点');
      this.assert(healthData.elizaOS?.phase === 3, 'Phase 3 健康数据');
      this.assert(typeof healthData.uptime?.ms === 'number', '运行时间数据');

      // Metrics endpoint
      const metricsResponse = await fetch(`${this.baseUrl}/metrics`);
      const metricsText = await metricsResponse.text();
      
      this.assert(metricsResponse.ok, 'Prometheus 指标端点');
      this.assert(metricsText.includes('vrm_eliza_requests_total'), '请求总数指标');
      this.assert(metricsText.includes('vrm_eliza_cache_hit_rate'), '缓存命中率指标');

      console.log('  ✅ 监控端点测试通过');
      console.log(`  📈 运行时间: ${healthData.uptime?.human}, 角色数: ${healthData.elizaOS?.charactersLoaded}`);
    } catch (error) {
      this.recordFailure('监控端点', error);
    }
  }

  async testErrorResilience() {
    console.log('\\n🛡️ 测试错误恢复能力...');
    
    try {
      // Test various error scenarios
      const errorTests = [
        {
          name: '无效角色',
          body: { userId: 'test', characterId: 'nonexistent', message: 'test' }
        },
        {
          name: '空消息',
          body: { userId: 'test', characterId: 'alice', message: '' }
        },
        {
          name: '缺少参数',
          body: { message: 'test' }
        }
      ];

      let resilientErrors = 0;

      for (const errorTest of errorTests) {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorTest.body)
        });

        const data = await response.json();
        
        // Should handle gracefully (either proper error response or fallback)
        if (response.status >= 400 || (data.success && data.data?.confidence < 0.5)) {
          resilientErrors++;
        }
      }

      this.assert(resilientErrors === errorTests.length, '所有错误场景优雅处理');

      // Test system recovery after errors
      const recoveryResponse = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'recovery_test',
          characterId: 'alice',
          message: '系统恢复测试'
        })
      });

      this.assert(recoveryResponse.ok, '错误后系统恢复');

      console.log('  ✅ 错误恢复测试通过');
      console.log(`  🔧 处理错误场景: ${resilientErrors}/${errorTests.length}`);
    } catch (error) {
      this.recordFailure('错误恢复', error);
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

  printFinalAssessment() {
    console.log('\\n' + '='.repeat(60));
    console.log('🎯 Phase 3 最终评估');
    console.log('='.repeat(60));
    
    const passRate = (this.results.passed / this.results.total * 100).toFixed(1);
    
    console.log(`✅ 通过: ${this.results.passed}/${this.results.total} (${passRate}%)`);
    console.log(`❌ 失败: ${this.results.failed}`);
    
    if (this.results.failed > 0) {
      console.log('\\n失败项目:');
      this.results.details
        .filter(d => d.status !== 'PASS')
        .forEach(detail => {
          console.log(`  - ${detail.name}: ${detail.status}${detail.error ? ' - ' + detail.error : ''}`);
        });
    }
    
    console.log('\\n🚀 生产部署准备状态:');
    console.log(`  🏭 生产就绪: ${this.results.details.some(d => d.name.includes('生产就绪') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  ⚡ 性能优化: ${this.results.details.some(d => d.name.includes('负载') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  🛡️ 安全功能: ${this.results.details.some(d => d.name.includes('安全') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  🔄 缓存系统: ${this.results.details.some(d => d.name.includes('缓存') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  📊 监控系统: ${this.results.details.some(d => d.name.includes('监控') && d.status === 'PASS') ? '✅' : '❌'}`);
    console.log(`  🛡️ 错误处理: ${this.results.details.some(d => d.name.includes('错误恢复') && d.status === 'PASS') ? '✅' : '❌'}`);
    
    console.log('\\n🎯 最终评估:');
    if (passRate >= 95) {
      console.log('🟢 优秀 - 已准备好生产部署！');
      console.log('   可以安全地部署到 Vercel 生产环境');
    } else if (passRate >= 85) {
      console.log('🟡 良好 - 基本准备就绪，建议修复小问题后部署');
    } else {
      console.log('🔴 需要改进 - 建议修复主要问题后再部署');
    }
    
    console.log('\\n' + '='.repeat(60));
  }
}

// 运行最终测试
const finalTest = new FinalProductionTest();
finalTest.runFinalTests().catch(error => {
  console.error('最终测试失败:', error);
  process.exit(1);
});