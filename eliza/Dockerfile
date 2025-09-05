# ElizaOS 集成服务 Dockerfile
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S eliza -u 1001

# 复制 package 文件
COPY package*.json ./
COPY tsconfig.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制应用代码
COPY --chown=eliza:nodejs . .

# 构建 TypeScript
RUN npm run build || echo "Build skipped - using JS files"

# 创建必要目录
RUN mkdir -p logs tmp characters bridge config tests
RUN chown -R eliza:nodejs /app

# 切换到非 root 用户
USER eliza

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# 启动命令
CMD ["npm", "start"]