# claw-wscat

openclaw gateway WebSocket 专用调试客户端。

无需手写 JSON，自动处理握手协议，一键测试所有 RPC 命令。

**要求**：Node.js >= 22，零额外依赖。

---

## 快速开始

```bash
git clone https://github.com/haxianhe/claw-wscat.git
cd claw-wscat
node claw-wscat.js
```

首次运行会自动引导填写 Gateway URL 和 Token，保存后下次直接运行无需再填。

---

## 手动配置

复制示例文件：

```bash
cp config.example.json config.json
```

编辑 `config.json`：

```json
{
  "url": "wss://your-gateway-host:8001/",
  "token": "your-gateway-token-here"
}
```

**如何获取 Token**：在运行 openclaw gateway 的机器上执行：

```bash
grep -A3 '"auth"' ~/.openclaw/openclaw.json
```

---

## 用法

```bash
# 交互式菜单（推荐）
node claw-wscat.js

# 直接执行某个命令
node claw-wscat.js all               # 运行全部命令
node claw-wscat.js channels.status   # 查看频道状态
node claw-wscat.js models.list       # 查看可用模型
node claw-wscat.js config.get        # 读取完整配置
node claw-wscat.js sessions.list     # 列出所有 Session

# 重新配置 URL / Token
node claw-wscat.js setup
```

---

## 支持的命令

| 命令 | 说明 |
|------|------|
| `channels.status` | 查看所有频道账号的运行状态 |
| `models.list` | 列出当前可用的 AI 模型 |
| `config.get` | 读取 gateway 完整配置（敏感字段自动脱敏） |
| `config.schema` | 查看配置的 JSON Schema 结构 |
| `sessions.list` | 列出所有对话 Session |
| `all` | 依次运行以上全部命令 |

---

## 与 wscat 的区别

| 能力 | wscat | claw-wscat |
|------|-------|-----------|
| 自动处理握手 | ❌ 需手动发 challenge 响应 | ✅ 自动完成 |
| 预置 RPC 命令 | ❌ 需手写完整 JSON | ✅ 一键执行 |
| 保存连接配置 | ❌ 每次手输 URL | ✅ 配置文件持久化 |
| 格式化输出 | ❌ 原始 JSON | ✅ 结构化展示 |
| 面向非开发者 | ❌ 需懂协议 | ✅ 交互式菜单 |

---

## License

MIT
