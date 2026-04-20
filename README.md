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

填写 **Gateway URL** 和 **Token**，点击「连接」即可。连接配置自动保存到 localStorage，下次打开无需重填。

---

## 如何获取 Token

在运行 openclaw gateway 的机器上执行：

```bash
grep -A3 '"auth"' ~/.openclaw/openclaw.json
```

---

## 界面说明

```
┌─────────────────────────────────────────────────────┐
│  URL 输入栏   Token 输入栏   [连接]   状态指示       │
├──────────────┬──────────────┬────────────────────────┤
│  命令列表     │  参数编辑区  │  响应面板（文本/预览） │
│              │              │                        │
│              │              ├────────────────────────┤
│              │  [▶ 发 送]  │  事件日志               │
└──────────────┴──────────────┴────────────────────────┘
```

- **命令列表**：点击选择要执行的 RPC 命令
- **参数编辑区**：实时 JSON 校验，格式错误时高亮提示
- **响应面板**：支持语法高亮的文本视图和可折叠的 JSON 树预览
- **事件日志**：实时显示服务端推送事件（health / heartbeat 自动过滤）

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
| `config.patch` | 修改配置（支持自动填入 baseHash） |
| 自定义 RPC | 输入任意 method 名称自由调试 |

---

## 自签名证书

gateway 使用自签名证书时，浏览器会拒绝 `wss://` 连接。连接失败后页面会自动给出引导：

1. 点击提示中的链接，在新标签页中访问 `https://gateway:8001/`
2. 点击「继续访问」信任证书
3. 回到 claw-wscat 页面，重新点击「连接」

---

## 与 wscat 的区别

| 能力 | wscat | claw-wscat |
|------|-------|-----------|
| 自动处理握手 | 需手动发 challenge 响应 | 自动完成 |
| 预置 RPC 命令 | 需手写完整 JSON | 一键执行 |
| 保存连接配置 | 每次手输 URL | localStorage 持久化 |
| 格式化输出 | 原始 JSON | 语法高亮 + JSON 树预览 |
| 零依赖 | 需安装 npm 包 | 单个 HTML 文件 |

---

## License

MIT
