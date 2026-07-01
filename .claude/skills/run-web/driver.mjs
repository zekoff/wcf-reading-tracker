// REPL driver for wcf-reading-tracker (Next.js web app).
// Run headless on Linux. Designed for agents: wrap in tmux, send-keys
// commands, capture-pane output. chromium-cli wasn't available in this
// environment, so this adapts the same REPL shape using playwright directly.
import { chromium } from "playwright";
import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";

const SHOT_DIR = process.env.SCREENSHOT_DIR || "/tmp/shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

let browser = null;
let page = null;

const COMMANDS = {
  async launch(url) {
    if (browser) return console.log("already launched");
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    page = await (await browser.newContext()).newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("[console error]", msg.text());
    });
    await page.goto(url || "http://localhost:3000", { waitUntil: "domcontentloaded" });
    console.log("launched:", page.url());
  },

  async nav(url) {
    if (!page) return console.log("ERROR: launch first");
    await page.goto(url, { waitUntil: "domcontentloaded" });
    console.log("nav:", page.url());
  },

  async ss(name) {
    if (!page) return console.log("ERROR: launch first");
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + ".png");
    await page.screenshot({ path: f });
    console.log("screenshot:", f);
  },

  async click(sel) {
    if (!page) return console.log("ERROR: launch first");
    try {
      await page.click(sel, { timeout: 5000 });
      console.log("click", sel, "-> OK");
    } catch (e) {
      console.log("click", sel, "-> ERROR:", e.message);
    }
  },

  async "click-text"(text) {
    if (!page) return console.log("ERROR: launch first");
    try {
      await page.getByText(text, { exact: false }).first().click({ timeout: 5000 });
      console.log("click-text", JSON.stringify(text), "-> OK");
    } catch (e) {
      console.log("click-text", JSON.stringify(text), "-> ERROR:", e.message);
    }
  },

  async fill(args) {
    if (!page) return console.log("ERROR: launch first");
    const idx = args.indexOf(" ");
    const sel = args.slice(0, idx);
    const value = args.slice(idx + 1);
    try {
      await page.fill(sel, value, { timeout: 5000 });
      console.log("fill", sel, "->", value);
    } catch (e) {
      console.log("fill", sel, "-> ERROR:", e.message);
    }
  },

  async type(text) {
    if (page) await page.keyboard.type(text, { delay: 30 });
  },
  async press(key) {
    if (page) await page.keyboard.press(key);
  },

  async wait(sel) {
    if (!page) return console.log("ERROR: launch first");
    try {
      await page.waitForSelector(sel, { timeout: 10_000 });
      console.log("found:", sel);
    } catch {
      console.log("TIMEOUT:", sel);
    }
  },

  async "wait-text"(text) {
    if (!page) return console.log("ERROR: launch first");
    try {
      await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10_000 });
      console.log("found text:", text);
    } catch {
      console.log("TIMEOUT waiting for text:", text);
    }
  },

  async text(sel) {
    if (!page) return console.log("ERROR: launch first");
    console.log(await page.evaluate((s) => (s ? document.querySelector(s) : document.body)?.innerText ?? "(null)", sel || null));
  },

  async eval(expr) {
    if (!page) return console.log("ERROR: launch first");
    try {
      console.log(JSON.stringify(await page.evaluate(expr)));
    } catch (e) {
      console.log("ERROR:", e.message);
    }
  },

  async quit() {
    if (browser) await browser.close().catch(() => {});
    browser = null;
    page = null;
  },
  help() {
    console.log("commands:", Object.keys(COMMANDS).join(", "));
  },
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "driver> " });

// readline's 'line' event fires for every line immediately regardless of
// whether an earlier async handler is still running -- without this queue,
// piping a multi-line script via heredoc runs every command concurrently
// instead of in order (e.g. "wait-text" firing before "launch" finishes).
let queue = Promise.resolve();

rl.on("line", (line) => {
  queue = queue.then(() => runLine(line));
});

async function runLine(line) {
  const idx = line.trim().indexOf(" ");
  const cmd = idx === -1 ? line.trim() : line.trim().slice(0, idx);
  const rest = idx === -1 ? "" : line.trim().slice(idx + 1);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.log("unknown:", cmd, "-- try: help");
    return rl.prompt();
  }
  try {
    await fn(rest);
  } catch (e) {
    console.log("ERROR:", e.message);
  }
  if (cmd === "quit") {
    rl.close();
    process.exit(0);
  }
  rl.prompt();
}
rl.on("close", async () => {
  await queue; // let any still-pending queued commands finish first
  await COMMANDS.quit();
  process.exit(0);
});

console.log("wcf-reading-tracker driver -- \"help\" for commands, \"launch\" to start");
rl.prompt();
