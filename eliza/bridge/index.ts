/**
 * ElizaOS 桥接服务入口点
 * 启动和配置服务
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ElizaBridgeService } from './bridge-service.js';
import { Logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

// 全局错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// 主函数
async function main() {
    const logger = new Logger('Main');
    
    try {
        // 验证关键环境变量
        const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY'];
        const missing = requiredEnvVars.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            logger.error(`缺少必需的环境变量: ${missing.join(', ')}`);
            process.exit(1);
        }

        // 创建并启动服务
        const service = new ElizaBridgeService();
        const port = parseInt(process.env.ELIZA_BRIDGE_PORT || '3001');

        // 优雅关闭处理
        const shutdown = async () => {
            logger.info('收到关闭信号，正在优雅关闭...');
            await service.shutdown();
            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        // 启动服务
        await service.start(port);

    } catch (error) {
        logger.error('服务启动失败', error);
        process.exit(1);
    }
}

// 仅在直接运行时执行
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { ElizaBridgeService };