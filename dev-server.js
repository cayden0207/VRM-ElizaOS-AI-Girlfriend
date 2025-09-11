// 开发环境服务器
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 导入原始处理器
import handler from './api/index.js';

// 将 Vercel serverless 函数适配为 Express 路由
app.use('/api', async (req, res) => {
  // 模拟 Vercel 的 req/res 对象
  const mockReq = {
    ...req,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body
  };

  const mockRes = {
    setHeader: (key, value) => res.setHeader(key, value),
    status: (code) => {
      res.status(code);
      return mockRes;
    },
    json: (data) => res.json(data),
    send: (data) => res.send(data),
    end: (data) => res.end(data)
  };

  try {
    await handler(mockReq, mockRes);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'vrm-eliza-development',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 开发服务器启动在端口 ${PORT}`);
  console.log(`🌐 访问: http://localhost:${PORT}`);
  console.log(`⚡ 健康检查: http://localhost:${PORT}/health`);
});