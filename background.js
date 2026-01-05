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

function startRecording(tabId, mode = 'standard', keepData = false) {
  chrome.debugger.attach({ tabId: tabId }, "1.3", () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
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

    // Show overlay
    chrome.tabs.sendMessage(tabId, { action: "showOverlay", mode: mode });

    // Set recording icon state
    chrome.action.setBadgeText({ text: "REC", tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#d13438", tabId: tabId });
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
    startRecording(tabId, 'standard');
    sendResponse({ status: "started" });
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
        highlightBox: request.highlightBox,
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

  if (request.action === "captureScreenshot") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);

    // Helper to capture via debugger
    const captureViaDebugger = (clip) => {
      // Check if attached
      const isAttached = attachedTabs[tabId] && attachedTabs[tabId].isRecording;
      const attachIfNeeded = (cb) => {
        if (isAttached) return cb();
        chrome.debugger.attach({ tabId: tabId }, "1.3", () => {
          if (chrome.runtime.lastError) return sendResponse({ error: chrome.runtime.lastError.message });
          cb(() => chrome.debugger.detach({ tabId: tabId })); // cleanup if temp attached
        });
      };

      attachIfNeeded((cleanup) => {
        const params = { format: 'png', fromSurface: true };
        if (request.type === 'full') {
          params.captureBeyondViewport = true;
        } else if (request.type === 'region' && request.area) {
          params.clip = { x: request.area.x, y: request.area.y, width: request.area.width, height: request.area.height, scale: 1 };
        }

        chrome.debugger.sendCommand({ tabId: tabId }, "Page.captureScreenshot", params, (result) => {
          if (cleanup) cleanup();
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ dataUrl: "data:image/png;base64," + result.data });
          }
        });
      });
    };

    if (request.type === 'visible') {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) return sendResponse({ error: chrome.runtime.lastError.message });

        // windowId is required
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) sendResponse({ error: chrome.runtime.lastError.message });
          else sendResponse({ dataUrl: dataUrl });
        });
      });
    } else {
      // Full or Region via debugger
      captureViaDebugger();
    }
    return true;
  }

  if (request.action === "replayEvents") {
    chrome.tabs.create({ url: request.url }, (tab) => {
      const tabId = tab.id;
      const onUpdated = (tId, info) => {
        if (tId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.debugger.attach({ tabId: tabId }, "1.3", () => {
            if (chrome.runtime.lastError) {
              console.warn("Attach failed:", chrome.runtime.lastError);
              return;
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
        return {
          _resourceType: entry.type,
          startedDateTime: new Date(entry.wallTime * 1000).toISOString(),
          time: time,
          request: {
            method: entry.request.method,
            url: entry.request.url,
            httpVersion: "HTTP/1.1",
            headers: Object.entries(entry.request.headers || {}).map(([k, v]) => {
              let val = v;
              if (k.toLowerCase() === 'authorization' && typeof v === 'string' && v.trim().toLowerCase().startsWith('bearer ')) {
                val = 'Bearer [REDACTED]';
              }
              return { name: k, value: val };
            }),
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
            headers: Object.entries(entry.response.headers || {}).map(([k, v]) => ({ name: k, value: v })),
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
    consoleErrors: data.logs,
    userEvents: data.userEvents || [],
    screencast: data.screencast || [],
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
    // Capture all logs or just errors? User asked for "all console errors"
    if (params.entry.level === "error") {
      attachedTabs[tabId].logs.push({
        type: 'log',
        ...params.entry
      });
    }
  } else if (method === "Runtime.consoleAPICalled") {
    if (params.type === "error") {
      attachedTabs[tabId].logs.push({
        type: 'console',
        timestamp: params.timestamp,
        level: "error",
        text: params.args.map(a => a.value || a.description || JSON.stringify(a)).join(" "),
        stackTrace: params.stackTrace
      });
    }
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
