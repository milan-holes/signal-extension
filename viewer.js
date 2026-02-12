let currentReportData = null;
let currentConsoleSort = { key: 'time', dir: 'asc' };
let currentNetworkSort = { key: 'start', dir: 'asc' };

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

  if (importBtn) importBtn.addEventListener('click', () => fileInput.click());

  if (replayBtn) replayBtn.addEventListener('click', () => {
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
    const blob = new Blob([JSON.stringify(currentReportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-report-${new Date().toISOString()}.json`;
    a.click();
  });

  if (fileInput) fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    reportDateSpan.textContent = "Loading...";
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        renderReport(data);
      } catch (err) {
        alert("Invalid JSON file");
        reportDateSpan.textContent = "";
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
    // Optional: Improve empty state visual
    const msg = `<div style="text-align:center; padding: 40px; color: var(--text-secondary); font-size: 14px;">No report loaded. Click "Import Report" to view data.</div>`;
    document.querySelectorAll('tbody').forEach(el => el.innerHTML = `<tr><td colspan="10">${msg}</td></tr>`);
  }

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

  // Filter Chips Logic
  document.querySelectorAll('.filter-chip').forEach(chip => {
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
  if (detailPanel) {
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    Object.assign(resizer.style, {
      width: '8px',
      cursor: 'col-resize',
      position: 'absolute',
      top: '0',
      bottom: '0',
      left: '-4px', // Center over the border
      zIndex: '100'
    });
    detailPanel.appendChild(resizer);

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = parseInt(window.getComputedStyle(detailPanel).width, 10);

      function doDrag(e) {
        // Calculate new width (dragging LEFT increases width)
        const newWidth = startWidth - (e.clientX - startX);
        if (newWidth > 300 && newWidth < window.innerWidth - 100) {
          detailPanel.style.width = newWidth + 'px';
        }
      }

      function stopDrag() {
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mouseup', stopDrag);
      }

      document.addEventListener('mousemove', doDrag);
      document.addEventListener('mouseup', stopDrag);
    });
  }
});

let currentNetworkEntries = [];
let currentFilter = { type: 'all', search: '' };

let currentConsoleErrors = [];
let allConsoleErrors = [];
let currentConsoleFilter = { level: 'all', search: '' };

function renderReport(data) {
  currentReportData = data;
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
  } catch (e) { console.error("Error rendering timeline:", e); }

  try {
    renderEnvironment(data.environment || {});
  } catch (e) { console.error("Error rendering environment:", e); }

  try {
    renderStorage(data.storage || {});
  } catch (e) { console.error("Error rendering storage:", e); }

  try {
    renderScreencast(data.screencast || []);
  } catch (e) { console.error("Error rendering screencast:", e); }

  let allEvents = [];
  try {
    (data.userEvents || []).forEach(e => allEvents.push({ ...e, source: 'user', sortTime: e.timestamp }));
    (data.consoleErrors || []).forEach(e => allEvents.push({ ...e, source: 'console', sortTime: e.timestamp }));
    ((data.har && data.har.log && data.har.log.entries) ? data.har.log.entries : []).forEach(e => allEvents.push({ ...e, source: 'network', sortTime: new Date(e.startedDateTime).getTime() }));
    (data.issues || []).forEach(e => allEvents.push({ ...e, source: 'issue', sortTime: e.timestamp }));
    allEvents.sort((a, b) => a.sortTime - b.sortTime);
  } catch (e) { console.error("Error preparing allEvents:", e); }

  try {
    renderIssues(data.issues || [], data.screencast || [], allEvents);
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

  errors.forEach(err => {
    const tr = document.createElement('tr');
    tr.className = 'error-row';
    tr.style.cursor = 'pointer';

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
    tbody.appendChild(tr);
  });
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

  entries.forEach(entry => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.title = 'Click to view details';

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
    `;

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      showDetails(entry);
    });
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
      document.querySelectorAll('#timelineTable tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      updatePreview(event.sortTime, screencast, allEvents);
    });

    let sourceDisplay = '';
    let details = '';
    let rowClass = '';

    if (event.source === 'user') {
      sourceDisplay = `<span class="badge badge-info">USER</span>`;
      if (event.type === 'click') {
        details = `Clicked <b>${event.target.tagName}</b>`;
        // if (event.target.innerText) details += ` "${escapeHtml(event.target.innerText)}"`;
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

    tr.innerHTML = `
      <td class="meta" style="font-family:monospace;">${new Date(event.sortTime).toLocaleTimeString()}</td>
      <td>${sourceDisplay}</td>
      <td>${details}</td>
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
  const subsequentLogs = allEvents.filter(e => e.source === 'console' && e.sortTime >= timestamp && e.sortTime < (timestamp + 5000));
  const subsequentNetwork = allEvents.filter(e => e.source === 'network' && e.sortTime >= timestamp && e.sortTime < (timestamp + 5000));

  let html = ``;

  // Logs Section
  html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <b>Subsequent Logs (next 5s):</b>
            ${createCopyBtnHTML('previewLogsContent')}
           </div>`;
  html += `<div id="previewLogsContent" style="max-height:150px; overflow-y:auto; background:var(--bg-input, #3a3b3c); padding:5px; border-radius:4px;">`;
  if (subsequentLogs.length === 0) html += `<span style="color:var(--text-secondary); font-size:10px;">None</span>`;
  subsequentLogs.forEach(l => {
    html += `<div class="code error-row" style="font-size:11px; margin-bottom:2px; color:var(--text-main); font-family:monospace;">${escapeHtml(l.text || l.message || '').substring(0, 100)}...</div>`;
  });
  html += `</div>`;

  // Network Section
  html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; margin-bottom:5px;">
            <b>Subsequent Network (next 5s):</b>
            ${createCopyBtnHTML('previewNetworkContent')}
           </div>`;
  html += `<div id="previewNetworkContent" style="max-height:150px; overflow-y:auto; background:var(--bg-input, #3a3b3c); padding:5px; border-radius:4px;">`;
  if (subsequentNetwork.length === 0) html += `<span style="color:var(--text-secondary); font-size:10px;">None</span>`;
  subsequentNetwork.forEach(n => {
    const statusColor = n.response.status >= 400 ? 'var(--danger)' : 'var(--text-main)';
    html += `<div class="code" style="font-size:11px; margin-bottom:2px; color:${statusColor}; font-family:monospace;">${n.request.method} ${n.request.url.substring(0, 60)}...</div>`;
  });
  html += `</div>`;

  contextDiv.innerHTML = html;
}

// Copy Button Logic (Delegation)
function createCopyBtnHTML(targetId) {
  return `<button class="copy-icon-btn" data-copy-target="${targetId}" title="Copy">
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
    btn.innerHTML = `<svg style="pointer-events:none;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
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
      // Restore title text if needed (e.g. if console overwrote it) but keep the span!
      // Actually, the span is inside the titleEl in HTML.
      // If console view overwrote innerHTML, the span is GONE.
      // So valid strategy is to reconstruct innerHTML if the span is missing.
      if (!titleEl.querySelector('.badge')) {
        titleEl.innerHTML = `${defaultTitle} <span id="${countId}" class="badge" style="background:var(--bg-input); color:var(--text-secondary); margin-left:5px;">${(headers || []).length}</span>`;
      } else {
        // Just update text part if needed, but usually 'Response Headers' is static there.
        // We already updated textContent of the badge above.
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
      return `  at ${f.functionName || '(anonymous)'} (<a href="#" class="source-link" data-url="${escapeHtml(url)}" data-line="${lineNumber}" data-col="${colNumber}" style="color:#2e89ff; text-decoration:underline;">${escapeHtml(url)}${lineDisplay}</a>)`;
    }).join('\n');
  } else if (err.url) {
    const line = err.line || err.lineNumber;
    const col = err.column || err.columnNumber;
    const hasLine = (typeof line === 'number');
    const lineDisplay = hasLine ? `:${line}:${col}` : '';
    const safeLine = hasLine ? line : 1;

    stackHtml = `at <a href="#" class="source-link" data-url="${escapeHtml(err.url)}" data-line="${safeLine}" data-col="${col || 1}" style="color:#2e89ff; text-decoration:underline;">${escapeHtml(err.url)}${lineDisplay}</a>`;
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
    "Context": {
      "URL": env.url
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

    card.innerHTML = `
      <h3 style="margin-top:0; font-size:14px; color:var(--primary); margin-bottom:15px;">${escapeHtml(title)}</h3>
      ${rows}
    `;
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

    keys.forEach(key => {
      const val = items[key];
      const tr = document.createElement('tr');

      const valStr = (typeof val === 'object') ? JSON.stringify(val) : String(val);

      tr.innerHTML = `
        <td style="font-family:monospace; word-break:break-all; color:var(--primary); font-weight:600; vertical-align:top;">${escapeHtml(key)}</td>
        <td style="vertical-align:top;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
                <div style="font-family:monospace; word-break:break-all; white-space:pre-wrap; flex:1; max-height: 200px; overflow-y: auto;">${escapeHtml(valStr)}</div>
                <button class="copy-btn action-btn" title="Copy Value" style="padding:4px 8px; flex-shrink:0;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
            </div>
        </td>
      `;

      // Add copy functionality
      const copyBtn = tr.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(valStr).then(() => {
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = `<span style="font-size:10px; font-weight:bold; color:var(--success);">Copied!</span>`;
          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
          }, 1500);
        });
      });

      tbody.appendChild(tr);
    });
  };

  // Attach listeners
  chips.forEach(chip => {
    // Remove old listeners by cloning (hacky but effective to prevent duplicates if render called multiple times)
    const newChip = chip.cloneNode(true);
    chip.parentNode.replaceChild(newChip, chip);

    newChip.addEventListener('click', () => {
      document.querySelectorAll('#storage .filter-chip').forEach(c => c.classList.remove('active'));
      newChip.classList.add('active');
      const type = newChip.dataset.storageType; // local, session, cookies
      renderTable(type);
    });
  });

  // Trigger default (Local)
  const defaultTab = document.querySelector('#storage .filter-chip[data-storage-type="local"]');
  if (defaultTab) {
    // Simulate click or just call render
    // We need to set active class manually if we don't click
    // The HTML has active class on 'local' by default.
    renderTable('local');
    // Ensure listeners are seemingly attached to the new nodes
  }
}
