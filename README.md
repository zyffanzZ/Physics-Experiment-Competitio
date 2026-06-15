# 物理实验助手 v2.3.5

> 基于 Spring Boot + DeepSeek AI 的智能物理实验平台，支持物联网下滑位移测量、AI 对话答疑、实验数据管理与导出。

## 功能特性

- 🤖 **AI 实验助手** — 集成 DeepSeek 大模型，支持物理实验答疑、数据分析、公式推导
- 📡 **物联网数据采集** — 通过 ESP8266 实时采集下滑位移实验数据
- 📊 **数据可视化** — Chart.js 图表展示实验数据曲线，点击图表可全屏放大
- 📐 **斜面动画模拟** — Canvas 实时斜面滑块动画，位移/速度/加速度同步，受力分析显示
- 📧 **邮件反馈** — 用户反馈提交 + QQ 邮箱 SMTP 自动通知
- 📋 **实验记录管理** — H2 数据库持久化存储实验历史，支持 Excel 导出
- 🔐 **安全加固** — 防暴力破解、XSS 过滤、安全响应头、错误信息隐藏
- 🖥 **管理后台** — 访问统计、数据管理、密码保护
- 📱 **移动端优化** — 响应式布局，图表纵向排列，对话区流畅滚动

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Spring Boot 3.2.0 |
| 语言 | Java 17 |
| 数据库 | H2 Database (file-based) |
| AI 接口 | DeepSeek API (deepseek-chat) |
| 前端图表 | Chart.js |
| Excel 导出 | Apache POI 5.2.5 |
| 构建工具 | Maven |

## 快速开始

### 环境要求

- JDK 17+
- Maven 3.6+

### 1. 克隆项目

```bash
git clone https://github.com/zyffanzZ/-.git
cd -
```

### 2. 配置 API Key

编辑 `src/main/resources/application.properties`：

```properties
deepseek.api.key=你的DeepSeek_API_Key
```

### 3. 启动服务

```bash
mvn spring-boot:run
```

启动后访问 http://localhost:8080

## 项目结构

```
├── frontend/                  # 前端页面
│   ├── index.html             # 主页面
│   ├── admin.html             # 管理后台
│   ├── css/style.css          # 样式文件
│   ├── js/
│   │   ├── main.js            # 主逻辑
│   │   ├── charts.js          # 图表绘制
│   │   └── api.js             # API 调用
│   └── images/logo.png        # Logo
├── src/main/java/.../
│   ├── controller/            # REST 控制器
│   │   ├── AgentController    # AI 对话接口
│   │   ├── SensorDataController  # 传感器数据
│   │   ├── ExperimentDataController  # 实验数据管理
│   │   ├── ExportController   # Excel 导出
│   │   ├── FeedbackController # 用户反馈
│   │   ├── SimulationController  # 仿真模拟
│   │   ├── VisitTrackingController  # 访问追踪
│   │   └── ...
│   ├── service/               # 业务逻辑层
│   ├── config/                # 配置类（含安全过滤器）
│   └── dto/                   # 数据传输对象
├── src/main/resources/
│   ├── application.properties # 应用配置
│   ├── schema.sql             # 数据库表结构
│   └── physics_knowledge_base.md  # 物理知识库
├── data/                      # H2 数据库文件（gitignore）
├── pom.xml
└── README.md
```

## API 接口概览

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/agent/chat` | POST | AI 对话 |
| `/api/agent/history` | GET | 对话历史 |
| `/api/sensor/data` | POST | 上传传感器数据 |
| `/api/experiment/list` | GET | 实验记录列表 |
| `/api/experiment/delete` | POST | 删除实验记录 |
| `/api/export/excel` | GET | 导出 Excel |
| `/api/feedback/submit` | POST | 提交反馈 |
| `/api/simulation/run` | POST | 运行仿真 |
| `/api/track/verify` | POST | 管理后台密码验证 |
| `/api/device/status` | GET | 设备在线状态 |

## 更新日志

| 版本 | 日期 | 主要改动 |
|------|------|----------|
| v2.3.5 | 2026-06-15 | 动画面板画布铺满布局、斜面居中优化、全屏等比例放大、受力分析图例增强 |
| v2.3.4 | 2026-06-14 | 移动端按钮统一、对话区滚动修复、图表纵向布局、图表点击全屏放大 |
| v2.3.3 | 2026-06-10 | 许可证更新为 HUAT License |
| v2.3.2 | 2026-06-10 | 安全加固：密码保护、防暴力破解、XSS 过滤、安全响应头 |

## 安全特性 (v2.3.2)

- H2 控制台已禁用 + 数据库密码保护
- 管理后台密码暴力破解防护（3 次锁定 15 分钟，累进递增至 60 分钟）
- 反馈提交服务端 XSS 过滤（script/iframe/事件注入）
- 安全响应头（CSP、X-Frame-Options、nosniff）
- 错误详情不对外暴露
- AI 会话历史过滤系统提示词

## 物联网设备连接

项目支持 ESP8266 模块通过 WiFi 上报下滑位移测量数据。详细使用说明请参考 `物联网下滑位移测量系统_使用指南.docx`。

## License

HUAT License
