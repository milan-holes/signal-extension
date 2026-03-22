/**
 * Utility functions for generating scripts and LLM context from report data
 */

function esc(s: any): string {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/`/g, '\\`');
}

export function generatePlaywrightScript(data: any): string {
    const events = [...(data.userEvents || [])].sort((a: any, b: any) => a.timestamp - b.timestamp);

    let script = `const { chromium } = require('playwright');\n\n(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'en-US'
  });
  const page = await context.newPage();\n\n`;

    for (const e of events) {
        const t = e.target || {};
        const loc = bestLocator(t);
        if (e.type === 'navigation') {
            script += `  await page.goto('${esc(e.url)}');\n  await page.waitForLoadState('networkidle');\n\n`;
        } else if (e.type === 'click') {
            if (loc.type === 'xpath') script += `  await page.locator('xpath=${esc(loc.sel)}').click();\n`;
            else script += `  await page.locator('${esc(loc.sel)}').click();\n`;
        } else if (e.type === 'input') {
            if (loc.type === 'xpath') script += `  await page.locator('xpath=${esc(loc.sel)}').fill('${esc(e.value)}');\n`;
            else script += `  await page.locator('${esc(loc.sel)}').fill('${esc(e.value)}');\n`;
        } else if (e.type === 'keydown') {
            script += `  await page.keyboard.press('${esc(e.key)}');\n`;
        }
    }

    script += `\n  await browser.close();\n})();\n`;
    return script;
}

export function generatePuppeteerScript(data: any): string {
    const events = [...(data.userEvents || [])].sort((a: any, b: any) => a.timestamp - b.timestamp);

    let script = `const puppeteer = require('puppeteer');\n\n(async () => {\n  const browser = await puppeteer.launch({ headless: false });\n  const page = await browser.newPage();\n\n`;
    script += `  async function clickXPath(xpath) {
    try {
      await page.waitForXPath(xpath, { timeout: 5000 });
      const [element] = await page.$x(xpath);
      if (element) await element.click();
    } catch (e) { console.warn(\`Could not click: \${xpath}\`); }
  }\n\n`;

    for (const e of events) {
        const t = e.target || {};
        const loc = bestLocator(t);
        if (e.type === 'navigation') {
            script += `  await page.goto('${esc(e.url)}', { waitUntil: 'networkidle0' });\n\n`;
        } else if (e.type === 'click') {
            if (loc.type === 'xpath') script += `  await clickXPath('${esc(loc.sel)}');\n`;
            else script += `  await page.click('${esc(loc.sel)}');\n`;
        } else if (e.type === 'input') {
            if (loc.type === 'xpath') {
                script += `  { const [el] = await page.$x('${esc(loc.sel)}'); if(el) await el.type('${esc(e.value)}'); }\n`;
            } else {
                script += `  await page.type('${esc(loc.sel)}', '${esc(e.value)}');\n`;
            }
        } else if (e.type === 'keydown') {
            script += `  await page.keyboard.press('${esc(e.key)}');\n`;
        }
    }

    script += `\n  await browser.close();\n})();\n`;
    return script;
}

export function generateLLMContext(data: any): string {
    const events = [...(data.userEvents || [])].sort((a: any, b: any) => a.timestamp - b.timestamp);
    const firstNav = events.find((e: any) => e.type === 'navigation');
    const startUrl = firstNav?.url || data.environment?.url || 'unknown';
    const rawEntries = data.har?.log?.entries || data.har?.entries || [];
    const consoleErrors = data.consoleErrors || [];
    const issues = data.issues || [];
    const env = data.environment || {};
    const storage = data.storage || {};

    // ── Domain helpers ──
    const getHostname = (url: string): string => {
        try { return new URL(url).hostname; } catch { return ''; }
    };
    const getRootDomain = (hostname: string): string => {
        const parts = hostname.split('.');
        return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
    };
    const siteRoot = getRootDomain(getHostname(startUrl));
    const isSameSite = (url: string): boolean => {
        const h = getHostname(url);
        return h ? getRootDomain(h) === siteRoot : false;
    };
    const entries = rawEntries.filter((r: any) => isSameSite(r.request?.url || ''));

    // ── Helpers ──
    const truncate = (s: string | undefined, max: number): string => {
        if (!s) return '';
        return s.length > max ? s.substring(0, max) + '...[truncated]' : s;
    };

    const findClosestActionIndex = (ts: number): number => {
        let closest = -1, minDiff = Infinity;
        events.forEach((e: any, i: number) => {
            const diff = ts - e.timestamp;
            if (diff >= 0 && diff < minDiff) { minDiff = diff; closest = i; }
        });
        return closest;
    };

    // ── Pre-classify bug type ──
    const errorLogs = consoleErrors.filter((l: any) => l.level === 'error');
    const failedRequests = entries.filter((r: any) => r.response && (r.response.status >= 400 || r.response.status === 0));
    const authFailures = failedRequests.filter((r: any) => r.response?.status === 401 || r.response?.status === 403);

    let bugType = 'unknown';
    let severity = 'medium';
    if (authFailures.length > 0) { bugType = 'auth_failure'; severity = 'high'; }
    else if (failedRequests.length > 0) { bugType = 'network_error'; severity = failedRequests.some((r: any) => r.response?.status >= 500) ? 'critical' : 'high'; }
    else if (errorLogs.length > 0) { bugType = 'runtime_error'; severity = 'high'; }
    else if (issues.length > 0) { bugType = 'user_reported'; severity = 'medium'; }

    const classification = {
        type: bugType,
        severity,
        reproducible: true,
        reproduction_steps_count: events.length,
        console_error_count: errorLogs.length,
        failed_request_count: failedRequests.length,
        user_reported_issues: issues.length
    };

    // ── Build output ──
    let md = '';

    // System prompt
    md += `You are a software debugging agent for a web application.\n`;
    md += `You have access to a structured bug report captured automatically during a user session.\n\n`;
    md += `Your job:\n`;
    md += `1. Classify the bug type (network / storage / UI / auth / unknown)\n`;
    md += `2. Identify the most likely root cause with confidence score (0–1)\n`;
    md += `3. List 2–3 alternative hypotheses in order of likelihood\n`;
    md += `4. Propose specific code fixes as unified diffs or pseudocode\n`;
    md += `5. Identify what additional data would confirm/rule out each hypothesis\n\n`;
    md += `Output as JSON matching this schema:\n`;
    md += '```json\n';
    md += `{\n`;
    md += `  "title": "...",\n`;
    md += `  "classification": "...",\n`;
    md += `  "root_cause": { "description": "...", "confidence": 0.0, "location": "file:line" },\n`;
    md += `  "hypotheses": [{ "description": "...", "confidence": 0.0 }],\n`;
    md += `  "fixes": [{ "description": "...", "code": "..." }],\n`;
    md += `  "needs_more_data": ["..."]\n`;
    md += `}\n`;
    md += '```\n\n---\n\n';

    // Header
    md += `# Bug Report\n\n`;
    md += `**Starting URL:** ${startUrl}\n`;
    md += `**Captured at:** ${new Date().toISOString()}\n`;
    md += `**Session events:** ${events.length} user actions, ${consoleErrors.length} console entries, ${entries.length} network requests\n\n`;

    // Environment
    md += `## Environment\n\n`;
    if (env.userAgent) md += `- **Browser:** ${env.userAgent}\n`;
    if (env.windowSize) md += `- **Viewport:** ${env.windowSize} (${env.devicePixelRatio || 1}x)\n`;
    if (env.platform) md += `- **Platform:** ${env.platform}\n`;
    if (env.language) md += `- **Language:** ${env.language}\n`;
    md += '\n';

    // Bug classification
    md += `## Bug Classification (pre-analyzed)\n\n`;
    md += '```json\n' + JSON.stringify(classification, null, 2) + '\n```\n\n';

    // Reproduction steps
    md += `## Reproduction Steps\n\n`;
    if (events.length > 0) {
        events.forEach((e: any, i: number) => {
            const time = new Date(e.timestamp).toLocaleTimeString();
            const t = e.target || {};
            const sel = t.selectors?.[0] || (t.id ? '#' + t.id : t.tagName || 'element');
            if (e.type === 'navigation') md += `${i}. [${time}] **navigate** → \`${e.url}\`\n`;
            else if (e.type === 'click') md += `${i}. [${time}] **click** \`${sel}\`${t.innerText ? ` ("${t.innerText.substring(0, 60)}")` : ''}\n`;
            else if (e.type === 'input') md += `${i}. [${time}] **input** \`${sel}\` = \`${e.value}\`\n`;
            else if (e.type === 'keydown') md += `${i}. [${time}] **keypress** \`${e.key}\`\n`;
            else md += `${i}. [${time}] **${e.type}**\n`;
        });
    } else md += '(No user actions recorded)\n';

    // User-reported issues
    if (issues.length > 0) {
        md += '\n### User-Reported Issues\n\n';
        for (const issue of issues) {
            const time = new Date(issue.timestamp).toLocaleTimeString();
            const actionIdx = findClosestActionIndex(issue.timestamp);
            md += `- [${time}] (after step ${actionIdx}) "${issue.comment || 'No comment'}"\n`;
        }
    }
    md += '\n';

    // Console events with full traces
    md += `## Console Events (errors & warnings, with stack traces)\n\n`;
    const relevantLogs = consoleErrors.filter((l: any) => {
        if (l.level !== 'error' && l.level !== 'warning') return false;
        const txt = l.text || l.message || '';
        if (txt.includes('net::ERR_ABORTED') || txt.includes('net::ERR_BLOCKED_BY_CLIENT')) return false;
        return true;
    });
    
    if (relevantLogs.length > 0) {
        const getLogUrl = (e: any) => e.url || e.stackTrace?.callFrames?.[0]?.url || '';
        const sameSiteLogs = relevantLogs.filter((l: any) => {
            const u = getLogUrl(l);
            // Treat empty URL as 1st party. If it's a security/CSP violation, try to infer from the text.
            if (!u && l.text) {
                // simple heuristic for CSP errors containing urls
                const match = l.text.match(/https?:\/\/[^\s']+/);
                if (match && !isSameSite(match[0])) return false;
            }
            return !u || isSameSite(u);
        });


        if (sameSiteLogs.length > 0) {
            md += `### Same-domain logs (${sameSiteLogs.length})\n\n`;
            for (const e of sameSiteLogs) {
                const ts = e.timestamp || 0;
                const actionIdx = findClosestActionIndex(ts);
                const source = e.source || (e.stackTrace?.callFrames?.[0]?.url ? 'script' : 'runtime');
                const initiator = e.stackTrace?.callFrames?.[0] ? `${e.stackTrace.callFrames[0].url}:${e.stackTrace.callFrames[0].lineNumber}` : '';

                md += `#### [${(e.level || 'ERROR').toUpperCase()}] ${truncate(e.text || e.message || '', 200)}\n`;
                md += `- **Source:** ${source}\n`;
                md += `- **Timestamp:** ${ts ? new Date(ts).toLocaleTimeString() : 'unknown'}\n`;
                md += `- **After action:** step ${actionIdx}\n`;
                if (e.url) md += `- **URL:** ${e.url}\n`;
                if (initiator) md += `- **Initiator:** \`${initiator}\`\n`;

                if (e.stackTrace?.callFrames?.length) {
                    md += '```\n';
                    e.stackTrace.callFrames.slice(0, 8).forEach((f: any) => {
                        md += `  at ${f.functionName || '(anonymous)'} (${f.url}:${f.lineNumber}:${f.columnNumber || 0})\n`;
                    });
                    md += '```\n';
                }
                md += '\n';
            }
        } else md += '(No relevant same-domain console errors)\n\n';
    } else md += '(No console errors or warnings)\n\n';

    // Network failures with request/response bodies
    md += `## Network Failures (with request/response bodies)\n\n`;

    if (failedRequests.length > 0) {
        md += `### Failed Requests (${failedRequests.length})\n\n`;
        for (const r of failedRequests) {
                const reqTs = r.startedDateTime ? new Date(r.startedDateTime).getTime() : 0;
                const actionIdx = findClosestActionIndex(reqTs);
                md += `#### ${r.response?.status} ${r.request?.method || 'GET'} \`${r.request?.url}\`\n`;
                md += `- **After action:** step ${actionIdx}\n`;
                md += `- **Duration:** ${r.time ? Math.round(r.time) + 'ms' : 'unknown'}\n`;

                // Request headers (interesting ones)
                const interestingHeaders = ['content-type', 'authorization', 'accept', 'x-requested-with', 'origin', 'referer'];
                const reqHeaders = (r.request?.headers || []).filter((h: any) => interestingHeaders.includes(h.name.toLowerCase()));
                if (reqHeaders.length > 0) {
                    md += '- **Request headers:**\n';
                    reqHeaders.forEach((h: any) => { md += `  - \`${h.name}: ${truncate(h.value, 100)}\`\n`; });
                }

                // Request body
                if (r.request?.postData?.text) {
                    md += `- **Request body:**\n\`\`\`\n${truncate(r.request.postData.text, 2048)}\n\`\`\`\n`;
                }

                // Response body
                if (r.response?.content?.text) {
                    md += `- **Response body:**\n\`\`\`\n${truncate(r.response.content.text, 2048)}\n\`\`\`\n`;
                }
                md += '\n';
            }
    } else md += '(No failed requests)\n\n';

    md += '\n';
    return md;
}

function bestLocator(t: any): { type: string; sel: string } {
    if (!t) return { type: 'css', sel: 'body' };
    if (t.testAttr) return { type: 'css', sel: t.testAttr.selector };
    if (t.id) return { type: 'css', sel: '#' + t.id };
    if (t.xpath) return { type: 'xpath', sel: t.xpath };
    if (t.selectors?.length > 0) return { type: 'css', sel: t.selectors[0] };
    return { type: 'css', sel: (t.tagName || 'div').toLowerCase() };
}
