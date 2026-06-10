#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo "   物理实验助手 - 一键启动 + Pinggy 穿透"
echo "============================================"
echo ""

# Step 1: Start Spring Boot in background
echo "[1/3] 正在编译并启动 Spring Boot (端口 8080) ..."
mvn spring-boot:run > .pinggy_spring.log 2>&1 &
SPRING_PID=$!
echo "  Spring Boot PID: $SPRING_PID"

# Step 2: Wait for backend to be ready
echo "[2/3] 等待 Spring Boot 启动 (约 20s) ..."
sleep 20

# Step 3: Start Pinggy tunnel (foreground)
echo "[3/3] 启动 Pinggy 远程隧道 ..."
echo ""
echo "公网地址和二维码将在下方显示:"
echo "(连接建立后请扫二维码或用浏览器打开)"
echo "============================================"
echo ""

ssh -o StrictHostKeyChecking=no -p 443 -R 0:localhost:8080 qr@pinggy.link

# Cleanup on tunnel exit
echo ""
echo "Pinggy 隧道已关闭。正在停止 Spring Boot ..."
kill $SPRING_PID 2>/dev/null
echo "Spring Boot 已停止。"
