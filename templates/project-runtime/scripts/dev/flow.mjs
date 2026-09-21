import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { chromium, expect } from '@playwright/test';
import { ensureReady, loadProject, writeJSON } from './runtime.mjs';

export async function verifyFlow(name, root) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Flow must be a local flow name');
  const project = await loadProject(root);
  const out = join(project.directory, 'verify', name, `${Date.now()}-${randomUUID()}`);
  await mkdir(out, { recursive: true, mode: 0o700 });
  const result = { flow: name, checked_at: new Date().toISOString(), passed: false, failed_step: 'ensure-ready', url_at_failure: null, artifacts: [], result_path: join(out, 'result.json') };
  let browser, context, page, credentials = {};
  try {
    const ready = await ensureReady(project.root);
    if (ready.unmet.length) throw new Error(ready.unmet.join('; '));
    const flow = parse(await readFile(join(project.root, 'scripts/dev/flows', `${name}.yaml`), 'utf8'));
    if (flow.name !== name || !Array.isArray(flow.steps) || !flow.steps.length) throw new Error('Invalid flow definition');
    const account = project.config.accounts.find(account => account.role === flow.role);
    if (!account || !ready.accounts.some(verified => verified.role === flow.role)) throw new Error('Flow account has no verified login');
    credentials = account.credentials();
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ baseURL: project.config.flowBaseUrl });
    await context.tracing.start({ screenshots: true, snapshots: true });
    page = await context.newPage();
    page.setDefaultTimeout(flow.timeout_ms ?? 5000);
    for (const [index, step] of flow.steps.entries()) {
      result.failed_step = index;
      if (!step || Object.keys(step).length !== 1) throw new Error('Each step must contain exactly one action');
      const [action, value] = Object.entries(step)[0];
      if (action === 'goto') await page.goto(value);
      else if (action === 'fill') {
        const key = /^\$account\.([a-z_]+)$/.exec(value.value)?.[1];
        const input = key ? credentials[key] : value.value;
        if (typeof input !== 'string') throw new Error('Missing account field');
        await page.locator(value.selector).fill(input);
      } else if (action === 'click') await page.locator(value).click();
      else if (action === 'expect_url') await expect.poll(() => new URL(page.url()).pathname, { timeout: flow.timeout_ms ?? 5000 }).toMatch(new RegExp(value));
      else if (action === 'expect_not_visible') await expect(page.locator(value)).toBeHidden({ timeout: flow.timeout_ms ?? 5000 });
      else if (action === 'expect_visible') await expect(page.locator(value)).toBeVisible({ timeout: flow.timeout_ms ?? 5000 });
      else throw new Error(`Unknown flow action: ${action}`);
    }
    result.passed = true; result.failed_step = null;
  } catch (e) {
    let message = e.message;
    for (const value of Object.values(credentials)) if (typeof value === 'string' && value) message = message.replaceAll(value, '[redacted]');
    result.error = message.slice(0, 2000);
    if (page) { const url = new URL(page.url()); result.url_at_failure = `${url.origin}${url.pathname}`; }
  } finally {
    if (page) {
      try { const path = join(out, 'page.png'); await page.screenshot({ path, fullPage: true }); result.artifacts.push(path); }
      catch { result.passed = false; result.artifact_error = 'Screenshot capture failed'; }
    }
    if (context) {
      try { const path = join(out, 'trace.zip'); await context.tracing.stop({ path }); result.artifacts.push(path); }
      catch { result.passed = false; result.artifact_error = 'Trace capture failed'; }
      try { await context.close(); } catch { result.passed = false; result.artifact_error = 'Browser context cleanup failed'; }
    }
    try { await browser?.close(); } catch { result.passed = false; result.artifact_error = 'Browser cleanup failed'; }
    await writeJSON(result.result_path, result);
  }
  return result;
}
