import type { UserEvent, ReplayState } from './types';

// ── Shared State Reference ───────────────────────────────────────────
// These are set by index.ts to share global state
let _replayState: Record<number, ReplayState> = {};

export function setReplayStateRef(ref: Record<number, ReplayState>): void {
    _replayState = ref;
}

// ── Helpers ──────────────────────────────────────────────────────────

export function sendCommand(tabId: number, method: string, params?: Record<string, unknown>, retry = true): Promise<any> {
    return new Promise((resolve) => {
        chrome.debugger.sendCommand({ tabId }, method, params, async (res: any) => {
            if (chrome.runtime.lastError) {
                const msg = chrome.runtime.lastError.message || '';
                if (retry && (msg.includes('not attached') || msg.includes('Detached'))) {
                    console.warn('Debugger detached, re-attaching...', method);
                    chrome.debugger.attach({ tabId }, '1.3', async () => {
                        if (chrome.runtime.lastError) { resolve(null); return; }
                        chrome.debugger.sendCommand({ tabId }, 'Page.enable');
                        chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
                        chrome.debugger.sendCommand({ tabId }, 'DOM.enable');
                        chrome.debugger.sendCommand({ tabId }, 'Network.enable');
                        const r = await sendCommand(tabId, method, params, false);
                        resolve(r);
                    });
                    return;
                }
                resolve(null);
            } else {
                resolve(res);
            }
        });
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// ── Content Script Communication ─────────────────────────────────────

export async function waitForContentScript(tabId: number, maxRetries = 20): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await new Promise<boolean>((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, { action: 'ping' }, (res: unknown) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(true);
                });
            });
            return true;
        } catch {
            await sleep(500);
        }
    }
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
        await sleep(500);
        return true;
    } catch (e) {
        console.warn('Could not inject content script:', e);
        return false;
    }
}

export async function injectReplayWidget(tabId: number, events: UserEvent[]): Promise<void> {
    await waitForContentScript(tabId);
    chrome.tabs.sendMessage(tabId, {
        action: 'replayWidgetInit',
        events,
        tabId
    });
}

async function updateReplayWidgetEvent(tabId: number, index: number, status: string, total: number): Promise<void> {
    chrome.tabs.sendMessage(tabId, {
        action: 'replayWidgetUpdate',
        index,
        status,
        total
    });
}

async function showReplayWidgetFinished(tabId: number, total: number, errorCount: number): Promise<void> {
    chrome.tabs.sendMessage(tabId, {
        action: 'replayWidgetFinished',
        total,
        errorCount
    });
}

function highlightReplayTarget(tabId: number, event: UserEvent, index: number): void {
    chrome.tabs.sendMessage(tabId, {
        action: 'replayHighlightTarget',
        event,
        index
    });
}

function clearReplayHighlight(tabId: number): void {
    chrome.tabs.sendMessage(tabId, {
        action: 'replayHighlightTarget',
        event: null,
        index: 0
    });
}

// ── Execute Replay ───────────────────────────────────────────────────

export async function executeReplay(tabId: number, events: UserEvent[]): Promise<void> {
    try {
        await sendCommand(tabId, 'Page.enable');
        await sendCommand(tabId, 'Runtime.enable');
        await sendCommand(tabId, 'DOM.enable');
        await sendCommand(tabId, 'Network.enable');
    } catch (e) { console.warn('Replay domain enable failed', e); }

    const replayable = events;

    chrome.tabs.sendMessage(tabId, { action: 'replayWidgetStarted' });

    if (replayable.length === 0) {
        await showReplayWidgetFinished(tabId, 0, 0);
        if (_replayState[tabId]) _replayState[tabId].isFinished = true;
        return;
    }

    let isNavigating = false;
    let lastNavTime = 0;
    const navHandler = (source: chrome.debugger.Debuggee, method: string, params?: any) => {
        if (source.tabId === tabId) {
            if (method === 'Page.frameNavigated' && (!params.frame.parentId)) {
                isNavigating = true;
                lastNavTime = Date.now();
            }
            if (method === 'Page.loadEventFired') {
                isNavigating = false;
            }
        }
    };
    chrome.debugger.onEvent.addListener(navHandler);

    replayable.sort((a, b) => a.timestamp - b.timestamp);
    const startTime = replayable[0].timestamp;
    let errorCount = 0;
    let completedCount = 0;
    let handledNavTime = 0;

    for (let i = 0; i < replayable.length; i++) {
        if (_replayState[tabId]?.isCancelled) break;

        const event = replayable[i];
        const prevTime = (i === 0) ? startTime : replayable[i - 1].timestamp;

        let delta: number;
        const state = _replayState[tabId];
        if (state && state.customDelay !== null) {
            delta = state.customDelay;
            if (i === 0) delta = Math.max(delta, 2000);
        } else {
            delta = Math.max(0, event.timestamp - prevTime);
            if (i === 0) delta = 5000;
        }

        const loopStartTime = Date.now();
        let waited = 0;
        const chunkMs = 100;
        let didInitialHighlight = false;

        chrome.tabs.sendMessage(tabId, {
            action: 'replayWidgetCountdown',
            index: i,
            duration: delta
        });

        if (_replayState[tabId]) _replayState[tabId].skipWait = false;

        while (waited < delta) {
            if (_replayState[tabId]?.isCancelled) break;

            if ((isNavigating || lastNavTime > loopStartTime - 1000) && handledNavTime !== lastNavTime) {
                handledNavTime = lastNavTime;

                let navWait = 0;
                while (isNavigating && navWait < 15000) {
                    if (_replayState[tabId]?.isCancelled) break;
                    await sleep(100);
                    navWait += 100;
                }

                isNavigating = false;
                if (_replayState[tabId]?.isCancelled) break;

                let postNavWaited = 0;
                while (postNavWaited < 3000) {
                    if (_replayState[tabId]?.isCancelled) break;
                    if (_replayState[tabId]?.skipWait) break;
                    await sleep(100);
                    postNavWaited += 100;
                }

                if (_replayState[tabId]?.isCancelled) break;

                try {
                    await injectReplayWidget(tabId, replayable);
                    for (let j = 0; j < i; j++) {
                        await updateReplayWidgetEvent(tabId, j, 'done', replayable.length);
                    }
                    chrome.tabs.sendMessage(tabId, { action: 'replayWidgetStarted' });
                } catch (e) { console.warn('Re-inject widget failed', e); }

                if (_replayState[tabId]?.skipWait) {
                    _replayState[tabId].skipWait = false;
                    break;
                }

                waited = 0;
                didInitialHighlight = false;
                chrome.tabs.sendMessage(tabId, {
                    action: 'replayWidgetCountdown',
                    index: i,
                    duration: delta
                });
            }

            if (_replayState[tabId]?.skipWait) {
                _replayState[tabId].skipWait = false;
                break;
            }
            while (_replayState[tabId]?.isPaused) {
                if (_replayState[tabId]!.isCancelled) break;
                await sleep(200);
            }

            const toWait = Math.min(chunkMs, delta - waited);
            await sleep(toWait);
            waited += toWait;

            // Show pulsating highlight early so user can see the target element
            if (!didInitialHighlight && waited >= 300) {
                didInitialHighlight = true;
                highlightReplayTarget(tabId, event, i);
            }
        }

        if (_replayState[tabId]?.isCancelled) break;

        await updateReplayWidgetEvent(tabId, i, 'active', replayable.length);

        try {
            let result: { found: boolean; method?: string; error?: string } | undefined;
            if (event.type === 'click') {
                result = await executeClick(tabId, event);
            } else if (event.type === 'input') {
                result = await executeInput(tabId, event);
            }
            if (result) {
                if (!result.found) throw new Error('Element not found on page');
                if (result.error) throw new Error('Element found but interaction failed: ' + result.error);
            }
            clearReplayHighlight(tabId);
            await updateReplayWidgetEvent(tabId, i, 'done', replayable.length);
            completedCount = i + 1;
        } catch (e) {
            console.warn('Event execution failed', e);
            clearReplayHighlight(tabId);
            errorCount++;
            completedCount = i + 1;
            await updateReplayWidgetEvent(tabId, i, 'error', replayable.length);

            chrome.tabs.sendMessage(tabId, {
                action: 'replayWidgetShowSkipOption',
                index: i,
                total: replayable.length
            });

            if (_replayState[tabId]) {
                _replayState[tabId].skipFailed = false;
                _replayState[tabId].isPaused = true;
            }
            while (_replayState[tabId]?.isPaused) {
                if (_replayState[tabId]!.isCancelled) break;
                if (_replayState[tabId]!.skipFailed) {
                    _replayState[tabId]!.skipFailed = false;
                    _replayState[tabId]!.isPaused = false;
                    break;
                }
                await sleep(200);
            }
        }

        // After executing the event, wait for any triggered navigation to fully load
        // before moving to the next event's countdown timer
        if (isNavigating || lastNavTime > Date.now() - 500) {
            let navWait = 0;
            while (isNavigating && navWait < 15000) {
                if (_replayState[tabId]?.isCancelled) break;
                await sleep(100);
                navWait += 100;
            }
            isNavigating = false;
        }
    }

    chrome.debugger.onEvent.removeListener(navHandler);
    clearReplayHighlight(tabId);

    const wasCancelled = _replayState[tabId]?.isCancelled;

    if (wasCancelled) {
        chrome.tabs.sendMessage(tabId, {
            action: 'replayWidgetCancelled',
            completed: completedCount,
            total: replayable.length
        });
    } else {
        await showReplayWidgetFinished(tabId, replayable.length, errorCount);
    }

    if (_replayState[tabId]) _replayState[tabId].isFinished = true;
    // Don't re-show the recording widget — keep replay popup visible with success/error info
}

// ── Retry Event ──────────────────────────────────────────────────────

export async function replayRetryEvent(tabId: number, event: UserEvent, index: number): Promise<void> {
    const state = _replayState[tabId];
    if (!state) return;

    await updateReplayWidgetEvent(tabId, index, 'active', state.events.length);
    highlightReplayTarget(tabId, event, index);
    await sleep(800);

    try {
        let result: { found: boolean; error?: string } | undefined;
        if (event.type === 'click') {
            result = await executeClick(tabId, event);
        } else if (event.type === 'input') {
            result = await executeInput(tabId, event);
        }
        if (result && !result.found) throw new Error('Element not found on page');

        clearReplayHighlight(tabId);
        await updateReplayWidgetEvent(tabId, index, 'done', state.events.length);

        if (!state.isFinished && state.isPaused) {
            state.skipFailed = true;
        }

        try {
            await sendCommand(tabId, 'Runtime.evaluate', {
                expression: `
          (function() {
            var errors = document.querySelectorAll('.sr-event-row.error');
            var footer = document.getElementById('sr-footer');
            if (errors.length === 0 && footer) {
              footer.textContent = 'All events replayed successfully!';
              footer.className = 'sr-footer success';
              var pf = document.getElementById('sr-progress-fill');
              if (pf) pf.style.background = 'linear-gradient(90deg, #2ea043, #3fb950)';
            } else if (footer) {
              footer.textContent = 'Replay finished with ' + errors.length + ' error(s). Use ↻ to retry.';
              footer.className = 'sr-footer has-errors';
            }
          })()
        `
            });
        } catch { }
    } catch (e) {
        console.warn('Retry failed', e);
        clearReplayHighlight(tabId);
        await updateReplayWidgetEvent(tabId, index, 'error', state.events.length);
    }
}

// ── Setup Replay Environment ─────────────────────────────────────────

export async function setupReplayEnvironment(tabId: number, context: any, url: string): Promise<void> {
    if (!context) return;

    try {
        await sendCommand(tabId, 'Page.enable');
        await sendCommand(tabId, 'Runtime.enable');
        await sendCommand(tabId, 'DOM.enable');
        await sendCommand(tabId, 'Network.enable');
    } catch { }

    // 1. Clear Storage
    try {
        const origin = url ? new URL(url).origin : null;
        const typesToClear: string[] = [];
        if (context.clearLocalSession) typesToClear.push('local_storage');
        if (context.clearCookies) typesToClear.push('cookies');
        if (context.clearIndexedDB) typesToClear.push('indexeddb', 'websql');

        if (origin && typesToClear.length > 0) {
            await sendCommand(tabId, 'Storage.enable');
            await sendCommand(tabId, 'Storage.clearDataForOrigin', {
                origin,
                storageTypes: typesToClear.join(',')
            });
        }

        if (context.clearCookies) {
            await sendCommand(tabId, 'Network.clearBrowserCookies');
        }
        if (context.clearLocalSession) {
            await sendCommand(tabId, 'Runtime.evaluate', {
                expression: 'localStorage.clear(); sessionStorage.clear();'
            });
        }
    } catch (e) {
        console.warn('Clear storage failed', e);
    }

    // 2. Set Cookies
    if (context.cookies) {
        for (const [key, value] of Object.entries(context.cookies)) {
            try {
                await sendCommand(tabId, 'Runtime.evaluate', {
                    expression: `document.cookie = "${key}=${value}; path=/";`
                });
            } catch (e) { console.error('Cookie set failed', e); }
        }
    }

    // 3. Set Local/Session Storage
    if (context.localStorage) {
        for (const [key, value] of Object.entries(context.localStorage)) {
            const val = typeof value === 'string' ? value : JSON.stringify(value);
            try {
                await sendCommand(tabId, 'Runtime.evaluate', {
                    expression: `localStorage.setItem('${key}', '${val.replace(/'/g, "\\'").replace(/\n/g, "\\n")}');`
                });
            } catch (e) { console.error('LocalStorage set failed', e); }
        }
    }
    if (context.sessionStorage) {
        for (const [key, value] of Object.entries(context.sessionStorage)) {
            const val = typeof value === 'string' ? value : JSON.stringify(value);
            try {
                await sendCommand(tabId, 'Runtime.evaluate', {
                    expression: `sessionStorage.setItem('${key}', '${val.replace(/'/g, "\\'").replace(/\n/g, "\\n")}');`
                });
            } catch (e) { console.error('SessionStorage set failed', e); }
        }
    }

    // 4. Pre-flight Requests
    if (context.requests && Array.isArray(context.requests)) {
        for (const req of context.requests) {
            try {
                const safeBody = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
                const fetchExpr = `
          (async function() {
            try {
              const res = await fetch("${req.url}", {
                method: "${req.method || 'GET'}",
                headers: ${JSON.stringify(req.headers || {})},
                body: ${req.method === 'GET' ? 'undefined' : JSON.stringify(safeBody)}
              });
              return { status: res.status };
            } catch (e) { return { error: e.toString() }; }
          })()
        `;
                await sendCommand(tabId, 'Runtime.evaluate', {
                    expression: fetchExpr,
                    awaitPromise: true
                });
            } catch (e) { console.error('Pre-flight request failed', e); }
        }
    }
}

// ── Execute Click ────────────────────────────────────────────────────

async function executeClick(tabId: number, event: UserEvent): Promise<{ found: boolean; method?: string; error?: string }> {
    let found = false;
    let method = 'none';
    const target = event.target || {} as any;
    const selectorPath: any[] = target.selectorPath || [];

    const strategies: Array<{ type: string; value: string; label: string }> = [];

    const interactiveLayer = selectorPath.find((l: any) => l.role_in_path === 'interactiveParent');
    if (interactiveLayer) {
        if (interactiveLayer.selector) strategies.push({ type: 'css', value: interactiveLayer.selector, label: 'interactiveParent.css' });
        if (interactiveLayer.xpath) strategies.push({ type: 'xpath', value: interactiveLayer.xpath, label: 'interactiveParent.xpath' });
    }

    const deepLayer = selectorPath.find((l: any) => l.role_in_path === 'deepTarget');
    if (deepLayer) {
        if (deepLayer.selector) strategies.push({ type: 'css', value: deepLayer.selector, label: 'deepTarget.css' });
        if (deepLayer.xpath) strategies.push({ type: 'xpath', value: deepLayer.xpath, label: 'deepTarget.xpath' });
    }

    if (target.selectors?.length > 0) {
        strategies.push({ type: 'css', value: target.selectors[0], label: 'legacy.css' });
    }
    if (target.xpath) {
        strategies.push({ type: 'xpath', value: target.xpath, label: 'legacy.xpath' });
    }

    const seen = new Set<string>();
    const uniqueStrategies = strategies.filter(s => {
        const key = s.type + ':' + s.value;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    for (const strategy of uniqueStrategies) {
        if (found) break;

        let attempts = 0;
        const maxAttempts = 15;

        while (attempts < maxAttempts) {
            try {
                let expression: string;
                if (strategy.type === 'css') {
                    const safeSel = strategy.value.replace(/\\/g, '\\\\\\\\').replace(/"/g, '\\\\\\"');
                    expression = `(function(){
            var el = document.querySelector("${safeSel}");
            if (el) {
              try {
                el.scrollIntoView({block: 'center', inline: 'center'});
                el.click();
                return { found: true, method: "${strategy.label}" };
              } catch (e) {
                return { found: true, error: e.message || String(e), method: "${strategy.label}" };
              }
            }
            return { found: false };
          })()`;
                } else {
                    const safeXpath = strategy.value.replace(/"/g, '\\\\\\"');
                    expression = `(function(){
            var el = document.evaluate("${safeXpath}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (el) {
              try {
                el.scrollIntoView({block: 'center', inline: 'center'});
                el.click();
                return { found: true, method: "${strategy.label}" };
              } catch (e) {
                return { found: true, error: e.message || String(e), method: "${strategy.label}" };
              }
            }
            return { found: false };
          })()`;
                }

                const res = await sendCommand(tabId, 'Runtime.evaluate', {
                    expression,
                    returnByValue: true
                });

                if (res?.result?.value?.found) {
                    if (res.result.value.error) {
                        return { found: true, method: res.result.value.method, error: res.result.value.error };
                    }
                    found = true;
                    method = res.result.value.method || strategy.label;
                    break;
                }
            } catch { }

            attempts++;
            if (attempts < maxAttempts && uniqueStrategies.indexOf(strategy) === 0) {
                await sleep(200);
            } else {
                break;
            }
        }
    }

    if (!found && uniqueStrategies.length === 0 && event.x !== undefined && event.y !== undefined) {
        try {
            await sendCommand(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: event.x, y: event.y, button: 'left', clickCount: 1 });
            await sleep(50);
            await sendCommand(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: event.x, y: event.y, button: 'left', clickCount: 1 });
            found = true;
            method = 'coordinates';
        } catch { }
    }

    return { found, method };
}

// ── Execute Input ────────────────────────────────────────────────────

async function executeInput(tabId: number, event: UserEvent): Promise<{ found: boolean; error?: string }> {
    const target = event.target || {} as any;
    const selectorPath: any[] = target.selectorPath || [];
    const safeValue = (event.value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

    function buildInputExpression(findExpr: string): string {
        return `(function(){
      var el = ${findExpr};
      if (el) {
        try {
          el.scrollIntoView({block: 'center', inline: 'center'});
          el.focus();
          el.value = "${safeValue}";
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { found: true };
        } catch (e) {
          return { found: true, error: e.message || String(e) };
        }
      }
      return { found: false };
    })()`;
    }

    const strategies: Array<{ type: string; value: string }> = [];

    const deepLayer = selectorPath.find((l: any) => l.role_in_path === 'deepTarget');
    if (deepLayer) {
        if (deepLayer.selector) strategies.push({ type: 'css', value: deepLayer.selector });
        if (deepLayer.xpath) strategies.push({ type: 'xpath', value: deepLayer.xpath });
    }

    if (target.selectors?.length > 0) {
        strategies.push({ type: 'css', value: target.selectors[0] });
    }
    if (target.xpath) {
        strategies.push({ type: 'xpath', value: target.xpath });
    }

    const seen = new Set<string>();
    const uniqueStrategies = strategies.filter(s => {
        const key = s.type + ':' + s.value;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    for (const strategy of uniqueStrategies) {
        let attempts = 0;
        const maxAttempts = 15;

        while (attempts < maxAttempts) {
            try {
                let findExpr: string;
                if (strategy.type === 'css') {
                    const safeSel = strategy.value.replace(/\\/g, '\\\\\\\\').replace(/"/g, '\\\\\\"');
                    findExpr = `document.querySelector("${safeSel}")`;
                } else {
                    const safeXpath = strategy.value.replace(/"/g, '\\\\\\"');
                    findExpr = `document.evaluate("${safeXpath}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
                }

                const res = await sendCommand(tabId, 'Runtime.evaluate', {
                    expression: buildInputExpression(findExpr),
                    returnByValue: true
                });

                if (res?.result?.value?.found) {
                    return res.result.value;
                }
            } catch { }

            attempts++;
            if (attempts < maxAttempts && uniqueStrategies.indexOf(strategy) === 0) {
                await sleep(200);
            } else {
                break;
            }
        }
    }

    return { found: false };
}
