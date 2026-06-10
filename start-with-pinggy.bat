@echo off
chcp 65001 > nul
title 物理实验助手 - Pinggy 隧道
cd /d "%~dp0"

echo ============================================
echo    物理实验助手 - 一键启动 + Pinggy 穿透
echo ============================================
echo.

:: Step 1: 启动 Spring Boot (最小化窗口, 后台运行)
echo [1/3] 正在编译并启动 Spring Boot (端口 8080) ...
start /min "Spring Boot" cmd /c "mvn spring-boot:run" > .pinggy_spring.log 2>&1

:: Step 2: 等待后端就绪
echo [2/3] 等待 Spring Boot 启动 (约 20s) ...
timeout /t 20 /nobreak > nul

:: Step 3: 启动 Pinggy 隧道 (前置窗口, 实时显示 URL + 二维码)
echo [3/3] 启动 Pinggy 远程隧道 ...
echo.
echo 公网地址和二维码将在下方显示:
echo (连接建立后请扫二维码或用浏览器打开)
echo ============================================
echo.

ssh -o StrictHostKeyChecking=no -p 443 -R 0:localhost:8080 qr@pinggy.link

:: 隧道关闭后清理
echo.
echo Pinggy 隧道已关闭。Spring Boot 进程仍在后台运行。
echo 手动关闭: taskkill /f /fi "WINDOWTITLE eq Spring Boot"
