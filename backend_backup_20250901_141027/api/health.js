/**
 * 健康检查和监控端点
 * 提供系统状态、性能指标和诊断信息
 */

const { createClient } = require('@supabase/supabase-js');

// 初始化Supabase客户端
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// 系统启动时间
const startTime = Date.now();

/**
 * 检查数据库连接
 */
async function checkDatabase() {
    try {
        const { data, error } = await supabase
            .from('memory_vectors')
            .select('count', { count: 'exact', head: true })
            .limit(1);

        if (error) {
            return {
                status: 'error',
                message: error.message,
                responseTime: null
            };
        }

        return {
            status: 'healthy',
            message: 'Database connection successful',
            totalMemories: data || 0,
            responseTime: Date.now()
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message,
            responseTime: null
        };
    }
}

/**
 * 检查OpenAI API
 */
async function checkOpenAI() {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return {
                status: 'error',
                message: 'OpenAI API key not configured'
            };
        }

        // 简单检查API key格式
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey.startsWith('sk-')) {
            return {
                status: 'warning',
                message: 'OpenAI API key format may be invalid'
            };
        }

        return {
            status: 'healthy',
            message: 'OpenAI API configured',
            keyLength: apiKey.length
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message
        };
    }
}

/**
 * 获取系统指标
 */
function getSystemMetrics() {
    const uptime = Date.now() - startTime;
    const memory = process.memoryUsage();

    return {
        uptime: {
            ms: uptime,
            human: formatUptime(uptime)
        },
        memory: {
            rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(memory.external / 1024 / 1024)}MB`
        },
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
    };
}

/**
 * 格式化运行时间
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * 主健康检查处理器
 */
module.exports = async (req, res) => {
    const startTime = Date.now();
    
    try {
        // 设置CORS头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (req.method !== 'GET') {
            res.status(405).json({
                error: 'Method not allowed',
                allowedMethods: ['GET']
            });
            return;
        }

        const detailed = req.query.detailed === 'true';
        const checks = req.query.checks === 'true';

        // 基础健康检查
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development',
            responseTime: Date.now() - startTime
        };

        // 详细信息
        if (detailed) {
            health.system = getSystemMetrics();
        }

        // 依赖检查
        if (checks) {
            const [dbCheck, openaiCheck] = await Promise.allSettled([
                checkDatabase(),
                checkOpenAI()
            ]);

            health.dependencies = {
                database: dbCheck.status === 'fulfilled' ? dbCheck.value : {
                    status: 'error',
                    message: dbCheck.reason?.message || 'Check failed'
                },
                openai: openaiCheck.status === 'fulfilled' ? openaiCheck.value : {
                    status: 'error',
                    message: openaiCheck.reason?.message || 'Check failed'
                }
            };

            // 根据依赖状态更新整体状态
            const hasError = Object.values(health.dependencies)
                .some(dep => dep.status === 'error');
            const hasWarning = Object.values(health.dependencies)
                .some(dep => dep.status === 'warning');

            if (hasError) {
                health.status = 'unhealthy';
            } else if (hasWarning) {
                health.status = 'degraded';
            }
        }

        // 设置HTTP状态码
        let statusCode = 200;
        if (health.status === 'unhealthy') {
            statusCode = 503; // Service Unavailable
        } else if (health.status === 'degraded') {
            statusCode = 200; // OK but with warnings
        }

        res.status(statusCode).json({
            success: true,
            ...health
        });

    } catch (error) {
        console.error('健康检查失败:', error);
        
        res.status(500).json({
            success: false,
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString(),
            responseTime: Date.now() - startTime
        });
    }
};