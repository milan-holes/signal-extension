let currentReportData = null;
let currentConsoleSort = { key: 'time', dir: 'asc' };
let currentNetworkSort = { key: 'start', dir: 'asc' };
let isEditorMode = false;
let globalAllEvents = [];
let currentScreencastIndex = 0; // Sync between timeline and player
let pauseScreencast = null; // Global function to pause playback from outside renderScreencast

document.addEventListener('DOMContentLoaded', () => {
  // Theme Toggle
  // Theme Toggle
  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // Load from storage
  chrome.storage.local.get(['theme'], (result) => {
    // Default to stored, or 'dark' if previously favored, but let's align with 'light' default or user choice
    // Actually, since viewer was dark-first, maybe check if storage is empty? 
    // If empty, let's respect the existing variable `storedTheme` from localStorage as migration?
    // Or just default to 'light' for consistency with popup.
    applyTheme(result.theme || 'light');
  });

  // Listen for changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.theme) {
      applyTheme(changes.theme.newValue);
    }
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      chrome.storage.local.get(['theme'], (result) => {
        const current = result.theme || document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        chrome.storage.local.set({ theme: next }); // This triggers onChanged which applies it
        // applyTheme(next); // Redundant if onChanged works, but safe for immediate feedback
      });
    });
  }

  // Controls are now in HTML
  const importBtn = document.getElementById('importBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const replayBtn = document.getElementById('replayBtn');
  const fileInput = document.getElementById('fileInput');
  const reportDateSpan = document.getElementById('reportDate'); // New ID
  const editorModeBtn = document.getElementById('editorModeBtn');

  if (editorModeBtn) {
    editorModeBtn.addEventListener('click', () => {
      isEditorMode = !isEditorMode;
      if (isEditorMode) {
        editorModeBtn.classList.add('primary');
        editorModeBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Done Editing
        `;
      } else {
        editorModeBtn.classList.remove('primary');
        editorModeBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editor Mode
        `;
      }
      if (currentReportData) renderReport(currentReportData);
    });
  }

  if (importBtn) importBtn.addEventListener('click', () => fileInput.click());

  // Helper for Tabs in Replay Modal
  const replayTabs = document.querySelectorAll('#replayConfigModal .composer-tab');
  replayTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent bubbling just in case
      // Remove active from all tabs in this modal
      replayTabs.forEach(t => t.classList.remove('active'));

      // Remove active from all panels in this modal
      document.querySelectorAll('#replayConfigModal .composer-panel').forEach(p => p.classList.remove('active'));

      // Activate clicked tab
      tab.classList.add('active');

      // Activate target panel
      const targetId = `replay-${tab.dataset.tab}`;
      const target = document.getElementById(targetId);
      if (target) {
        target.classList.add('active');
      } else {
        console.error(`Target panel not found: ${targetId}`);
      }
    });
  });

  const replayConfigModal = document.getElementById('replayConfigModal');
  const closeReplayConfigBtn = document.getElementById('closeReplayConfigBtn');
  const startReplayBtn = document.getElementById('startReplayBtn');

  if (closeReplayConfigBtn) closeReplayConfigBtn.addEventListener('click', () => replayConfigModal.style.display = 'none');

  if (replayBtn) replayBtn.addEventListener('click', () => {
    if (!currentReportData || !currentReportData.userEvents) return;

    if (!currentReportData.userEvents.length) {
      alert("No events to replay.");
      return;
    }

    // Sort events
    const events = [...currentReportData.userEvents].sort((a, b) => a.timestamp - b.timestamp);

    // Find URL
    let startUrl = null;
    const nav = events.find(e => e.type === 'navigation');
    if (nav) startUrl = nav.url;

    // Populate Modal
    const urlInput = document.getElementById('replayUrlInput');
    const localInput = document.getElementById('replayLocalStorage');
    const sessionInput = document.getElementById('replaySessionStorage');
    const cookiesInput = document.getElementById('replayCookies');
    const requestsInput = document.getElementById('replayRequestsInput');

    if (urlInput) urlInput.value = startUrl || "";

    // Pre-fill storage from report if available
    let storage = currentReportData.storage || {};

    // Clear lists
    ['storageListLocal', 'storageListSession', 'storageListCookies', 'requestList'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });

    if (storage.localStorage) {
      Object.entries(storage.localStorage).forEach(([k, v]) => addStorageRow('storageListLocal', k, typeof v === 'string' ? v : JSON.stringify(v)));
    }
    if (storage.sessionStorage) {
      Object.entries(storage.sessionStorage).forEach(([k, v]) => addStorageRow('storageListSession', k, typeof v === 'string' ? v : JSON.stringify(v)));
    }
    if (storage.cookies) {
      Object.entries(storage.cookies).forEach(([k, v]) => addStorageRow('storageListCookies', k, typeof v === 'string' ? v : JSON.stringify(v)));
    }

    // Show Modal
    if (replayConfigModal) replayConfigModal.style.display = 'flex';
  });

  // Storage Builder Logic
  function addStorageRow(containerId, key = '', value = '') {
    const list = document.getElementById(containerId);
    if (!list) return;

    const div = document.createElement('div');
    div.className = 'storage-item';
    div.style.cssText = "display:flex; align-items:flex-start; gap:10px; padding:10px; border-bottom:1px solid var(--border-color); background:var(--bg-card); border-radius:6px; margin-bottom:8px; border:1px solid var(--border-color);";

    // Input Wrapper
    const inputsDiv = document.createElement('div');
    inputsDiv.style.cssText = "display:flex; flex-direction:column; gap:8px; flex:1; width:100%;";

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'form-input';
    keyInput.style.cssText = "font-family:monospace; font-size:12px; padding:8px; width:100%; box-sizing:border-box;";
    keyInput.placeholder = "Key";
    keyInput.value = key;

    const valInput = document.createElement('textarea');
    valInput.className = 'form-input';
    valInput.style.cssText = "font-family:monospace; font-size:12px; min-height:60px; padding:8px; resize:vertical; width:100%; box-sizing:border-box;";
    valInput.placeholder = "Value";
    valInput.value = value;

    inputsDiv.appendChild(keyInput);
    inputsDiv.appendChild(valInput);
    div.appendChild(inputsDiv);

    // Remove Button (Trash)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'action-btn';
    removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    removeBtn.style.cssText = "padding:8px; flex-shrink:0; color:var(--text-secondary); border-color:var(--border-color); width:34px; height:34px; display:flex; align-items:center; justify-content:center;";
    removeBtn.title = "Remove Item";

    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.color = 'var(--danger)';
      removeBtn.style.borderColor = 'var(--danger)';
      removeBtn.style.background = 'rgba(250, 56, 62, 0.1)';
    });

    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.color = 'var(--text-secondary)';
      removeBtn.style.borderColor = 'var(--border-color)';
      removeBtn.style.background = 'transparent';
    });

    removeBtn.onclick = () => div.remove();
    div.appendChild(removeBtn);

    list.appendChild(div);
  }

  ['addLocalBtn', 'addSessionBtn', 'addCookieBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        const type = id === 'addLocalBtn' ? 'storageListLocal' : (id === 'addSessionBtn' ? 'storageListSession' : 'storageListCookies');
        addStorageRow(type);
      });
    }
  });

  // Request Builder Logic
  const addReplayRequestBtn = document.getElementById('addReplayRequestBtn');
  const requestList = document.getElementById('requestList');

  if (addReplayRequestBtn) {
    addReplayRequestBtn.addEventListener('click', () => {
      addRequestRow();
    });
  }

  function addRequestRow(data = {}) {
    if (!requestList) return;
    const div = document.createElement('div');
    div.className = 'request-item';
    div.style.cssText = "display:flex; gap:10px; align-items:flex-start; padding:10px; border:1px solid var(--border-color); border-radius:4px; margin-bottom:10px; background:var(--bg-card);";

    // Inputs Wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = "display:flex; flex-direction:column; gap:8px; flex:1; min-width:0;";

    // Method & URL Row
    const row1 = document.createElement('div');
    row1.style.cssText = "display:flex; gap:10px;";

    const methodSelect = document.createElement('select');
    methodSelect.className = 'form-input';
    methodSelect.style.flex = "0 0 80px";
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (data.method === m) opt.selected = true;
      methodSelect.appendChild(opt);
    });

    const urlInput = document.createElement('input');
    urlInput.type = "text";
    urlInput.className = 'form-input';
    urlInput.style.flex = "1";
    urlInput.placeholder = "https://api.example.com/...";
    if (data.url) urlInput.value = data.url;

    row1.appendChild(methodSelect);
    row1.appendChild(urlInput);
    wrapper.appendChild(row1);

    // Headers & Body Row
    const row2 = document.createElement('div');
    row2.style.cssText = "display:flex; gap:10px;";

    const headersInput = document.createElement('textarea');
    headersInput.className = 'form-input';
    headersInput.style.cssText = "flex:1; height:60px; font-family:monospace; font-size:12px;";
    headersInput.placeholder = "Headers (Key: Value)";
    if (data.headers) {
      headersInput.value = Object.entries(data.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
    }

    const bodyInput = document.createElement('textarea');
    bodyInput.className = 'form-input';
    bodyInput.style.cssText = "flex:1; height:60px; font-family:monospace; font-size:12px;";
    bodyInput.placeholder = "Body (JSON or Text)";
    if (data.body) bodyInput.value = data.body;

    row2.appendChild(headersInput);
    row2.appendChild(bodyInput);
    wrapper.appendChild(row2);

    div.appendChild(wrapper);

    // Remove Button (Trash)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'action-btn';
    removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    removeBtn.style.cssText = "padding:8px; flex-shrink:0; color:var(--text-secondary); border-color:var(--border-color); width:34px; height:34px; display:flex; align-items:center; justify-content:center;";
    removeBtn.title = "Remove Request";

    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.color = 'var(--danger)';
      removeBtn.style.borderColor = 'var(--danger)';
      removeBtn.style.background = 'rgba(250, 56, 62, 0.1)';
    });

    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.color = 'var(--text-secondary)';
      removeBtn.style.borderColor = 'var(--border-color)';
      removeBtn.style.background = 'transparent';
    });

    removeBtn.onclick = () => div.remove();
    div.appendChild(removeBtn);

    requestList.appendChild(div);
  }

  if (startReplayBtn) startReplayBtn.addEventListener('click', () => {
    const url = document.getElementById('replayUrlInput').value.trim();
    const clearStorage = document.getElementById('replayClearStorageCheck').checked;

    let localStorageData = {};
    let sessionStorageData = {};
    let cookiesData = {};
    let requests = [];

    // Gather Storage Data
    const gatherStorage = (listId) => {
      const data = {};
      const items = document.querySelectorAll(`#${listId} .storage-item`);
      items.forEach(item => {
        const key = item.querySelector('input').value.trim();
        const val = item.querySelector('textarea').value;
        if (key) data[key] = val;
      });
      return data;
    };

    localStorageData = gatherStorage('storageListLocal');
    sessionStorageData = gatherStorage('storageListSession');
    cookiesData = gatherStorage('storageListCookies');

    // Gather Requests from Builder
    try {
      const items = document.querySelectorAll('#requestList .request-item');
      items.forEach(item => {
        const method = item.querySelector('select').value;
        const urlIn = item.querySelector('input').value.trim();
        const headersText = item.querySelectorAll('textarea')[0].value.trim();
        const bodyText = item.querySelectorAll('textarea')[1].value.trim(); // Assume second is body

        if (!urlIn) return; // Skip empty URL

        const headers = {};
        if (headersText) {
          headersText.split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
              headers[parts[0].trim()] = parts.slice(1).join(':').trim();
            }
          });
        }

        requests.push({
          method: method,
          url: urlIn,
          headers: headers,
          body: bodyText
        });
      });
    } catch (e) { alert("Error parsing requests: " + e.message); return; }

    if (!url) { alert("URL is required"); return; }

    // Get events again
    if (!currentReportData || !currentReportData.userEvents) return;
    const events = [...currentReportData.userEvents].sort((a, b) => a.timestamp - b.timestamp);

    chrome.runtime.sendMessage({
      action: "replayEvents",
      url: url,
      events: events,
      context: {
        clearStorage: clearStorage,
        localStorage: localStorageData,
        sessionStorage: sessionStorageData,
        cookies: cookiesData,
        requests: requests
      }
    });

    replayConfigModal.style.display = 'none';
  });

  const jiraBtn = document.getElementById('jiraBtn');
  if (jiraBtn) jiraBtn.addEventListener('click', () => {
    try {
      if (!currentReportData) {
        alert("No report data found. Please import a report first.");
        return;
      }
      const blob = new Blob([JSON.stringify(currentReportData, null, 2)], { type: "application/json" });
      const filename = `debug-report-${new Date().toISOString()}.json`;

      if (window.jiraHelper) {
        window.jiraHelper.showModal(blob, filename);
      } else {
        alert("JIRA Helper not loaded.");
      }
    } catch (e) {
      alert("Error launching JIRA modal: " + e.message);
    }
  });

  // Download logic
  if (downloadBtn) downloadBtn.addEventListener('click', () => {
    if (!currentReportData) return;

    const originalText = downloadBtn.innerHTML;
    // Ensure keyframes exist for simple spin if not present
    if (!document.getElementById('spin-style')) {
      const style = document.createElement('style');
      style.id = 'spin-style';
      style.textContent = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    downloadBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Exporting...`;
    downloadBtn.disabled = true;

    // Use setTimeout to allow UI update before heavy sync work (JSON.stringify)
    setTimeout(() => {
      try {
        // Auto-save pending Environment Description
        const envDescInput = document.querySelector('.env-desc-input');
        if (envDescInput) {
          if (!currentReportData.environment) currentReportData.environment = {};
          if (!currentReportData.environment.Context) currentReportData.environment.Context = {};
          currentReportData.environment.Context['Issue Description'] = envDescInput.value;
        }

        // Auto-save open Storage Editors
        const openStorageEditors = document.querySelectorAll('#storageTable textarea');
        if (openStorageEditors.length > 0) {
          const activeChip = document.querySelector('#storage .filter-chip.active');
          const type = activeChip ? activeChip.dataset.storageType : 'local';

          let storeTarget = null;
          if (currentReportData.storage) {
            if (type === 'local') storeTarget = currentReportData.storage.localStorage;
            else if (type === 'session') storeTarget = currentReportData.storage.sessionStorage;
            else if (type === 'cookies') storeTarget = currentReportData.storage.cookies;
          }

          if (storeTarget) {
            openStorageEditors.forEach(editor => {
              const row = editor.closest('tr');
              if (row) {
                const keyCell = row.firstElementChild;
                if (keyCell) {
                  const key = keyCell.innerText;
                  storeTarget[key] = editor.value;
                }
              }
            });
          }
        }

        if (typeof JSZip !== 'undefined') {
          const zip = new JSZip();
          // Minify JSON by removing indentation
          const jsonStr = JSON.stringify(currentReportData);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `debug-report-${timestamp}.json`;

          zip.file(filename, jsonStr);

          // Compress
          zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 9 }
          }).then(function (content) {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `debug-report-${timestamp}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);

            // Restore
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
          }).catch(err => {
            console.error("Zip generation failed:", err);
            alert("Export failed: " + err.message);
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
          });
        } else {
          // Fallback if JSZip missing
          const blob = new Blob([JSON.stringify(currentReportData, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `debug-report-${new Date().toISOString()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 100);

          downloadBtn.innerHTML = originalText;
          downloadBtn.disabled = false;
        }
      } catch (e) {
        console.error("Export failed:", e);
        alert("Export failed: " + e.message);
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
      }
    }, 50);
  });

  // --- Share via Webhook ---
  const shareBtn = document.getElementById('shareBtn');
  const webhookModal = document.getElementById('webhookModal');
  const closeWebhookBtn = document.getElementById('closeWebhookBtn');
  const sendWebhookBtn = document.getElementById('sendWebhookBtn');
  const webhookUrl = document.getElementById('webhookUrl');
  const webhookMethod = document.getElementById('webhookMethod');
  const webhookHeaders = document.getElementById('webhookHeaders');
  const webhookPayload = document.getElementById('webhookPayload');
  const webhookStatus = document.getElementById('webhookStatus');

  // Load saved webhook settings from localStorage
  if (webhookUrl) webhookUrl.value = localStorage.getItem('signal_webhook_url') || '';
  if (webhookMethod) webhookMethod.value = localStorage.getItem('signal_webhook_method') || 'POST';
  if (webhookHeaders) webhookHeaders.value = localStorage.getItem('signal_webhook_headers') || '';
  if (webhookPayload) webhookPayload.value = localStorage.getItem('signal_webhook_payload') || '{\n  "file": "%export%",\n  "screenshot": "%screenshot%",\n  "text": "New debug report"\n}';

  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      if (!currentReportData) {
        alert('No report loaded. Import a report first.');
        return;
      }
      if (webhookModal) webhookModal.style.display = 'flex';
      if (webhookStatus) webhookStatus.style.display = 'none';
    });
  }

  if (closeWebhookBtn) {
    closeWebhookBtn.addEventListener('click', () => {
      if (webhookModal) webhookModal.style.display = 'none';
    });
  }

  if (webhookModal) {
    webhookModal.addEventListener('click', (e) => {
      if (e.target === webhookModal) webhookModal.style.display = 'none';
    });
  }

  if (sendWebhookBtn) {
    sendWebhookBtn.addEventListener('click', async () => {
      const url = webhookUrl ? webhookUrl.value.trim() : '';
      if (!url) {
        alert('Please enter a webhook URL.');
        webhookUrl.focus();
        return;
      }

      if (!currentReportData) {
        alert('No report data to send.');
        return;
      }

      // Save settings to localStorage
      localStorage.setItem('signal_webhook_url', url);
      localStorage.setItem('signal_webhook_method', webhookMethod ? webhookMethod.value : 'POST');
      localStorage.setItem('signal_webhook_headers', webhookHeaders ? webhookHeaders.value : '');
      localStorage.setItem('signal_webhook_payload', webhookPayload ? webhookPayload.value : '');

      const templateText = webhookPayload ? webhookPayload.value.trim() : '';
      if (!templateText) {
        alert('Please define FormData fields.');
        webhookPayload.focus();
        return;
      }

      // Parse the template JSON
      let fields;
      try {
        fields = JSON.parse(templateText);
        if (typeof fields !== 'object' || Array.isArray(fields)) {
          throw new Error('Must be a JSON object (key-value pairs).');
        }
      } catch (parseErr) {
        alert('Invalid JSON in FormData fields: ' + parseErr.message);
        webhookPayload.focus();
        return;
      }

      // Parse custom headers (skip Content-Type — browser sets multipart boundary)
      const headers = {};
      if (webhookHeaders && webhookHeaders.value.trim()) {
        webhookHeaders.value.trim().split('\n').forEach(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const val = line.substring(colonIndex + 1).trim();
            if (key && key.toLowerCase() !== 'content-type') headers[key] = val;
          }
        });
      }

      // Show loading state
      const originalBtnText = sendWebhookBtn.innerHTML;
      sendWebhookBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right: 8px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Preparing...`;
      sendWebhookBtn.disabled = true;

      // Ensure spin keyframe
      if (!document.getElementById('spin-style')) {
        const style = document.createElement('style');
        style.id = 'spin-style';
        style.textContent = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
      }

      try {
        const formData = new FormData();
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const attachedParts = [];

        for (const [fieldName, fieldValue] of Object.entries(fields)) {
          const val = String(fieldValue).trim();

          if (val === '%export%') {
            // Attach compressed zip as file
            if (typeof JSZip !== 'undefined') {
              const zip = new JSZip();
              const jsonStr = JSON.stringify(currentReportData);
              zip.file(`debug-report-${ts}.json`, jsonStr);
              const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 9 }
              });
              formData.append(fieldName, zipBlob, `debug-report-${ts}.zip`);
            } else {
              const jsonBlob = new Blob([JSON.stringify(currentReportData)], { type: 'application/json' });
              formData.append(fieldName, jsonBlob, `debug-report-${ts}.json`);
            }
            attachedParts.push(fieldName + ' (export)');

          } else if (val === '%screenshot%') {
            // Attach current screenshot as file
            const screenPlayer = document.getElementById('screenPlayer');
            if (screenPlayer && screenPlayer.src && screenPlayer.src.startsWith('data:image')) {
              const dataUrl = screenPlayer.src;
              const byteString = atob(dataUrl.split(',')[1]);
              const mimeType = dataUrl.split(',')[0].split(':')[1].split(';')[0];
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              const screenshotBlob = new Blob([ab], { type: mimeType });
              formData.append(fieldName, screenshotBlob, `screenshot-${ts}.jpg`);
              attachedParts.push(fieldName + ' (screenshot)');
            } else {
              attachedParts.push(fieldName + ' (no screenshot available)');
            }

          } else {
            // Plain text field
            formData.append(fieldName, val);
            attachedParts.push(fieldName);
          }
        }

        sendWebhookBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right: 8px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Sending...`;

        const method = webhookMethod ? webhookMethod.value : 'POST';
        const res = await fetch(url, {
          method: method,
          headers: headers,
          body: formData
        });

        if (webhookStatus) {
          webhookStatus.style.display = 'block';
          if (res.ok) {
            webhookStatus.style.background = 'rgba(74, 222, 128, 0.1)';
            webhookStatus.style.border = '1px solid rgba(74, 222, 128, 0.3)';
            webhookStatus.style.color = 'var(--success)';
            webhookStatus.innerHTML = `&#10003; Sent successfully &mdash; ${res.status} ${res.statusText}<br><span style="font-size:11px; opacity:0.8;">Fields: ${attachedParts.join(', ')}</span>`;
          } else {
            const errText = await res.text().catch(() => '');
            webhookStatus.style.background = 'rgba(248, 113, 113, 0.1)';
            webhookStatus.style.border = '1px solid rgba(248, 113, 113, 0.3)';
            webhookStatus.style.color = 'var(--danger)';
            webhookStatus.innerHTML = `&#10007; Failed &mdash; ${res.status} ${res.statusText}${errText ? '<br><span style="font-size:11px; opacity:0.8;">' + escapeHtml(errText.substring(0, 200)) + '</span>' : ''}`;
          }
        }
      } catch (e) {
        if (webhookStatus) {
          webhookStatus.style.display = 'block';
          webhookStatus.style.background = 'rgba(248, 113, 113, 0.1)';
          webhookStatus.style.border = '1px solid rgba(248, 113, 113, 0.3)';
          webhookStatus.style.color = 'var(--danger)';
          webhookStatus.innerHTML = `&#10007; Error: ${escapeHtml(e.message)}`;
        }
      } finally {
        sendWebhookBtn.innerHTML = originalBtnText;
        sendWebhookBtn.disabled = false;
      }
    });
  }

  if (fileInput) fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    reportDateSpan.textContent = "Loading...";

    // Loading State
    const importBtnHeader = document.getElementById('importBtn');
    const importBtnMain = document.getElementById('mainImportBtn');

    let originalHeaderHTML = '';
    let originalMainHTML = '';

    if (importBtnHeader) {
      originalHeaderHTML = importBtnHeader.innerHTML;
      importBtnHeader.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Importing...`;
      importBtnHeader.disabled = true;
    }
    if (importBtnMain) {
      originalMainHTML = importBtnMain.innerHTML;
      importBtnMain.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right: 6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Importing...`;
      importBtnMain.disabled = true;
    }

    const resetButtons = () => {
      if (importBtnHeader) {
        importBtnHeader.innerHTML = originalHeaderHTML;
        importBtnHeader.disabled = false;
      }
      if (importBtnMain) {
        importBtnMain.innerHTML = originalMainHTML;
        importBtnMain.disabled = false;
      }
      fileInput.value = '';
    };

    setTimeout(() => {
      // Handle ZIP files if JSZip is available
      if ((file.name.endsWith('.zip') || file.type.includes('zip')) && typeof JSZip !== 'undefined') {
        new JSZip().loadAsync(file).then(function (zip) {
          // Find the first JSON file inside
          const jsonFiles = Object.keys(zip.files).filter(name => name.endsWith('.json') && !name.startsWith('__MACOSX'));
          if (jsonFiles.length > 0) {
            const targetFile = jsonFiles[0];
            console.log("Parsing ZIP entry:", targetFile);
            zip.file(targetFile).async("string").then(function (content) {
              try {
                const data = JSON.parse(content);
                renderReport(data);
                resetButtons();
              } catch (err) {
                console.error("JSON parse error in " + targetFile, err);
                alert("Invalid JSON file inside ZIP (" + targetFile + "): " + err.message);
                reportDateSpan.textContent = "";
                resetButtons();
              }
            });
          } else {
            alert("No JSON file found in ZIP archive");
            reportDateSpan.textContent = "";
            resetButtons();
          }
        }, function (e) {
          alert("Error reading ZIP file: " + e.message);
          reportDateSpan.textContent = "";
          resetButtons();
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          renderReport(data);
          resetButtons();
        } catch (err) {
          alert("Invalid JSON file");
          reportDateSpan.textContent = "";
          resetButtons();
        }
      };
      reader.onerror = () => resetButtons();
      reader.readAsText(file);
    }, 50);
  });

  // Check for existing data in storage (optional, if passed from popup in future)
  // Check for existing data in storage (optional, if passed from popup in future)
  chrome.storage.local.get('viewerData', (result) => {
    const data = result.viewerData;
    if (data) {
      renderReport(data);
      // Clear it so we don't show old data next time if user opens viewer directly
      chrome.storage.local.remove('viewerData');
    } else {
      showEmptyState();
    }
  });

  const mainImportBtn = document.getElementById('mainImportBtn');
  if (mainImportBtn) mainImportBtn.addEventListener('click', () => fileInput.click());

  // Tab switching logic
  document.querySelectorAll('.tab-btn').forEach(tab => {
    // Hide Content Changes tab explicitly as per request
    if (tab.dataset.target === 'changesList' || tab.dataset.target === 'changes') {
      tab.style.display = 'none';
      return;
    }

    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');

      // Close detail panel when switching tabs
      const panel = document.getElementById('detailPanel');
      if (panel) panel.classList.remove('open');
    });
  });

  // Filter logic
  const searchInput = document.getElementById('networkSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentFilter.search = e.target.value.toLowerCase();
      resetNetworkChips();
      currentFilter.type = 'all';
      filterAndRenderNetwork();
    });
  }

  const consoleSearchInput = document.getElementById('consoleSearch');
  if (consoleSearchInput) {
    consoleSearchInput.addEventListener('input', (e) => {
      currentConsoleFilter.search = e.target.value.toLowerCase();
      resetConsoleChips();
      currentConsoleFilter.level = 'all';
      filterAndRenderConsole();
    });
  }

  // Filter Chips Logic (only main console/network screens, not timeline panels)
  document.querySelectorAll('#network .filter-chip, #console .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const parent = chip.parentElement;
      const isNetwork = chip.closest('#network');

      // Clear all chips in this tab
      const tabId = isNetwork ? '#network' : '#console';
      const tabEl = document.querySelector(tabId);
      if (tabEl) {
        tabEl.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      }
      chip.classList.add('active');

      if (isNetwork) {
        const type = chip.textContent.toLowerCase();
        if (type === 'all') currentFilter.type = 'all';
        else if (type.includes('fetch') || type.includes('xhr')) currentFilter.type = 'xhr';
        else if (type === 'js') currentFilter.type = 'js';
        else if (type === 'css') currentFilter.type = 'css';
        else if (type === 'img') currentFilter.type = 'img';
        else if (type === 'media') currentFilter.type = 'media';
        else if (type === 'doc') currentFilter.type = 'doc';
        else currentFilter.type = 'all';

        filterAndRenderNetwork();
      } else {
        // Console Tab
        const filter = chip.dataset.filter || 'all';
        currentConsoleFilter.level = filter;
        filterAndRenderConsole();
      }
    });
  });

  function resetNetworkChips() {
    const wrapper = document.querySelector('#network .filters-bar');
    if (wrapper) {
      wrapper.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      const first = wrapper.querySelector('.filter-chip');
      if (first) first.classList.add('active');
    }
  }

  function resetConsoleChips() {
    const wrapper = document.querySelector('#console .filters-bar');
    if (wrapper) {
      wrapper.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      const first = wrapper.querySelector('.filter-chip');
      if (first) first.classList.add('active');
    }
  }

  // Sorting Listeners
  document.querySelectorAll('#consoleTable th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (currentConsoleSort.key === key) {
        currentConsoleSort.dir = currentConsoleSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        currentConsoleSort.key = key;
        currentConsoleSort.dir = 'asc';
      }
      filterAndRenderConsole();
      updateSortIndicators('#consoleTable', currentConsoleSort);
    });
  });

  document.querySelectorAll('#networkTable th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (currentNetworkSort.key === key) {
        currentNetworkSort.dir = currentNetworkSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        currentNetworkSort.key = key;
        currentNetworkSort.dir = 'asc';
      }
      filterAndRenderNetwork();
      updateSortIndicators('#networkTable', currentNetworkSort);
    });
  });

  function updateSortIndicators(tableId, sortState) {
    document.querySelectorAll(`${tableId} th.sortable`).forEach(th => {
      th.style.background = ''; // reset head bg
      const svg = th.querySelector('svg');
      if (svg) {
        svg.style.opacity = '0.3';
        svg.style.transform = '';
        svg.style.color = ''; // reset
      }

      if (th.dataset.key === sortState.key) {
        th.style.background = 'rgba(46, 137, 255, 0.1)';
        if (svg) {
          svg.style.opacity = '1';
          svg.style.color = 'var(--primary)';
          svg.style.transition = 'transform 0.2s';
          if (sortState.dir === 'desc') {
            svg.style.transform = 'rotate(180deg)';
          }
        }
      }
    });
  }

  // Close Detail Panel
  const closeDetailBtn = document.getElementById('closeDetailBtn');
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', () => {
      document.getElementById('detailPanel').classList.remove('open');
    });
  }

  // Resizable Detail Panel
  const detailPanel = document.getElementById('detailPanel');
  const detailResizeHandle = document.getElementById('detailResizeHandle');
  if (detailPanel && detailResizeHandle) {
    detailResizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = detailPanel.offsetWidth;
      detailResizeHandle.classList.add('active');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      function onDrag(e) {
        // Dragging left increases width (panel is on the right)
        const newWidth = startWidth - (e.clientX - startX);
        const minW = 280;
        const maxW = window.innerWidth * 0.7;
        detailPanel.style.width = Math.max(minW, Math.min(maxW, newWidth)) + 'px';
      }

      function onStop() {
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', onStop);
        detailResizeHandle.classList.remove('active');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }

      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onStop);
    });
  }

  // Request Composer Logic
  const requestComposer = document.getElementById('requestComposer');
  const closeComposerBtn = document.getElementById('closeComposerBtn');
  const sendRequestBtn = document.getElementById('sendRequestBtn');

  if (closeComposerBtn) {
    closeComposerBtn.addEventListener('click', () => {
      requestComposer.style.display = 'none';
    });
  }

  // Close when clicking outside modal
  if (requestComposer) {
    requestComposer.addEventListener('click', (e) => {
      if (e.target === requestComposer) {
        requestComposer.style.display = 'none';
      }
    });
  }

  // Composer Tabs
  // Composer Tabs (Request Composer only)
  document.querySelectorAll('#requestComposer .composer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#requestComposer .composer-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#requestComposer .composer-panel').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const target = document.getElementById(`composer-${tab.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });

  if (sendRequestBtn) {
    sendRequestBtn.addEventListener('click', async () => {
      const method = document.getElementById('composerMethod').value;
      const url = document.getElementById('composerUrl').value;
      const headersText = document.getElementById('composerHeadersInput').value;
      const bodyText = document.getElementById('composerBodyInput').value;

      const output = document.getElementById('composerResponseOutput');
      const headersOutput = document.getElementById('composerResponseHeaders');
      const statusDiv = document.getElementById('composerResponseStatus');

      // Switch to response tab
      const resTab = document.querySelector('#requestComposer .composer-tab[data-tab="response"]');
      if (resTab) resTab.click();

      console.log(`Sending ${method} request to ${url}`);
      output.textContent = "Sending request...";
      headersOutput.textContent = "";
      statusDiv.textContent = "";

      try {
        const headers = {};
        headersText.split('\n').forEach(line => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join(':').trim();
            if (key) headers[key] = val;
          }
        });

        const options = {
          method: method,
          headers: headers,
          redirect: 'manual' // Prevent auto-following redirects to see the actual response code
        };

        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && bodyText) {
          options.body = bodyText;
        }

        const startTime = performance.now();
        const res = await fetch(url, options);
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        const contentType = res.headers.get('content-type') || '';

        // Format Headers
        let resHeadersStr = "";
        res.headers.forEach((val, key) => {
          resHeadersStr += `${key}: ${val}\n`;
        });
        if (!resHeadersStr) resHeadersStr = "(No headers available or CORS restricted)";
        headersOutput.textContent = resHeadersStr;

        let statusColor = 'var(--info)';
        if (res.ok) statusColor = 'var(--success)';
        else if (res.status >= 300 && res.status < 400) statusColor = 'var(--warning)';
        else if (res.status >= 400) statusColor = 'var(--danger)';

        statusDiv.innerHTML = `Status: <span style="color:${statusColor}">${res.status} ${res.statusText}</span> | Time: ${duration}ms`;

        if (contentType.startsWith('image/')) {
          try {
            const blob = await res.blob();
            const imgUrl = URL.createObjectURL(blob);
            output.innerHTML = `<div style="padding:10px; display:flex; flex-direction:column; align-items:center;">
                    <img src="${imgUrl}" style="max-width:100%; max-height:400px; border:1px solid var(--border-color); object-fit:contain;">
                    <div style="margin-top:8px; font-size:12px; color:var(--text-secondary);">${contentType} (${blob.size} bytes)</div>
                </div>`;
          } catch (e) {
            output.textContent = "Error loading image: " + e.message;
          }
        } else {
          let data;
          if (contentType.includes('application/json')) {
            try {
              data = await res.json();
              data = JSON.stringify(data, null, 2);
            } catch (jsonErr) {
              data = await res.text();
            }
          } else {
            data = await res.text();
          }
          output.textContent = typeof data === 'string' ? data.trim() : data;
        }

        if (res.type === 'opaqueredirect') {
          output.textContent += "\n[Opaque Redirect - Request was redirected but CORS prevented checking destination]";
        }

      } catch (err) {
        output.textContent = "Error sending request: " + err.message;
        if (headersOutput) headersOutput.textContent = "";
        statusDiv.textContent = "Failed";
        statusDiv.style.color = "var(--danger)";
        console.error("Request failed:", err);
      }
    });
  }
});

let currentNetworkEntries = [];
let currentFilter = { type: 'all', search: '' };

let currentConsoleErrors = [];
let allConsoleErrors = [];
let currentConsoleFilter = { level: 'all', search: '' };

// Timeline detail panel filter state
let timelineConsoleFilter = { level: 'all', search: '' };
let timelineNetworkFilter = { type: 'all', search: '' };

function showEmptyState() {
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = 'flex';
}

function hideEmptyState() {
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = 'none';
}

function renderReport(data) {
  hideEmptyState();
  currentReportData = data;

  // Persistence disabled per user request


  const hasEvents = data.userEvents && data.userEvents.length > 0;

  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.style.display = 'flex';
    downloadBtn.disabled = !hasEvents;

    if (!hasEvents) {
      downloadBtn.style.opacity = '0.5';
      downloadBtn.style.cursor = 'not-allowed';
      downloadBtn.style.background = 'var(--bg-disabled, #e0e0e0)';
      downloadBtn.style.color = 'var(--text-disabled, #999)';
      downloadBtn.style.pointerEvents = 'none'; // Prevent hover
    } else {
      downloadBtn.style.opacity = '1';
      downloadBtn.style.cursor = 'pointer';
      downloadBtn.style.background = ''; // Revert to CSS
      downloadBtn.style.color = ''; // Revert to CSS
      downloadBtn.style.pointerEvents = 'auto';
    }

    downloadBtn.title = hasEvents ? "Download Report" : "No user events recorded";
  }

  const replayBtn = document.getElementById('replayBtn');
  if (replayBtn) {
    replayBtn.style.display = 'flex';
    replayBtn.disabled = !hasEvents;

    if (!hasEvents) {
      replayBtn.style.opacity = '0.5';
      replayBtn.style.cursor = 'not-allowed';
      replayBtn.style.background = 'var(--bg-disabled, #e0e0e0)';
      replayBtn.style.color = 'var(--text-disabled, #999)';
      replayBtn.style.pointerEvents = 'none';
    } else {
      replayBtn.style.opacity = '1';
      replayBtn.style.cursor = 'pointer';
      replayBtn.style.background = '';
      replayBtn.style.color = '';
      replayBtn.style.pointerEvents = 'auto';
    }

    replayBtn.title = hasEvents ? "Replay Events" : "No user events recorded";
  }

  if (window.jiraHelper) {
    window.jiraHelper.readyPromise.then(() => {
      if (window.jiraHelper.isConfigured()) {
        const jiraBtn = document.getElementById('jiraBtn');
        if (jiraBtn) jiraBtn.style.display = 'flex';
      }
    });
  }

  // Reset filter
  currentFilter = { type: 'all', search: '' };
  currentConsoleFilter = { level: 'all', search: '' };

  const searchInput = document.getElementById('networkSearch');
  if (searchInput) searchInput.value = '';
  const consoleInput = document.getElementById('consoleSearch');
  if (consoleInput) consoleInput.value = '';

  // Update title with generation date
  const dateSpan = document.getElementById('reportDate');
  if (dateSpan) {
    dateSpan.textContent = data.generatedAt ? `(${new Date(data.generatedAt).toLocaleString()})` : '';
  }

  // Clear tables
  document.querySelector('#consoleTable tbody').innerHTML = '';
  document.querySelector('#networkTable tbody').innerHTML = '';
  document.querySelector('#timelineTable tbody').innerHTML = '';
  document.querySelector('#issuesList').innerHTML = '';

  renderConsole(data.consoleErrors || []);
  currentConsoleErrors = data.consoleErrors || []; // Store for filtering
  allConsoleErrors = data.consoleErrors || []; // Store original data for filtering logic
  try {
    renderTimeline(data.userEvents || [], data.consoleErrors || [], (data.har && data.har.log && data.har.log.entries) ? data.har.log.entries : [], data.issues || [], data.screencast || []);
  } catch (e) {
    console.error("Error rendering timeline:", e);
    // Ensure globalAllEvents is defined even if renderTimeline fails
    if (!globalAllEvents.length) globalAllEvents = [];
  }

  // Use the globalAllEvents populated by renderTimeline
  try {
    renderEnvironment(data.environment || {});
  } catch (e) { console.error("Error rendering environment:", e); }

  try {
    renderStorage(data.storage || {});
  } catch (e) { console.error("Error rendering storage:", e); }

  try {
    renderScreencast(data.screencast || []);
  } catch (e) { console.error("Error rendering screencast:", e); }

  try {
    renderIssues(data.issues || [], data.screencast || [], globalAllEvents);
  } catch (e) { console.error("Error rendering issues:", e); }

  // Hide Content Changes for now
  // renderContentChanges(data.contentChanges || [], data.screencast || []);
  const changesTab = document.querySelector('.tab-btn[data-target="changesList"]') || document.querySelector('.tab-btn[data-target="changes"]');
  if (changesTab) changesTab.style.display = 'none';

  // Store entries and render
  currentNetworkEntries = (data.har && data.har.log && data.har.log.entries) ? data.har.log.entries : [];
  try {
    filterAndRenderNetwork();
  } catch (e) { console.error("Error rendering network:", e); }

  // Default to first tab (Environment) if no tab is active
  if (!document.querySelector('.tab-btn.active')) {
    const envTab = document.querySelector('.tab-btn[data-target="environment"]');
    if (envTab) envTab.click();
  }
}

function renderContentChanges(changes, frames) {
  const container = document.getElementById('changesList');
  if (!changes || changes.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px;">No content changes recorded.</div>';
    return;
  }

  container.innerHTML = '';

  changes.forEach(change => {
    const div = document.createElement('div');
    div.className = "change-card";
    div.style.border = "1px solid #ccc";
    div.style.marginBottom = "20px";
    div.style.padding = "10px";
    div.style.borderRadius = "4px";
    div.style.background = "#fff";

    // Find closest frame
    let closestFrame = null;
    let minDiff = Infinity;

    frames.forEach(frame => {
      if (frame.wallTime) {
        const diff = Math.abs(frame.wallTime - change.timestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frame;
        }
      }
    });

    let imageHtml = '';
    if (closestFrame) {
      imageHtml = `
        <div style="position:relative; display:inline-block; margin-top:10px; border:1px solid #ddd;">
             <img src="data:image/jpeg;base64,${closestFrame.data}" style="max-width: 100%; display:block;">
        </div>
        `;
    }

    let diffHtml = '<table style="width:100%; border-collapse:collapse; margin-top:10px;">';
    diffHtml += '<tr><th style="text-align:left; border-bottom:1px solid #eee;">Property</th><th style="text-align:left; border-bottom:1px solid #eee;">New Value</th></tr>';

    if (change.changes.innerText) {
      diffHtml += `<tr><td style="padding:5px; border-bottom:1px solid #eee;">Text</td><td style="padding:5px; border-bottom:1px solid #eee; font-family:monospace;">${escapeHtml(change.changes.innerText)}</td></tr>`;
    }
    for (const [prop, val] of Object.entries(change.changes.style)) {
      diffHtml += `<tr><td style="padding:5px; border-bottom:1px solid #eee;">Style: ${prop}</td><td style="padding:5px; border-bottom:1px solid #eee; font-family:monospace;">${val}</td></tr>`;
    }
    diffHtml += '</table>';

    div.innerHTML = `
      <h3 style="margin-top:0;">Change at ${new Date(change.timestamp).toLocaleTimeString()}</h3>
      <div style="font-size:12px; color:#666;">Target: <code style="background:#f4f4f4; padding:2px;">${change.tagName}</code></div>
      ${diffHtml}
      ${imageHtml}
    `;
    container.appendChild(div);
  });
}

function filterAndRenderNetwork() {
  let filtered = currentNetworkEntries.filter(entry => {
    // Search filter
    if (currentFilter.search) {
      const url = (entry.request.url || '').toLowerCase();
      if (!url.includes(currentFilter.search)) {
        return false;
      }
    }

    // Type filter
    if (currentFilter.type !== 'all') {
      const type = (entry._resourceType || '').toLowerCase();
      const mime = (entry.response.content.mimeType || '').toLowerCase();

      switch (currentFilter.type) {
        case 'xhr': return type === 'xhr' || type === 'fetch' || mime.includes('json');
        case 'js': return type === 'script' || mime.includes('javascript') || mime.includes('jscript') || mime.includes('ecmascript');
        case 'css': return type === 'stylesheet' || mime.includes('css');
        case 'img': return type === 'image' || mime.includes('image');
        case 'media': return type === 'media' || mime.includes('video') || mime.includes('audio');
        case 'font': return type === 'font' || mime.includes('font');
        case 'doc': return type === 'document' || mime.includes('html');
        case 'ws': return type === 'websocket';
        case 'other': return !['xhr', 'fetch', 'script', 'stylesheet', 'image', 'media', 'font', 'document', 'websocket', 'manifest'].includes(type);
        default: return true;
      }
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    let valA, valB;
    if (currentNetworkSort.key === 'start') {
      valA = new Date(a.startedDateTime).getTime();
      valB = new Date(b.startedDateTime).getTime();
    } else if (currentNetworkSort.key === 'method') {
      valA = a.request.method || ''; valB = b.request.method || '';
    } else if (currentNetworkSort.key === 'status') {
      valA = a.response.status || 0; valB = b.response.status || 0;
    } else if (currentNetworkSort.key === 'name') {
      valA = a.request.url || ''; valB = b.request.url || '';
    } else if (currentNetworkSort.key === 'time') {
      valA = a.time || 0; valB = b.time || 0;
    }

    if (valA < valB) return currentNetworkSort.dir === 'asc' ? -1 : 1;
    if (valA > valB) return currentNetworkSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  renderNetwork({ log: { entries: filtered } });
}

function filterAndRenderConsole() {
  let filtered = allConsoleErrors.filter(err => {
    // Search Filter
    if (currentConsoleFilter.search) {
      const text = (err.text || err.message || '').toLowerCase();
      if (!text.includes(currentConsoleFilter.search)) {
        return false;
      }
    }

    // Level Filter
    if (currentConsoleFilter.level !== 'all') {
      const lvl = (err.level || 'log').toLowerCase();
      if (currentConsoleFilter.level === 'error' && lvl !== 'error') return false;
      if (currentConsoleFilter.level === 'warning' && lvl !== 'warning') return false;
      if (currentConsoleFilter.level === 'log' && (lvl === 'error' || lvl === 'warning')) return false;
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    let valA, valB;
    if (currentConsoleSort.key === 'time') {
      valA = a.timestamp || 0; valB = b.timestamp || 0;
    } else if (currentConsoleSort.key === 'level') {
      // Custom order: error > warning > log? Or alphabetical?
      // Let's do alphabetical for simplicity, or severity?
      // Severity: Error(3), Warning(2), Log(1)
      const severity = { 'error': 3, 'warning': 2, 'log': 1, 'info': 1 };
      valA = severity[(a.level || 'log').toLowerCase()] || 0;
      valB = severity[(b.level || 'log').toLowerCase()] || 0;
    } else if (currentConsoleSort.key === 'source') {
      valA = a.source || ''; valB = b.source || '';
    } else if (currentConsoleSort.key === 'text') {
      valA = a.text || a.message || ''; valB = b.text || b.message || '';
    }

    if (valA < valB) return currentConsoleSort.dir === 'asc' ? -1 : 1;
    if (valA > valB) return currentConsoleSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  renderConsole(filtered);
}


function renderConsole(errors) {
  const tbody = document.querySelector('#consoleTable tbody');
  tbody.innerHTML = '';

  if (errors.length === 0) {
    const emptyMsg = currentConsoleFilter.search || currentConsoleFilter.level !== 'all'
      ? "No console errors match filter."
      : "No console errors match filter."; // Unified message

    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color: var(--text-secondary);">${emptyMsg}</td></tr>`;
    return;
  }

  // Optimize with Fragment
  const fragment = document.createDocumentFragment();

  errors.forEach(err => {
    const tr = document.createElement('tr');
    tr.className = 'error-row';
    tr.style.cursor = 'pointer';
    tr.dataset.timestamp = err.timestamp || '';

    // Try to format timestamp if it looks like epoch (large number)
    let tsDisplay = err.timestamp;
    if (typeof err.timestamp === 'number' && err.timestamp > 1000000000000) {
      tsDisplay = new Date(err.timestamp).toLocaleTimeString();
    }

    const levelClass = err.level === 'error' ? 'badge-error' : (err.level === 'warning' ? 'badge-warn' : 'badge-info');

    tr.innerHTML = `
      <td class="meta" style="font-family:monospace;">${tsDisplay}</td>
      <td><span class="badge ${levelClass}">${err.level}</span></td>
      <td style="font-family:monospace; color:var(--text-secondary);">${err.source || 'console'}</td>
      <td class="code" style="color:${err.level === 'error' ? 'var(--danger)' : 'inherit'};">${escapeHtml(err.text || err.message || '')}</td>
    `;

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      showConsoleDetails(err);
    });
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

function renderNetwork(har) {
  const tbody = document.querySelector('#networkTable tbody');
  const entries = har.log.entries;

  tbody.innerHTML = '';

  if (entries.length === 0) {
    if (currentFilter.search || currentFilter.type !== 'all') {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">No network requests match filter.</td></tr>';
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">No network requests recorded.</td></tr>';
    }
    return;
  }

  // Optimize with Fragment
  const fragment = document.createDocumentFragment();

  entries.forEach(entry => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.title = 'Click to view details';
    tr.dataset.startTime = new Date(entry.startedDateTime).getTime();

    // Status Logic
    const status = entry.response.status;
    let statusClass = 'badge-info';
    let statusColor = '#60a5fa'; // default blue
    if (status >= 200 && status < 300) { statusClass = 'badge-success'; statusColor = '#4ade80'; }
    else if (status >= 300 && status < 400) { statusClass = 'badge-warn'; statusColor = '#fcd34d'; } // warning
    else if (status >= 400) { statusClass = 'badge-error'; statusColor = '#f87171'; } // error
    else if (status === 0 || status === 'Blocked') { statusClass = 'badge-error'; statusColor = '#f87171'; }

    // Method Color
    const method = entry.request.method;
    let methodColor = '#2e89ff'; // blue default
    if (method === 'POST') methodColor = '#a855f7'; // purple
    else if (method === 'DELETE') methodColor = '#ef4444'; // red
    else if (method === 'PUT') methodColor = '#f59e0b'; // orange

    // Name / URL parsing
    let name = '';
    let url = entry.request.url;
    try {
      const urlObj = new URL(url);
      name = urlObj.pathname.split('/').pop();
      if (!name) name = urlObj.hostname;
      // If path ends in slash, pop gives empty string, take prev
      if (!name) name = urlObj.pathname.split('/').filter(Boolean).pop() || urlObj.hostname;
      if (urlObj.search) name += urlObj.search;
    } catch (e) {
      name = url;
    }

    const timeStr = new Date(entry.startedDateTime).toLocaleTimeString('en-GB', { hour12: false });

    tr.innerHTML = `
      <td class="meta" style="font-family:monospace; color:var(--text-secondary);">${timeStr}</td>
      <td style="font-weight:700; color:${methodColor};">${method}</td>
      <td><span class="badge ${statusClass}">${status}</span></td>
      <td style="max-width:300px;">
        <div style="font-weight:600; color:var(--text-main); margin-bottom:2px;">${escapeHtml(name)}</div>
        <div style="font-size:11px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(url)}</div>
      </td>
      <td>
        <button class="action-btn" style="padding:4px 8px; font-size:11px;">Resend</button>
      </td>
    `;

    // Resend Button Click
    const resendBtn = tr.querySelector('button');
    resendBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRequestComposer(entry);
    });

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      showDetails(entry);
    });
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

function renderTimeline(userEvents, consoleErrors, networkEntries, issues, screencast) {
  const tbody = document.querySelector('#timelineTable tbody');
  const thead = document.querySelector('#timelineTable thead');

  // Update Header for Editor Mode
  if (isEditorMode) {
    thead.innerHTML = `
        <tr>
            <th style="width:50px;">Action</th>
            <th style="width:100px;">Time</th>
            <th style="width:80px;">Source</th>
            <th>Event Details</th>
        </tr>`;
  } else {
    thead.innerHTML = `
        <tr>
            <th style="width:100px;">Time</th>
            <th style="width:80px;">Source</th>
            <th>Event Details</th>
        </tr>`;
  }

  // Merge all events for context
  let allEvents = [];

  // Add User Events with index for deletion
  userEvents.forEach((e, i) => allEvents.push({ ...e, source: 'user', sortTime: e.timestamp, originalIndex: i }));

  // Add Console Errors
  consoleErrors.forEach(e => allEvents.push({ ...e, source: 'console', sortTime: e.timestamp }));

  // Add Network
  networkEntries.forEach(e => allEvents.push({ ...e, source: 'network', sortTime: new Date(e.startedDateTime).getTime() }));

  // Add Issues
  issues.forEach(e => allEvents.push({ ...e, source: 'issue', sortTime: e.timestamp }));

  // Sort
  allEvents.sort((a, b) => a.sortTime - b.sortTime);

  // Update global variable for screencast/timeline sync
  globalAllEvents = allEvents;

  // Filter for table display (User Events & Issues only)
  const tableEvents = allEvents.filter(e => e.source === 'user' || e.source === 'issue');

  if (tableEvents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">No user events recorded.</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();

  tableEvents.forEach(event => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => {
      document.querySelectorAll('#timelineTable tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      // Pause video if playing, then jump to event position
      if (pauseScreencast) pauseScreencast();
      updatePreview(event.sortTime, screencast, allEvents);
    });

    let sourceDisplay = '';
    let details = '';
    let rowClass = '';

    if (event.source === 'user') {
      sourceDisplay = `<span class="badge badge-info">USER</span>`;
      if (event.type === 'click') {
        if (event.target.tagName === 'A' && event.target.innerText && event.target.innerText.trim()) {
          details = `Clicked Link "<b>${escapeHtml(event.target.innerText.trim())}</b>"`;
        } else {
          details = `Clicked <b>${event.target.tagName}</b>`;
        }
        if (event.target.xpath) details += ` <span style="color:#999; font-size:11px;">${escapeHtml(event.target.xpath)}</span>`;
      } else if (event.type === 'keydown') {
        details = `Key: <b>${event.key}</b>`;
      } else if (event.type === 'input') {
        details = `Input: "${escapeHtml(event.value)}"`;
      } else if (event.type === 'navigation') {
        details = `Navigated to <a href="${event.url}" target="_blank">${escapeHtml(event.url)}</a>`;
      }
    } else if (event.source === 'issue') {
      sourceDisplay = `<span class="badge badge-error">ISSUE</span>`;
      details = `<b>Reported:</b> ${escapeHtml(event.comment)}`;
    }

    let actionCell = '';
    if (isEditorMode) {
      if (event.source === 'user') {
        actionCell = `<td><button class="action-btn delete-btn" title="Remove Event" style="padding:4px; color:var(--danger); border-color:var(--danger); display:flex; align-items:center; justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button></td>`;
      } else {
        actionCell = `<td></td>`;
      }
    }

    if (isEditorMode) {
      tr.innerHTML = `
          ${actionCell}
          <td class="meta" style="font-family:monospace;">${new Date(event.sortTime).toLocaleTimeString()}</td>
          <td>${sourceDisplay}</td>
          <td>${details}</td>
        `;
    } else {
      tr.innerHTML = `
          <td class="meta" style="font-family:monospace;">${new Date(event.sortTime).toLocaleTimeString()}</td>
          <td>${sourceDisplay}</td>
          <td>${details}</td>
        `;
    }

    // Add listener for delete button if applicable
    if (isEditorMode && event.source === 'user') {
      const btn = tr.querySelector('.delete-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Delete this user event?')) {
            // Use originalIndex which we added earlier
            if (currentReportData && currentReportData.userEvents) {
              // Find the event in the current list by index or other means?
              // Since we re-render every time, indices are fresh.
              // Just to be safe, filter it out or splice.
              // Using splice is risky if indices shifted but we re-render immediately so it's fine.
              currentReportData.userEvents.splice(event.originalIndex, 1);
              renderReport(currentReportData);
            }
          }
        });
      }
    }

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);

  // Pre-select first row
  const firstRow = tbody.querySelector('tr');
  if (firstRow) {
    firstRow.click();
  }
}

function updatePreview(timestamp, screencast, allEvents) {
  // Update Header
  const header = document.getElementById('timelineDetailHeader');
  if (header) header.textContent = `State at ${new Date(timestamp).toLocaleTimeString()}`;

  // Update Player (Top)
  const player = document.getElementById('screenPlayer');

  if (screencast && screencast.length > 0) {
    // Find closest frame by wallTime
    let closestFrame = null;
    let minDiff = Infinity;
    let frameIndex = -1;

    screencast.forEach((frame, i) => {
      if (frame.wallTime) {
        const diff = Math.abs(frame.wallTime - timestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frame;
          frameIndex = i;
        }
      }
    });

    if (closestFrame && minDiff < 5000) {
      player.src = "data:image/jpeg;base64," + closestFrame.data;
      player.style.display = 'block';

      // Update Scrubber & Global Index
      const scrubber = document.getElementById('scrubber');
      const timeDisplay = document.getElementById('timeDisplay');

      if (frameIndex !== -1) {
        currentScreencastIndex = frameIndex;
        if (scrubber) scrubber.value = frameIndex;

        if (timeDisplay && screencast[0].wallTime) {
          const startTime = screencast[0].wallTime;
          const time = closestFrame.wallTime - startTime;
          timeDisplay.textContent = new Date(time < 0 ? 0 : time).toISOString().substr(11, 8);
        }
      }
    }
  }

  // Update Tabs
  updateTabsContent(timestamp, allEvents);
}

// Helper to programmatically switch to a sidebar tab
function switchToTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const targetTab = document.querySelector(`.tab-btn[data-target="${tabName}"]`);
  if (targetTab) targetTab.classList.add('active');
  const targetContent = document.getElementById(tabName);
  if (targetContent) targetContent.classList.add('active');
}

function updateTabsContent(timestamp, events) {
  const allEvents = events || globalAllEvents || [];

  // 2. Console (History up to timestamp, Descending) with filters
  const consoleTbody = document.querySelector('#timelineConsoleTable tbody');
  if (consoleTbody) {
    consoleTbody.innerHTML = '';
    // Filter up to current time
    let logs = allEvents.filter(e => e.source === 'console' && e.sortTime <= timestamp);

    // Apply search filter
    if (timelineConsoleFilter.search) {
      const search = timelineConsoleFilter.search;
      logs = logs.filter(log => {
        const text = (log.text || log.message || '').toLowerCase();
        return text.includes(search);
      });
    }

    // Apply level filter
    if (timelineConsoleFilter.level !== 'all') {
      logs = logs.filter(log => {
        const lvl = (log.level || 'log').toLowerCase();
        if (timelineConsoleFilter.level === 'error' && lvl !== 'error') return false;
        if (timelineConsoleFilter.level === 'warning' && lvl !== 'warning') return false;
        if (timelineConsoleFilter.level === 'log' && (lvl === 'error' || lvl === 'warning')) return false;
        return true;
      });
    }

    // Sort Descending (Newest First)
    logs.sort((a, b) => b.sortTime - a.sortTime);

    const recentLogs = logs.slice(0, 200); // Show last 200

    if (recentLogs.length === 0) {
      consoleTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-secondary); padding:10px;">No console logs match.</td></tr>';
    } else {
      recentLogs.forEach(log => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        const color = log.level === 'error' ? 'var(--danger)' : (log.level === 'warning' ? 'var(--warning)' : 'inherit');
        tr.innerHTML = `
                <td style="font-family:monospace; color:var(--text-secondary);">${new Date(log.sortTime).toLocaleTimeString()}</td>
                <td><span class="badge" style="color:${color}; border:1px solid ${color}; padding:1px 4px; border-radius:3px; font-size:10px;">${log.level}</span></td>
                <td style="font-family:monospace; color:${color}; word-break:break-all;">${escapeHtml(log.text || log.message || '')}</td>
              `;
        tr.addEventListener('click', () => {
          switchToTab('console');
          showConsoleDetails(log);
          // Highlight matching row in main console table
          const mainTbody = document.querySelector('#consoleTable tbody');
          if (mainTbody) {
            mainTbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            const match = mainTbody.querySelector(`tr[data-timestamp="${log.timestamp || ''}"]`);
            if (match) {
              match.classList.add('selected');
              match.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        });
        consoleTbody.appendChild(tr);
      });
    }
  }

  // 3. Network (History up to timestamp, Descending) with filters
  const networkTbody = document.querySelector('#timelineNetworkTable tbody');
  if (networkTbody) {
    networkTbody.innerHTML = '';
    // Filter up to current time
    let reqs = allEvents.filter(e => e.source === 'network' && e.sortTime <= timestamp);

    // Apply search filter
    if (timelineNetworkFilter.search) {
      const search = timelineNetworkFilter.search;
      reqs = reqs.filter(req => {
        const url = (req.request.url || '').toLowerCase();
        return url.includes(search);
      });
    }

    // Apply type filter
    if (timelineNetworkFilter.type !== 'all') {
      reqs = reqs.filter(req => {
        const type = (req._resourceType || '').toLowerCase();
        const mime = (req.response && req.response.content && req.response.content.mimeType || '').toLowerCase();
        switch (timelineNetworkFilter.type) {
          case 'xhr': return type === 'xhr' || type === 'fetch' || mime.includes('json');
          case 'js': return type === 'script' || mime.includes('javascript');
          case 'css': return type === 'stylesheet' || mime.includes('css');
          case 'img': return type === 'image' || mime.includes('image');
          case 'media': return type === 'media' || mime.includes('video') || mime.includes('audio');
          case 'doc': return type === 'document' || mime.includes('html');
          default: return true;
        }
      });
    }

    // Sort Descending
    reqs.sort((a, b) => b.sortTime - a.sortTime);

    const recentReqs = reqs.slice(0, 200);

    if (recentReqs.length === 0) {
      networkTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary); padding:10px;">No network requests match.</td></tr>';
    } else {
      recentReqs.forEach(req => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        const statusColor = req.response.status >= 400 ? 'var(--danger)' : 'var(--success)';
        tr.innerHTML = `
                <td style="font-family:monospace; color:var(--text-secondary);">${new Date(req.sortTime).toLocaleTimeString()}</td>
                <td style="font-weight:600; font-size:11px;">${req.request.method}</td>
                <td style="word-break:break-all;">${escapeHtml(req.request.url.split('/').pop().split('?')[0] || req.request.url)}</td>
                <td style="color:${statusColor}; font-weight:600;">${req.response.status}</td>
              `;
        tr.addEventListener('click', () => {
          switchToTab('network');
          showDetails(req);
          // Highlight matching row in main network table
          const mainTbody = document.querySelector('#networkTable tbody');
          if (mainTbody) {
            mainTbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            const startTime = new Date(req.startedDateTime).getTime();
            const match = mainTbody.querySelector(`tr[data-start-time="${startTime}"]`);
            if (match) {
              match.classList.add('selected');
              match.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        });
        networkTbody.appendChild(tr);
      });
    }
  }


}

function highlightEventRow(timestamp) {
  const tbody = document.querySelector('#timelineTable tbody');
  if (!tbody || !globalAllEvents.length) return;

  // Only consider events that are displayed in the table (user + issue)
  const tableEvents = globalAllEvents.filter(e => e.source === 'user' || e.source === 'issue');

  // Find the last table event that occurred at or before this timestamp
  let lastTableIndex = -1;
  const tolerance = 100; // ms

  for (let i = tableEvents.length - 1; i >= 0; i--) {
    if (tableEvents[i].sortTime <= (timestamp + tolerance)) {
      lastTableIndex = i;
      break;
    }
  }

  // Remove existing highlights and indicator icons
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(r => {
    r.style.outline = '';
    r.style.background = '';
    const icon = r.querySelector('.now-playing-icon');
    if (icon) icon.remove();
  });

  if (lastTableIndex >= 0 && lastTableIndex < rows.length) {
    const row = rows[lastTableIndex];
    row.style.outline = '2px solid var(--primary)';
    row.style.background = 'rgba(46, 137, 255, 0.08)';

    // Add a "now playing" indicator icon to the first cell
    const firstCell = row.querySelector('td');
    if (firstCell && !firstCell.querySelector('.now-playing-icon')) {
      const icon = document.createElement('span');
      icon.className = 'now-playing-icon';
      icon.style.cssText = 'display:inline-flex; align-items:center; margin-right:6px; color:var(--primary); animation:pulse-icon 1.2s ease-in-out infinite;';
      icon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      firstCell.insertBefore(icon, firstCell.firstChild);
    }

    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Inject keyframe animation if not already present
  if (!document.getElementById('pulse-icon-style')) {
    const style = document.createElement('style');
    style.id = 'pulse-icon-style';
    style.textContent = `@keyframes pulse-icon { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`;
    document.head.appendChild(style);
  }
}

// Copy Button Logic (Delegation)
function createCopyBtnHTML(targetId) {
  return `<button class="action-btn copy-icon-btn" data-copy-target="${targetId}" title="Copy" style="padding:4px; color:var(--text-main);">
        <svg style="pointer-events:none;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
    </button>`;
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.copy-icon-btn');
  if (!btn) return;

  const targetId = btn.dataset.copyTarget;
  if (!targetId) return;

  const el = document.getElementById(targetId);
  if (!el) return;

  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    // Visual Feedback
    const original = btn.innerHTML;
    // Don't replace if already showing feedback to avoid race conditions or losing original icon permanently
    if (btn.innerText.includes("Copied!")) return;

    btn.innerHTML = `<span style="font-size:10px; font-weight:bold; color:var(--success);">Copied!</span>`;
    setTimeout(() => btn.innerHTML = original, 1500);
  });
});

function ensureCopyBtn(boxId, contentId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const title = box.querySelector('.section-title');
  if (title && !title.querySelector('.copy-icon-btn')) {
    title.style.display = 'flex';
    title.style.justifyContent = 'space-between';
    title.innerHTML += createCopyBtnHTML(contentId);
  }
}

function showDetails(entry) {
  const panel = document.getElementById('detailPanel');
  document.getElementById('modalTitle').textContent = "Network Details";

  // Show Panel
  panel.classList.add('open');

  // Show necessary boxes
  const generalBox = document.getElementById('generalBox');
  if (generalBox) generalBox.style.display = 'block';

  const reqHeadersBox = document.getElementById('reqHeadersBox');
  if (reqHeadersBox) reqHeadersBox.style.display = 'block';

  const resHeadersBox = document.getElementById('resHeadersBox');
  if (resHeadersBox) resHeadersBox.style.display = 'block';

  const reqBodyBox = document.getElementById('reqBodyBox');
  if (reqBodyBox) reqBodyBox.style.display = 'block';

  const resBodyBox = document.getElementById('resBodyBox');
  if (resBodyBox) resBodyBox.style.display = 'block';

  // 1. General Info
  const url = entry.request.url;
  const method = entry.request.method;
  const status = entry.response.status;
  const statusText = entry.response.statusText || '';

  let statusColor = '#60a5fa';
  if (status >= 200 && status < 300) statusColor = '#4ade80';
  else if (status >= 300 && status < 400) statusColor = '#fcd34d';
  else if (status >= 400) statusColor = '#f87171';
  else if (status === 0 || status === 'Blocked') statusColor = '#f87171';

  const remoteAddr = entry.serverIPAddress ? `${entry.serverIPAddress}:${entry.connection || ''}` : 'N/A';
  const referrerPolicyHeader = entry.response.headers.find(h => h.name.toLowerCase() === 'referrer-policy');
  const referrerPolicy = referrerPolicyHeader ? referrerPolicyHeader.value : 'strict-origin-when-cross-origin';

  const generalHtml = `
    <div class="detail-row" style="border:none; padding-bottom:2px;"><span class="detail-key">Request URL</span></div>
    <div style="word-break:break-all; color:var(--text-main); font-family:monospace; margin-bottom:15px; font-size:12px; background:var(--bg-input); padding:8px; border-radius:4px;">${escapeHtml(url)}</div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
      <div>
        <div class="detail-key" style="margin-bottom:4px;">Request Method</div>
        <div class="detail-val" style="font-weight:600; color:${method === 'POST' ? '#a855f7' : (method === 'DELETE' ? '#ef4444' : '#2e89ff')}">${method}</div>
      </div>
      <div>
        <div class="detail-key" style="margin-bottom:4px;">Status Code</div>
        <div class="detail-val" style="display:flex; align-items:center;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${statusColor}; margin-right:8px;"></span>
          <span style="color:${statusColor}">${status} ${statusText}</span>
        </div>
      </div>
      <div>
        <div class="detail-key" style="margin-bottom:4px;">Remote Address</div>
        <div class="detail-val">${escapeHtml(remoteAddr)}</div>
      </div>
       <div>
        <div class="detail-key" style="margin-bottom:4px;">Referrer Policy</div>
        <div class="detail-val">${escapeHtml(referrerPolicy)}</div>
      </div>
    </div>
  `;
  document.getElementById('generalInfo').innerHTML = generalHtml;

  // 2. Headers
  const formatHeaders = (headers) => {
    if (!headers || headers.length === 0) return '(No headers)';
    return headers.map(h => `${h.name}: ${h.value}`).join('\n');
  };

  const setHeaderSection = (boxId, countId, contentId, headers, defaultTitle) => {
    const box = document.getElementById(boxId);
    if (!box) return;

    // Reset Title/Count
    const countEl = document.getElementById(countId);
    if (countEl) countEl.textContent = (headers || []).length;

    // Ensure Copy Button
    const titleEl = box.querySelector('.section-title');
    if (titleEl) {
      // Ensure wrapper exists for text+badge to keep them together (fixes spacing issue)
      if (!titleEl.querySelector('.title-wrapper')) {
        // Capture current badge state (with updated count)
        const currentBadge = titleEl.querySelector('.badge');
        const badgeHTML = currentBadge ? currentBadge.outerHTML : `<span id="${countId}" class="badge" style="background:var(--bg-input); color:var(--text-secondary); margin-left:5px;">${(headers || []).length}</span>`;

        // Rebuild structure: Wrapper(Text + Badge)
        titleEl.innerHTML = `<span class="title-wrapper" style="display:flex; align-items:center;">${defaultTitle} ${badgeHTML}</span>`;
      }

      if (!titleEl.querySelector('.copy-icon-btn')) {
        titleEl.style.display = 'flex';
        titleEl.style.justifyContent = 'space-between';
        titleEl.style.alignItems = 'center';
        titleEl.insertAdjacentHTML('beforeend', createCopyBtnHTML(contentId));
      }
    }

    document.getElementById(contentId).textContent = formatHeaders(headers);
  };

  setHeaderSection('reqHeadersBox', 'reqHeadersCount', 'reqHeaders', entry.request.headers, 'Request Headers');
  setHeaderSection('resHeadersBox', 'resHeadersCount', 'resHeaders', entry.response.headers, 'Response Headers');

  // 3. Bodies
  const setBodySection = (boxId, contentId, content, title) => {
    const box = document.getElementById(boxId);
    if (!box) return;

    const titleEl = box.querySelector('.section-title');
    if (titleEl) {
      // Restore title if Console view changed it
      if (!titleEl.textContent.includes(title)) {
        // If completely different, reset
        titleEl.innerHTML = title;
      }

      if (!titleEl.querySelector('.copy-icon-btn')) {
        titleEl.style.display = 'flex';
        titleEl.style.justifyContent = 'space-between';
        titleEl.style.alignItems = 'center';
        titleEl.insertAdjacentHTML('beforeend', createCopyBtnHTML(contentId));
      }
    }
    document.getElementById(contentId).textContent = content || '(No body)';
  };

  // Logic for Req Body
  let reqBody = '';
  if (entry.request.postData) {
    reqBody = entry.request.postData.text;
    const mime = (entry.request.postData.mimeType || '').toLowerCase();
    const isBinaryMime = mime.includes('octet-stream') || mime.includes('image') || mime.includes('pdf') || mime.includes('zip');
    let nonPrintables = 0;
    const checkLen = Math.min(reqBody ? reqBody.length : 0, 500);
    for (let i = 0; i < checkLen; i++) {
      const c = reqBody.charCodeAt(i);
      if ((c < 32 && c !== 10 && c !== 13 && c !== 9) || c === 65533) nonPrintables++;
    }

    if (isBinaryMime || (checkLen > 0 && (nonPrintables / checkLen) > 0.1)) {
      reqBody = `(Binary data detected: ${reqBody.length} bytes, ${mime || 'unknown type'})`;
    }
  }
  setBodySection('reqBodyBox', 'reqBody', reqBody, 'Request Body');

  // Logic for Res Body
  let resBody = '';
  if (entry.response.content && entry.response.content.text) {
    resBody = entry.response.content.text;
    try {
      if (entry.response.content.mimeType && entry.response.content.mimeType.includes('json')) {
        resBody = JSON.stringify(JSON.parse(resBody), null, 2);
      }
    } catch (e) { }
  }
  setBodySection('resBodyBox', 'resBody', resBody, 'Response Body');
}

window.viewSource = async function (url, line, col) {
  if (!url) return;

  // Create or reuse a source preview container
  let preview = document.getElementById('sourcePreview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'sourcePreview';
    preview.style.cssText = "margin-top:10px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-main); padding:10px; max-height:300px; overflow:auto; font-family:monospace; white-space:pre; font-size:12px;";
    // Append inside the modal content, somewhere suitable. 
    // The modal has 'resBody' (Stack Trace) parent. We can append after that.
    const parent = document.getElementById('resBody').parentElement;
    parent.appendChild(preview);
  }

  preview.innerHTML = "Loading source...";
  preview.style.display = 'block';

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch source");
    const text = await response.text();
    const lines = text.split('\n');

    // Extract +/- 10 lines
    const targetLineIndex = (line || 1) - 1;
    const start = Math.max(0, targetLineIndex - 10);
    const end = Math.min(lines.length, targetLineIndex + 11);

    let html = '';
    for (let i = start; i < end; i++) {
      const isTarget = (i === targetLineIndex);
      // Use semi-transparent background for highlight to work in both modes
      const style = isTarget ? "background:rgba(209, 52, 56, 0.2); font-weight:bold; display:block; width:100%; border-left: 3px solid #d13438; padding-left: 5px; color:var(--text-main);" : "display:block; padding-left: 8px; color:var(--text-secondary);";
      html += `<div style="${style}"><span style="color:var(--text-secondary); opacity:0.7; margin-right:10px; user-select:none; display:inline-block; width:30px; text-align:right;">${i + 1}</span>${escapeHtml(lines[i])}</div>`;
    }

    preview.innerHTML = html;
    // Provide a way to scroll if needed, but it's small.
  } catch (e) {
    preview.innerHTML = `<span style="color:red;">Error loading source: ${e.message}.<br><span style="font-size:10px; color:#666;">(Extension might not have permission to fetch this URL, or it is local/restricted)</span></span>`;
  }
};

function showConsoleDetails(err) {
  const panel = document.getElementById('detailPanel');
  document.getElementById('modalTitle').textContent = "Console Log Details";

  // Hide Network specific boxes
  const hideBox = (id) => {
    const box = document.getElementById(id);
    if (box) box.style.display = 'none';
  };

  // Show Panel
  panel.classList.add('open');

  const showBox = (id, title, contentId) => {
    const box = document.getElementById(id);
    if (box) {
      box.style.display = 'block';
      const titleEl = box.querySelector('.section-title');
      if (titleEl) {
        titleEl.innerHTML = title;
        titleEl.style.display = 'flex';
        titleEl.style.justifyContent = 'space-between';
        titleEl.style.alignItems = 'center';
        titleEl.innerHTML += createCopyBtnHTML(contentId);
      }
    }
  };

  hideBox('generalBox'); // Hide General Box
  hideBox('reqHeadersBox');
  hideBox('resHeadersBox');

  // Show Message and Stack Trace using Body boxes
  showBox('reqBodyBox', 'Message', 'reqBody');
  showBox('resBodyBox', 'Stack Trace', 'resBody');

  document.getElementById('reqBody').textContent = err.text || err.message || '';

  // Hide previous source preview if any
  const oldPreview = document.getElementById('sourcePreview');
  if (oldPreview) oldPreview.style.display = 'none';

  let stackHtml = '';
  if (err.stackTrace && err.stackTrace.callFrames) {
    stackHtml = err.stackTrace.callFrames.map(f => {
      let url = f.url;
      // Check validation
      const hasLine = typeof f.lineNumber === 'number';
      const lineNumber = hasLine ? f.lineNumber + 1 : 1;
      const colNumber = typeof f.columnNumber === 'number' ? f.columnNumber + 1 : 1;

      if (!url) return `  at ${f.functionName || '(anonymous)'}`;

      const lineDisplay = hasLine ? `:${lineNumber}:${colNumber}` : '';

      // Use class and data attributes instead of onclick
      return `  at ${f.functionName || '(anonymous)'} (<a href="#" class="source-link" data-url="${escapeHtml(url)}" data-line="${lineNumber}" data-col="${colNumber}" style="color:var(--primary); text-decoration:none; border-bottom:1px dotted var(--primary); word-break:break-all;">${escapeHtml(url)}${lineDisplay}</a>)`;
    }).join('\n');
  } else if (err.url) {
    const line = err.line || err.lineNumber;
    const col = err.column || err.columnNumber;
    const hasLine = (typeof line === 'number');
    const lineDisplay = hasLine ? `:${line}:${col}` : '';
    const safeLine = hasLine ? line : 1;

    stackHtml = `at <a href="#" class="source-link" data-url="${escapeHtml(err.url)}" data-line="${safeLine}" data-col="${col || 1}" style="color:var(--primary); text-decoration:none; border-bottom:1px dotted var(--primary); word-break:break-all;">${escapeHtml(err.url)}${lineDisplay}</a>`;
  } else {
    stackHtml = '(No stack trace available)';
  }

  const resBody = document.getElementById('resBody');
  resBody.innerHTML = stackHtml;

  // Attach event listeners to source links
  resBody.querySelectorAll('.source-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = link.dataset.url;
      const line = parseInt(link.dataset.line);
      const col = parseInt(link.dataset.col);
      viewSource(url, line, col);
    });
  });

  panel.classList.add('open');
}

function renderScreencast(frames) {
  const player = document.getElementById('screenPlayer');
  // Timeline Detail Tabs
  const timelineDetailTabs = document.querySelectorAll('.timeline-tab');
  timelineDetailTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      timelineDetailTabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.timeline-panel').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const target = document.getElementById(`timeline-${tab.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });

  // --- Timeline Console Filter Listeners ---
  const tlConsoleSearch = document.getElementById('timelineConsoleSearch');
  if (tlConsoleSearch) {
    tlConsoleSearch.addEventListener('input', (e) => {
      timelineConsoleFilter.search = e.target.value.toLowerCase();
      // Re-render with current timestamp
      const currentFrame = frames && frames[currentScreencastIndex];
      if (currentFrame) updateTabsContent(currentFrame.wallTime || (currentFrame.timestamp * 1000));
    });
  }

  document.querySelectorAll('.timeline-console-filter').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.timeline-console-filter').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      timelineConsoleFilter.level = chip.dataset.filter || 'all';
      const currentFrame = frames && frames[currentScreencastIndex];
      if (currentFrame) updateTabsContent(currentFrame.wallTime || (currentFrame.timestamp * 1000));
    });
  });

  // --- Timeline Network Filter Listeners ---
  const tlNetworkSearch = document.getElementById('timelineNetworkSearch');
  if (tlNetworkSearch) {
    tlNetworkSearch.addEventListener('input', (e) => {
      timelineNetworkFilter.search = e.target.value.toLowerCase();
      const currentFrame = frames && frames[currentScreencastIndex];
      if (currentFrame) updateTabsContent(currentFrame.wallTime || (currentFrame.timestamp * 1000));
    });
  }

  document.querySelectorAll('.timeline-network-filter').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.timeline-network-filter').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const filterText = (chip.dataset.filter || 'all').toLowerCase();
      if (filterText === 'all') timelineNetworkFilter.type = 'all';
      else if (filterText.includes('fetch') || filterText.includes('xhr')) timelineNetworkFilter.type = 'xhr';
      else if (filterText === 'js') timelineNetworkFilter.type = 'js';
      else if (filterText === 'css') timelineNetworkFilter.type = 'css';
      else if (filterText === 'img') timelineNetworkFilter.type = 'img';
      else if (filterText === 'media') timelineNetworkFilter.type = 'media';
      else if (filterText === 'doc') timelineNetworkFilter.type = 'doc';
      else timelineNetworkFilter.type = 'all';
      const currentFrame = frames && frames[currentScreencastIndex];
      if (currentFrame) updateTabsContent(currentFrame.wallTime || (currentFrame.timestamp * 1000));
    });
  });

  if (!frames || frames.length === 0) {
    player.alt = "No screencast recorded.";
    return;
  }

  // Sort frames by wallTime if available, else timestamp
  frames.sort((a, b) => (a.wallTime || a.timestamp) - (b.wallTime || b.timestamp));

  const startTime = frames[0].wallTime || (frames[0].timestamp * 1000);

  scrubber.max = frames.length - 1;
  scrubber.value = 0;

  let isPlaying = false;
  currentScreencastIndex = 0;
  let timeoutId = null;

  // Expose a global pause function so clicking timeline rows can pause playback
  pauseScreencast = function () {
    if (isPlaying) {
      clearTimeout(timeoutId);
      playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play`;
      isPlaying = false;
    }
  };

  function showFrame(index) {
    if (index >= frames.length) index = frames.length - 1;
    if (index < 0) index = 0;

    const frame = frames[index];
    player.src = "data:image/jpeg;base64," + frame.data;
    player.style.display = 'block';

    const currentFrameTime = frame.wallTime || (frame.timestamp * 1000);
    const time = currentFrameTime - startTime;
    timeDisplay.textContent = new Date(time).toISOString().substr(11, 8);
    scrubber.value = index;
    currentScreencastIndex = index;

    // Update Detail Tabs (Console/Network) to match video time
    updateTabsContent(currentFrameTime);
    highlightEventRow(currentFrameTime);
  }

  showFrame(0);

  scrubber.addEventListener('input', (e) => {
    showFrame(parseInt(e.target.value));
    if (isPlaying) togglePlay(); // Pause if user scrubs
  });

  playBtn.onclick = togglePlay;

  function togglePlay() {
    if (isPlaying) {
      clearTimeout(timeoutId);
      playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play`;
      isPlaying = false;
    } else {
      playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
      isPlaying = true;
      playNextFrame();
    }
  }

  function playNextFrame() {
    if (!isPlaying) return;

    if (currentScreencastIndex >= frames.length - 1) {
      togglePlay(); // Stop at end
      return;
    }

    const currentFrame = frames[currentScreencastIndex];
    const nextFrame = frames[currentScreencastIndex + 1];

    const delay = (nextFrame.wallTime - currentFrame.wallTime) || ((nextFrame.timestamp - currentFrame.timestamp) * 1000);

    // Cap delay to avoid long freezes (e.g. if paused for a long time during recording)
    const safeDelay = Math.min(delay, 1000);

    showFrame(currentScreencastIndex + 1);

    timeoutId = setTimeout(playNextFrame, safeDelay);
  }
}

function renderIssues(issues, frames, allEvents) {
  const container = document.getElementById('issuesList');
  if (!issues || issues.length === 0) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px; color:var(--text-secondary);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:15px; opacity:0.5;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
        <div style="font-size:16px; font-weight:600;">No issues tracked</div>
        <div style="font-size:13px; margin-top:5px; opacity:0.8;">Report issues during recording to see them here.</div>
      </div>
    `;
    return;
  }

  issues.forEach(issue => {
    const div = document.createElement('div');
    div.className = "issue-card";
    div.style.border = "1px solid var(--border-color)";
    div.style.marginBottom = "20px";
    div.style.padding = "10px";
    div.style.borderRadius = "4px";
    div.style.background = "var(--bg-card)";
    div.style.color = "var(--text-main)";

    // Find closest frame
    let closestFrame = null;
    let minDiff = Infinity;

    frames.forEach(frame => {
      if (frame.wallTime) {
        const diff = Math.abs(frame.wallTime - issue.timestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frame;
        }
      }
    });

    let imageHtml = '';
    if (closestFrame) {
      // We rely on the screencast capturing the red box overlay drawn during the issue reporting.
      // Drawing it again here causes "double box" issues due to image scaling mismatches.
      imageHtml = `
      <div style="position:relative; display:inline-block; margin-top:10px; border:1px solid var(--border-color);">
          <img src="data:image/jpeg;base64,${closestFrame.data}" style="max-width: 100%; display:block;">
      </div>
      `;
    } else {
      imageHtml = `<div style="padding:10px; background:var(--bg-input); color:var(--text-secondary);">No screenshot available</div>`;
    }

    // Context
    const timestamp = issue.timestamp;
    const recentLogs = (allEvents || []).filter(e => e.source === 'console' && e.sortTime <= timestamp && e.sortTime > (timestamp - 5000));
    const recentNetwork = (allEvents || []).filter(e => e.source === 'network' && e.sortTime <= timestamp && e.sortTime > (timestamp - 5000));

    let contextHtml = '<div style="margin-top:15px; border-top:1px solid var(--border-color); padding-top:10px;">';

    contextHtml += '<b>Recent Logs (last 5s):</b><br>';
    if (recentLogs.length === 0) contextHtml += '<span style="color:var(--text-secondary); font-size:10px;">None</span>';
    recentLogs.forEach(l => {
      contextHtml += `<div class="code error-row" style="font-size:10px; margin-bottom:2px;">${escapeHtml(l.text || l.message || '').substring(0, 100)}...</div>`;
    });

    contextHtml += '<br><b>Recent Network (last 5s):</b><br>';
    if (recentNetwork.length === 0) contextHtml += '<span style="color:var(--text-secondary); font-size:10px;">None</span>';
    recentNetwork.forEach(n => {
      // statusColor for dark mode needs to be handled. 'black' is bad for dark mode.
      const statusColor = n.response.status >= 400 ? 'var(--danger)' : 'var(--text-main)';
      contextHtml += `<div class="code" style="font-size:10px; margin-bottom:2px; color:${statusColor}">${n.request.method} ${n.request.url.substring(0, 60)}...</div>`;
    });

    contextHtml += '</div>';

    div.innerHTML = `
    <h3 style="margin-top:0;">Issue Reported at ${new Date(issue.timestamp).toLocaleTimeString()}</h3>
    <p><strong>Comment:</strong> ${escapeHtml(issue.comment)}</p>
    ${imageHtml}
    ${contextHtml}
  `;
    container.appendChild(div);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEnvironment(env) {
  const container = document.getElementById('envGrid');
  if (!container) return;

  container.innerHTML = '';

  if (!env || Object.keys(env).length === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color: var(--text-secondary);">No environment data captured.</div>`;
    return;
  }

  // Current Environment (Viewer)
  const currentEnv = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    screenSize: `${window.screen.width}x${window.screen.height}`,
    screenAvailSize: `${window.screen.availWidth}x${window.screen.availHeight}`,
    windowInnerSize: `${window.innerWidth}x${window.innerHeight}`,
    windowOuterSize: `${window.outerWidth}x${window.outerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
    deviceMemory: navigator.deviceMemory || 'N/A',
    connectionType: navigator.connection ? navigator.connection.effectiveType : 'N/A',
    url: window.location.href // This will just show the viewer URL, but useful for context if needed
  };

  // Groupings
  const recordedData = {
    "Browser": {
      "User Agent": env.userAgent,
      "Language": env.language,
      "Platform": env.platform,
      "Cookies Enabled": env.cookieEnabled ? "Yes" : "No"
    },
    "Screen & Window": {
      "Screen Size": env.screenSize,
      "Available Screen": env.screenAvailSize,
      "Window Inner (Viewport)": env.windowInnerSize || env.windowSize,
      "Window Outer": env.windowOuterSize,
      "Device Pixel Ratio": env.devicePixelRatio,
    },
    "Hardware & Connection": {
      "CPU Cores": env.hardwareConcurrency,
      "Memory (GB)": env.deviceMemory,
      "Connection Type": env.connectionType,
      "Timezone": env.timezone
    },
    // Include Issue Description if available (from edits)
    "Context": {
      "URL": env.url,
      "Issue Description": (env.Context && env.Context['Issue Description']) ? env.Context['Issue Description'] : undefined
    }
  };

  // Map keys to currentEnv keys for comparison
  const keyMap = {
    "User Agent": "userAgent",
    "Language": "language",
    "Platform": "platform",
    "Cookies Enabled": "cookieEnabled",
    "Screen Size": "screenSize",
    "Available Screen": "screenAvailSize",
    "Window Inner (Viewport)": "windowInnerSize",
    "Window Outer": "windowOuterSize",
    "Device Pixel Ratio": "devicePixelRatio",
    "CPU Cores": "hardwareConcurrency",
    "Memory (GB)": "deviceMemory",
    "Connection Type": "connectionType",
    "Timezone": "timezone",
    "URL": "url"
  };

  // Helper to create card
  const createCard = (title, data) => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    `;

    // Header Row with "Recorded" vs "Current" label if this is comparison relevant
    let rows = `
      <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid var(--border-color); padding-bottom:5px;">
         <span style="font-size:10px; text-transform:uppercase; color:var(--text-secondary); width:48%;">Recorded</span>
         <span style="font-size:10px; text-transform:uppercase; color:var(--text-secondary); width:48%;">Current (You)</span>
      </div>
    `;

    // For Context URL, we probably don't need comparison column as it's just the recorded page vs viewer page
    const isContext = title === "Context";

    if (isContext) {
      rows = ''; // reset header for single column
    }

    for (const [key, val] of Object.entries(data)) {
      if (val === undefined || val === null) continue;
      if (key === 'Issue Description') continue; // Handle separately

      let currentVal = 'N/A';
      let isMatch = false;

      const currentKey = keyMap[key];
      if (currentKey && currentEnv[currentKey] !== undefined) {
        currentVal = currentEnv[currentKey];
        if (currentKey === 'cookieEnabled') currentVal = currentVal ? "Yes" : "No";

        // Loosely compare
        if (String(currentVal) === String(val)) isMatch = true;
      }

      // Override for Context URL
      if (isContext) {
        rows += `
            <div style="margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 2px;">${escapeHtml(key)}</div>
              <div style="font-size: 13px; color: var(--text-main); font-family: monospace; word-break: break-all;">${escapeHtml(String(val))}</div>
            </div>
          `;
      } else {
        // Double column comparison
        const matchColor = isMatch ? 'var(--success)' : 'var(--danger)';
        const matchIcon = isMatch
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

        rows += `
            <div style="margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px;">${escapeHtml(key)}</div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                 <div style="width:48%; font-size: 12px; color: var(--text-main); font-family: monospace; word-break: break-all;">${escapeHtml(String(val))}</div>
                 <div style="width:48%; font-size: 12px; color: ${isMatch ? 'var(--text-secondary)' : 'var(--danger)'}; font-family: monospace; word-break: break-all; position:relative;">
                    ${escapeHtml(String(currentVal))}
                    <span style="position:absolute; right:0; top:0; color:${matchColor}; opacity:0.8;">${matchIcon}</span>
                 </div>
              </div>
            </div>
          `;
      }
    }

    // Add Description Field for Context
    if (title === 'Context') {
      const desc = data['Issue Description'] || '';
      if (isEditorMode) {
        rows += `
                <div style="margin-top: 10px; padding-top: 10px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Issue Description</div>
                    <textarea class="form-input env-desc-input" placeholder="Add a description of the issue..." style="width:100%; min-height:80px; font-family:var(--font-family); font-size:13px; resize:vertical; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-color); padding:8px;">${escapeHtml(desc)}</textarea>
                    <button class="action-btn primary save-desc-btn" style="margin-top:8px; width:100%; justify-content:center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Save Description
                    </button>
                </div>
             `;
      } else if (desc) {
        rows += `
                <div style="margin-top: 10px; padding-top: 10px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Issue Description</div>
                    <div style="font-size: 13px; color: var(--text-main); white-space: pre-wrap; font-family: var(--font-family);">${escapeHtml(desc)}</div>
                </div>
             `;
      }
    }

    card.innerHTML = `
      <h3 style="margin-top:0; font-size:14px; color:var(--primary); margin-bottom:15px;">${escapeHtml(title)}</h3>
      ${rows}
    `;

    // Attach Listener for Description Save
    if (title === 'Context' && isEditorMode) {
      const btn = card.querySelector('.save-desc-btn');
      const input = card.querySelector('.env-desc-input');
      if (btn && input) {
        btn.addEventListener('click', () => {
          if (!currentReportData.environment) currentReportData.environment = {};
          if (!currentReportData.environment.Context) currentReportData.environment.Context = {};
          currentReportData.environment.Context['Issue Description'] = input.value;

          // Visual feedback
          const originalHTML = btn.innerHTML;
          btn.innerHTML = `<span style="color:white; font-weight:bold;">Saved!</span>`;
          btn.classList.remove('primary');
          btn.style.background = 'var(--success)';
          btn.style.borderColor = 'var(--success)';

          setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.add('primary');
            btn.style.background = '';
            btn.style.borderColor = '';
          }, 1500);
        });
      }
    }

    return card;
  };

  for (const [groupTitle, groupData] of Object.entries(recordedData)) {
    container.appendChild(createCard(groupTitle, groupData));
  }
}
// Storage Renderer
function renderStorage(storageData) {
  const container = document.getElementById('storageTableContainer');
  const chips = document.querySelectorAll('#storage .filter-chip');
  if (!container || !chips.length) return;

  // Set up listeners (only once if possible, but renderStorage might be called again)
  // To avoid duplicate listeners, we can clone and replace, or just check a flag?
  // Simpler: Just re-attach. The overhead is low for this app.
  // actually, better to attach listeners to a parent or use a named handler if we cared about memory, 
  // but for this extension viewer, replacing the chips is fine? No, they are in HTML.

  // Let's use a module-level variable to track if listeners are added?
  // Or just always render the default tab (Local) and let the listeners update the view.

  // Define render helper
  const renderTable = (type) => {
    const tbody = document.querySelector('#storageTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let items = {};
    if (type === 'local') items = storageData.localStorage || {};
    else if (type === 'session') items = storageData.sessionStorage || {};
    else if (type === 'cookies') items = storageData.cookies || {};

    const keys = Object.keys(items).sort();

    if (keys.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-secondary);">No data in ${type} storage</td></tr>`;
      return;
    }

    keys.forEach((key, i) => {
      const val = items[key];
      const tr = document.createElement('tr');
      const valStr = (typeof val === 'object') ? JSON.stringify(val, null, 2) : String(val);
      const valId = `storage-val-${type}-${i}`;

      let actionsHTML = createCopyBtnHTML(valId);

      if (isEditorMode) {
        actionsHTML = `
            <div class="storage-actions" style="display:flex; gap:4px; align-items:center;">
                ${createCopyBtnHTML(valId)}
                <button class="action-btn edit-storage-btn" title="Edit Value" style="padding:4px; color:var(--text-main);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="action-btn delete-storage-btn" title="Delete Item" style="padding:4px; color:var(--danger);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
          `;
      }

      tr.innerHTML = `
        <td style="font-family:monospace; word-break:break-all; color:var(--primary); font-weight:600; vertical-align:top;">${escapeHtml(key)}</td>
        <td style="vertical-align:top;">
            <div class="storage-value-container" style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
                <div id="${valId}" class="value-display" style="font-family:monospace; word-break:break-all; white-space:pre-wrap; flex:1; max-height: 200px; overflow-y: auto;">${escapeHtml(valStr)}</div>
                ${actionsHTML}
            </div>
        </td>
      `;

      if (isEditorMode) {
        const editBtn = tr.querySelector('.edit-storage-btn');
        const deleteBtn = tr.querySelector('.delete-storage-btn');
        const container = tr.querySelector('.storage-value-container');
        const valueDisplay = tr.querySelector('.value-display');
        const actionsDiv = tr.querySelector('.storage-actions');

        if (editBtn) {
          editBtn.addEventListener('click', () => {
            valueDisplay.style.display = 'none';
            actionsDiv.style.display = 'none';

            const editContainer = document.createElement('div');
            editContainer.style.cssText = "display:flex; flex:1; gap:10px; align-items:flex-start;";

            const textarea = document.createElement('textarea');
            textarea.className = 'form-input';
            textarea.style.cssText = "width:100%; min-height:80px; font-family:monospace; font-size:12px; resize:vertical; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-color);";
            textarea.value = valStr;

            const saveBtn = document.createElement('button');
            saveBtn.className = 'action-btn primary';
            saveBtn.title = "Save Changes";
            saveBtn.style.padding = "6px";
            saveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;

            saveBtn.addEventListener('click', () => {
              items[key] = textarea.value;
              renderReport(currentReportData);
            });

            editContainer.appendChild(textarea);
            editContainer.appendChild(saveBtn);

            container.insertBefore(editContainer, container.firstChild);
          });
        }

        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => {
            if (confirm("Delete item '" + key + "'?")) {
              delete items[key];
              renderReport(currentReportData);
            }
          });
        }
      }
      tbody.appendChild(tr);
    });
  };

  // Attach listeners
  chips.forEach(chip => {
    // Avoid re-attaching listeners
    if (chip.dataset.hasListener) return;
    chip.dataset.hasListener = "true";

    chip.addEventListener('click', () => {
      document.querySelectorAll('#storage .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const type = chip.dataset.storageType; // local, session, cookies
      renderTable(type);
    });
  });

  // Render current or default
  const activeTab = document.querySelector('#storage .filter-chip.active');
  if (activeTab) {
    renderTable(activeTab.dataset.storageType);
  } else {
    const defaultTab = document.querySelector('#storage .filter-chip[data-storage-type="local"]');
    if (defaultTab) {
      defaultTab.classList.add('active');
      renderTable('local');
    }
  }
}

function openRequestComposer(entry) {
  const modal = document.getElementById('requestComposer');
  if (!modal) return;

  const methodSelect = document.getElementById('composerMethod');
  const urlInput = document.getElementById('composerUrl');
  const headersInput = document.getElementById('composerHeadersInput');
  const bodyInput = document.getElementById('composerBodyInput');
  const responseOutput = document.getElementById('composerResponseOutput');
  const statusDiv = document.getElementById('composerResponseStatus');

  // Reset Response
  responseOutput.textContent = "";
  statusDiv.textContent = "";

  // Set Method & URL (Uppercase method to match select options)
  if (methodSelect && entry.request.method) methodSelect.value = entry.request.method.toUpperCase();
  if (urlInput) urlInput.value = entry.request.url;

  // Set Headers (Convert to Key: Value string)
  if (headersInput) {
    const headerStr = entry.request.headers
      .filter(h => !h.name.startsWith(':')) // Filter pseudo-headers if any
      .map(h => `${h.name}: ${h.value}`)
      .join('\n');
    headersInput.value = headerStr;
  }

  // Set Body
  if (bodyInput) {
    if (entry.request.postData && entry.request.postData.text) {
      // Try to pretty print if JSON
      try {
        const json = JSON.parse(entry.request.postData.text);
        bodyInput.value = JSON.stringify(json, null, 2);
      } catch (e) {
        bodyInput.value = entry.request.postData.text;
      }
    } else {
      bodyInput.value = "";
    }
  }

  // Switch to Headers tab by default
  const defaultTab = document.querySelector('#requestComposer .composer-tab[data-tab="reqHeaders"]');
  if (defaultTab) defaultTab.click();

  modal.style.display = 'flex';
}
