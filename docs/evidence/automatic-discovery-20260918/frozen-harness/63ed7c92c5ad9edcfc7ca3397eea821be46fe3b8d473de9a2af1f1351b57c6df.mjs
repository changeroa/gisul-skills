import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';

// Values become argv entries, never shell command strings.
export function toml(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return '[' + value.map(toml).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).map(([key, v]) => JSON.stringify(key) + '=' + toml(v)).join(',') + '}';
  throw new Error('Unsupported TOML override');
}

export class CodexSession extends EventEmitter {
  constructor({ cwd, config = {}, record = () => {} }) {
    super();
    this.nextId = 0;
    this.pending = new Map();
    this.record = record;
    this.events = [];
    this.stderr = '';
    this.permissionProfile = config['permissions.discovery'] ? 'discovery' : null;
    const args = ['app-server', '--stdio'];
    for (const [key, value] of Object.entries(config)) args.push('-c', key + '=' + toml(value));
    this.child = spawn('codex', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    this.child.stderr.on('data', bytes => { this.stderr = (this.stderr + bytes.toString()).slice(-24000); });
    this.child.on('error', error => this.rejectPending(error));
    this.child.on('exit', (code, signal) => {
      this.rejectPending(new Error('Codex app-server exited: ' + code + '/' + signal));
      this.emit('closed', { code, signal });
    });
    createInterface({ input: this.child.stdout }).on('line', line => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else if (message.id !== undefined && message.method) {
        // Evaluations cannot answer interactive approvals or grant new scope.
        this.child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Interactive requests unavailable in isolated evaluation' } }) + '\n');
        this.observe({ method: 'evaluation/interactiveRequestRejected', params: { method: message.method } });
      } else if (message.method) this.observe(message);
    });
  }
  observe(message) {
    const event = { observedAt: new Date().toISOString(), ...message };
    this.events.push(event);
    this.record(event);
    this.emit('notification', event);
  }
  rejectPending(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
  rpc(method, params = {}, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(method + ' timeout')); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  async initialize() {
    const result = await this.rpc('initialize', { clientInfo: { name: 'gisul-discovery-runner', version: '1' }, capabilities: { experimentalApi: true } });
    this.child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
    return result;
  }
  async start(cwd, extras = {}) {
    const policy = this.permissionProfile ? { permissions: this.permissionProfile } : { sandbox: 'workspace-write' };
    const result = await this.rpc('thread/start', { cwd, ephemeral: true, approvalPolicy: 'never', ...policy, ...extras });
    this.threadId = result.thread.id;
    return result;
  }
  async turn(prompt, { timeoutMs = 240000, ...params } = {}) {
    const startIndex = this.events.length;
    let timer, onEvent, onClose;
    const done = new Promise((resolve, reject) => {
      onEvent = event => {
        if (event.method === 'turn/completed' && event.params?.threadId === this.threadId) resolve(event.params);
      };
      onClose = event => reject(new Error('Server closed during turn: ' + JSON.stringify(event)));
      timer = setTimeout(async () => {
        try { if (this.activeTurnId) await this.rpc('turn/interrupt', { threadId: this.threadId, turnId: this.activeTurnId }, 10000); } catch {}
        reject(new Error('Model turn exceeded ' + timeoutMs + ' ms'));
      }, timeoutMs);
      this.on('notification', onEvent);
      this.once('closed', onClose);
    });
    // Attach the rejection handler before waiting for the start RPC.
    done.catch(() => {});
    try {
      const started = await this.rpc('turn/start', { threadId: this.threadId, input: [{ type: 'text', text: prompt }], ...params });
      this.activeTurnId = started.turn.id;
      const completed = await done;
      return { ...completed, events: this.events.slice(startIndex) };
    } finally {
      clearTimeout(timer);
      this.off('notification', onEvent);
      this.off('closed', onClose);
      this.activeTurnId = null;
    }
  }
  async close() {
    this.rejectPending(new Error('Session closing'));
    this.child.stdin.end();
    if (this.child.exitCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => { this.child.kill('SIGTERM'); resolve(); }, 1500);
      this.child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
}
