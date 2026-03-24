// Signal Extension - Background Service Worker (TypeScript)
// Entry point — message router, debugger events, tab management
import type { TabData, Settings, ReplayState } from './types';
import { generateReport } from './report';
import {
    setReplayStateRef,
    sendCommand,
    waitForContentScript,
    injectReplayWidget,
    executeReplay,
    replayRetryEvent,
    setupReplayEnvironment,
} from './replay';

// ── Global State ─────────────────────────────────────────────────────

const attachedTabs: Record<number, TabData> = {};
let settings: Settings = {
    autoRecord: false,
    domains: [],
    bufferMinutes: 2
};
const stoppedTabs = new Set<number>();
const replayState: Record<number, ReplayState> = {};

// Share replay state reference with replay module
setReplayStateRef(replayState);

// ── Settings ─────────────────────────────────────────────────────────

chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) settings = result.settings as Settings;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
        settings = changes.settings.newValue as Settings;
    }
});

// ── Tab Updated ──────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        stoppedTabs.delete(tabId);
    }

    if (changeInfo.status === 'complete') {
        if (stoppedTabs.has(tabId)) return;

        chrome.storage.local.get(['settings'], (result) => {
            const currentSettings = (result.settings as Settings) || { autoRecord: false, domains: [] };
            settings = currentSettings;

            const shouldAutoRecord = currentSettings.autoRecord && tab.url && (currentSettings.domains || []).some((d: string) => {
                try { return new URL(tab.url!).hostname.includes(d); } catch { return false; }
            });

            if (attachedTabs[tabId]) {
                if (attachedTabs[tabId].isRecording) {
                    if (attachedTabs[tabId].mode === 'buffer' && !shouldAutoRecord) {
                        chrome.debugger.detach({ tabId });
                        chrome.tabs.sendMessage(tabId, { action: 'hideOverlay' });
                        return;
                    }
                    chrome.tabs.sendMessage(tabId, {
                        action: 'showOverlay',
                        mode: attachedTabs[tabId].mode
                    });
                } else if (shouldAutoRecord) {
                    startRecording(tabId, 'buffer', true);
                }
            } else if (shouldAutoRecord) {
                startRecording(tabId, 'buffer');
            }
        });
    }
});

// ── Recording ────────────────────────────────────────────────────────

function startRecording(
    tabId: number,
    mode: 'standard' | 'buffer' = 'standard',
    keepData = false,
    callback: ((result: { status: string; message?: string }) => void) | null = null,
    environment: any = null,
    storage: any = null
): void {
    chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            if (callback) callback({ status: 'error', message: chrome.runtime.lastError.message });
            return;
        }

        const existingData = (keepData && attachedTabs[tabId]) ? attachedTabs[tabId] : {} as Partial<TabData>;

        attachedTabs[tabId] = {
            mode,
            isRecording: true,
            logs: keepData ? (existingData.logs || []) : [],
            network: keepData ? (existingData.network || {}) : {},
            userEvents: keepData ? (existingData.userEvents || []) : [],
            screencast: keepData ? (existingData.screencast || []) : [],
            issues: keepData ? (existingData.issues || []) : [],
            contentChanges: keepData ? (existingData.contentChanges || []) : [],
            environment: environment || (keepData ? existingData.environment : null),
            storage: storage || (keepData ? existingData.storage : null),
            startTime: keepData ? (existingData.startTime || new Date().toISOString()) : new Date().toISOString()
        };

        // Capture initial URL
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) return;
            if (tab?.url && attachedTabs[tabId]) {
                const lastEvent = attachedTabs[tabId].userEvents[attachedTabs[tabId].userEvents.length - 1];
                if (!lastEvent || lastEvent.type !== 'navigation' || lastEvent.url !== tab.url) {
                    attachedTabs[tabId].userEvents.push({
                        type: 'navigation',
                        timestamp: Date.now(),
                        url: tab.url
                    });
                }
            }
        });

        chrome.debugger.sendCommand({ tabId }, 'Network.enable');
        chrome.debugger.sendCommand({ tabId }, 'Log.enable');
        chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
        chrome.debugger.sendCommand({ tabId }, 'Page.enable');
        chrome.debugger.sendCommand({ tabId }, 'Page.startScreencast', { format: 'jpeg', quality: 50, everyNthFrame: 1 });

        // Fetch environment and storage
        if ((!environment || !storage) && (!keepData || !existingData.environment)) {
            const expression = `
        (function() {
          const getStorage = (type) => {
            try {
              const s = window[type];
              const data = {};
              for (let i = 0; i < s.length; i++) {
                const key = s.key(i);
                data[key] = s.getItem(key);
              }
              return data;
            } catch (e) { return {}; }
          };
          const getCookies = () => {
            try {
              const cookies = {};
              if (document.cookie) {
                document.cookie.split(';').forEach(c => {
                  const parts = c.split('=');
                  const k = parts.shift().trim();
                  const v = parts.join('=');
                  if (k) cookies[k] = v;
                });
              }
              return cookies;
            } catch (e) { return {}; }
          };
          return JSON.stringify({
            env: {
              userAgent: navigator.userAgent,
              language: navigator.language,
              platform: navigator.platform,
              cookieEnabled: navigator.cookieEnabled,
              screenSize: window.screen.width + 'x' + window.screen.height,
              windowSize: window.innerWidth + 'x' + window.innerHeight,
              devicePixelRatio: window.devicePixelRatio,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
              deviceMemory: navigator.deviceMemory || 'N/A',
              connectionType: navigator.connection ? navigator.connection.effectiveType : 'N/A',
              url: window.location.href
            },
            storage: {
              localStorage: getStorage('localStorage'),
              sessionStorage: getStorage('sessionStorage'),
              cookies: getCookies()
            }
          });
        })();
      `;
            chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', { expression, returnByValue: true }, (res: any) => {
                if (chrome.runtime.lastError) {
                    console.warn('Env/Storage capture failed:', chrome.runtime.lastError);
                } else if (res?.result?.value) {
                    try {
                        const data = JSON.parse(res.result.value);
                        if (attachedTabs[tabId]) {
                            if (!attachedTabs[tabId].environment) attachedTabs[tabId].environment = data.env;
                            if (!attachedTabs[tabId].storage) attachedTabs[tabId].storage = data.storage;
                        }
                    } catch (e) {
                        console.error('Failed to parse env/storage data', e);
                    }
                }
            });
        }

        chrome.tabs.sendMessage(tabId, { action: 'showOverlay', mode });
        chrome.action.setBadgeText({ text: 'REC', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#d13438', tabId });

        if (callback) callback({ status: 'started' });
    });
}

function pruneData(tabId: number): void {
    const data = attachedTabs[tabId];
    if (!data || data.mode !== 'buffer') return;

    const bufferMinutes = settings.bufferMinutes || 2;
    const BUFFER_TIME_MS = bufferMinutes * 60 * 1000;
    const cutoff = Date.now() - BUFFER_TIME_MS;

    data.logs = data.logs.filter(l => l.timestamp >= cutoff);
    data.userEvents = data.userEvents.filter(e => e.timestamp >= cutoff);
    data.screencast = data.screencast.filter(f => f.wallTime >= cutoff);
    data.issues = data.issues.filter(i => i.timestamp >= cutoff);
    data.contentChanges = data.contentChanges.filter(c => c.timestamp >= cutoff);

    const cutoffSeconds = cutoff / 1000;
    for (const requestId in data.network) {
        if (data.network[requestId].wallTime < cutoffSeconds) {
            delete data.network[requestId];
        }
    }
}

// ── Message Router ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    const resolveTabId = () => request.tabId || sender.tab?.id || null;

    // ── Recording Actions ────────────────────────────────────────────
    if (request.action === 'start') {
        const tabId = resolveTabId();
        startRecording(tabId, 'standard', false, (result) => sendResponse(result), request.environment || null, request.storage || null);
        return true;
    }

    if (request.action === 'pause') {
        const tabId = resolveTabId();
        if (tabId && attachedTabs[tabId]) attachedTabs[tabId].isPaused = true;
        return true;
    }

    if (request.action === 'resume') {
        const tabId = resolveTabId();
        if (tabId && attachedTabs[tabId]) attachedTabs[tabId].isPaused = false;
        return true;
    }

    if (request.action === 'togglePause') {
        const tabId = resolveTabId();
        if (tabId && attachedTabs[tabId]) {
            attachedTabs[tabId].isPaused = !attachedTabs[tabId].isPaused;
            chrome.tabs.sendMessage(tabId, { action: attachedTabs[tabId].isPaused ? 'pause' : 'resume' });
        }
        sendResponse({ status: 'toggled' });
        return true;
    }

    if (request.action === 'recordUserEvent') {
        const tabId = sender.tab!.id!;
        if (attachedTabs[tabId]?.isRecording && !attachedTabs[tabId]?.isPaused) {
            attachedTabs[tabId].userEvents.push(request.event);
        }
        return;
    }

    if (request.action === 'recordIssue') {
        const tabId = sender.tab!.id!;
        if (attachedTabs[tabId]?.isRecording) {
            attachedTabs[tabId].issues.push(request.issue);
        }
        return;
    }

    if (request.action === 'recordContentChange') {
        const tabId = sender.tab!.id!;
        if (!attachedTabs[tabId]) {
            attachedTabs[tabId] = {
                mode: 'manual_edit',
                isRecording: false,
                logs: [],
                network: {},
                userEvents: [],
                screencast: [],
                issues: [],
                contentChanges: [],
                startTime: new Date().toISOString()
            };
        }
        attachedTabs[tabId].contentChanges.push(request.change);
        return;
    }

    if (request.action === 'stop') {
        const tabId = resolveTabId();
        if (tabId) stoppedTabs.add(tabId);
        chrome.debugger.detach({ tabId }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
            } else {
                if (attachedTabs[tabId]) attachedTabs[tabId].isRecording = false;
                chrome.action.setBadgeText({ text: '', tabId });
            }
            sendResponse({ status: 'stopped' });
        });
        return true;
    }

    // ── Report Actions ───────────────────────────────────────────────
    if (request.action === 'getReport') {
        const tabId = resolveTabId();
        const rawData = attachedTabs[tabId];
        if (rawData) {
            try {
                const report = generateReport(rawData, settings);
                sendResponse({ data: report });
            } catch (e: any) {
                console.error('Error generating report:', e);
                sendResponse({ error: e.toString() });
            }
        } else {
            sendResponse({ data: null });
        }
        return true;
    }

    if (request.action === 'saveReport') {
        const tabId = resolveTabId();
        const rawData = attachedTabs[tabId];
        if (rawData) {
            try {
                // Notify user that report is being created
                chrome.tabs.sendMessage(tabId, {
                    action: 'showToast',
                    toastType: 'info',
                    message: 'Creating your recording report...'
                }).catch(() => {
                    // Ignore if content script is not available
                });

                const report = generateReport(rawData, settings);
                chrome.storage.local.set({ viewerData: report }, () => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ error: chrome.runtime.lastError.message });
                    } else {
                        sendResponse({ status: 'saved' });
                    }
                });
            } catch (e: any) {
                sendResponse({ error: e.toString() });
            }
        } else {
            sendResponse({ error: 'No data found' });
        }
        return true;
    }

    if (request.action === 'downloadContentChanges') {
        const tabId = resolveTabId();
        const data = attachedTabs[tabId];
        if (data?.contentChanges?.length > 0) {
            const blob = new Blob([JSON.stringify(data.contentChanges, null, 2)], { type: 'application/json' });
            const reader = new FileReader();
            reader.onload = function (e: any) {
                chrome.downloads.download({
                    url: e.target.result,
                    filename: 'content-changes.json',
                    saveAs: true
                }, () => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ status: 'error', error: chrome.runtime.lastError.message });
                    } else {
                        sendResponse({ status: 'downloaded' });
                    }
                });
            };
            reader.readAsDataURL(blob);
        } else {
            sendResponse({ status: 'no_data' });
        }
        return true;
    }

    // ── Internal Extension Data Actions ──────────────────────────────
    if (request.action === 'getCss') {
        const url = chrome.runtime.getURL('content.css');
        fetch(url)
            .then(r => r.text())
            .then(css => sendResponse({ css }))
            .catch(e => sendResponse({ error: e.toString() }));
        return true;
    }

    // ── Navigation Actions ───────────────────────────────────────────
    if (request.action === 'openViewer') {
        chrome.tabs.create({ url: 'src/viewer/index.html' });
        return true;
    }

    if (request.action === 'openScreenshotEditor') {
        chrome.storage.local.set({
            tempScreenshot: {
                dataUrl: request.dataUrl,
                mode: request.mode,
                highlightBox: (request.mode === 'region') ? null : request.highlightBox,
                timestamp: Date.now()
            }
        }, () => {
            chrome.tabs.create({ url: 'src/screenshot-editor/index.html' });
        });
        return true;
    }

    if (request.action === 'checkStatus') {
        const tabId = resolveTabId();
        const data = attachedTabs[tabId];
        sendResponse({
            isRecording: data?.isRecording,
            mode: data?.mode ?? null,
            isPaused: data?.isPaused ?? false,
            hasData: !!data
        });
        return true;
    }

    // ── Screenshot Actions ───────────────────────────────────────────
    if (request.action === 'initiateScreenshot') {
        const tabId = request.tabId;
        const type = request.type;
        chrome.tabs.sendMessage(tabId, { action: 'triggerScreenshot', type }).catch(() => {
            if (chrome.scripting) {
                chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content.js']
                }, () => {
                    if (!chrome.runtime.lastError) {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabId, { action: 'triggerScreenshot', type }).catch(console.error);
                        }, 100);
                    }
                });
            }
        });
        return true;
    }

    if (request.action === 'captureScreenshot') {
        const tabId = resolveTabId();

        if (request.type === 'visible') {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) return sendResponse({ error: chrome.runtime.lastError.message });
                chrome.tabs.captureVisibleTab(tab.windowId!, { format: 'png' }, (dataUrl) => {
                    if (chrome.runtime.lastError) sendResponse({ error: chrome.runtime.lastError.message });
                    else sendResponse({ dataUrl });
                });
            });
            return true;
        }

        // Capture via debugger (full page / region)
        const isAttached = attachedTabs[tabId]?.isRecording;
        const attachIfNeeded = (cb: (cleanup?: () => void) => void) => {
            if (isAttached) return cb();
            chrome.debugger.attach({ tabId }, '1.3', () => {
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message?.includes('Another debugger')) return cb();
                    return sendResponse({ error: chrome.runtime.lastError.message });
                }
                cb(() => chrome.debugger.detach({ tabId }));
            });
        };

        attachIfNeeded((cleanup) => {
            if (request.type === 'full') {
                chrome.debugger.sendCommand({ tabId }, 'Page.getLayoutMetrics', {}, (metrics: any) => {
                    if (chrome.runtime.lastError) {
                        if (cleanup) cleanup();
                        return sendResponse({ error: chrome.runtime.lastError.message });
                    }
                    const width = Math.ceil(metrics.contentSize.width);
                    const height = Math.ceil(metrics.contentSize.height);
                    chrome.debugger.sendCommand({ tabId }, 'Emulation.setDeviceMetricsOverride', {
                        width, height, deviceScaleFactor: 1, mobile: false
                    }, () => {
                        setTimeout(() => {
                            chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', { format: 'png', fromSurface: true }, (result: any) => {
                                chrome.debugger.sendCommand({ tabId }, 'Emulation.clearDeviceMetricsOverride', {}, () => {
                                    if (cleanup) cleanup();
                                    if (chrome.runtime.lastError) {
                                        sendResponse({ error: chrome.runtime.lastError.message });
                                    } else if (result?.data) {
                                        sendResponse({ dataUrl: 'data:image/png;base64,' + result.data });
                                    } else {
                                        sendResponse({ error: 'Capture failed' });
                                    }
                                });
                            });
                        }, 150);
                    });
                });
            } else {
                const params: any = { format: 'png' };
                if (request.type === 'region' && request.area) {
                    params.fromSurface = true;
                    params.clip = {
                        x: request.area.x,
                        y: request.area.y,
                        width: request.area.width,
                        height: request.area.height,
                        scale: request.area.scale || 1
                    };
                }
                chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', params, (result: any) => {
                    if (cleanup) cleanup();
                    if (chrome.runtime.lastError) {
                        sendResponse({ error: chrome.runtime.lastError.message });
                    } else if (result?.data) {
                        sendResponse({ dataUrl: 'data:image/png;base64,' + result.data });
                    } else {
                        sendResponse({ error: 'Capture failed' });
                    }
                });
            }
        });
        return true;
    }

    // ── Replay Actions ───────────────────────────────────────────────
    if (request.action === 'replayEvents') {
        chrome.tabs.create({ url: request.url }, (tab) => {
            const tabId = tab!.id!;
            const onUpdated = (tId: number, info: any) => {
                if (tId === tabId && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(onUpdated);
                    chrome.debugger.attach({ tabId }, '1.3', async () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Attach failed:', chrome.runtime.lastError);
                            return;
                        }
                        if (request.context) {
                            await setupReplayEnvironment(tabId, request.context, request.url);
                            await sendCommand(tabId, 'Page.reload');
                            await new Promise(r => setTimeout(r, 2000));
                        }
                        const replayable = request.events.filter((e: any) => ['click', 'input'].includes(e.type));
                        const autoStart = request.autoStart === true;
                        const defaultDelay = request.defaultDelay !== undefined ? request.defaultDelay : null;

                        replayState[tabId] = {
                            isPaused: false,
                            isCancelled: false,
                            skipWait: false,
                            skipCurrentEvent: false,
                            customDelay: defaultDelay,
                            events: replayable,
                            issues: request.issues || [],
                            originalUrl: request.url,
                            originalContext: request.context || null,
                            originalAutoStart: autoStart,
                            isFinished: false,
                            isStarted: autoStart
                        };

                        chrome.tabs.sendMessage(tabId, { action: 'setWidgetVisibility', visible: false });
                        await waitForContentScript(tabId);
                        chrome.tabs.sendMessage(tabId, {
                            action: 'replayWidgetInit',
                            events: replayable,
                            tabId,
                            readyMode: !autoStart,
                            defaultDelay,
                            issues: request.issues || []
                        });

                        if (autoStart) executeReplay(tabId, replayable);
                    });
                }
            };
            chrome.tabs.onUpdated.addListener(onUpdated);
        });
        return true;
    }

    if (request.action === 'replayStart') {
        const tabId = request.tabId;
        const state = replayState[tabId];
        if (state && !state.isStarted) {
            state.isStarted = true;
            executeReplay(tabId, state.events);
        }
        sendResponse({ status: 'started' });
        return true;
    }

    if (request.action === 'replayRestart') {
        const tabId = request.tabId;
        const state = replayState[tabId];
        if (!state) { sendResponse({ status: 'no_state' }); return true; }

        const url = state.originalUrl;
        const events = state.events;
        const context = state.originalContext;
        const autoStart = state.originalAutoStart || false;
        const defaultDelay = state.customDelay;
        const issues = state.issues || [];

        replayState[tabId] = {
            isPaused: false,
            isCancelled: false,
            skipWait: false,
            customDelay: defaultDelay,
            events,
            issues,
            originalUrl: url,
            originalContext: context,
            originalAutoStart: autoStart,
            isFinished: false,
            isStarted: autoStart
        };

        const initAfterLoad = async () => {
            if (context) {
                await setupReplayEnvironment(tabId, context, url);
            }
            // Single reload so the page loads with the restored environment
            await sendCommand(tabId, 'Page.reload');
            await new Promise(r => setTimeout(r, 2000));
            await waitForContentScript(tabId);
            chrome.tabs.sendMessage(tabId, {
                action: 'replayWidgetInit',
                events,
                tabId,
                readyMode: !autoStart,
                defaultDelay,
                issues
            });
            chrome.tabs.sendMessage(tabId, { action: 'setWidgetVisibility', visible: false });
            if (autoStart) executeReplay(tabId, events);
        };

        // Check if the tab is already on the target URL to avoid a redundant navigation
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                // Tab may have been closed — fall back to navigating
                chrome.tabs.update(tabId, { url }, () => {
                    const onUpdated = (tId: number, info: any) => {
                        if (tId === tabId && info.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(onUpdated);
                            initAfterLoad();
                        }
                    };
                    chrome.tabs.onUpdated.addListener(onUpdated);
                });
                return;
            }

            let isSameUrl = false;
            try {
                const currentOriginPath = new URL(tab.url || '').origin + new URL(tab.url || '').pathname;
                const targetOriginPath = new URL(url).origin + new URL(url).pathname;
                isSameUrl = currentOriginPath === targetOriginPath;
            } catch { isSameUrl = tab.url === url; }

            if (isSameUrl) {
                // Already on the right page — just setup environment and reload once
                initAfterLoad();
            } else {
                // Different URL — navigate first, then setup + reload
                chrome.tabs.update(tabId, { url }, () => {
                    const onUpdated = (tId: number, info: any) => {
                        if (tId === tabId && info.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(onUpdated);
                            initAfterLoad();
                        }
                    };
                    chrome.tabs.onUpdated.addListener(onUpdated);
                });
            }
        });
        sendResponse({ status: 'restarting' });
        return true;
    }

    if (request.action === 'replayRemoveEvent') {
        const tabId = request.tabId;
        const state = replayState[tabId];
        if (state && !state.isStarted && request.eventIndex >= 0 && request.eventIndex < state.events.length) {
            state.events.splice(request.eventIndex, 1);
        }
        sendResponse({ status: 'removed', remaining: state ? state.events.length : 0, events: state ? state.events : [] });
        return true;
    }

    if (request.action === 'replayPause') {
        const tabId = request.tabId;
        if (replayState[tabId]) replayState[tabId].isPaused = true;
        sendResponse({ status: 'paused' });
        return true;
    }

    if (request.action === 'replayResume') {
        const tabId = request.tabId;
        if (replayState[tabId]) replayState[tabId].isPaused = false;
        sendResponse({ status: 'resumed' });
        return true;
    }

    if (request.action === 'replayRetry') {
        const tabId = request.tabId;
        const eventIndex = request.eventIndex;
        if (replayState[tabId]?.events?.[eventIndex]) {
            replayRetryEvent(tabId, replayState[tabId].events[eventIndex], eventIndex);
        }
        sendResponse({ status: 'retrying' });
        return true;
    }

    if (request.action === 'replaySkip') {
        const tabId = request.tabId;
        if (replayState[tabId]) replayState[tabId].skipWait = true;
        sendResponse({ status: 'skipped' });
        return true;
    }

    if (request.action === 'replaySkipEvent') {
        const tabId = request.tabId;
        if (replayState[tabId]) {
            replayState[tabId].skipCurrentEvent = true;
            replayState[tabId].skipWait = true; // Also skip the wait
        }
        sendResponse({ status: 'skipped' });
        return true;
    }

    if (request.action === 'replayCancel') {
        const tabId = request.tabId;
        if (replayState[tabId]) {
            replayState[tabId].isCancelled = true;
            replayState[tabId].isPaused = false;
        }
        sendResponse({ status: 'cancelled' });
        return true;
    }

    if (request.action === 'replaySetDelay') {
        const tabId = request.tabId;
        if (replayState[tabId]) replayState[tabId].customDelay = request.delay;
        sendResponse({ status: 'ok' });
        return true;
    }

    if (request.action === 'replaySkipFailed') {
        const tabId = request.tabId;
        if (replayState[tabId]) replayState[tabId].skipFailed = true;
        sendResponse({ status: 'skipped' });
        return true;
    }

    if (request.action === 'replayClose') {
        const tabId = request.tabId;
        if (replayState[tabId]) delete replayState[tabId];
        chrome.tabs.sendMessage(tabId, { action: 'replayWidgetRemove' });
        chrome.tabs.sendMessage(tabId, { action: 'setWidgetVisibility', visible: true });
        try { chrome.debugger.detach({ tabId }); } catch { }
        sendResponse({ status: 'closed' });
        return true;
    }
});

// ── Debugger Event Handler ───────────────────────────────────────────

chrome.debugger.onEvent.addListener((source, method, params: any) => {
    const tabId = source.tabId!;
    if (!attachedTabs[tabId] || attachedTabs[tabId].isPaused) return;

    if (method === 'Log.entryAdded') {
        if (['error', 'warning', 'info', 'verbose'].includes(params.entry.level)) {
            let ts = params.entry.timestamp;
            if (ts < 100000000000) ts *= 1000;
            attachedTabs[tabId].logs.push({
                type: 'log',
                ...params.entry,
                timestamp: ts
            });
        }
    } else if (method === 'Runtime.consoleAPICalled') {
        if (['error', 'warning', 'assert', 'info', 'log', 'debug', 'dir', 'table', 'trace', 'count', 'timeEnd'].includes(params.type)) {
            let ts = params.timestamp;
            if (ts < 100000000000) ts *= 1000;
            const text = params.args.map((a: any) => a.value || a.description || JSON.stringify(a)).join(' ');
            attachedTabs[tabId].logs.push({
                type: 'console',
                timestamp: ts,
                level: params.type === 'assert' ? 'error' : params.type,
                text,
                stackTrace: params.stackTrace
            });
            // Forward console errors as toast
            if ((params.type === 'error' || params.type === 'assert') && settings.toastConsole !== false) {
                chrome.tabs.sendMessage(tabId, { action: 'showToast', toastType: 'console', message: text }).catch(() => {});
            }
        }
    } else if (method === 'Runtime.exceptionThrown') {
        let ts = params.timestamp;
        if (ts < 100000000000) ts *= 1000;
        const details = params.exceptionDetails;
        const desc = details.exception?.description || details.text;
        attachedTabs[tabId].logs.push({
            type: 'exception',
            source: 'exception',
            timestamp: ts,
            level: 'error',
            text: desc,
            stackTrace: details.stackTrace,
            url: details.url
        });
        // Forward exception as toast
        if (settings.toastConsole !== false) {
            chrome.tabs.sendMessage(tabId, { action: 'showToast', toastType: 'console', message: desc }).catch(() => {});
        }
    } else if (method === 'Network.requestWillBeSent') {
        attachedTabs[tabId].network[params.requestId] = {
            requestId: params.requestId,
            request: params.request,
            startTime: params.timestamp,
            wallTime: params.wallTime,
            initiator: params.initiator,
            type: params.type
        };
    } else if (method === 'Network.responseReceived') {
        if (attachedTabs[tabId].network[params.requestId]) {
            attachedTabs[tabId].network[params.requestId].response = params.response;
            attachedTabs[tabId].network[params.requestId].type = params.type;
            if (params.response.status >= 400) {
                const netMsg = `${params.response.status} ${params.response.statusText} — ${params.response.url}`;
                attachedTabs[tabId].logs.push({
                    type: 'network',
                    source: 'network',
                    level: 'error',
                    text: `Failed to load resource: the server responded with a status of ${params.response.status} (${params.response.statusText})`,
                    url: params.response.url,
                    timestamp: Date.now()
                });
                // Forward network error as toast
                if (settings.toastNetwork !== false) {
                    chrome.tabs.sendMessage(tabId, { action: 'showToast', toastType: 'network', message: netMsg }).catch(() => {});
                }
            }
        }
    } else if (method === 'Network.loadingFailed') {
        const failMsg = params.errorText || 'Network request failed';
        attachedTabs[tabId].logs.push({
            type: 'network',
            source: 'network',
            level: 'error',
            text: failMsg,
            timestamp: Date.now()
        });
        // Forward network failure as toast (skip browser-level noise)
        const suppressedErrors = ['net::ERR_ABORTED', 'net::ERR_BLOCKED_BY_CLIENT', 'net::ERR_BLOCKED_BY_RESPONSE', 'Network request failed'];
        if (settings.toastNetwork !== false && !suppressedErrors.some(s => failMsg.includes(s))) {
            chrome.tabs.sendMessage(tabId, { action: 'showToast', toastType: 'network', message: failMsg }).catch(() => {});
        }
        if (attachedTabs[tabId].network[params.requestId]) {
            attachedTabs[tabId].network[params.requestId].errorText = params.errorText;
        }
    } else if (method === 'Network.loadingFinished') {
        if (attachedTabs[tabId].network[params.requestId]) {
            attachedTabs[tabId].network[params.requestId].endTime = params.timestamp;
            attachedTabs[tabId].network[params.requestId].encodedDataLength = params.encodedDataLength;
            chrome.debugger.sendCommand({ tabId }, 'Network.getResponseBody', { requestId: params.requestId }, (responseBody: any) => {
                if (chrome.runtime.lastError) return;
                if (attachedTabs[tabId]?.network[params.requestId]) {
                    attachedTabs[tabId].network[params.requestId].responseBody = responseBody;
                }
            });
        }
    } else if (method === 'Page.frameNavigated') {
        if (params.frame && !params.frame.parentId) {
            attachedTabs[tabId].userEvents.push({
                type: 'navigation',
                timestamp: Date.now(),
                url: params.frame.url
            });
        }
    } else if (method === 'Page.screencastFrame') {
        if (attachedTabs[tabId]) {
            attachedTabs[tabId].screencast.push({
                data: params.data,
                timestamp: params.metadata.timestamp,
                wallTime: Date.now(),
                sessionId: params.sessionId
            });
            chrome.debugger.sendCommand({ tabId }, 'Page.screencastFrameAck', { sessionId: params.sessionId });
            if (attachedTabs[tabId].mode === 'buffer') {
                pruneData(tabId);
            }
        }
    }
});

// ── Debugger Detach Handler ──────────────────────────────────────────

chrome.debugger.onDetach.addListener((source: chrome.debugger.Debuggee, reason: string) => {
    const tabId = source.tabId!;
    if (attachedTabs[tabId]) {
        attachedTabs[tabId].isRecording = false;
    }
    chrome.action.setBadgeText({ text: '', tabId });
    console.log('Debugger detached', reason);
});
