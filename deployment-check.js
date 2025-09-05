/**
 * 部署就绪性检查
 * 验证所有配置和依赖项是否准备就绪
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// 颜色输出函数
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

// 检查环境变量
function checkEnvironmentVariables() {
    log('\n📋 检查环境变量...', 'blue');
    
    const requiredEnvVars = {
        'SUPABASE_URL': process.env.SUPABASE_URL,
        'SUPABASE_SERVICE_KEY': process.env.SUPABASE_SERVICE_KEY,
        'OPENAI_API_KEY': process.env.OPENAI_API_KEY
    };
    
    let allPresent = true;
    
    for (const [key, value] of Object.entries(requiredEnvVars)) {
        if (!value) {
            log(`  ❌ ${key}: 未设置`, 'red');
            allPresent = false;
        } else {
            const masked = key === 'OPENAI_API_KEY' 
                ? value.substring(0, 8) + '...'
                : value.substring(0, 30) + '...';
            log(`  ✅ ${key}: ${masked}`, 'green');
        }
    }
    
    return allPresent;
}

// 检查文件结构
function checkFileStructure() {
    log('\n📁 检查文件结构...', 'blue');
    
    const requiredFiles = [
        'vercel.json',
        'backend/server.js',
        'backend/api/memory.js',
        'backend/api/memory-batch.js',
        'backend/api/health.js',
        'memory-system-v2.js',
        'chat-system-v2.js',
        'index.html',
        'character-select.html'
    ];
    
    let allPresent = true;
    
    for (const file of requiredFiles) {
        const fullPath = path.join(__dirname, file);
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            log(`  ✅ ${file}: ${(stats.size / 1024).toFixed(1)}KB`, 'green');
        } else {
            log(`  ❌ ${file}: 文件不存在`, 'red');
            allPresent = false;
        }
    }
    
    return allPresent;
}

// 检查数据库连接
async function checkDatabaseConnection() {
    log('\n🗄️ 检查数据库连接...', 'blue');
    
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
        
        // 测试连接
        const { data, error } = await supabase
            .from('memory_vectors')
            .select('count', { count: 'exact', head: true })
            .limit(1);
            
        if (error) {
            log(`  ❌ 数据库连接失败: ${error.message}`, 'red');
            return false;
        }
        
        log(`  ✅ 数据库连接成功`, 'green');
        log(`  📊 memory_vectors 表记录数: ${data || 0}`, 'blue');
        
        // 测试函数存在性
        const { data: functionData, error: functionError } = await supabase
            .rpc('match_memories', {
                query_embedding: new Array(1536).fill(0),
                match_user_id: 'test',
                match_character_id: 'test',
                match_count: 1,
                similarity_threshold: 0.9
            });
            
        if (functionError && !functionError.message.includes('Invalid input')) {
            log(`  ⚠️ match_memories函数测试: ${functionError.message}`, 'yellow');
        } else {
            log(`  ✅ match_memories函数可用`, 'green');
        }
        
        return true;
    } catch (error) {
        log(`  ❌ 数据库检查失败: ${error.message}`, 'red');
        return false;
    }
}

// 检查OpenAI API
async function checkOpenAIConnection() {
    log('\n🤖 检查OpenAI API...', 'blue');
    
    try {
        if (!process.env.OPENAI_API_KEY) {
            log(`  ❌ OpenAI API密钥未设置`, 'red');
            return false;
        }
        
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        // 简单的API调用测试（使用较小的请求避免成本）
        const response = await openai.models.list();
        
        if (response.data && response.data.length > 0) {
            log(`  ✅ OpenAI API连接成功`, 'green');
            log(`  📋 可用模型数量: ${response.data.length}`, 'blue');
            
            // 检查目标模型是否可用
            const targetModels = ['gpt-3.5-turbo', 'text-embedding-3-small'];
            const availableModels = response.data.map(m => m.id);
            
            for (const model of targetModels) {
                if (availableModels.includes(model)) {
                    log(`  ✅ ${model}: 可用`, 'green');
                } else {
                    log(`  ⚠️ ${model}: 不可用`, 'yellow');
                }
            }
            
            return true;
        } else {
            log(`  ❌ OpenAI API响应异常`, 'red');
            return false;
        }
    } catch (error) {
        if (error.message.includes('401')) {
            log(`  ❌ OpenAI API密钥无效`, 'red');
        } else if (error.message.includes('429')) {
            log(`  ⚠️ OpenAI API限流，但连接正常`, 'yellow');
            return true;
        } else {
            log(`  ❌ OpenAI API检查失败: ${error.message}`, 'red');
        }
        return false;
    }
}

// 检查Vercel配置
function checkVercelConfig() {
    log('\n🚀 检查Vercel配置...', 'blue');
    
    try {
        const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
        
        const requiredProperties = ['version', 'builds', 'routes', 'functions'];
        let allPresent = true;
        
        for (const prop of requiredProperties) {
            if (vercelConfig[prop]) {
                log(`  ✅ ${prop}: 已配置`, 'green');
            } else {
                log(`  ❌ ${prop}: 缺失`, 'red');
                allPresent = false;
            }
        }
        
        // 检查记忆系统API路由
        const hasMemoryRoutes = vercelConfig.routes?.some(route => 
            route.src.includes('memory') || route.dest.includes('memory')
        );
        
        if (hasMemoryRoutes) {
            log(`  ✅ 记忆系统路由: 已配置`, 'green');
        } else {
            log(`  ⚠️ 记忆系统路由: 未明确配置`, 'yellow');
        }
        
        return allPresent;
    } catch (error) {
        log(`  ❌ Vercel配置读取失败: ${error.message}`, 'red');
        return false;
    }
}

// 性能预检查
function performancePrecheck() {
    log('\n⚡ 性能预检查...', 'blue');
    
    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.rss / 1024 / 1024);
    
    log(`  📊 当前内存使用: ${memMB}MB`, memMB > 100 ? 'yellow' : 'green');
    log(`  📱 Node.js版本: ${process.version}`, 'blue');
    
    if (process.version.startsWith('v18') || process.version.startsWith('v16')) {
        log(`  ⚠️ 建议升级到Node.js 20+以获得更好的性能`, 'yellow');
    } else {
        log(`  ✅ Node.js版本适合生产环境`, 'green');
    }
    
    return true;
}

// 主检查函数
async function runDeploymentCheck() {
    log('🎯 VRM AI女友项目部署就绪性检查', 'blue');
    log('=' .repeat(50));
    
    const checks = [
        { name: '环境变量', fn: checkEnvironmentVariables },
        { name: '文件结构', fn: checkFileStructure },
        { name: '数据库连接', fn: checkDatabaseConnection },
        { name: 'OpenAI API', fn: checkOpenAIConnection },
        { name: 'Vercel配置', fn: checkVercelConfig },
        { name: '性能预检', fn: performancePrecheck }
    ];
    
    const results = {};
    let allPassed = true;
    
    for (const check of checks) {
        try {
            results[check.name] = await check.fn();
            if (!results[check.name]) {
                allPassed = false;
            }
        } catch (error) {
            log(`\n❌ ${check.name}检查失败: ${error.message}`, 'red');
            results[check.name] = false;
            allPassed = false;
        }
    }
    
    // 最终结果
    log('\n🎉 部署检查结果', 'blue');
    log('=' .repeat(30));
    
    for (const [checkName, passed] of Object.entries(results)) {
        const status = passed ? '✅ 通过' : '❌ 失败';
        const color = passed ? 'green' : 'red';
        log(`  ${checkName}: ${status}`, color);
    }
    
    log('\n📊 总体评估:', 'blue');
    if (allPassed) {
        log('🚀 系统准备就绪，可以部署到生产环境！', 'green');
        log('\n💡 部署建议:');
        log('  1. 运行 `vercel --prod` 部署到生产环境');
        log('  2. 部署后访问 /health?detailed=true&checks=true 进行健康检查');
        log('  3. 监控系统性能和错误日志');
        process.exit(0);
    } else {
        log('⚠️ 发现问题，请修复后重新检查', 'yellow');
        log('\n🔧 修复建议:');
        
        if (!results['环境变量']) {
            log('  - 确保所有必需的环境变量已正确设置');
        }
        if (!results['数据库连接']) {
            log('  - 检查Supabase配置和网络连接');
            log('  - 确保已运行 final-fix.sql');
        }
        if (!results['OpenAI API']) {
            log('  - 验证OpenAI API密钥是否有效且有足够额度');
        }
        
        process.exit(1);
    }
}

// 运行检查
if (require.main === module) {
    runDeploymentCheck().catch(error => {
        log(`\n💥 检查过程出现异常: ${error.message}`, 'red');
        process.exit(1);
    });
}

module.exports = { runDeploymentCheck };