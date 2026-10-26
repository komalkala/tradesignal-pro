/**
 * TradeSignal Pro local supervisor.
 * Launches the dashboard and all configured research/Telegram workers from ONE terminal.
 * No extra npm dependencies; supports Windows, macOS and Linux with Node >=20.
 * Ctrl+C stops all child processes. Never places exchange orders.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const envFile = join(projectRoot, '.env.local');
const checkOnly = process.argv.includes('--check');
const processes = new Map();
const timers = new Set();
let shuttingDown = false;
let stopTimer;

function write(message) { process.stdout.write(`[ALL] ${message}\n`); }
function fail(message) { process.stderr.write(`[ALL ERROR] ${message}\n`); process.exit(1); }

if (Number(process.versions.node.split('.')[0]) < 20) fail('Node.js 20+ is required (--env-file support).');
if (!existsSync(envFile)) fail('Missing .env.local. Copy .env.example to .env.local and set Telegram credentials.');

// Only read nonsecret keys for preflight. Worker processes load .env.local themselves.
const env = new Map();
const duplicate = new Map();
for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  const key = m[1];
  let value = m[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, '').trim();
  }
  duplicate.set(key, (duplicate.get(key) ?? 0) + 1);
  env.set(key, value);
}
const duplicated = [...duplicate].filter(([, count]) => count > 1).map(([key]) => key);
if (duplicated.length) fail(`Duplicate variable(s) in .env.local: ${duplicated.join(', ')}. Keep each key only once (especially ALERT_DRY_RUN).`);

const setting = (key, fallback = '') => env.get(key) ?? process.env[key] ?? fallback;
const enabled = (key, fallback = false) => setting(key, String(fallback)).toLowerCase() === 'true';
const dryRun = enabled('ALERT_DRY_RUN', true);
const useV7 = enabled('V7_TELEGRAM_ENABLED', true);
const useSignals = enabled('SIGNALS_ENABLED', true);
const useJournal = enabled('V71_JOURNAL_ENABLED', true);
const useSentiment = enabled('SENTIMENT_TELEGRAM_ENABLED');
const useOrderFlow = enabled('ORDER_FLOW_TELEGRAM_ENABLED');
if (!dryRun && !checkOnly && (!setting('TELEGRAM_BOT_TOKEN') || !setting('TELEGRAM_CHAT_ID'))) {
  fail('Telegram sending is enabled but TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.');
}

// Give .env.local precedence over any stale shell values. Node --env-file otherwise
// leaves already-set parent environment variables unchanged.
const childEnv = { ...process.env };
for (const key of env.keys()) delete childEnv[key];

const nextCLI = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const tsx = join(projectRoot, 'node_modules', 'tsx');
const entries = [
  { label: 'WEB', active: true, args: [nextCLI, 'dev'], description: 'Next.js dashboard' },
  { label: 'SIGNALS', active: useSignals, args: ['--env-file=.env.local', '--import', 'tsx', 'workers/signal-monitor.ts'], description: 'Original swing signals; QUICK off by default' },
  { label: 'SENTIMENT', active: useSentiment, args: ['--env-file=.env.local', '--import', 'tsx', 'workers/sentiment-monitor.ts'], description: 'Fear & Greed + RSI Telegram digest' },
  { label: 'ORDER-FLOW', active: useOrderFlow, args: ['--env-file=.env.local', '--import', 'tsx', 'workers/order-flow-monitor.ts'], description: 'Buyer/seller pressure + high volume Telegram alerts' },
  { label: 'V7-SWING', active: useV7, args: ['--env-file=.env.local', '--import', 'tsx', 'workers/v7-monitor.ts'], description: 'Swing research + configured macro-event Telegram alerts' },
  { label: 'JOURNAL', active: useJournal && !useV7, args: ['--env-file=.env.local', '--import', 'tsx', 'workers/v71-journal-monitor.ts'], description: 'Standalone paper journal (fallback when V7 is off)' },
];

if (useJournal && useV7) write('Journal integrated into V7-SWING: one Binance fetch per coin/timeframe pair, one journal writer.');
write(`Mode: ${dryRun ? 'DRY RUN — no real Telegram messages' : 'LIVE TELEGRAM — notifications enabled (no Binance orders)'}`);
if (useV7 && !setting('V7_EVENTS_JSON')) write('Note: V7_EVENTS_JSON is empty. CPI/FOMC event alerts require verified configured events.');
for (const spec of entries) write(`${spec.active ? 'ON ' : 'OFF'} ${spec.label.padEnd(10)} ${spec.description}`);
if (checkOnly) { write('Configuration check completed. No child processes started.'); process.exit(0); }
if (!existsSync(nextCLI) || !existsSync(tsx)) fail('Dependencies missing: run npm install first.');

function outputPrefix(child, stream, label, isError) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) (isError ? process.stderr : process.stdout).write(`[${label}] ${line}\n`);
    if (buffer.length > 12000) { (isError ? process.stderr : process.stdout).write(`[${label}] ${buffer}\n`); buffer = ''; }
  });
  stream.on('end', () => {
    if (buffer) (isError ? process.stderr : process.stdout).write(`[${label}] ${buffer}\n`);
  });
}

function start(spec) {
  if (shuttingDown) return;
  const child = spawn(process.execPath, spec.args, {
    cwd: projectRoot,
    env: childEnv,
    shell: false,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const entry = processes.get(spec.label) ?? { restarts: 0 };
  entry.child = child;
  entry.spec = spec;
  entry.startedAt = Date.now();
  processes.set(spec.label, entry);
  write(`Started ${spec.label} (pid ${child.pid ?? 'pending'})`);
  outputPrefix(child, child.stdout, spec.label, false);
  outputPrefix(child, child.stderr, spec.label, true);
  let finished = false;
  const onEnd = (description) => {
    if (finished) return;
    finished = true;
    entry.child = null;
    if (shuttingDown) return;
    if (Date.now() - entry.startedAt > 120000) entry.restarts = 0;
    entry.restarts += 1;
    const retryMs = Math.min(60000, 5000 * 2 ** Math.min(4, entry.restarts - 1));
    write(`${spec.label} ${description}. Restarting in ${Math.round(retryMs / 1000)}s (Ctrl+C to stop all).`);
    const t = setTimeout(() => { timers.delete(t); start(spec); }, retryMs);
    timers.add(t);
  };
  child.on('error', (e) => onEnd(`failed to spawn: ${e.message}`));
  child.on('exit', (code, signal) => onEnd(`exited (code ${code ?? 'n/a'}, signal ${signal ?? 'none'})`));
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  write(`Stopping all processes (${signal})...`);
  for (const t of timers) clearTimeout(t);
  timers.clear();
  for (const { child } of processes.values()) if (child && !child.killed) {
    try { child.kill('SIGTERM'); } catch {}
  }
  stopTimer = setTimeout(() => {
    for (const { child } of processes.values()) if (child && child.exitCode === null) {
      try { child.kill('SIGKILL'); } catch {}
    }
    process.exit(0);
  }, 5000);
  stopTimer.unref();
  // Active child handles will close after children terminate; this is a safety fallback.
}
process.on('SIGINT', () => shutdown('Ctrl+C'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
for (const spec of entries) if (spec.active) start(spec);
write('All enabled services launched. Keep this terminal open. Ctrl+C stops them.');
