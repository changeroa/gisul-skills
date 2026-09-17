import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// Uses the user's installed connector. No model turn, token export, or direct OAuth access.
export class CodexLinear {
  constructor(command, cwd) {
    this.cwd = cwd; this.nextId = 0; this.pending = new Map();
    this.child = spawn(command, ['app-server', '--stdio'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stderr.resume();
    this.child.on('error', error => this.rejectPending(error));
    this.child.on('exit', () => this.rejectPending(new Error('Codex app-server exited')));
    createInterface({ input: this.child.stdout }).on('line', line => {
      let message; try { message = JSON.parse(line); } catch { return; }
      const pending = this.pending.get(message.id);
      if (pending) {
        clearTimeout(pending.timer); this.pending.delete(message.id);
        message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
      } else if (message.id !== undefined && message.method) {
        this.child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'No interactive actions in completion job' } }) + '\n');
      }
    });
  }
  rejectPending(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
  rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timeout`)); }, 90000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  async start() {
    await this.rpc('initialize', { clientInfo: { name: 'dev-tools-mvp-completion', version: '1' }, capabilities: { experimentalApi: true } });
    this.child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
    const thread = await this.rpc('thread/start', { cwd: this.cwd, ephemeral: true });
    this.threadId = thread.thread.id;
    let cursor, connector;
    do {
      const page = await this.rpc('mcpServerStatus/list', { threadId: this.threadId, limit: 100, ...(cursor ? { cursor } : {}) });
      connector ??= page.data.find(server => server.name === 'codex_apps'); cursor = page.nextCursor;
    } while (cursor);
    if (!connector) throw new Error('Installed app connector is unavailable');
    return this;
  }
  async call(tool, args) {
    const result = await this.rpc('mcpServer/tool/call', { threadId: this.threadId, server: 'codex_apps', tool: `linear.${tool}`, arguments: args });
    if (result.isError) throw new Error(`Linear ${tool}: ${JSON.stringify(result.content)}`);
    const content = result.content?.filter(item => item.type === 'text').map(item => item.text).join('\n');
    if (!content) throw new Error(`Linear ${tool} returned no text result`);
    return JSON.parse(content);
  }
  async close() {
    this.rejectPending(new Error('Completion client closing')); this.child.stdin.end();
    if (this.child.exitCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => { this.child.kill('SIGTERM'); resolve(); }, 1000);
      this.child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
}
