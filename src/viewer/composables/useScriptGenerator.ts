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

    // ── Source Resolution Helpers ──
    interface SourceLocation {
        file?: string;
        line?: number;
        column?: number;
        functionName?: string;
        resolved: boolean;
        method: 'sourcemap' | 'bundler_comment' | 'raw';
    }

    const parseStackFrame = (frame: any): SourceLocation | null => {
        if (!frame) return null;

        // CDP stack frame format
        if (frame.url && frame.lineNumber !== undefined) {
            return {
                file: frame.url,
                line: frame.lineNumber,
                column: frame.columnNumber,
                functionName: frame.functionName || undefined,
                resolved: false,
                method: 'raw'
            };
        }

        // String format: "at functionName (url:line:col)" or "url:line:col"
        if (typeof frame === 'string') {
            const match = frame.match(/(?:at\s+([^\s]+)\s+\()?([^:]+):(\d+):(\d+)\)?/);
            if (match) {
                return {
                    functionName: match[1] || undefined,
                    file: match[2],
                    line: parseInt(match[3], 10),
                    column: parseInt(match[4], 10),
                    resolved: false,
                    method: 'raw'
                };
            }
        }

        return null;
    };

    const formatSourceLocation = (loc: SourceLocation): string => {
        if (!loc.file) return 'unknown';

        const fileName = loc.file.split('/').pop() || loc.file;
        const position = loc.line !== undefined ? `:${loc.line}` : '';
        const func = loc.functionName ? ` (${loc.functionName})` : '';

        return `${fileName}${position}${func}`;
    };

    const parseInitiator = (initiator: any): SourceLocation | null => {
        if (!initiator) return null;

        // CDP initiator format
        if (initiator.type === 'script' && initiator.stack) {
            const topFrame = initiator.stack.callFrames?.[0];
            if (topFrame) {
                return parseStackFrame(topFrame);
            }
        }

        if (initiator.url && initiator.lineNumber !== undefined) {
            return {
                file: initiator.url,
                line: initiator.lineNumber,
                column: initiator.columnNumber,
                resolved: false,
                method: 'raw'
            };
        }

        return null;
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

    // Source Resolution Status
    md += `## Source Resolution\n\n`;
    md += `**Error locations and network initiators** are extracted from stack traces and Chrome DevTools Protocol data.\n\n`;

    // Check if we have bundled/minified scripts
    const hasBundledScripts = consoleErrors.some((e: any) => {
        const url = e.url || e.stackTrace?.callFrames?.[0]?.url || '';
        return url.includes('.min.') || url.includes('bundle');
    });

    if (hasBundledScripts) {
        md += `⚠️ **Note:** The website uses bundled/minified JavaScript. Error locations and initiators shown below refer to:\n`;
        md += `- **Bundled code positions** (e.g., \`bundle.js:142:18\`) - not the original source\n`;
        md += `- **Original source locations** may differ significantly\n`;
        md += `- If the site provides **sourcemaps**, they would resolve to actual source files (e.g., \`src/api/client.ts:45\`)\n`;
        md += `- Without sourcemaps, treat file/line references as **approximate indicators** of which bundle contains the error\n\n`;
    } else {
        md += `✓ The website appears to use non-minified scripts. File and line numbers should be accurate.\n\n`;
    }

    // Bug classification
    md += `## Bug Classification (pre-analyzed)\n\n`;
    md += '```json\n' + JSON.stringify(classification, null, 2) + '\n```\n\n';

    // User-reported issues (PRIORITY - show these first!)
    if (issues.length > 0) {
        md += `## ⚠️ User-Reported Issues\n\n`;
        md += `**IMPORTANT:** The user explicitly reported ${issues.length} issue${issues.length > 1 ? 's' : ''} during this session.\n`;
        md += `These issues include exact DOM element identification, screenshots, and state descriptions.\n\n`;

        issues.forEach((issue: any, idx: number) => {
            const time = new Date(issue.timestamp).toLocaleTimeString();
            const actionIdx = findClosestActionIndex(issue.timestamp);

            md += `### Issue #${idx + 1} - [${time}] (after step ${actionIdx})\n\n`;

            // Current vs Expected State
            if (issue.currentState || issue.desiredState) {
                md += `**Problem Description:**\n`;
                if (issue.currentState) {
                    md += `- **Current State:** ${issue.currentState}\n`;
                }
                if (issue.desiredState) {
                    md += `- **Expected State:** ${issue.desiredState}\n`;
                }
                md += '\n';
            }

            // Additional notes
            if (issue.comment) {
                md += `**Additional Notes:** ${issue.comment}\n\n`;
            }

            // Legacy format fallback
            if (!issue.currentState && !issue.desiredState && (issue.description || issue.text || issue.message)) {
                md += `**Comment:** ${issue.description || issue.text || issue.message}\n\n`;
            }

            // Resolved DOM Elements
            if (issue.primaryElement) {
                md += `**Identified DOM Element:**\n`;
                md += '```html\n';
                md += `<!-- Primary element (confidence: ${issue.primaryElement.score.toFixed(1)}) -->\n`;
                md += `<${issue.primaryElement.tagName}`;

                // Add data attributes
                const dataAttrs = issue.primaryElement.dataAttributes || {};
                Object.entries(dataAttrs).forEach(([key, val]) => {
                    md += ` ${key}="${val}"`;
                });
                md += '>\n';

                if (issue.primaryElement.textContent) {
                    md += `  ${truncate(issue.primaryElement.textContent, 100)}\n`;
                }
                md += `</${issue.primaryElement.tagName}>\n`;
                md += '```\n\n';

                md += `**Selector:** \`${issue.primaryElement.selector}\`\n`;
                md += `**Position:** x=${issue.primaryElement.boundingBox?.x}, y=${issue.primaryElement.boundingBox?.y}, `;
                md += `${issue.primaryElement.boundingBox?.width}×${issue.primaryElement.boundingBox?.height}px\n\n`;
            }

            // Additional elements
            if (issue.resolvedElements && issue.resolvedElements.length > 1) {
                md += `**Additional Elements Identified (${issue.resolvedElements.length - 1}):**\n`;
                issue.resolvedElements.slice(1, 4).forEach((el: any) => {
                    md += `- \`<${el.tagName}>\` - ${el.selector} (score: ${el.score.toFixed(1)})\n`;
                });
                if (issue.resolvedElements.length > 4) {
                    md += `- ... and ${issue.resolvedElements.length - 4} more\n`;
                }
                md += '\n';
            }

            // Selected text
            if (issue.selectedText) {
                md += `**User Selected Text:** "${issue.selectedText}"\n\n`;
            }

            // Screenshot reference
            if (issue.rect) {
                md += `**Screenshot Area:** Highlighted region at (${Math.round(issue.rect.x)}, ${Math.round(issue.rect.y)}), `;
                md += `${Math.round(issue.rect.width)}×${Math.round(issue.rect.height)}px\n`;
                md += `*Screenshot included in screencast frames near timestamp ${issue.timestamp}*\n\n`;
            }

            // URL context
            if (issue.url) {
                md += `**Page URL:** ${issue.url}\n\n`;
            }

            md += '---\n\n';
        });
    }

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
    md += '\n';

    // Console events with full traces (same-domain only)
    md += `## Console Events (errors & warnings, with stack traces)\n\n`;
    const getLogUrl = (e: any) => e.url || e.stackTrace?.callFrames?.[0]?.url || '';

    const relevantLogs = consoleErrors.filter((l: any) => {
        if (l.level !== 'error' && l.level !== 'warning') return false;
        const txt = l.text || l.message || '';

        // Filter out network errors that are blocked/aborted
        if (txt.includes('net::ERR_ABORTED') || txt.includes('net::ERR_BLOCKED_BY_CLIENT')) return false;

        // Filter logs by domain - only keep same-site logs
        const u = getLogUrl(l);
        if (u && !isSameSite(u)) return false; // 3rd party domain, exclude

        // For logs without URL, check if text contains 3rd party URLs
        if (!u && txt) {
            const match = txt.match(/https?:\/\/[^\s'"]+/);
            if (match && !isSameSite(match[0])) return false; // 3rd party URL in message, exclude
        }

        return true;
    });

    if (relevantLogs.length > 0) {
        md += `### Application errors (${relevantLogs.length})\n\n`;
        for (const e of relevantLogs) {
                const ts = e.timestamp || 0;
                const actionIdx = findClosestActionIndex(ts);
                const source = e.source || (e.stackTrace?.callFrames?.[0]?.url ? 'script' : 'runtime');

                // Parse error location from stack trace
                let errorLocation: SourceLocation | null = null;
                if (e.stackTrace?.callFrames?.[0]) {
                    errorLocation = parseStackFrame(e.stackTrace.callFrames[0]);
                }

                md += `#### [${(e.level || 'ERROR').toUpperCase()}] ${truncate(e.text || e.message || '', 200)}\n`;
                md += `- **Source:** ${source}\n`;
                md += `- **Timestamp:** ${ts ? new Date(ts).toLocaleTimeString() : 'unknown'}\n`;
                md += `- **After action:** step ${actionIdx}\n`;
                if (e.url) md += `- **URL:** ${e.url}\n`;

                // Add resolved error location
                if (errorLocation) {
                    const fileName = errorLocation.file ? errorLocation.file.split('/').pop() : 'unknown';
                    const loc = errorLocation.line !== undefined
                        ? `${fileName}:${errorLocation.line}:${errorLocation.column || 0}`
                        : fileName;

                    // Make function name prominent
                    if (errorLocation.functionName) {
                        md += `- **Error in function:** \`${errorLocation.functionName}()\` at \`${loc}\`\n`;
                    } else {
                        md += `- **Error location:** \`${loc}\`\n`;
                    }

                    // Note if using bundled code
                    if (errorLocation.file && (errorLocation.file.includes('.min.') || errorLocation.file.includes('bundle'))) {
                        md += `- **Note:** Error in bundled/minified script. Original source location may differ if sourcemaps are available.\n`;
                    }
                }

                if (e.stackTrace?.callFrames?.length) {
                    md += '- **Stack trace:**\n```\n';
                    e.stackTrace.callFrames.slice(0, 8).forEach((f: any, idx: number) => {
                        const funcName = f.functionName || '(anonymous)';
                        const fileName = f.url ? f.url.split('/').pop() : 'unknown';
                        const location = `${fileName}:${f.lineNumber}:${f.columnNumber || 0}`;

                        // Show function name prominently with location
                        if (idx === 0) {
                            md += `  → ${funcName}() at ${location}\n`;
                        } else {
                            md += `    at ${funcName}() [${location}]\n`;
                        }
                    });
                    md += '```\n';
                }
                md += '\n';
            }
    } else {
        md += '(No console errors or warnings)\n\n';
    }

    // Network failures (summary only, no bodies)
    md += `## Network Failures\n\n`;

    if (failedRequests.length > 0) {
        md += `### Failed Requests (${failedRequests.length})\n\n`;
        for (const r of failedRequests) {
            const reqTs = r.startedDateTime ? new Date(r.startedDateTime).getTime() : 0;
            const actionIdx = findClosestActionIndex(reqTs);
            md += `- **${r.response?.status}** ${r.request?.method || 'GET'} \`${r.request?.url}\`\n`;
            md += `  - After step ${actionIdx}, took ${r.time ? Math.round(r.time) + 'ms' : '?'}\n`;

            // Parse and display initiator
            const initiatorLoc = parseInitiator(r._initiator);
            if (initiatorLoc) {
                const fileName = initiatorLoc.file ? initiatorLoc.file.split('/').pop() : 'unknown';
                const loc = initiatorLoc.line !== undefined
                    ? `${fileName}:${initiatorLoc.line}:${initiatorLoc.column || 0}`
                    : fileName;
                const func = initiatorLoc.functionName ? ` in ${initiatorLoc.functionName}()` : '';
                md += `  - Initiated by: \`${loc}\`${func}\n`;

                // Note if using bundled code
                if (initiatorLoc.file && (initiatorLoc.file.includes('.min.') || initiatorLoc.file.includes('bundle'))) {
                    md += `  - Note: Initiator in bundled/minified script\n`;
                }
            }

            // Only include content-type if present
            const contentType = (r.request?.headers || []).find((h: any) => h.name.toLowerCase() === 'content-type');
            if (contentType) {
                md += `  - Content-Type: ${contentType.value}\n`;
            }
            md += '\n';
        }
    } else {
        md += '(No failed requests)\n\n';
    }

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
