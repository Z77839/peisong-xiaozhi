# ============================================
# 配送小智 - 生产级 Docker 镜像
# 多阶段构建：构建前端 + 后端 + 运行时
# ============================================

# ---------- Stage 1: 构建前端 ----------
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# 复制前端 package 文件
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# 复制前端代码
COPY frontend/ ./

# 构建（用空 VITE_BASE_PATH 让 build 输出可部署到任意路径）
ENV VITE_BASE_PATH=/
RUN npm run build

# ---------- Stage 2: 构建后端 ----------
FROM node:20-alpine AS backend-builder

WORKDIR /build/backend

# 复制后端 package
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# 复制后端代码
COPY backend/ ./

# ---------- Stage 3: 运行时 ----------
FROM node:20-alpine AS runtime

# 安全：使用非 root 用户
RUN addgroup -g 1001 -S appuser && \
    adduser -S -u 1001 -G appuser appuser

WORKDIR /app

# 安装 dumb-init（信号处理）
RUN apk add --no-cache dumb-init

# 复制后端
COPY --from=backend-builder --chown=appuser:appuser /build/backend /app

# 复制前端构建产物到 /app/public
COPY --from=frontend-builder --chown=appuser:appuser /build/frontend/dist /app/public

# 创建日志目录
RUN mkdir -p /app/logs && chown appuser:appuser /app/logs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 切换到非 root 用户
USER appuser

EXPOSE 3000

# 用 dumb-init 启动（正确处理 SIGTERM/SIGINT）
ENTRYPOINT ["dumb-init", "--"]

# 启动后端（同时 serve 前端 dist）
CMD ["node", "src/server.js"]
