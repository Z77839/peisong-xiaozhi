@echo off
chcp 65001 >nul
title 停止配送小智

echo.
echo 正在停止配送小智的所有服务...

REM 通过端口结束进程
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
  echo 停止后端 (PID: %%a)
  taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
  echo 停止前端 (PID: %%a)
  taskkill /F /PID %%a >nul 2>&1
)

REM 杀 node 进程（兜底）
taskkill /F /IM node.exe /T >nul 2>&1

echo.
echo [√] 全部已停止
echo.
pause
