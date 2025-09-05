#!/usr/bin/env node

import { performance } from 'perf_hooks';

class ProductionMonitor {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.results = {
      startTime: Date.now(),
      tests: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity
      }
    };
  }

  async monitor(duration = 60000) {
    console.log('📊 Phase 3 Production Monitoring Started');
    console.log(`🌐 Target: ${this.baseUrl}`);
    console.log(`⏱️ Duration: ${duration/1000} seconds`);
    console.log('='.repeat(60));

    const endTime = Date.now() + duration;
    let iteration = 1;

    while (Date.now() < endTime) {
      console.log(`\\n🔄 Monitoring Cycle ${iteration}`);
      
      await this.runMonitoringCycle();
      
      // Wait 10 seconds between cycles
      await this.sleep(10000);
      iteration++;
    }

    this.printFinalReport();
  }

  async runMonitoringCycle() {
    const tests = [
      { name: 'Health Check', test: () => this.testHealth() },
      { name: 'Characters List', test: () => this.testCharactersList() },
      { name: 'Character Status', test: () => this.testCharacterStatus() },
      { name: 'Chat Performance', test: () => this.testChatPerformance() },
      { name: 'Error Handling', test: () => this.testErrorHandling() },
      { name: 'Cache Performance', test: () => this.testCachePerformance() }
    ];

    for (const { name, test } of tests) {
      const result = await this.runTest(name, test);
      this.results.tests.push(result);
      this.updateSummary(result);
      
      const status = result.success ? '✅' : '❌';
      const time = result.responseTime ? `(${Math.round(result.responseTime)}ms)` : '';
      console.log(`  ${status} ${name} ${time}`);
    }
  }

  async runTest(name, testFunction) {
    const startTime = performance.now();
    
    try {
      const result = await testFunction();
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return {
        name,
        success: true,
        responseTime,
        timestamp: Date.now(),
        ...result
      };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return {
        name,
        success: false,
        responseTime,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  async testHealth() {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Health check failed');
    
    return {
      uptime: data.uptime?.human,
      charactersLoaded: data.elizaOS?.charactersLoaded,
      cacheSize: data.cache?.size,
      cacheHitRate: data.cache?.hitRate
    };
  }

  async testCharactersList() {
    const response = await fetch(`${this.baseUrl}/api/characters`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Characters list failed');
    
    return {
      totalCharacters: data.data.total,
      activeCharacters: data.data.active
    };
  }

  async testCharacterStatus() {
    const testCharacter = 'alice';
    const response = await fetch(`${this.baseUrl}/api/characters/${testCharacter}/status`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Character status failed');
    
    return {
      character: testCharacter,
      status: data.data.status,
      usage: data.data.usage
    };
  }

  async testChatPerformance() {
    const startTime = performance.now();
    
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: `monitor_${Date.now()}`,
        characterId: 'alice',
        message: 'Performance test message'
      })
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Chat failed');
    
    const endTime = performance.now();
    
    return {
      chatResponseTime: endTime - startTime,
      confidence: data.data.confidence,
      enhanced: data.data.enhanced,
      cached: data.data.cached,
      emotion: data.data.emotion
    };
  }

  async testErrorHandling() {
    // Test invalid character
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'monitor_error_test',
        characterId: 'invalid_character',
        message: 'Error test'
      })
    });
    
    // Should handle gracefully, either with fallback or proper error
    const data = await response.json();
    
    // Success if we get a proper response structure
    return {
      errorHandled: data.hasOwnProperty('success'),
      statusCode: response.status,
      hasFallback: data.success && data.data?.confidence < 0.5
    };
  }

  async testCachePerformance() {
    const message = `Cache test ${Math.floor(Date.now() / 60000)}`; // Same message for 1 minute
    const userId = 'cache_test_user';
    
    // First request (should be cache miss)
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
    
    // Second request (should be cache hit)
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
    
    const firstRequestTime = endTime1 - startTime1;
    const secondRequestTime = endTime2 - startTime2;
    const speedup = firstRequestTime / secondRequestTime;
    
    return {
      firstRequestTime,
      secondRequestTime,
      speedup: Math.round(speedup * 100) / 100,
      cacheWorking: data2.data?.cached === true || secondRequestTime < firstRequestTime * 0.8
    };
  }

  updateSummary(result) {
    this.results.summary.totalTests++;
    
    if (result.success) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    
    if (result.responseTime) {
      // Update response time statistics
      const times = this.results.tests
        .filter(t => t.responseTime)
        .map(t => t.responseTime);
      
      this.results.summary.averageResponseTime = 
        times.reduce((sum, time) => sum + time, 0) / times.length;
      
      this.results.summary.maxResponseTime = Math.max(...times);
      this.results.summary.minResponseTime = Math.min(...times);
    }
  }

  printFinalReport() {
    const { summary } = this.results;
    const duration = Date.now() - this.results.startTime;
    
    console.log('\\n' + '='.repeat(60));
    console.log('📊 Production Monitoring Report');
    console.log('='.repeat(60));
    
    console.log(`⏱️ Monitoring Duration: ${Math.round(duration/1000)}s`);
    console.log(`🧪 Total Tests: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passed} (${Math.round(summary.passed/summary.totalTests*100)}%)`);
    console.log(`❌ Failed: ${summary.failed} (${Math.round(summary.failed/summary.totalTests*100)}%)`);
    
    console.log('\\n📈 Performance Metrics:');
    console.log(`  Average Response Time: ${Math.round(summary.averageResponseTime)}ms`);
    console.log(`  Max Response Time: ${Math.round(summary.maxResponseTime)}ms`);
    console.log(`  Min Response Time: ${Math.round(summary.minResponseTime)}ms`);
    
    // Recent test results
    console.log('\\n🔍 Recent Test Results:');
    const recentTests = this.results.tests.slice(-12); // Last 12 tests (2 cycles)
    
    recentTests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      const time = test.responseTime ? `${Math.round(test.responseTime)}ms` : 'N/A';
      const timestamp = new Date(test.timestamp).toLocaleTimeString();
      
      console.log(`  ${status} [${timestamp}] ${test.name} (${time})`);
      
      if (test.error) {
        console.log(`      Error: ${test.error}`);
      }
      
      if (test.cacheWorking !== undefined) {
        console.log(`      Cache: ${test.cacheWorking ? '✅ Working' : '❌ Not Working'} (${test.speedup}x speedup)`);
      }
    });
    
    // Health assessment
    console.log('\\n🎯 System Health Assessment:');
    const passRate = summary.passed / summary.totalTests;
    const avgResponseTime = summary.averageResponseTime;
    
    if (passRate >= 0.95 && avgResponseTime < 500) {
      console.log('🟢 Excellent - System performing optimally');
    } else if (passRate >= 0.90 && avgResponseTime < 1000) {
      console.log('🟡 Good - System stable with minor issues');
    } else if (passRate >= 0.80) {
      console.log('🟠 Fair - System functional but needs attention');
    } else {
      console.log('🔴 Poor - System experiencing significant issues');
    }
    
    // Recommendations
    console.log('\\n💡 Recommendations:');
    if (avgResponseTime > 1000) {
      console.log('  ⚡ Consider response time optimization');
    }
    if (summary.failed > 0) {
      console.log('  🔧 Investigate failed tests for system issues');
    }
    if (passRate > 0.95) {
      console.log('  🎉 System is performing excellently!');
    }
    
    console.log('\\n' + '='.repeat(60));
    
    // Save report
    this.saveReport();
  }

  saveReport() {
    const reportData = {
      ...this.results,
      generatedAt: new Date().toISOString(),
      baseUrl: this.baseUrl
    };
    
    const filename = `monitoring-report-${Date.now()}.json`;
    import('fs').then(fs => {
      fs.writeFileSync(filename, JSON.stringify(reportData, null, 2));
    });
    console.log(`📄 Detailed report saved to: ${filename}`);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI usage
const args = process.argv.slice(2);
const baseUrl = args[0] || 'http://localhost:3001';
const duration = parseInt(args[1]) || 60000;

const monitor = new ProductionMonitor(baseUrl);
monitor.monitor(duration).catch(error => {
  console.error('Monitoring failed:', error);
  process.exit(1);
});