@echo off
chcp 65001 >nul
title 配送小智 - 本地启动

echo.
echo ============================================================
echo   配送小智 — AI 配送运营智能决策系统
echo   本地启动器
echo ============================================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [错误] 未检测到 Node.js
  echo 请先安装 Node.js 18+: https://nodejs.org/
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
echo [√] Node.js 版本: %NODE_VER%

REM 检查后端依赖
if not exist "backend\node_modules" (
  echo.
  echo [1/4] 第一次启动，正在安装后端依赖（1-2 分钟）...
  cd backend
  call npm install --no-audit --no-fund --legacy-peer-deps
  if %errorlevel% neq 0 (
    echo [错误] 后端依赖安装失败
    pause
    exit /b 1
  )
  cd ..
  echo [√] 后端依赖安装完成
) else (
  echo [√] 后端依赖已就绪
)

REM 检查前端依赖
if not exist "frontend\node_modules" (
  echo.
  echo [2/4] 第一次启动，正在安装前端依赖（2-3 分钟）...
  cd frontend
  call npm install --no-audit --no-fund --legacy-peer-deps
  if %errorlevel% neq 0 (
    echo [错误] 前端依赖安装失败
    pause
    exit /b 1
  )
  cd ..
  echo [√] 前端依赖安装完成
) else (
  echo [√] 前端依赖已就绪
)

echo.
echo [3/4] 启动后端服务（端口 3000）...
start "配送小智-后端" cmd /k "cd /d %CD%\backend && node src/server.js"
timeout /t 3 /nobreak >nul

echo.
echo [4/4] 启动前端服务（端口 5173）...
start "配送小智-前端" cmd /k "cd /d %CD%\frontend && npm run dev"

echo.
echo ============================================================
echo   [√] 全部启动完成！
echo ============================================================
echo.
echo   后端 API:    http://localhost:3000/api/health
echo   前端地址:    http://localhost:5173
echo   登录账号:    admin / operator / analyst
echo   演示密码:    任意
echo.
echo   两个黑色窗口分别是后端和前端，**不要关闭**
echo   关闭整个启动器前请先关闭那两个窗口
echo.
echo   按任意键打开浏览器...
pause >nul

start http://localhost:5173
echo 浏览器已打开，关闭此窗口不影响后端和前端
pause
