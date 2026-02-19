let attachedTabs = {};
let settings = {
  autoRecord: false,
  domains: [],
  bufferMinutes: 2
};
let stoppedTabs = new Set();

// Load settings
chrome.storage.local.get(['settings'], (result) => {
  if (result.settings) {
    settings = result.settings;
  }
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.settings) {
    settings = changes.settings.newValue;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    stoppedTabs.delete(tabId);
  }

  if (changeInfo.status === 'complete') {
    if (stoppedTabs.has(tabId)) return;

    chrome.storage.local.get(['settings'], (result) => {
      const currentSettings = result.settings || { autoRecord: false, domains: [] };
      // Update global settings just in case
      settings = currentSettings;

      const shouldAutoRecord = currentSettings.autoRecord && tab.url && currentSettings.domains.some(d => {
        try { return new URL(tab.url).hostname.includes(d); } catch (e) { return false; }
      });

      if (attachedTabs[tabId]) {
        if (attachedTabs[tabId].isRecording) {
          // Tab is already recorded.
          // If we are in buffer mode, check if we should STILL be recording.
          if (attachedTabs[tabId].mode === 'buffer' && !shouldAutoRecord) {
            // User disabled auto-record or moved to non-matching domain. Stop.
            chrome.debugger.detach({ tabId: tabId });
            chrome.tabs.sendMessage(tabId, { action: "hideOverlay" });
            return;
          }

          // Restore overlay
          chrome.tabs.sendMessage(tabId, {
            action: "showOverlay",
            mode: attachedTabs[tabId].mode
          });
        } else if (shouldAutoRecord) {
          // Was recorded but detached (e.g. navigation), restart recording and append data
          startRecording(tabId, 'buffer', true);
        }
      } else if (shouldAutoRecord) {
        startRecording(tabId, 'buffer');
      }
    });
  }
});

function startRecording(tabId, mode = 'standard', keepData = false, callback = null, environment = null, storage = null) {
  chrome.debugger.attach({ tabId: tabId }, "1.3", () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      if (callback) callback({ status: "error", message: chrome.runtime.lastError.message });
      return;
    }

    let existingData = {};
    if (keepData && attachedTabs[tabId]) {
      existingData = attachedTabs[tabId];
    }

    attachedTabs[tabId] = {
      mode: mode,
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
      if (tab && tab.url && attachedTabs[tabId]) {
        // Only add if it's not a duplicate of the last event
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

    chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable");
    chrome.debugger.sendCommand({ tabId: tabId }, "Log.enable");
    chrome.debugger.sendCommand({ tabId: tabId }, "Runtime.enable");
    chrome.debugger.sendCommand({ tabId: tabId }, "Page.enable");
    chrome.debugger.sendCommand({ tabId: tabId }, "Page.startScreencast", { format: 'jpeg', quality: 50, everyNthFrame: 1 });

    // Fetch environment and storage details if not provided
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
      chrome.debugger.sendCommand({ tabId: tabId }, "Runtime.evaluate", { expression: expression, returnByValue: true }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("Env/Storage capture failed:", chrome.runtime.lastError);
        } else if (res && res.result && res.result.value) {
          try {
            const data = JSON.parse(res.result.value);
            console.log("Env/Storage captured via Runtime.evaluate", data);
            if (attachedTabs[tabId]) {
              if (!attachedTabs[tabId].environment) attachedTabs[tabId].environment = data.env;
              if (!attachedTabs[tabId].storage) attachedTabs[tabId].storage = data.storage;
            }
          } catch (e) {
            console.error("Failed to parse env/storage data", e);
          }
        }
      });
    }

    // Show overlay
    chrome.tabs.sendMessage(tabId, { action: "showOverlay", mode: mode });

    // Set recording icon state
    chrome.action.setBadgeText({ text: "REC", tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#d13438", tabId: tabId });

    if (callback) callback({ status: "started" });
  });
}

function pruneData(tabId) {
  const data = attachedTabs[tabId];
  if (!data || data.mode !== 'buffer') return;

  const bufferMinutes = settings.bufferMinutes || 2;
  const BUFFER_TIME_MS = bufferMinutes * 60 * 1000;
  const cutoff = Date.now() - BUFFER_TIME_MS;

  // Prune logs (timestamp is ms or double?)
  // Runtime.consoleAPICalled timestamp is double (seconds? no, usually ms in chrome protocol? wait)
  // Runtime.consoleAPICalled timestamp is "Timestamp of the exception."
  // Actually, let's check how we store it.
  // We store params.timestamp.
  // In Chrome DevTools Protocol, Runtime.timestamp is Number, milliseconds since epoch.
  // Wait, documentation says "Number of milliseconds since epoch."
  // But sometimes it is monotonic.
  // Let's assume it is compatible with Date.now() for now, or we should use wallTime if available.
  // We used Date.now() for userEvents and screencast wallTime.

  data.logs = data.logs.filter(l => l.timestamp >= cutoff);
  data.userEvents = data.userEvents.filter(e => e.timestamp >= cutoff);
  data.screencast = data.screencast.filter(f => f.wallTime >= cutoff);
  data.screencast = data.screencast.filter(f => f.wallTime >= cutoff);
  data.issues = data.issues.filter(i => i.timestamp >= cutoff);
  data.contentChanges = data.contentChanges.filter(c => c.timestamp >= cutoff);

  // Prune network
  // Network.requestWillBeSent params.wallTime is "Timestamp. UTC time in seconds, counted from January 1, 1970."
  // So we need to multiply by 1000.
  const cutoffSeconds = cutoff / 1000;
  for (const requestId in data.network) {
    if (data.network[requestId].wallTime < cutoffSeconds) {
      delete data.network[requestId];
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    const env = request.environment || null;
    const storage = request.storage || null;
    startRecording(tabId, 'standard', false, (result) => {
      sendResponse(result);
    }, env, storage);
    return true; // Async response
  }

  if (request.action === "pause") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    if (tabId && attachedTabs[tabId]) {
      attachedTabs[tabId].isPaused = true;
    }
    return true;
  }

  if (request.action === "resume") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    if (tabId && attachedTabs[tabId]) {
      attachedTabs[tabId].isPaused = false;
    }
    return true;
  }

  if (request.action === "togglePause") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    if (tabId && attachedTabs[tabId]) {
      attachedTabs[tabId].isPaused = !attachedTabs[tabId].isPaused;
      // Propagate to content script for UI update
      chrome.tabs.sendMessage(tabId, { action: attachedTabs[tabId].isPaused ? "pause" : "resume" });
    }
    sendResponse({ status: "toggled" });
    return true;
  }

  if (request.action === "recordUserEvent") {
    const tabId = sender.tab.id;
    if (attachedTabs[tabId] && attachedTabs[tabId].isRecording && !attachedTabs[tabId].isPaused) {
      attachedTabs[tabId].userEvents.push(request.event);
    }
    return;
  }

  if (request.action === "recordIssue") {
    const tabId = sender.tab.id;
    if (attachedTabs[tabId] && attachedTabs[tabId].isRecording) {
      attachedTabs[tabId].issues.push(request.issue);
    }
    return;
  }

  if (request.action === "recordContentChange") {
    const tabId = sender.tab.id;

    // Ensure we have a session for this tab if not already present
    if (!attachedTabs[tabId]) {
      attachedTabs[tabId] = {
        mode: 'manual_edit', // New mode for just edits
        isRecording: false, // Not fully recording everything
        logs: [],
        network: {},
        userEvents: [],
        screencast: [],
        issues: [],
        contentChanges: [],
        startTime: new Date().toISOString()
      };
    }

    // Always push content changes if the tab structure exists
    attachedTabs[tabId].contentChanges.push(request.change);
    return;
  }

  if (request.action === "stop") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    if (tabId) stoppedTabs.add(tabId);

    // Hide overlay
    chrome.tabs.sendMessage(tabId, { action: "hideOverlay" });

    chrome.debugger.detach({ tabId: tabId }, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
      } else {
        // Explicitly update state to ensure UI sync
        if (attachedTabs[tabId]) {
          attachedTabs[tabId].isRecording = false;
        }
        chrome.action.setBadgeText({ text: "", tabId: tabId });
      }
      sendResponse({ status: "stopped" });
    });
    return true;
  }

  if (request.action === "getReport") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    const rawData = attachedTabs[tabId];
    if (rawData) {
      try {
        const report = generateReport(rawData);
        sendResponse({ data: report });
      } catch (e) {
        console.error("Error generating report:", e);
        sendResponse({ error: e.toString() });
      }
    } else {
      sendResponse({ data: null });
    }
    return true;
  }

  if (request.action === "saveReport") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    const rawData = attachedTabs[tabId];
    if (rawData) {
      try {
        const report = generateReport(rawData);
        chrome.storage.local.set({ 'viewerData': report }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            // Also download json file if explicitly requested via "downloadReport"
            sendResponse({ status: "saved" });
          }
        });
      } catch (e) {
        sendResponse({ error: e.toString() });
      }
    } else {
      sendResponse({ error: "No data found" });
    }
    return true;
  }

  if (request.action === "downloadContentChanges") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    const data = attachedTabs[tabId];
    if (data && data.contentChanges && data.contentChanges.length > 0) {
      const blob = new Blob([JSON.stringify(data.contentChanges, null, 2)], { type: "application/json" });
      const reader = new FileReader();
      reader.onload = function (e) {
        chrome.downloads.download({
          url: e.target.result,
          filename: "content-changes.json",
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ status: "error", error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ status: "downloaded" });
          }
        });
      };
      reader.readAsDataURL(blob);
    } else {
      sendResponse({ status: "no_data" });
    }
    return true;
  }

  if (request.action === "openViewer") {
    chrome.tabs.create({ url: 'viewer.html' });
    return true;
  }

  if (request.action === "openScreenshotEditor") {
    // Store temporarily
    chrome.storage.local.set({
      tempScreenshot: {
        dataUrl: request.dataUrl,
        mode: request.mode,
        highlightBox: (request.mode === 'region') ? null : request.highlightBox,
        timestamp: Date.now()
      }
    }, () => {
      // Open editor
      chrome.tabs.create({ url: 'screenshot-editor.html' });
    });
    return true;
  }

  if (request.action === "checkStatus") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    const data = attachedTabs[tabId];
    sendResponse({
      isRecording: data && data.isRecording,
      mode: data ? data.mode : null,
      isPaused: data ? !!data.isPaused : false,
      hasData: !!data
    });
    return true;
  }

  if (request.action === "initiateScreenshot") {
    const tabId = request.tabId;
    const type = request.type;

    chrome.tabs.sendMessage(tabId, { action: "triggerScreenshot", type: type }, (res) => {
      if (chrome.runtime.lastError) {
        // Content script likely not loaded, inject it
        if (chrome.scripting) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }, () => {
            if (!chrome.runtime.lastError) {
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { action: "triggerScreenshot", type: type });
              }, 100);
            }
          });
        }
      }
    });
    return true;
  }

  if (request.action === "captureScreenshot") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);

    if (request.type === 'visible') {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) return sendResponse({ error: chrome.runtime.lastError.message });
        // windowId is required
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) sendResponse({ error: chrome.runtime.lastError.message });
          else sendResponse({ dataUrl: dataUrl });
        });
      });
      return true;
    }

    // Helper to capture via debugger
    const captureViaDebugger = () => {
      // Check if attached
      const isAttached = attachedTabs[tabId] && attachedTabs[tabId].isRecording;
      const attachIfNeeded = (cb) => {
        if (isAttached) return cb();
        chrome.debugger.attach({ tabId: tabId }, "1.3", () => {
          if (chrome.runtime.lastError) {
            // If already attached, try to reuse the connection
            if (chrome.runtime.lastError.message.includes("Another debugger")) {
              return cb();
            }
            return sendResponse({ error: chrome.runtime.lastError.message });
          }
          cb(() => chrome.debugger.detach({ tabId: tabId })); // cleanup if temp attached
        });
      };

      attachIfNeeded((cleanup) => {
        if (request.type === 'full') {
          // Robust Full Page Capture using Emulation
          chrome.debugger.sendCommand({ tabId: tabId }, "Page.getLayoutMetrics", {}, (metrics) => {
            if (chrome.runtime.lastError) {
              if (cleanup) cleanup();
              return sendResponse({ error: chrome.runtime.lastError.message });
            }

            const width = Math.ceil(metrics.contentSize.width);
            const height = Math.ceil(metrics.contentSize.height);

            const deviceMetrics = {
              width: width,
              height: height,
              deviceScaleFactor: 1,
              mobile: false
            };

            chrome.debugger.sendCommand({ tabId: tabId }, "Emulation.setDeviceMetricsOverride", deviceMetrics, () => {
              // Give the renderer a moment to update layout/paint for the new massive viewport
              setTimeout(() => {
                chrome.debugger.sendCommand({ tabId: tabId }, "Page.captureScreenshot", { format: 'png', fromSurface: true }, (result) => {
                  // Always reset metrics
                  chrome.debugger.sendCommand({ tabId: tabId }, "Emulation.clearDeviceMetricsOverride", {}, () => {
                    if (cleanup) cleanup();
                    if (chrome.runtime.lastError) {
                      sendResponse({ error: chrome.runtime.lastError.message });
                    } else if (result && result.data) {
                      sendResponse({ dataUrl: "data:image/png;base64," + result.data });
                    } else {
                      sendResponse({ error: "Capture failed" });
                    }
                  });
                });
              }, 150); // 150ms wait
            });
          });
        } else {
          // Region capture (Standard)
          const params = { format: 'png' };
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

          chrome.debugger.sendCommand({ tabId: tabId }, "Page.captureScreenshot", params, (result) => {
            if (cleanup) cleanup();
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message });
            } else if (result && result.data) {
              sendResponse({ dataUrl: "data:image/png;base64," + result.data });
            } else {
              sendResponse({ error: "Capture failed" });
            }
          });
        }
      });
    };

    captureViaDebugger();
    return true;
  }

  if (request.action === "replayEvents") {
    chrome.tabs.create({ url: request.url }, (tab) => {
      const tabId = tab.id;
      const onUpdated = (tId, info) => {
        if (tId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.debugger.attach({ tabId: tabId }, "1.3", async () => {
            if (chrome.runtime.lastError) {
              console.warn("Attach failed:", chrome.runtime.lastError);
              return;
            }

            if (request.context) {
              await setupReplayEnvironment(tabId, request.context);
              // Reload to apply storage/cookies fully
              await sendCommand(tabId, "Page.reload");
              // Wait for reload (executeReplay has its own warmup, but let's give it a moment)
              await new Promise(r => setTimeout(r, 2000));
            }

            executeReplay(tabId, request.events);
          });
        }
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
    });
    return true;
  }
});

function generateReport(data) {
  // Settings for redaction
  const redactHeaders = (settings.securityHeaders || ['Authorization', 'Cookie', 'Set-Cookie', 'X-Auth-Token', 'Proxy-Authorization']).map(s => s.toLowerCase());
  const redactStorage = (settings.securityStorage || ['token', 'auth', 'session', 'secret', 'key', 'password', 'user', 'account']).map(s => s.toLowerCase());
  const redactCookies = (settings.securityCookies || ['JSESSIONID', 'PHPSESSID', 'connect.sid', 'token', 'auth']).map(s => s.toLowerCase());

  // Helper to redact
  const shouldRedact = (key, list) => list.some(item => key.toLowerCase().includes(item));
  const REDACTED_VAL = '[REDACTED]';

  // Anonymize Storage
  const anonymizeStorage = (storageObj) => {
    if (!storageObj) return {};
    const clean = {};
    for (const [k, v] of Object.entries(storageObj)) {
      if (shouldRedact(k, redactStorage)) {
        clean[k] = REDACTED_VAL;
      } else {
        clean[k] = v;
      }
    }
    return clean;
  };

  const cleanStorage = {
    localStorage: anonymizeStorage(data.storage ? data.storage.localStorage : {}),
    sessionStorage: anonymizeStorage(data.storage ? data.storage.sessionStorage : {}),
    cookies: {}
  };

  // Environment Cookies
  if (data.storage && data.storage.cookies) {
    cleanStorage.cookies = {};
    for (const [k, v] of Object.entries(data.storage.cookies)) {
      if (shouldRedact(k, redactCookies)) {
        cleanStorage.cookies[k] = REDACTED_VAL;
      } else {
        cleanStorage.cookies[k] = v;
      }
    }
  }

  // Convert network data to HAR-like format
  const har = {
    log: {
      version: "1.2",
      creator: { name: "Signal", version: "1.0" },
      pages: [{
        startedDateTime: data.startTime,
        id: "page_1",
        title: "Recorded Session",
        pageTimings: {}
      }],
      entries: Object.values(data.network).map(entry => {
        const time = (entry.endTime && entry.startTime) ? (entry.endTime - entry.startTime) * 1000 : 0;

        // Request Headers
        const requestHeaders = Object.entries(entry.request.headers || {}).map(([k, v]) => {
          let val = v;
          if (shouldRedact(k, redactHeaders)) {
            val = REDACTED_VAL;
          }
          return { name: k, value: val };
        });

        // Response Headers
        const responseHeaders = Object.entries((entry.response && entry.response.headers) || {}).map(([k, v]) => {
          let val = v;
          if (shouldRedact(k, redactHeaders)) {
            val = REDACTED_VAL;
          }
          return { name: k, value: val };
        });

        return {
          _resourceType: entry.type,
          startedDateTime: new Date(entry.wallTime * 1000).toISOString(),
          time: time,
          request: {
            method: entry.request.method,
            url: entry.request.url,
            httpVersion: "HTTP/1.1",
            headers: requestHeaders,
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1,
            postData: entry.request.postData ? {
              mimeType: entry.request.headers['Content-Type'] || "",
              text: entry.request.postData
            } : undefined
          },
          response: entry.response ? {
            status: entry.response.status,
            statusText: entry.response.statusText,
            httpVersion: entry.response.protocol || "HTTP/1.1",
            headers: responseHeaders,
            cookies: [],
            content: {
              size: entry.encodedDataLength || 0,
              mimeType: entry.response.mimeType,
              text: entry.responseBody ? entry.responseBody.body : undefined,
              encoding: (entry.responseBody && entry.responseBody.base64Encoded) ? "base64" : undefined
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: -1
          } : { status: 0, statusText: "", httpVersion: "", headers: [], content: {}, redirectURL: "", headersSize: -1, bodySize: -1 },
          cache: {},
          timings: { send: 0, wait: 0, receive: time }
        };
      })
    }
  };

  return {
    generatedAt: new Date().toISOString(),
    environment: data.environment || {},
    storage: cleanStorage,
    consoleErrors: data.logs,
    userEvents: data.userEvents || [],
    screencast: data.screencast || [],
    issues: data.issues || [],
    contentChanges: data.contentChanges || [],
    har: har
  };
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  const tabId = source.tabId;
  if (!attachedTabs[tabId] || attachedTabs[tabId].isPaused) return;

  if (method === "Log.entryAdded") {
    // Capture errors and warnings
    if (['error', 'warning', 'info', 'verbose'].includes(params.entry.level)) {
      let ts = params.entry.timestamp;
      if (ts < 100000000000) ts *= 1000; // Convert seconds to ms if needed

      attachedTabs[tabId].logs.push({
        type: 'log',
        ...params.entry,
        timestamp: ts
      });
    }
  } else if (method === "Runtime.consoleAPICalled") {
    // Capture console.error, console.warn, console.assert
    if (['error', 'warning', 'assert', 'info', 'log', 'debug', 'dir', 'table', 'trace', 'count', 'timeEnd'].includes(params.type)) {
      let ts = params.timestamp;
      if (ts < 100000000000) ts *= 1000; // Convert seconds to ms if needed

      attachedTabs[tabId].logs.push({
        type: 'console',
        timestamp: ts,
        level: params.type === 'assert' ? 'error' : params.type,
        text: params.args.map(a => a.value || a.description || JSON.stringify(a)).join(" "),
        stackTrace: params.stackTrace
      });
    }
  } else if (method === "Runtime.exceptionThrown") {
    // Capture uncaught exceptions
    let ts = params.timestamp;
    if (ts < 100000000000) ts *= 1000;

    const details = params.exceptionDetails;
    const desc = details.exception && details.exception.description ? details.exception.description : details.text;

    attachedTabs[tabId].logs.push({
      type: 'exception',
      source: 'exception',
      timestamp: ts,
      level: 'error',
      text: desc,
      stackTrace: details.stackTrace,
      url: details.url
    });
  } else if (method === "Network.requestWillBeSent") {
    attachedTabs[tabId].network[params.requestId] = {
      requestId: params.requestId,
      request: params.request,
      startTime: params.timestamp,
      wallTime: params.wallTime,
      initiator: params.initiator,
      type: params.type
    };
  } else if (method === "Network.responseReceived") {
    if (attachedTabs[tabId].network[params.requestId]) {
      attachedTabs[tabId].network[params.requestId].response = params.response;
      attachedTabs[tabId].network[params.requestId].type = params.type;

      // Synthesize Console Error for HTTP 4xx/5xx
      if (params.response.status >= 400) {
        attachedTabs[tabId].logs.push({
          type: 'network',
          source: 'network',
          level: 'error',
          text: `Failed to load resource: the server responded with a status of ${params.response.status} (${params.response.statusText})`,
          url: params.response.url,
          timestamp: Date.now()
        });
      }
    }
  } else if (method === "Network.loadingFailed") {
    // Capture network failures (DNS, connection refined, etc)
    attachedTabs[tabId].logs.push({
      type: 'network',
      source: 'network',
      level: 'error',
      text: params.errorText || "Network request failed",
      timestamp: Date.now()
    });

    if (attachedTabs[tabId].network[params.requestId]) {
      attachedTabs[tabId].network[params.requestId].errorText = params.errorText;
    }
  } else if (method === "Network.loadingFinished") {
    if (attachedTabs[tabId].network[params.requestId]) {
      attachedTabs[tabId].network[params.requestId].endTime = params.timestamp;
      attachedTabs[tabId].network[params.requestId].encodedDataLength = params.encodedDataLength;

      // Fetch response body
      chrome.debugger.sendCommand({ tabId: tabId }, "Network.getResponseBody", { requestId: params.requestId }, (responseBody) => {
        if (chrome.runtime.lastError) {
          // Ignore errors (e.g. for redirects or empty bodies)
          return;
        }
        if (attachedTabs[tabId] && attachedTabs[tabId].network[params.requestId]) {
          attachedTabs[tabId].network[params.requestId].responseBody = responseBody;
        }
      });
    }
  } else if (method === "Page.frameNavigated") {
    if (params.frame && !params.frame.parentId) { // Top frame
      attachedTabs[tabId].userEvents.push({
        type: 'navigation',
        timestamp: Date.now(),
        url: params.frame.url
      });
    }
  } else if (method === "Page.screencastFrame") {
    if (attachedTabs[tabId]) {
      attachedTabs[tabId].screencast.push({
        data: params.data,
        timestamp: params.metadata.timestamp,
        wallTime: Date.now(), // Add wall clock time for synchronization
        sessionId: params.sessionId
      });
      // Acknowledge the frame
      chrome.debugger.sendCommand({ tabId: tabId }, "Page.screencastFrameAck", { sessionId: params.sessionId });

      // Prune data periodically (e.g. on every frame)
      if (attachedTabs[tabId].mode === 'buffer') {
        pruneData(tabId);
      }
    }
  }
});

chrome.debugger.onDetach.addListener((source, reason) => {
  const tabId = source.tabId;
  if (attachedTabs[tabId]) {
    attachedTabs[tabId].isRecording = false;
  }
  chrome.action.setBadgeText({ text: "", tabId: tabId });
  // Keep the data for a bit or clear it? 
  // If we clear it immediately, the user can't download after stop.
  // But if we don't clear it, it leaks.
  // We'll keep it until the user explicitly clears or starts a new session, 
  // but for now, let's just leave it in memory. 
  // Ideally, we should move it to a "finished sessions" store.
  console.log("Debugger detached", reason);
});

async function executeReplay(tabId, events) {
  // Enable domains for reliable execution and navigation tracking
  try {
    await sendCommand(tabId, "Page.enable");
    await sendCommand(tabId, "Runtime.enable");
    await sendCommand(tabId, "DOM.enable");
    await sendCommand(tabId, "Network.enable");
  } catch (e) { console.warn("Replay domain enable failed", e); }

  const replayable = events.filter(e => ['click', 'input'].includes(e.type));

  // Hide widget
  chrome.tabs.sendMessage(tabId, { action: "setWidgetVisibility", visible: false });

  // Show Notification Banner
  try {
    await sendCommand(tabId, "Runtime.evaluate", {
      expression: `
            (function() {
                var badge = document.createElement('div');
                badge.style.cssText = 'position:fixed; top:10px; right:10px; background:#0078d4; color:white; padding:10px 20px; border-radius:4px; z-index:2147483647; font-family:sans-serif; box-shadow:0 2px 10px rgba(0,0,0,0.2); pointer-events:none; font-weight:bold;';
                badge.id = 'replay-badge';
                badge.innerText = 'Replaying Events...';
                document.body.appendChild(badge);
            })();
        `
    });
  } catch (e) { }

  if (replayable.length === 0) {
    showReplayFinished(tabId, 0);
    return;
  }

  // Navigation Tracking
  let isNavigating = false;
  const navHandler = (source, method, params) => {
    if (source.tabId === tabId) {
      if (method === "Network.requestWillBeSent" && params.type === "Document") {
        isNavigating = true;
      }
      if (method === "Page.loadEventFired") {
        isNavigating = false;
      }
    }
  };
  chrome.debugger.onEvent.addListener(navHandler);

  replayable.sort((a, b) => a.timestamp - b.timestamp);
  const startTime = replayable[0].timestamp;

  for (let i = 0; i < replayable.length; i++) {
    const event = replayable[i];
    const prevTime = (i === 0) ? startTime : replayable[i - 1].timestamp;

    // Wait for delta
    let delta = Math.max(0, event.timestamp - prevTime);
    if (i === 0) delta = 5000; // warmup: Wait 5s for SPA loading

    await sleep(delta);

    // If navigating, wait until done
    let navWait = 0;
    while (isNavigating && navWait < 15000) { // 15s max wait
      await sleep(100);
      navWait += 100;
    }
    // Extra pause after navigation to ensure data fetch
    if (navWait > 0) {
      await sleep(3000);
    }

    // Execute
    try {
      if (event.type === 'click') {
        await executeClick(tabId, event);
      } else if (event.type === 'input') {
        await executeInput(tabId, event);
      }
    } catch (e) {
      console.warn("Event execution failed", e);
    }
  }

  // Cleanup
  chrome.debugger.onEvent.removeListener(navHandler);
  showReplayFinished(tabId, replayable.length);
}

function showReplayFinished(tabId, count) {
  chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
    expression: `
            (function() {
                var b = document.getElementById('replay-badge');
                if (b) {
                    b.innerText = 'Replay Successfully Finished (${count} events)';
                    b.style.background = '#107c10';
                    setTimeout(function() { b.remove(); }, 4000);
                }
            })();
        `
  });
  chrome.tabs.sendMessage(tabId, { action: "setWidgetVisibility", visible: true });
  setTimeout(() => { chrome.debugger.detach({ tabId: tabId }); }, 5000);
}

async function setupReplayEnvironment(tabId, context) {
  if (!context) return;

  // Enable domains
  try {
    await sendCommand(tabId, "Page.enable");
    await sendCommand(tabId, "Runtime.enable");
    await sendCommand(tabId, "DOM.enable");
    await sendCommand(tabId, "Network.enable");
  } catch (e) { }

  // 1. Clear Storage if requested
  if (context.clearStorage) {
    try {
      await sendCommand(tabId, "Network.clearBrowserCookies");
      await sendCommand(tabId, "Runtime.evaluate", {
        expression: "localStorage.clear(); sessionStorage.clear();"
      });
    } catch (e) { console.warn("Clear storage failed", e); }
  }

  // 2. Set Cookies
  if (context.cookies) {
    for (const [key, value] of Object.entries(context.cookies)) {
      try {
        await sendCommand(tabId, "Runtime.evaluate", {
          expression: `document.cookie = "${key}=${value}; path=/";`
        });
      } catch (e) { console.error("Cookie set failed", e); }
    }
  }

  // 3. Set Local/Session Storage
  if (context.localStorage) {
    for (const [key, value] of Object.entries(context.localStorage)) {
      const val = typeof value === 'string' ? value : JSON.stringify(value);
      try {
        await sendCommand(tabId, "Runtime.evaluate", {
          expression: `localStorage.setItem('${key}', '${val.replace(/'/g, "\\'").replace(/\n/g, "\\n")}');`
        });
      } catch (e) { console.error("LocalStorage set failed", e); }
    }
  }
  if (context.sessionStorage) {
    for (const [key, value] of Object.entries(context.sessionStorage)) {
      const val = typeof value === 'string' ? value : JSON.stringify(value);
      try {
        await sendCommand(tabId, "Runtime.evaluate", {
          expression: `sessionStorage.setItem('${key}', '${val.replace(/'/g, "\\'").replace(/\n/g, "\\n")}');`
        });
      } catch (e) { console.error("SessionStorage set failed", e); }
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

        await sendCommand(tabId, "Runtime.evaluate", {
          expression: fetchExpr,
          awaitPromise: true
        });
      } catch (e) { console.error("Pre-flight request failed", e); }
    }
  }
}

// Helpers
function sendCommand(tabId, method, params, retry = true) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, async (res) => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || "";
        if (retry && (msg.includes("not attached") || msg.includes("Detached"))) {
          console.warn("Debugger detached, re-attaching...", method);
          chrome.debugger.attach({ tabId }, "1.3", async () => {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }
            // Re-enable domains
            chrome.debugger.sendCommand({ tabId }, "Page.enable");
            chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
            chrome.debugger.sendCommand({ tabId }, "DOM.enable");
            chrome.debugger.sendCommand({ tabId }, "Network.enable");

            // Retry
            const r = await sendCommand(tabId, method, params, false);
            resolve(r);
          });
          return;
        }
        resolve(null);
      }
      else resolve(res);
    });
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function executeClick(tabId, event) {
  const xpath = event.target ? event.target.xpath : null;
  let x = event.x, y = event.y;
  let found = false;

  try {
    const res = await sendCommand(tabId, "Runtime.evaluate", {
      expression: `(function(){ 
                 var xpath = "${xpath ? xpath.replace(/"/g, '\\"') : ''}";
                 var el = xpath ? document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue : null;
                 if (el) {
                    el.scrollIntoView({block: 'center', inline: 'center'});
                    var original = el.style.outline;
                    el.style.outline = '3px solid #ff0000';
                    setTimeout(function() { el.style.outline = original; }, 300);
                    
                    el.click(); 
                    return { found: true };
                 }
                 return { found: false };
            })()`,
      returnByValue: true
    });
    if (res && res.result && res.result.value && res.result.value.found) {
      found = true;
    }
  } catch (e) { }

  if (!found && x !== undefined && y !== undefined) {
    await sendCommand(tabId, "Input.dispatchMouseEvent", { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await sleep(50);
    await sendCommand(tabId, "Input.dispatchMouseEvent", { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
}

async function executeInput(tabId, event) {
  if (!event.target.xpath) return;
  const safeValue = (event.value || '').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const xpath = event.target.xpath.replace(/"/g, '\\"');
  await sendCommand(tabId, "Runtime.evaluate", {
    expression: `
            (function() {
                var el = document.evaluate("${xpath}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (el) { 
                    el.scrollIntoView({block: 'center', inline: 'center'});
                    el.focus(); 
                    el.value = "${safeValue}"; 
                    el.dispatchEvent(new Event('input', { bubbles: true })); 
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            })();
        `
  });
}
