/**
 * ElizaOS 集成 POC 测试
 * 验证单个角色的基础功能
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const BRIDGE_URL = 'http://localhost:3001';
const TEST_USER_ID = 'poc_test_user';
const TEST_CHARACTER_ID = 'alice';

// 颜色输出
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// 等待服务启动
async function waitForService(maxRetries = 30) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(`${BRIDGE_URL}/health`, {
                timeout: 2000
            });
            if (response.ok) {
                log('✅ 桥接服务已就绪', 'green');
                return true;
            }
        } catch (error) {
            log(`等待服务启动... (${i + 1}/${maxRetries})`, 'yellow');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    throw new Error('服务启动超时');
}

// 测试健康检查
async function testHealthCheck() {
    log('\n🔍 测试健康检查...', 'blue');
    
    try {
        const response = await fetch(`${BRIDGE_URL}/health`);
        const data = await response.json();
        
        if (data.success) {
            log('✅ 健康检查通过', 'green');
            log(`   - 服务: ${data.service}`, 'blue');
            log(`   - 运行时间: ${data.uptime?.human || 'N/A'}`, 'blue');
            log(`   - ElizaOS 状态: ${data.elizaOS?.healthyCount || 0}/${data.elizaOS?.totalRuntimes || 0} 健康`, 'blue');
            return true;
        } else {
            log('❌ 健康检查失败', 'red');
            return false;
        }
    } catch (error) {
        log(`❌ 健康检查错误: ${error.message}`, 'red');
        return false;
    }
}

// 测试角色状态
async function testCharacterStatus() {
    log('\n👤 测试角色状态...', 'blue');
    
    try {
        const response = await fetch(`${BRIDGE_URL}/api/characters/${TEST_CHARACTER_ID}/status`);
        const data = await response.json();
        
        if (data.success && data.data.available) {
            log(`✅ 角色 ${TEST_CHARACTER_ID} 状态正常`, 'green');
            log(`   - 状态: ${data.data.status}`, 'blue');
            log(`   - 可用: ${data.data.available}`, 'blue');
            log(`   - 响应时间: ${data.data.responseTime || 'N/A'}ms`, 'blue');
            return true;
        } else {
            log(`❌ 角色 ${TEST_CHARACTER_ID} 不可用`, 'red');
            log(`   - 状态: ${data.data?.status || 'unknown'}`, 'yellow');
            return false;
        }
    } catch (error) {
        log(`❌ 角色状态检查错误: ${error.message}`, 'red');
        return false;
    }
}

// 测试简单对话
async function testSimpleChat() {
    log('\n💬 测试简单对话...', 'blue');
    
    const testMessages = [
        '你好！',
        '你叫什么名字？',
        '今天天气怎么样？',
        '我们来聊聊你的爱好吧'
    ];
    
    let successCount = 0;
    
    for (const message of testMessages) {
        try {
            log(`   发送: "${message}"`, 'yellow');
            
            const response = await fetch(`${BRIDGE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: TEST_USER_ID,
                    characterId: TEST_CHARACTER_ID,
                    message: message,
                    options: {
                        generateVoice: false, // 暂时禁用语音以避免 API 调用
                        includeAnimation: true
                    }
                }),
                timeout: 15000
            });
            
            const data = await response.json();
            
            if (data.success && data.data?.text) {
                log(`   ✅ 回复: "${data.data.text.substring(0, 100)}..."`, 'green');
                log(`   📊 情感: ${data.data.emotion || 'none'} | 置信度: ${data.data.confidence || 'N/A'} | 响应时间: ${data.data.responseTime || data.responseTime}ms`, 'blue');
                successCount++;
                
                // 检查动画数据
                if (data.data.animation) {
                    log(`   🎭 动画: ${data.data.animation.type} (${data.data.animation.duration}ms)`, 'blue');
                }
            } else {
                log(`   ❌ 对话失败: ${data.error || '未知错误'}`, 'red');
                if (data.errorCode) {
                    log(`   错误代码: ${data.errorCode}`, 'yellow');
                }
            }
            
            // 间隔避免过于频繁
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            log(`   ❌ 请求错误: ${error.message}`, 'red');
        }
    }
    
    const successRate = (successCount / testMessages.length * 100).toFixed(1);
    log(`\n📊 对话测试结果: ${successCount}/${testMessages.length} 成功 (${successRate}%)`, successCount === testMessages.length ? 'green' : 'yellow');
    
    return successCount === testMessages.length;
}

// 测试记忆功能
async function testMemoryFunction() {
    log('\n🧠 测试记忆功能...', 'blue');
    
    try {
        // 第一条消息 - 告诉 AI 一个信息
        log('   教给 AI 一个新信息...', 'yellow');
        const teachResponse = await fetch(`${BRIDGE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: TEST_USER_ID,
                characterId: TEST_CHARACTER_ID,
                message: '我的名字叫小明，我最喜欢的颜色是蓝色',
                options: { generateVoice: false }
            }),
            timeout: 15000
        });
        
        const teachData = await teachResponse.json();
        if (!teachData.success) {
            log(`   ❌ 教学消息失败: ${teachData.error}`, 'red');
            return false;
        }
        
        log(`   ✅ 教学回复: "${teachData.data.text.substring(0, 80)}..."`, 'green');
        log(`   记忆更新: ${teachData.data.memoryUpdated ? '是' : '否'}`, 'blue');
        
        // 等待一秒确保记忆存储
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 第二条消息 - 测试 AI 是否记住了
        log('   测试 AI 是否记住了信息...', 'yellow');
        const recallResponse = await fetch(`${BRIDGE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: TEST_USER_ID,
                characterId: TEST_CHARACTER_ID,
                message: '你还记得我的名字和喜欢的颜色吗？',
                options: { generateVoice: false }
            }),
            timeout: 15000
        });
        
        const recallData = await recallResponse.json();
        if (!recallData.success) {
            log(`   ❌ 回忆消息失败: ${recallData.error}`, 'red');
            return false;
        }
        
        const replyText = recallData.data.text.toLowerCase();
        const remembersName = replyText.includes('小明');
        const remembersColor = replyText.includes('蓝色') || replyText.includes('blue');
        
        log(`   ✅ 回忆回复: "${recallData.data.text.substring(0, 100)}..."`, 'green');
        log(`   记忆检查: 名字 ${remembersName ? '✅' : '❌'} | 颜色 ${remembersColor ? '✅' : '❌'}`, remembersName && remembersColor ? 'green' : 'yellow');
        
        return remembersName || remembersColor; // 至少记住一个信息算通过
        
    } catch (error) {
        log(`   ❌ 记忆测试错误: ${error.message}`, 'red');
        return false;
    }
}

// 测试错误处理
async function testErrorHandling() {
    log('\n⚠️ 测试错误处理...', 'blue');
    
    const errorTests = [
        {
            name: '缺少参数',
            request: { userId: TEST_USER_ID },
            expectedError: 'INVALID_REQUEST'
        },
        {
            name: '不存在的角色',
            request: {
                userId: TEST_USER_ID,
                characterId: 'nonexistent_character',
                message: 'hello'
            },
            expectedError: 'RUNTIME_NOT_FOUND'
        },
        {
            name: '空消息',
            request: {
                userId: TEST_USER_ID,
                characterId: TEST_CHARACTER_ID,
                message: ''
            },
            expectedError: 'INVALID_REQUEST'
        }
    ];
    
    let passedTests = 0;
    
    for (const test of errorTests) {
        try {
            log(`   测试: ${test.name}`, 'yellow');
            
            const response = await fetch(`${BRIDGE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(test.request),
                timeout: 10000
            });
            
            const data = await response.json();
            
            if (!data.success && data.errorCode) {
                log(`   ✅ 正确处理错误: ${data.errorCode}`, 'green');
                passedTests++;
            } else {
                log(`   ❌ 未正确处理错误，预期失败但成功了`, 'red');
            }
            
        } catch (error) {
            log(`   ❌ 测试执行失败: ${error.message}`, 'red');
        }
    }
    
    log(`\n📊 错误处理测试结果: ${passedTests}/${errorTests.length} 通过`, passedTests === errorTests.length ? 'green' : 'yellow');
    return passedTests >= errorTests.length / 2; // 至少一半通过
}

// 性能测试
async function testPerformance() {
    log('\n⚡ 测试性能...', 'blue');
    
    const testCount = 5;
    const responseTimes = [];
    
    log(`   发送 ${testCount} 个并发请求...`, 'yellow');
    
    const promises = Array(testCount).fill(0).map(async (_, i) => {
        const startTime = Date.now();
        
        try {
            const response = await fetch(`${BRIDGE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: `perf_test_${i}`,
                    characterId: TEST_CHARACTER_ID,
                    message: `性能测试消息 #${i + 1}`,
                    options: { generateVoice: false }
                }),
                timeout: 20000
            });
            
            const duration = Date.now() - startTime;
            const data = await response.json();
            
            if (data.success) {
                responseTimes.push(duration);
                return { success: true, duration };
            } else {
                return { success: false, error: data.error, duration };
            }
            
        } catch (error) {
            return { success: false, error: error.message, duration: Date.now() - startTime };
        }
    });
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    
    if (responseTimes.length > 0) {
        const avgTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        const minTime = Math.min(...responseTimes);
        const maxTime = Math.max(...responseTimes);
        
        log(`   ✅ 并发成功率: ${successCount}/${testCount} (${(successCount/testCount*100).toFixed(1)}%)`, 'green');
        log(`   📊 响应时间 - 平均: ${Math.round(avgTime)}ms | 最快: ${minTime}ms | 最慢: ${maxTime}ms`, 'blue');
        
        return avgTime < 5000; // 5秒内算通过
    } else {
        log(`   ❌ 所有并发请求都失败了`, 'red');
        return false;
    }
}

// 主测试函数
async function runPOCTest() {
    log('🚀 ElizaOS 集成 POC 测试开始', 'blue');
    log('=' .repeat(60));
    
    const results = {
        serviceReady: false,
        healthCheck: false,
        characterStatus: false,
        simpleChat: false,
        memoryFunction: false,
        errorHandling: false,
        performance: false
    };
    
    try {
        // 1. 等待服务启动
        log('\n⏳ 等待桥接服务启动...', 'blue');
        results.serviceReady = await waitForService();
        
        // 2. 健康检查
        results.healthCheck = await testHealthCheck();
        
        // 3. 角色状态检查
        results.characterStatus = await testCharacterStatus();
        
        // 4. 简单对话测试
        results.simpleChat = await testSimpleChat();
        
        // 5. 记忆功能测试
        results.memoryFunction = await testMemoryFunction();
        
        // 6. 错误处理测试
        results.errorHandling = await testErrorHandling();
        
        // 7. 性能测试
        results.performance = await testPerformance();
        
    } catch (error) {
        log(`\n💥 测试过程中发生异常: ${error.message}`, 'red');
    }
    
    // 生成测试报告
    log('\n\n📋 POC 测试报告', 'blue');
    log('=' .repeat(60));
    
    const testItems = [
        { name: '服务启动', key: 'serviceReady', critical: true },
        { name: '健康检查', key: 'healthCheck', critical: true },
        { name: '角色状态', key: 'characterStatus', critical: true },
        { name: '简单对话', key: 'simpleChat', critical: true },
        { name: '记忆功能', key: 'memoryFunction', critical: false },
        { name: '错误处理', key: 'errorHandling', critical: false },
        { name: '性能测试', key: 'performance', critical: false }
    ];
    
    let passedCount = 0;
    let criticalPassed = 0;
    let criticalTotal = 0;
    
    for (const item of testItems) {
        const status = results[item.key] ? '✅ 通过' : '❌ 失败';
        const color = results[item.key] ? 'green' : 'red';
        const critical = item.critical ? ' [关键]' : '';
        
        log(`  ${item.name}: ${status}${critical}`, color);
        
        if (results[item.key]) passedCount++;
        if (item.critical) {
            criticalTotal++;
            if (results[item.key]) criticalPassed++;
        }
    }
    
    log('\n📊 测试统计:', 'blue');
    log(`  总体通过率: ${passedCount}/${testItems.length} (${(passedCount/testItems.length*100).toFixed(1)}%)`, passedCount === testItems.length ? 'green' : 'yellow');
    log(`  关键功能: ${criticalPassed}/${criticalTotal} (${(criticalPassed/criticalTotal*100).toFixed(1)}%)`, criticalPassed === criticalTotal ? 'green' : 'red');
    
    // 最终评估
    log('\n🎯 POC 评估结果:', 'blue');
    if (criticalPassed === criticalTotal) {
        log('✅ POC 测试通过！ElizaOS 集成基础功能正常', 'green');
        log('🚀 可以进行下一阶段的开发工作', 'green');
        return 0;
    } else {
        log('❌ POC 测试失败，关键功能存在问题', 'red');
        log('🔧 需要修复关键问题后重新测试', 'yellow');
        return 1;
    }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.includes('poc-test.js')) {
    runPOCTest()
        .then(exitCode => process.exit(exitCode))
        .catch(error => {
            console.error('测试异常:', error);
            process.exit(1);
        });
}

export { runPOCTest };