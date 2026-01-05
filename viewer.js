let currentReportData = null;

document.addEventListener('DOMContentLoaded', () => {
  // Add import controls
  const header = document.querySelector('h1');
  const controls = document.createElement('div');
  controls.style.marginBottom = '20px';
  controls.innerHTML = `
    <button id="viewerImportBtn" style="padding: 8px 16px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">Import Report</button>
    <button id="viewerDownloadBtn" style="padding: 8px 16px; background: #107c10; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; display: none;">Download Report</button>
    <button id="viewerJiraBtn" style="padding: 8px 16px; background: #0052cc; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; display: none;">Create JIRA Ticket</button>
    <button id="viewerReplayBtn" style="padding: 8px 16px; background: #d13438; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; display: none;">Replay on Site</button>
    <input type="file" id="viewerFileInput" accept=".json" style="display: none;">
    <span id="fileName" style="margin-left: 10px; color: #666;"></span>
  `;
  header.parentNode.insertBefore(controls, header.nextSibling);

  const importBtn = document.getElementById('viewerImportBtn');
  const downloadBtn = document.getElementById('viewerDownloadBtn');
  const replayBtn = document.getElementById('viewerReplayBtn');
  const fileInput = document.getElementById('viewerFileInput');
  const fileNameSpan = document.getElementById('fileName');

  importBtn.addEventListener('click', () => fileInput.click());

  replayBtn.addEventListener('click', () => {
    if (!currentReportData || !currentReportData.userEvents) return;

    // Sort events by timestamp to ensure correct start URL finding
    const events = [...currentReportData.userEvents].sort((a, b) => a.timestamp - b.timestamp);

    // Find URL
    let startUrl = null;
    const nav = events.find(e => e.type === 'navigation');
    if (nav) startUrl = nav.url;

    if (!startUrl) {
      startUrl = prompt("Enter URL to replay on:", "https://");
    }
    if (!startUrl) return;

    if (!events.length) {
      alert("No events to replay.");
      return;
    }

    if (confirm(`Replay ${events.length} events on ${startUrl}?`)) {
      chrome.runtime.sendMessage({
        action: "replayEvents",
        url: startUrl,
        events: events
      });
    }
  });

  const jiraBtn = document.getElementById('viewerJiraBtn');
  jiraBtn.addEventListener('click', () => {
    try {
      console.log("JIRA Btn clicked in Viewer");
      if (!currentReportData) {
        console.error("No report data loaded");
        alert("No report data found. Please import a report first.");
        return;
      }
      const blob = new Blob([JSON.stringify(currentReportData, null, 2)], { type: "application/json" });
      const filename = `debug-report-${new Date().toISOString()}.json`;

      if (window.jiraHelper) {
        window.jiraHelper.showModal(blob, filename);
      } else {
        console.error("JIRA Helper not loaded");
        alert("JIRA Helper not loaded.");
      }
    } catch (e) {
      console.error("JIRA Button Error:", e);
      alert("Error launching JIRA modal: " + e.message);
    }
  });

  // Download logic
  downloadBtn.addEventListener('click', () => {
    if (!currentReportData) return;
    const blob = new Blob([JSON.stringify(currentReportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-report-${new Date().toISOString()}.json`;
    a.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileNameSpan.textContent = "Loading...";
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        fileNameSpan.textContent = file.name;
        renderReport(data);
      } catch (err) {
        alert("Invalid JSON file");
        fileNameSpan.textContent = "Error loading file";
      }
    };
    reader.readAsText(file);
  });

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

  function showEmptyState() {
    const icon = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" style="margin-bottom:10px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    const msg = `<div style="text-align:center; padding: 40px; color: #666; font-size: 16px;">${icon}<br>No report loaded.<br><br>Click <b>"Import Report"</b> to view data.</div>`;

    document.querySelector('#consoleTable tbody').innerHTML = `<tr><td colspan="4">${msg}</td></tr>`;
    document.querySelector('#networkTable tbody').innerHTML = `<tr><td colspan="5">${msg}</td></tr>`;
    document.querySelector('#timelineTable tbody').innerHTML = `<tr><td colspan="3">${msg}</td></tr>`;
    document.getElementById('issuesList').innerHTML = msg;
    document.getElementById('changesList').innerHTML = msg;
    const player = document.getElementById('screenPlayer');
    if (player) {
      player.removeAttribute('src');
      player.alt = ""; // Clear alt text as we show msg elsewhere usually, but here player is image.
      // Actually screencast tab: player is an img. wrapper is div.
      // But we just hide/show player?
      // I'll leave player logic but maybe put the msg div over it?
      // Simple fix: just hide player and show message container?
      // For now I'll just style the player area or inject a div instead of image source?
      // Reusing 'msg' might break if player expects image.
      // I'll keep previous player logic but updated styling.
      player.style.display = 'none';
      // I should append msg to player's parent if not there?
      // The parent is .video-container usually.
      const parent = player.parentElement;
      if (parent) {
        // Check if message already exists
        if (!parent.querySelector('.no-data-msg')) {
          const div = document.createElement('div');
          div.className = 'no-data-msg';
          div.innerHTML = msg;
          parent.appendChild(div);
        }
      }
    }
  }

  // Tab switching logic
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });

  // Filter logic
  const searchInput = document.getElementById('networkSearch');
  const filterBtns = document.querySelectorAll('.filter-btn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentFilter.search = e.target.value.toLowerCase();
      filterAndRenderNetwork();
    });
  }

  if (filterBtns) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter.type = btn.dataset.type;
        filterAndRenderNetwork();
      });
    });
  }
  // Copy to clipboard logic
  document.querySelectorAll('.codesnippet-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const text = targetEl.textContent;
        navigator.clipboard.writeText(text).then(() => {
          // Visual feedback
          const originalHTML = btn.innerHTML;
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          setTimeout(() => {
            btn.innerHTML = originalHTML;
          }, 2000);
        }).catch(err => {
          console.error("Failed to copy", err);
        });
      }
    });
  });
});

let currentNetworkEntries = [];
let currentFilter = { type: 'all', search: '' };

function renderReport(data) {
  currentReportData = data;
  document.getElementById('viewerDownloadBtn').style.display = 'inline-block';
  document.getElementById('viewerReplayBtn').style.display = 'inline-block';
  if (window.jiraHelper) {
    window.jiraHelper.readyPromise.then(() => {
      if (window.jiraHelper.isConfigured()) {
        document.getElementById('viewerJiraBtn').style.display = 'inline-block';
      }
    });
  }

  // Reset filter
  currentFilter = { type: 'all', search: '' };
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  const allBtn = document.querySelector('.filter-btn[data-type="all"]');
  if (allBtn) allBtn.classList.add('active');
  const searchInput = document.getElementById('networkSearch');
  if (searchInput) searchInput.value = '';

  // Update title with generation date
  const title = document.querySelector('h1');
  // Reset title first
  // Reset title first
  title.textContent = 'Signal Report';
  if (data.generatedAt) {
    title.textContent += ` (${new Date(data.generatedAt).toLocaleString()})`;
  }

  // Clear tables
  document.querySelector('#consoleTable tbody').innerHTML = '';
  document.querySelector('#networkTable tbody').innerHTML = '';
  document.querySelector('#timelineTable tbody').innerHTML = '';
  document.querySelector('#issuesList').innerHTML = '';

  renderConsole(data.consoleErrors || []);
  renderTimeline(data.userEvents || [], data.consoleErrors || [], (data.har && data.har.log && data.har.log.entries) ? data.har.log.entries : [], data.issues || [], data.screencast || []);
  renderScreencast(data.screencast || []);

  // Prepare allEvents for renderIssues context
  let allEvents = [];
  (data.userEvents || []).forEach(e => allEvents.push({ ...e, source: 'user', sortTime: e.timestamp }));
  (data.consoleErrors || []).forEach(e => allEvents.push({ ...e, source: 'console', sortTime: e.timestamp }));
  ((data.har && data.har.log && data.har.log.entries) ? data.har.log.entries : []).forEach(e => allEvents.push({ ...e, source: 'network', sortTime: new Date(e.startedDateTime).getTime() }));
  (data.issues || []).forEach(e => allEvents.push({ ...e, source: 'issue', sortTime: e.timestamp }));
  allEvents.sort((a, b) => a.sortTime - b.sortTime);

  renderIssues(data.issues || [], data.screencast || [], allEvents);
  renderContentChanges(data.contentChanges || [], data.screencast || []);

  // Store entries and render
  currentNetworkEntries = (data.har && data.har.log && data.har.log.entries) ? data.har.log.entries : [];
  filterAndRenderNetwork();
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
  const filtered = currentNetworkEntries.filter(entry => {
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

  renderNetwork({ log: { entries: filtered } });
}


function renderConsole(errors) {
  const tbody = document.querySelector('#consoleTable tbody');
  if (errors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">No console errors recorded.</td></tr>';
    return;
  }

  errors.forEach(err => {
    const tr = document.createElement('tr');
    tr.className = 'error-row';
    tr.style.cursor = 'pointer';

    // Try to format timestamp if it looks like epoch (large number)
    let tsDisplay = err.timestamp;
    if (typeof err.timestamp === 'number' && err.timestamp > 1000000000000) {
      tsDisplay = new Date(err.timestamp).toLocaleTimeString();
    }

    tr.innerHTML = `
      <td class="meta">${tsDisplay}</td>
      <td>${err.level}</td>
      <td>${err.source || 'console'}</td>
      <td class="code">${escapeHtml(err.text || err.message || '')}</td>
    `;

    tr.addEventListener('click', () => showConsoleDetails(err));
    tbody.appendChild(tr);
  });
}

function renderNetwork(har) {
  const tbody = document.querySelector('#networkTable tbody');
  const entries = har.log.entries;

  tbody.innerHTML = '';

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No network requests recorded.</td></tr>';
    return;
  }

  entries.forEach(entry => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.title = 'Click to view details';
    const statusClass = (entry.response.status >= 400) ? 'error-row' : '';

    tr.innerHTML = `
      <td class="meta">${new Date(entry.startedDateTime).toLocaleTimeString()}</td>
      <td>${entry.request.method}</td>
      <td class="${statusClass}">${entry.response.status}</td>
      <td class="code" style="word-break: break-all;">${escapeHtml(entry.request.url)}</td>
      <td>${Math.round(entry.time)}</td>
    `;

    tr.addEventListener('click', () => showDetails(entry));
    tbody.appendChild(tr);
  });
}

function renderTimeline(userEvents, consoleErrors, networkEntries, issues, screencast) {
  const tbody = document.querySelector('#timelineTable tbody');

  // Merge all events for context
  let allEvents = [];

  // Add User Events
  userEvents.forEach(e => allEvents.push({ ...e, source: 'user', sortTime: e.timestamp }));

  // Add Console Errors
  consoleErrors.forEach(e => allEvents.push({ ...e, source: 'console', sortTime: e.timestamp }));

  // Add Network
  networkEntries.forEach(e => allEvents.push({ ...e, source: 'network', sortTime: new Date(e.startedDateTime).getTime() }));

  // Add Issues
  issues.forEach(e => allEvents.push({ ...e, source: 'issue', sortTime: e.timestamp }));

  // Sort
  allEvents.sort((a, b) => a.sortTime - b.sortTime);

  // Filter for table display (User Events & Issues only)
  const tableEvents = allEvents.filter(e => e.source === 'user' || e.source === 'issue');

  if (tableEvents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">No user events recorded.</td></tr>';
    return;
  }

  tableEvents.forEach(event => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => {
      document.querySelectorAll('#timelineTable tr').forEach(r => r.style.background = '');
      tr.style.background = '#e6f7ff';
      updatePreview(event.sortTime, screencast, allEvents);
    });

    let sourceDisplay = '';
    let details = '';
    let rowClass = '';

    if (event.source === 'user') {
      sourceDisplay = `<span style="color:#0078d4; font-weight:bold;">USER</span>`;
      if (event.type === 'click') {
        details = `Clicked <b>${event.target.tagName}</b>`;
        if (event.target.id) details += ` #${event.target.id}`;
        if (event.target.innerText) details += ` "${escapeHtml(event.target.innerText)}"`;
      } else if (event.type === 'keydown') {
        details = `Key: <b>${event.key}</b>`;
      } else if (event.type === 'input') {
        details = `Input: "${escapeHtml(event.value)}"`;
      } else if (event.type === 'navigation') {
        details = `Navigated to ${escapeHtml(event.url)}`;
      }
    } else if (event.source === 'issue') {
      sourceDisplay = `<span style="color:#d13438; font-weight:bold; background:yellow;">ISSUE</span>`;
      details = `<b>Reported:</b> ${escapeHtml(event.comment)}`;
    }

    tr.innerHTML = `
      <td class="meta">${new Date(event.sortTime).toLocaleTimeString()}</td>
      <td>${sourceDisplay}</td>
      <td class="${rowClass}">${details}</td>
    `;
    tbody.appendChild(tr);
  });

  // Pre-select first row
  const firstRow = tbody.querySelector('tr');
  if (firstRow) {
    firstRow.click();
  }
}

function updatePreview(timestamp, screencast, allEvents) {
  // Update Image
  const player = document.getElementById('previewImage');
  if (screencast && screencast.length > 0) {
    // Find closest frame by wallTime
    let closestFrame = null;
    let minDiff = Infinity;

    screencast.forEach(frame => {
      if (frame.wallTime) {
        const diff = Math.abs(frame.wallTime - timestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frame;
        }
      }
    });

    if (closestFrame) {
      player.src = "data:image/jpeg;base64," + closestFrame.data;
    } else {
      player.alt = "No frame found (timestamp mismatch)";
    }
  }

  // Update Context
  const contextDiv = document.getElementById('previewContext');

  // Find logs/network occurring AFTER this event (within 5 seconds)
  // This shows "what happened because of this event"
  const subsequentLogs = allEvents.filter(e => e.source === 'console' && e.sortTime >= timestamp && e.sortTime < (timestamp + 5000));
  const subsequentNetwork = allEvents.filter(e => e.source === 'network' && e.sortTime >= timestamp && e.sortTime < (timestamp + 5000));

  let html = ``;

  html += `<b>Subsequent Logs (next 5s):</b><br>`;
  if (subsequentLogs.length === 0) html += `<span style="color:#666; font-size:10px;">None</span>`;
  subsequentLogs.forEach(l => {
    html += `<div class="code error-row" style="font-size:10px; margin-bottom:2px;">${escapeHtml(l.text || l.message || '').substring(0, 100)}...</div>`;
  });

  html += `<hr style="margin: 10px 0;"><b>Subsequent Network (next 5s):</b><br>`;
  if (subsequentNetwork.length === 0) html += `<span style="color:#666; font-size:10px;">None</span>`;
  subsequentNetwork.forEach(n => {
    const statusColor = n.response.status >= 400 ? 'red' : 'black';
    html += `<div class="code" style="font-size:10px; margin-bottom:2px; color:${statusColor}">${n.request.method} ${n.request.url.substring(0, 60)}...</div>`;
  });

  contextDiv.innerHTML = html;
}

function showDetails(entry) {
  const modal = document.getElementById('detailModal');
  document.getElementById('modalTitle').textContent = entry.request.url;

  // Reset Visibility for Network (Content & Titles)
  const reqHeadersWrap = document.getElementById('reqHeaders').parentElement;
  reqHeadersWrap.style.display = 'block';
  reqHeadersWrap.previousElementSibling.style.display = 'block';

  const resHeadersWrap = document.getElementById('resHeaders').parentElement;
  resHeadersWrap.style.display = 'block';
  resHeadersWrap.previousElementSibling.style.display = 'block';

  const reqBodyWrap = document.getElementById('reqBody').parentElement;
  reqBodyWrap.style.display = 'block';
  reqBodyWrap.previousElementSibling.style.display = 'block';
  reqBodyWrap.previousElementSibling.textContent = 'Request Body';

  const resBodyWrap = document.getElementById('resBody').parentElement;
  resBodyWrap.style.display = 'block';
  resBodyWrap.previousElementSibling.style.display = 'block';
  resBodyWrap.previousElementSibling.textContent = 'Response Body';

  const formatHeaders = (headers) => headers.map(h => `${h.name}: ${h.value}`).join('\n');

  document.getElementById('reqHeaders').textContent = formatHeaders(entry.request.headers);
  document.getElementById('resHeaders').textContent = formatHeaders(entry.response.headers);

  let reqBody = '';
  if (entry.request.postData) {
    reqBody = entry.request.postData.text;
  }
  document.getElementById('reqBody').textContent = reqBody || '(No body)';

  let resBody = '';
  if (entry.response.content && entry.response.content.text) {
    resBody = entry.response.content.text;
    // Try to pretty print JSON
    try {
      if (entry.response.content.mimeType && entry.response.content.mimeType.includes('json')) {
        resBody = JSON.stringify(JSON.parse(resBody), null, 2);
      }
    } catch (e) { }
  }
  document.getElementById('resBody').textContent = resBody || '(No body)';

  modal.style.display = 'block';
}

window.viewSource = async function (url, line, col) {
  if (!url) return;

  // Create or reuse a source preview container
  let preview = document.getElementById('sourcePreview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'sourcePreview';
    preview.style.cssText = "margin-top:10px; border:1px solid #ccc; background:#f9f9f9; padding:10px; max-height:300px; overflow:auto; font-family:monospace; white-space:pre; font-size:12px;";
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
      const style = isTarget ? "background:#ffeda3; font-weight:bold; display:block; width:100%; border-left: 3px solid #d13438; padding-left: 5px;" : "display:block; padding-left: 8px;";
      html += `<div style="${style}"><span style="color:#888; margin-right:10px; user-select:none; display:inline-block; width:30px; text-align:right;">${i + 1}</span>${escapeHtml(lines[i])}</div>`;
    }

    preview.innerHTML = html;
    // Provide a way to scroll if needed, but it's small.
  } catch (e) {
    preview.innerHTML = `<span style="color:red;">Error loading source: ${e.message}.<br><span style="font-size:10px; color:#666;">(Extension might not have permission to fetch this URL, or it is local/restricted)</span></span>`;
  }
};

function showConsoleDetails(err) {
  const modal = document.getElementById('detailModal');
  document.getElementById('modalTitle').textContent = "Console Log Details";

  // Hide network specific (Content & Titles)
  const reqHeadersWrap = document.getElementById('reqHeaders').parentElement;
  reqHeadersWrap.style.display = 'none';
  reqHeadersWrap.previousElementSibling.style.display = 'none';

  const resHeadersWrap = document.getElementById('resHeaders').parentElement;
  resHeadersWrap.style.display = 'none';
  resHeadersWrap.previousElementSibling.style.display = 'none';

  // Reuse Body sections for Message & Stack Trace
  const body1 = document.getElementById('reqBody').parentElement;
  body1.style.display = 'block';
  body1.previousElementSibling.style.display = 'block';
  body1.previousElementSibling.textContent = "Message";
  document.getElementById('reqBody').textContent = err.text || err.message || '';

  const body2 = document.getElementById('resBody').parentElement;
  body2.style.display = 'block';
  body2.previousElementSibling.style.display = 'block';
  body2.previousElementSibling.textContent = "Stack Trace";

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
      return `  at ${f.functionName || '(anonymous)'} (<a href="#" class="source-link" data-url="${escapeHtml(url)}" data-line="${lineNumber}" data-col="${colNumber}" style="color:#0078d4; text-decoration:underline;">${escapeHtml(url)}${lineDisplay}</a>)`;
    }).join('\n');
  } else if (err.url) {
    const line = err.line || err.lineNumber;
    const col = err.column || err.columnNumber;
    const hasLine = (typeof line === 'number');
    const lineDisplay = hasLine ? `:${line}:${col}` : '';
    const safeLine = hasLine ? line : 1;

    stackHtml = `at <a href="#" class="source-link" data-url="${escapeHtml(err.url)}" data-line="${safeLine}" data-col="${col || 1}" style="color:#0078d4; text-decoration:underline;">${escapeHtml(err.url)}${lineDisplay}</a>`;
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

  modal.style.display = 'block';
}

function renderScreencast(frames) {
  const player = document.getElementById('screenPlayer');
  const scrubber = document.getElementById('scrubber');
  const timeDisplay = document.getElementById('timeDisplay');
  const playBtn = document.getElementById('playBtn');

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
  let currentIndex = 0;
  let timeoutId = null;

  function showFrame(index) {
    if (index >= frames.length) index = frames.length - 1;
    if (index < 0) index = 0;

    const frame = frames[index];
    player.src = "data:image/jpeg;base64," + frame.data;

    const currentFrameTime = frame.wallTime || (frame.timestamp * 1000);
    const time = currentFrameTime - startTime;
    timeDisplay.textContent = new Date(time).toISOString().substr(11, 8);
    scrubber.value = index;
    currentIndex = index;
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
      playBtn.textContent = "Play";
      isPlaying = false;
    } else {
      playBtn.textContent = "Pause";
      isPlaying = true;
      playNextFrame();
    }
  }

  function playNextFrame() {
    if (!isPlaying) return;

    if (currentIndex >= frames.length - 1) {
      togglePlay(); // Stop at end
      return;
    }

    const currentFrame = frames[currentIndex];
    const nextFrame = frames[currentIndex + 1];

    const delay = (nextFrame.wallTime - currentFrame.wallTime) || ((nextFrame.timestamp - currentFrame.timestamp) * 1000);

    // Cap delay to avoid long freezes (e.g. if paused for a long time during recording)
    const safeDelay = Math.min(delay, 1000);

    showFrame(currentIndex + 1);

    timeoutId = setTimeout(playNextFrame, safeDelay);
  }
}

function renderIssues(issues, frames, allEvents) {
  const container = document.getElementById('issuesList');
  if (issues.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px;">No issues reported.</div>';
    return;
  }

  issues.forEach(issue => {
    const div = document.createElement('div');
    div.className = "issue-card";
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
        <div style="position:relative; display:inline-block; margin-top:10px; border:1px solid #ddd;">
            <img src="data:image/jpeg;base64,${closestFrame.data}" style="max-width: 100%; display:block;">
        </div>
        `;
    } else {
      imageHtml = `<div style="padding:10px; background:#eee;">No screenshot available</div>`;
    }

    // Context
    const timestamp = issue.timestamp;
    const recentLogs = (allEvents || []).filter(e => e.source === 'console' && e.sortTime <= timestamp && e.sortTime > (timestamp - 5000));
    const recentNetwork = (allEvents || []).filter(e => e.source === 'network' && e.sortTime <= timestamp && e.sortTime > (timestamp - 5000));

    let contextHtml = '<div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">';

    contextHtml += '<b>Recent Logs (last 5s):</b><br>';
    if (recentLogs.length === 0) contextHtml += '<span style="color:#666; font-size:10px;">None</span>';
    recentLogs.forEach(l => {
      contextHtml += `<div class="code error-row" style="font-size:10px; margin-bottom:2px;">${escapeHtml(l.text || l.message || '').substring(0, 100)}...</div>`;
    });

    contextHtml += '<br><b>Recent Network (last 5s):</b><br>';
    if (recentNetwork.length === 0) contextHtml += '<span style="color:#666; font-size:10px;">None</span>';
    recentNetwork.forEach(n => {
      const statusColor = n.response.status >= 400 ? 'red' : 'black';
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

// Close modal logic
document.querySelector('.close').addEventListener('click', () => {
  document.getElementById('detailModal').style.display = 'none';
});

window.addEventListener('click', (event) => {
  const modal = document.getElementById('detailModal');
  if (event.target == modal) {
    modal.style.display = 'none';
  }
});

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
