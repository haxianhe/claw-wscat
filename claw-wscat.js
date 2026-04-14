#!/usr/bin/env node
/**
 * claw-wscat — openclaw gateway WebSocket 专用调试客户端
 * 零依赖，需要 Node.js >= 22
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createInterface } from "readline";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = join(__dirname, "config.json");

// ── ANSI 颜色（无需外部依赖）────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};
const clr = (color, text) => `${color}${text}${c.reset}`;

// ── 配置管理 ────────────────────────────────────────────────────────────────

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

async function promptConfig() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  console.log(clr(c.cyan + c.bold, "\n  claw-wscat 首次配置\n"));
  console.log(clr(c.dim, "  配置将保存到 config.json，下次直接运行无需再填\n"));

  const url = (await ask(clr(c.bold, "  Gateway URL > "))).trim();
  const token = (await ask(clr(c.bold, "  Auth Token  > "))).trim();

  rl.close();

  if (!url || !token) {
    console.error(clr(c.red, "\n  URL 和 Token 不能为空\n"));
    process.exit(1);
  }

  const cfg = { url, token };
  saveConfig(cfg);
  console.log(clr(c.green, "\n  ✓ 配置已保存到 config.json\n"));
  return cfg;
}

// ── Gateway 客户端 ───────────────────────────────────────────────────────────

class GatewayClient {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.ws = null;
    this.pending = new Map();
    this._readerRunning = false;
  }

  async connect() {
    process.stdout.write(clr(c.dim, `  连接 ${this.url} … `));

    this.ws = new WebSocket(this.url, {
      rejectUnauthorized: false,
    });

    // 等待 open
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", (e) => reject(e.message ?? e), { once: true });
    });

    // 等待 connect.challenge
    const nonce = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject("等待 challenge 超时"), 8000);
      const handler = (ev) => {
        const frame = JSON.parse(ev.data);
        if (frame.type === "event" && frame.event === "connect.challenge") {
          clearTimeout(timer);
          this.ws.removeEventListener("message", handler);
          resolve(frame.payload.nonce);
        }
      };
      this.ws.addEventListener("message", handler);
    });

    // 发送 connect 握手
    this._send("connect", {
      minProtocol: 3,
      maxProtocol: 3,
      client: { id: "test", version: "1.0.0", platform: "node", mode: "test" },
      role: "operator",
      scopes: [
        "operator.admin",
        "operator.read",
        "operator.write",
        "operator.approvals",
        "operator.pairing",
      ],
      auth: { token: this.token },
      caps: ["tool-events"],
      userAgent: `claw-wscat/node-${process.version}`,
      locale: "zh-CN",
    });

    // 等待 connect res（忽略 connect.challenge 之后的第一帧直到拿到 res）
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject("握手响应超时"), 8000);
      const handler = (ev) => {
        const frame = JSON.parse(ev.data);
        if (frame.type === "res") {
          clearTimeout(timer);
          this.ws.removeEventListener("message", handler);
          if (frame.ok === false) reject(frame.error?.message ?? "connect failed");
          else resolve();
        }
      };
      this.ws.addEventListener("message", handler);
    });

    // 启动持久消息循环
    this._startReader();
    console.log(clr(c.green, "已连接 ✓"));
  }

  _startReader() {
    this._readerRunning = true;
    this.ws.addEventListener("message", (ev) => {
      let frame;
      try { frame = JSON.parse(ev.data); } catch { return; }

      if (frame.type === "res") {
        const fut = this.pending.get(frame.id);
        if (fut) {
          this.pending.delete(frame.id);
          frame.ok === false
            ? fut.reject(new Error(frame.error?.message ?? "rpc error"))
            : fut.resolve(frame.payload);
        }
      } else if (frame.type === "event") {
        // 静默忽略 health/heartbeat，其他 event 打印
        if (!["health", "heartbeat"].includes(frame.event)) {
          console.log(
            clr(c.gray, `\n  [event] ${frame.event}`),
            JSON.stringify(frame.payload, null, 2)
          );
        }
      }
    });

    this.ws.addEventListener("close", () => {
      for (const [, fut] of this.pending) {
        fut.reject(new Error("连接已关闭"));
      }
      this.pending.clear();
    });
  }

  request(method, params) {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} 请求超时`));
      }, 15000);

      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });

      const frame = { type: "req", id, method };
      if (params !== undefined) frame.params = params;
      this.ws.send(JSON.stringify(frame));
    });
  }

  _send(method, params) {
    this.ws.send(JSON.stringify({ type: "req", id: randomUUID(), method, params }));
  }

  close() {
    this.ws?.close();
  }
}

// ── 命令实现 ─────────────────────────────────────────────────────────────────

const COMMANDS = {
  "channels.status": {
    desc: "查看所有频道账号状态",
    async run(client) {
      const result = await client.request("channels.status", { probe: false });
      const accounts = result.channelAccounts ?? {};
      console.log(clr(c.bold, "\n  频道状态\n"));
      for (const [channel, accts] of Object.entries(accounts)) {
        const label = result.channelLabels?.[channel] ?? channel;
        console.log(clr(c.cyan, `  ▸ ${label} (${channel})`));
        for (const a of accts) {
          const running = a.running ? clr(c.green, "运行中") : clr(c.red, "已停止");
          const enabled = a.enabled === false ? clr(c.yellow, " [已禁用]") : "";
          console.log(`    账号: ${a.accountId}  状态: ${running}${enabled}`);
          if (a.lastError) console.log(clr(c.gray, `    错误: ${a.lastError}`));
        }
        console.log();
      }
    },
  },

  "models.list": {
    desc: "查看可用模型列表",
    async run(client) {
      const { models = [] } = await client.request("models.list");
      console.log(clr(c.bold, `\n  可用模型 (${models.length})\n`));
      for (const m of models) {
        console.log(
          `  ${clr(c.cyan, m.id)}\n` +
          `    Provider: ${m.provider ?? "-"}  ` +
          `Context: ${m.contextWindow ? (m.contextWindow / 1000).toFixed(0) + "k" : "-"}  ` +
          `Reasoning: ${m.reasoning ? "✓" : "-"}\n`
        );
      }
    },
  },

  "config.get": {
    desc: "读取当前完整配置",
    async run(client) {
      const result = await client.request("config.get");
      const cfg = result.config ?? {};
      console.log(clr(c.bold, "\n  当前配置\n"));
      console.log(clr(c.dim, `  baseHash: ${result.baseHash ?? "(无)"}\n`));
      console.log(clr(c.cyan, "  已配置频道:"),
        Object.keys(cfg.channels ?? {}).join(", ") || "(无)");
      const providers = Object.keys(cfg.models?.providers ?? {});
      console.log(clr(c.cyan, "  已配置 Provider:"), providers.join(", ") || "(无)");
      console.log();
      console.log(clr(c.dim, "  完整配置:"));
      console.log(JSON.stringify(cfg, null, 2).split("\n").map(l => "  " + l).join("\n"));
      console.log();
    },
  },

  "config.schema": {
    desc: "查看配置 Schema 结构",
    async run(client) {
      const result = await client.request("config.schema");
      const props = Object.keys(result.schema?.properties ?? {});
      console.log(clr(c.bold, "\n  配置 Schema 顶层字段\n"));
      console.log(" ", props.join(", "));
      console.log();
    },
  },

  "sessions.list": {
    desc: "列出所有对话 Session",
    async run(client) {
      const result = await client.request("sessions.list");
      const sessions = result.sessions ?? [];
      console.log(clr(c.bold, `\n  Sessions (${sessions.length})\n`));
      for (const s of sessions) {
        console.log(
          `  ${clr(c.cyan, s.sessionId ?? s.key)}\n` +
          `    名称: ${s.displayName ?? "-"}  ` +
          `模型: ${s.model ?? "-"}  ` +
          `渠道: ${s.lastChannel ?? "-"}\n` +
          clr(c.dim, `    更新: ${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "-"}`) +
          "\n"
        );
      }
    },
  },

  "all": {
    desc: "运行以上全部命令",
    async run(client) {
      const cmds = ["channels.status", "models.list", "config.get", "sessions.list"];
      for (const name of cmds) {
        console.log(clr(c.bold + c.blue, `\n${"─".repeat(56)}`));
        console.log(clr(c.bold + c.blue, `  ${name}`));
        try {
          await COMMANDS[name].run(client);
        } catch (e) {
          console.log(clr(c.red, `  ✗ 失败: ${e.message}`));
        }
      }
    },
  },
};

// ── 帮助信息 ─────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${clr(c.bold, "  claw-wscat")} — openclaw gateway WebSocket 调试客户端
${clr(c.dim, "  https://github.com/haxianhe/claw-wscat")}

${clr(c.bold, "  用法")}

    node claw-wscat.js [命令]

${clr(c.bold, "  命令")}
`);
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    if (name === "all") continue;
    console.log(`    ${clr(c.cyan, name.padEnd(20))} ${cmd.desc}`);
  }
  console.log(`    ${clr(c.cyan, "all".padEnd(20))} 运行以上全部命令`);
  console.log(`    ${clr(c.cyan, "setup".padEnd(20))} 重新配置 URL 和 Token`);
  console.log(`    ${clr(c.cyan, "help".padEnd(20))} 显示此帮助`);
  console.log();
  console.log(`${clr(c.bold, "  示例")}`);
  console.log(`    node claw-wscat.js                # 交互式菜单`);
  console.log(`    node claw-wscat.js all            # 一键测试所有命令`);
  console.log(`    node claw-wscat.js channels.status`);
  console.log();
}

// ── 交互式菜单 ───────────────────────────────────────────────────────────────

async function interactiveMenu(client) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  const cmdList = Object.entries(COMMANDS).filter(([k]) => k !== "all");

  while (true) {
    console.log(clr(c.bold, "\n  选择命令:\n"));
    cmdList.forEach(([name, cmd], i) => {
      console.log(`  ${clr(c.cyan, `[${i + 1}]`)} ${name.padEnd(20)} ${clr(c.dim, cmd.desc)}`);
    });
    console.log(`  ${clr(c.cyan, "[a]")} ${"all".padEnd(20)} ${clr(c.dim, "运行全部")}`);
    console.log(`  ${clr(c.cyan, "[q]")} 退出`);
    console.log();

    const input = (await ask(clr(c.bold, "  > "))).trim().toLowerCase();

    if (input === "q" || input === "quit" || input === "exit") {
      console.log(clr(c.dim, "\n  再见\n"));
      rl.close();
      break;
    }

    if (input === "a" || input === "all") {
      await COMMANDS["all"].run(client);
      continue;
    }

    const idx = parseInt(input) - 1;
    if (idx >= 0 && idx < cmdList.length) {
      const [name, cmd] = cmdList[idx];
      console.log(clr(c.bold + c.blue, `\n${"─".repeat(56)}\n  ${name}`));
      try {
        await cmd.run(client);
      } catch (e) {
        console.log(clr(c.red, `  ✗ 失败: ${e.message}`));
      }
    } else if (COMMANDS[input]) {
      console.log(clr(c.bold + c.blue, `\n${"─".repeat(56)}\n  ${input}`));
      try {
        await COMMANDS[input].run(client);
      } catch (e) {
        console.log(clr(c.red, `  ✗ 失败: ${e.message}`));
      }
    } else {
      console.log(clr(c.yellow, "  未知选项，请重新输入"));
    }
  }
}

// ── 主入口 ───────────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2];

  if (arg === "help" || arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  }

  // 加载或初始化配置
  let cfg = loadConfig();

  if (!cfg || arg === "setup") {
    cfg = await promptConfig();
    if (arg === "setup") process.exit(0);
  }

  // 连接
  const client = new GatewayClient(cfg.url, cfg.token);
  try {
    await client.connect();
  } catch (e) {
    console.error(clr(c.red, `\n  ✗ 连接失败: ${e}\n`));
    process.exit(1);
  }

  // 执行命令
  if (!arg) {
    // 无参数：交互式菜单
    await interactiveMenu(client);
  } else if (COMMANDS[arg]) {
    await COMMANDS[arg].run(client).catch((e) => {
      console.error(clr(c.red, `  ✗ ${e.message}`));
    });
  } else {
    console.error(clr(c.red, `  ✗ 未知命令: ${arg}`));
    printHelp();
    process.exit(1);
  }

  client.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(clr(c.red, `\n  ✗ 意外错误: ${e.message}\n`));
  process.exit(1);
});
