# claw-wscat

openclaw gateway WebSocket 专用调试客户端，浏览器直接打开即用。

自动处理握手协议，内置全部 RPC 命令，无需手写 JSON，无需安装任何依赖。

---

## 快速开始

下载 `index.html`，用浏览器打开：

```bash
git clone https://github.com/haxianhe/claw-wscat.git
open claw-wscat/index.html   # macOS
# 或直接双击 index.html
```

### 连接方式

填写 **Gateway URL** 和 **Token** 后点击「连接」。支持三种快捷输入方式，**直接粘贴**即可自动解析：

| 粘贴内容 | 示例 |
|---------|------|
| JSON（含 `machineUrl` + `token`） | `{"machineUrl":"https://host:port","token":"abc123"}` |
| `host:port+token` 格式 | `your-host.example.com:port+mytoken` |
| 带 `authcode` 参数的 URL | `https://example.com/mcp.html?authcode=<your-authcode>` |

连接配置自动保存到 localStorage，下次打开无需重填。

---

## 如何获取 Token

在运行 openclaw gateway 的机器上执行：

```bash
grep -A3 '"auth"' ~/.openclaw/openclaw.json
```

---

## 界面说明

```
┌─────────────────────────────────────────────────────────┐
│  URL 输入栏   Token 输入栏   [连接]   状态指示           │
├──────────────┬──────────────┬──────────────────────────┤
│              │              │  Text │ JSON │ Log │Sessions│
│  命令列表    │  参数编辑区  ├──────────────────────────┤
│              │              │  响应内容                 │
│              │  [▶ 发 送]  ├──────────────────────────┤
│              │              │  事件日志                 │
└──────────────┴──────────────┴──────────────────────────┘
```

- **命令列表**：点击选择要执行的 RPC 命令
- **参数编辑区**：实时 JSON 校验，格式错误时高亮提示
- **Text / JSON / Log Tab**：语法高亮文本、可折叠 JSON 树、事件日志，顶部「复制」一键复制完整响应
- **Sessions Tab**：会话可视化（见下方说明）

---

## Sessions Tab 使用方法

### 1. 查看会话列表

在命令列表中选择 `sessions.list` 并发送，Sessions Tab 自动展示所有会话卡片：

```
┌─────────────────────────────┐
│ Web Chat              14:26 │
│ agent:main:main             │
│ kimi-for-coding · 79,689 t  │
└─────────────────────────────┘
```

点击卡片自动加载该会话的完整消息链。

### 2. 查看消息链

点击会话卡片后，自动发送 `chat.history` 请求，消息链按时间倒序展示：

- 🔵 **USER**：用户消息
- 🟢 **ASST**：助手回复，`toolCall` 和 `thinking` 块可点击展开/收起
- 每条消息右上角有「复制」按钮，时间戳格式为 `YYYY-MM-DD hh:mm:ss`

点击「← 返回」回到会话列表。

### 3. 搜索

| 场景 | 操作 |
|------|------|
| **全局搜索**（跨所有会话） | 在会话列表页的搜索框输入关键词，按 `Enter` |
| **消息内搜索**（当前会话） | 进入消息链后，在搜索框输入关键词，实时过滤高亮 |

---

## 支持的命令

| 命令 | 说明 |
|------|------|
| `channels.status` | 查看所有频道账号的运行状态 |
| `models.list` | 列出当前可用的 AI 模型 |
| `config.get` | 读取 gateway 完整配置（敏感字段自动脱敏） |
| `config.schema` | 查看配置的 JSON Schema 结构 |
| `sessions.list` | 列出所有对话 Session |
| `sessions.usage` | Session 用量统计 |
| `chat.history` | 加载指定 Session 的消息链（参数：`{"sessionKey":"agent:main:main"}`） |
| `config.patch` | 修改配置（支持自动填入 baseHash） |
| 自定义 RPC | 输入任意 method 名称自由调试 |

---

## 自签名证书

gateway 使用自签名证书时，浏览器会拒绝 `wss://` 连接。连接失败后页面会自动给出引导：

1. 点击提示中的链接，在新标签页中访问 `https://gateway:port/`
2. 点击「继续访问」信任证书
3. 回到 claw-wscat 页面，重新点击「连接」

---

## 与 wscat 的区别

| 能力 | wscat | claw-wscat |
|------|-------|-----------|
| 自动处理握手 | 需手动发 challenge 响应 | 自动完成 |
| 预置 RPC 命令 | 需手写完整 JSON | 一键执行 |
| 保存连接配置 | 每次手输 URL | localStorage 持久化 |
| 快捷粘贴连接信息 | 不支持 | 自动解析 JSON / URL / token |
| 格式化输出 | 原始 JSON | 语法高亮 + JSON 树预览 |
| 会话可视化 | 不支持 | Sessions Tab 消息链视图 |
| 消息搜索 | 不支持 | 全局搜索 + 实时过滤高亮 |
| 零依赖 | 需安装 npm 包 | 单个 HTML 文件 |

---

## License

MIT
