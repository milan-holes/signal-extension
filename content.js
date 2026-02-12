{ // Signal Content Script
  // Prevent content script from running on extension pages (Viewer, Editor, etc.)
  // Prevent content script from running on extension pages (Viewer, Editor, etc.)
  const isExtensionPage = location.protocol === 'chrome-extension:' ||
    location.protocol === 'moz-extension:' ||
    document.title === 'Screenshot Editor' ||
    document.title === 'Signal Report';

  if (isExtensionPage) {
    throw new Error("Content script should not run on extension pages.");
  }

  // Floating Icon Logic
  // Redesigned Floating Widget (Unified Icon + Controls)

  // 1. Cleanup Old Widget
  const oldWidget = document.getElementById('signal-widget-root');
  if (oldWidget) oldWidget.remove();

  document.querySelectorAll('div').forEach(div => {
    if (div.style.zIndex === '2147483647' && div.style.position === 'fixed' && div.style.bottom === '20px') {
      div.remove();
    }
  });

  // Global State
  let recorder;
  let stream;
  let audioStream;
  let recordedChunks = [];
  let statsInterval;
  let isRecording = false;
  let highlightBox = null;
  let forcedHidden = false; // For 'hide' while recording
  let settings = {};

  let isPaused = false;
  let currentMode = 'standard';
  let isEditMode = false;
  let showWidget = false;
  let selectedElement = null;
  let originalBorder = "";
  let editorPopup = null;
  let activeReportCleanup = null;
  let showClicks = true; // Default

  // 2. Create Widget
  const floatingWidget = document.createElement('div');
  floatingWidget.id = 'signal-widget-root';
  floatingWidget.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    border-radius: 30px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-family: "Segoe UI", sans-serif;
    transition: width 0.3s ease, background 0.3s ease, padding 0.3s ease;
    bottom: 20px;
    right: 20px;
    pointer-events: auto;
    width: auto;
    height: auto;
    opacity: 1;
    visibility: visible;
  `;

  (document.documentElement || document.body).appendChild(floatingWidget);

  // Icons
  const Icons = {

    record: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>`,
    stop: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>`,
    pause: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    screenshot: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    chevron: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>`,
    report: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    drag: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="16" cy="20" r="2"/></svg>`,
    cancel: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
  };

  function createWidgetBtn(html, bg, onClick) {
    const btn = document.createElement('div');
    btn.innerHTML = html;
    Object.assign(btn.style, {
      padding: '6px 12px', background: bg, borderRadius: '20px',
      color: 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
      display: 'flex', gap: '6px', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      fontFamily: 'Segoe UI, sans-serif', userSelect: 'none'
    });
    btn.onclick = (e) => { e.stopPropagation(); onClick(e); };
    btn.onmousedown = (e) => e.stopPropagation();
    return btn;
  }

  function createDragHandle() {
    const div = document.createElement('div');
    div.innerHTML = Icons.drag;
    Object.assign(div.style, {
      color: 'rgba(255,255,255,0.5)', cursor: 'move', marginRight: '4px', display: 'flex', alignItems: 'center', padding: '2px'
    });
    return div;
  }

  let screenshotDropdown = null;

  function toggleScreenshotMenu(btn) {
    if (!screenshotDropdown) {
      screenshotDropdown = document.createElement('div');
      Object.assign(screenshotDropdown.style, {
        position: 'fixed', zIndex: '2147483648', background: 'white',
        borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', padding: '5px 0',
        display: 'none', minWidth: '140px', fontFamily: 'Segoe UI, sans-serif', fontSize: '13px',
        color: '#333'
      });

      const opts = [
        { text: 'Visible Area', action: 'visible' },
        { text: 'Selected Area', action: 'region' },
        { text: 'Whole Page', action: 'full' }
      ];

      opts.forEach(opt => {
        const item = document.createElement('div');
        item.innerText = opt.text;
        Object.assign(item.style, { padding: '8px 15px', cursor: 'pointer' });
        item.onmouseover = () => item.style.background = '#f3f2f1';
        item.onmouseout = () => item.style.background = 'white';
        item.onclick = (e) => {
          e.stopPropagation();
          screenshotDropdown.style.display = 'none';
          performScreenshot(opt.action);
        };
        screenshotDropdown.appendChild(item);
      });

      document.body.appendChild(screenshotDropdown);

      document.addEventListener('click', (e) => {
        if (screenshotDropdown && screenshotDropdown.style.display === 'block' && !screenshotDropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
          screenshotDropdown.style.display = 'none';
        }
      });
    }

    if (screenshotDropdown.style.display === 'block') {
      screenshotDropdown.style.display = 'none';
    } else {
      const rect = btn.getBoundingClientRect();
      screenshotDropdown.style.display = 'block';

      const dropdownHeight = screenshotDropdown.offsetHeight;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Check if enough space below, otherwise place above
      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        screenshotDropdown.style.top = (rect.top - dropdownHeight - 5) + 'px';
      } else {
        screenshotDropdown.style.top = (rect.bottom + 5) + 'px';
      }
      screenshotDropdown.style.left = rect.left + 'px';
    }
  }

  function setWidgetIdle() {
    if (activeReportCleanup) {
      activeReportCleanup();
      activeReportCleanup = null;
    }

    floatingWidget.innerHTML = '';
    Object.assign(floatingWidget.style, {
      width: 'auto', height: 'auto', padding: '6px 12px 6px 6px', background: 'rgba(30, 30, 30, 0.9)',
      borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)'
    });

    const startBtn = createWidgetBtn(`${Icons.record} Start`, '#d13438', () => {
      try {
        const env = {
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
          url: window.location.href // Current URL Context
        };

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
                const v = parts.join('='); // Re-join rest in case value has =
                if (k) cookies[k] = v;
              });
            }
            return cookies;
          } catch (e) { return {}; }
        };

        const storage = {
          localStorage: getStorage('localStorage'),
          sessionStorage: getStorage('sessionStorage'),
          cookies: getCookies()
        };

        chrome.runtime.sendMessage({ action: "start", environment: env, storage: storage }, (response) => {
          if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message.includes("invalidated")) {
              showToast("Extension context invalidated. Please refresh the page.", "error");
            } else {
              showToast("Error: " + chrome.runtime.lastError.message, "error");
            }
            return;
          }
          if (response && response.status === "started") {
            updateOverlayState('standard');
          }
        });
      } catch (e) {
        if (e.message.includes("invalidated")) showToast("Extension updated. Please refresh the page.", "error");
        else console.error(e);
      }
    });

    const shotBtn = createWidgetBtn(`${Icons.screenshot} Screenshot ${Icons.chevron}`, '#0078d4', (e) => {
      toggleScreenshotMenu(e.currentTarget);
    });

    floatingWidget.appendChild(createDragHandle());
    floatingWidget.appendChild(startBtn);
    floatingWidget.appendChild(shotBtn);

    floatingWidget.dataset.state = "idle";
    floatingWidget.style.display = showWidget ? "flex" : "none";
  }

  function setWidgetRecording(isPaused = false, mode = 'standard') {
    floatingWidget.innerHTML = '';
    const color = mode === 'buffer' ? '#0078d4' : '#d13438';
    const statusText = isPaused ? "Paused" : "Recording";
    const statusIcon = isPaused ? Icons.pause : Icons.stop;

    const stopBtn = createWidgetBtn(
      `${statusIcon} ${statusText}`,
      color,
      () => stopRecording()
    );

    /* Screenshot button removed as per request
    const shotBtn = createWidgetBtn(`${Icons.screenshot} Screenshot ${Icons.chevron}`, '#0078d4', (e) => {
      toggleScreenshotMenu(e.currentTarget);
    });
    */

    const isReporting = !!activeReportCleanup;
    const reportBtn = createWidgetBtn(`${Icons.report} Report`, isReporting ? '#ccc' : '#ffb900', () => {
      if (!isReporting) highlightAndReport();
    });
    reportBtn.style.color = isReporting ? '#666' : '#000000';
    if (isReporting) {
      reportBtn.style.cursor = 'not-allowed';
    }

    /* Edit button hidden for now
    const editBtn = createWidgetBtn(
      isEditMode ? `${Icons.check} Done` : `${Icons.edit} Edit`,
      isEditMode ? '#107c10' : '#444',
      () => setEditMode(!isEditMode)
    );
    editBtn.id = 'widget-edit-btn';
    */

    // Cancel Btn
    const cancelBtn = createWidgetBtn(`${Icons.cancel} Cancel`, '#555', () => cancelRecording());
    cancelBtn.title = "Discard Recording";

    floatingWidget.appendChild(createDragHandle());

    floatingWidget.appendChild(stopBtn);
    // floatingWidget.appendChild(shotBtn);
    floatingWidget.appendChild(reportBtn);
    // floatingWidget.appendChild(editBtn);
    floatingWidget.appendChild(cancelBtn);

    floatingWidget.dataset.state = "recording";
    // Explicitly force display to flex to override any 'display: none' from settings
    floatingWidget.style.setProperty('display', 'flex', 'important');
    floatingWidget.style.setProperty('visibility', 'visible', 'important');
    floatingWidget.style.setProperty('opacity', '1', 'important');
    forcedHidden = false;

    // Ensure widget stays within viewport when size changes
    requestAnimationFrame(() => {
      const rect = floatingWidget.getBoundingClientRect();
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      if (rect.right > winWidth) {
        const newLeft = Math.max(0, winWidth - rect.width - 20);
        floatingWidget.style.left = newLeft + 'px';
      }
      if (rect.bottom > winHeight) {
        const newTop = Math.max(0, winHeight - rect.height - 20);
        floatingWidget.style.top = newTop + 'px';
      }
    });
  }



  function updateWidgetVisibility() {
    if (floatingWidget && floatingWidget.dataset.state !== 'hidden') {
      if (forcedHidden) {
        floatingWidget.style.display = "none";
        return;
      }
      // Force show if recording, otherwise respect setting
      if (floatingWidget.dataset.state === 'recording') {
        floatingWidget.style.display = "flex";
      } else {
        floatingWidget.style.display = showWidget ? "flex" : "none";
      }
    }
  }

  // Global settings variables
  // let showClicks = true; // Moved to top
  let clickSize = 20;

  // Initial settings load
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      const settings = result.settings;

      if (settings.showClicks !== undefined) showClicks = settings.showClicks;
      if (settings.clickSize) clickSize = settings.clickSize;

      // FORCE DISABLE AutoRecord (Instant Replay) as per request
      if (settings.autoRecord) {
        settings.autoRecord = false;
        chrome.storage.local.set({ settings });
        // Ensure any auto-started recording is stopped
        chrome.runtime.sendMessage({ action: "stop" });
      }

      if (settings.showWidget !== undefined) {
        showWidget = settings.showWidget;
      } else {
        showWidget = true;
      }
    } else {
      showWidget = true;
    }
    updateWidgetVisibility();

    // Re-apply display logic for idle state just in case
    if (floatingWidget.dataset.state === 'idle') {
      floatingWidget.style.display = showWidget ? "flex" : "none";
    }
  });

  // Settings Listener
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue;
      if (newSettings) {
        if (newSettings.showWidget !== undefined) {
          showWidget = newSettings.showWidget;
          updateWidgetVisibility();
        }
        if (newSettings.showClicks !== undefined) showClicks = newSettings.showClicks;
        if (newSettings.clickSize) clickSize = newSettings.clickSize;
      }
    }
  });

  function togglePause() {
    isPaused = !isPaused;
    chrome.runtime.sendMessage({ action: isPaused ? "pause" : "resume" });
    setWidgetRecording(isPaused, currentMode);
  }

  function stopRecording() {
    showProcessingToast("Generating Report...");
    chrome.runtime.sendMessage({ action: "stop" }, () => {
      chrome.runtime.sendMessage({ action: "saveReport" }, (response) => {
        if (response && response.status === "saved") {
          chrome.runtime.sendMessage({ action: "openViewer" });
        } else {
          alert("Error saving report: " + (response ? response.error : "Unknown error"));
        }
        removeProcessingToast();
      });
    });
  }

  function cancelRecording() {
    if (confirm("Are you sure you want to cancel? This recording will be discarded.")) {
      chrome.runtime.sendMessage({ action: "stop" }, () => {
        // Do NOT save report
        setWidgetIdle();
        // Maybe show toast?
        const toast = document.createElement('div');
        toast.innerText = "Recording Cancelled";
        Object.assign(toast.style, {
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#333', color: '#fff', padding: '10px 20px', borderRadius: '4px',
          zIndex: 2147483647, fontSize: '13px'
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      });
    }
  }


  // Drag Handler
  let isDragging = false;
  let offsetX, offsetY;

  floatingWidget.addEventListener('mousedown', (e) => {
    // Buttons stop propagation, so this is only for background drag
    e.preventDefault();

    isDragging = false;

    // Calculate offset relative to widget's top-left
    const rect = floatingWidget.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // Capture start pos for threshold check
    const startX = e.clientX;
    const startY = e.clientY;

    floatingWidget.style.transition = 'none';

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;

      if (isDragging) {
        let newTop = ev.clientY - offsetY;
        let newLeft = ev.clientX - offsetX;

        newTop = Math.max(0, Math.min(newTop, window.innerHeight - floatingWidget.offsetHeight));
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - floatingWidget.offsetWidth));

        floatingWidget.style.top = newTop + 'px';
        floatingWidget.style.left = newLeft + 'px';
        floatingWidget.style.bottom = 'auto';
        floatingWidget.style.right = 'auto';
      }
    };

    const onUp = (ev) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      floatingWidget.style.transition = "";

      if (isDragging) {
        localStorage.setItem('debug-widget-pos', JSON.stringify({
          top: floatingWidget.style.top,
          left: floatingWidget.style.left
        }));
      }
      isDragging = false;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });


  setWidgetIdle();

  // Restore position
  if (localStorage.getItem('debug-widget-pos')) {
    try {
      const pos = JSON.parse(localStorage.getItem('debug-widget-pos'));
      const t = parseInt(pos.top);
      const l = parseInt(pos.left);
      if (!isNaN(t) && !isNaN(l) && t >= 0 && l >= 0 && t < window.innerHeight && l < window.innerWidth) {
        floatingWidget.style.top = t + 'px';
        floatingWidget.style.left = l + 'px';
        floatingWidget.style.bottom = 'auto';
        floatingWidget.style.right = 'auto';
      }
    } catch (e) {
      console.warn("Invalid widget position", e);
      localStorage.removeItem('debug-widget-pos');
    }
  }

  // 5. Append to DOM
  // Already handled above when created to ensure it exists for subsequent logic
  if (!floatingWidget.isConnected) {
    (document.documentElement || document.body).appendChild(floatingWidget);
  }

  function performScreenshot(type) {
    if (type === 'region') {
      startSelectionOverlay((box) => {
        promptAndCapture(type, box);
      });
    } else {
      promptAndCapture(type, null);
    }
  }

  function promptAndCapture(type, area) {
    // We delay slightly to allow menu to close fully if needed
    setTimeout(() => {
      // Hide widget for clean screenshot
      const originalDisplay = floatingWidget.style.display;
      floatingWidget.style.display = 'none';

      // Wait a frame for paint
      requestAnimationFrame(() => {
        const dpr = window.devicePixelRatio || 1;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

        const scaledArea = area ? {
          x: Math.round(area.x + scrollX),
          y: Math.round(area.y + scrollY),
          width: Math.round(area.width),
          height: Math.round(area.height),
          scale: dpr
        } : null;

        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: "captureScreenshot",
            type: type,
            area: scaledArea
          }, (response) => {
            // Restore widget
            floatingWidget.style.display = originalDisplay;

            if (chrome.runtime.lastError || (response && response.error)) {
              alert("Screenshot failed: " + (chrome.runtime.lastError?.message || response.error));
              return;
            }

            if (response && response.dataUrl) {
              // Pause recording if active
              if (isRecording) {
                chrome.runtime.sendMessage({ action: "pause" });
                isPaused = true;
                setWidgetRecording(true, currentMode);
              }

              // Open Editor instead of direct save
              chrome.runtime.sendMessage({
                action: "openScreenshotEditor",
                dataUrl: response.dataUrl,
                mode: type
              });
            }
          });
        }, 500);
      });
    }, 100);
  }

  function showSuccessRipple() {
    const flash = document.createElement('div');
    Object.assign(flash.style, {
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'white', opacity: 0.5, zIndex: 2000000, pointerEvents: 'none',
      transition: 'opacity 0.5s ease'
    });
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = 0;
      setTimeout(() => flash.remove(), 500);
    });
  }

  // Re-implement startSelectionOverlay to be generic
  function startSelectionOverlay(callback) {
    // Cleanup any existing overlays to prevent stacking/dimming
    const existing = document.getElementById('signal-selection-overlay');
    if (existing) existing.remove();
    document.querySelectorAll('div').forEach(d => {
      if (d.style.zIndex === '1000000' && d.style.cursor === 'crosshair' && d.style.position === 'fixed') {
        d.remove();
      }
    });

    const overlay = document.createElement('div');
    overlay.id = 'signal-selection-overlay';
    Object.assign(overlay.style, {
      position: "fixed", top: "0", left: "0", width: "100%", height: "100%",
      zIndex: "1000000", cursor: "crosshair", background: "rgba(0,0,0,0.2)"
    });
    document.body.appendChild(overlay);

    let startX, startY;
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: "absolute", border: "2px solid #0078d4", background: "rgba(0, 120, 212, 0.1)",
      display: "none"
    });
    overlay.appendChild(box);

    const onDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startY = e.clientY;
      box.style.left = startX + "px";
      box.style.top = startY + "px";
      box.style.width = "0px";
      box.style.height = "0px";
      box.style.display = "block";

      overlay.addEventListener('mousemove', onMove);
      overlay.addEventListener('mouseup', onUp);
    };

    const onMove = (e) => {
      const currentX = e.clientX;
      const currentY = e.clientY;

      // Calculate rect
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(currentX, startX);
      const top = Math.min(currentY, startY);

      box.style.width = width + "px";
      box.style.height = height + "px";
      box.style.left = left + "px";
      box.style.top = top + "px";
    };

    const onUp = (e) => {
      e.stopPropagation();
      e.preventDefault();
      overlay.removeEventListener('mousemove', onMove);
      overlay.removeEventListener('mouseup', onUp);
      overlay.removeEventListener('mousedown', onDown);

      const rect = {
        x: parseInt(box.style.left),
        y: parseInt(box.style.top),
        width: parseInt(box.style.width),
        height: parseInt(box.style.height)
      };

      document.body.removeChild(overlay);

      // Only callback if size is meaningful
      if (rect.width > 5 && rect.height > 5) {
        // Wait for paint to clear overlay
        requestAnimationFrame(() => {
          setTimeout(() => {
            callback(rect);
          }, 50); // Small delay to ensure clean frame
        });
      } else {
        if (callback) callback(null);
      }
    };

    overlay.addEventListener('mousedown', onDown);
  }

  // Redirect old startIssueReporting to new flow (alias to Selected Area)
  function startIssueReporting() {
    highlightAndReport();
  }

  function highlightAndReport() {
    // 1. Pause Recording
    chrome.runtime.sendMessage({ action: "pause" });
    isPaused = true;
    setWidgetRecording(true, currentMode); // Update UI

    startSelectionOverlay((box) => {
      if (!box) {
        // Selection aborted/cancelled
        chrome.runtime.sendMessage({ action: "resume" });
        isPaused = false;
        setWidgetRecording(false, currentMode);
        return;
      }

      // 1. Visual feedback (persist box)
      const persistBox = document.createElement('div');
      // box includes scrollX/scrollY, but we use position: fixed for overlay items usually?
      // Wait, startSelectionOverlay returns x/y with scroll already added?
      // Yes: x: parseInt(box.style.left) + window.scrollX

      // If we use position: 'fixed' here, we must subtract scroll
      // OR use position: 'absolute' and append to body (which is often relative or static)
      // Let's use position: absolute to match the coordinates we have
      Object.assign(persistBox.style, {
        position: 'absolute',
        border: '4px solid red',
        background: 'rgba(255, 0, 0, 0.2)',
        zIndex: 2147483647,
        pointerEvents: 'none',
        left: (box.x + window.scrollX) + 'px',
        top: (box.y + window.scrollY) + 'px',
        width: box.width + 'px',
        height: box.height + 'px'
      });
      document.body.appendChild(persistBox);

      // 2. Show Input Dialog
      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 4px 25px rgba(0,0,0,0.4)',
        zIndex: 2147483648,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '320px',
        fontFamily: 'Segoe UI, sans-serif'
      });

      dialog.innerHTML = `
        <label style="font-size:14px; font-weight:600; color:#333;">Report Issue</label>
        <div style="font-size:12px; color:#666; margin-bottom:4px;">Describe the issue found in the selected area.</div>
        <textarea id="issue-comment" rows="4" style="width:100%; box-sizing:border-box; border:1px solid #ddd; border-radius:4px; padding:8px; font-family:inherit; font-size:13px; resize:none; color:#000000; background-color:#ffffff;" placeholder="What's wrong here?"></textarea>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
            <button id="btn-cancel-issue" style="padding:6px 14px; border:1px solid #ccc; background:#f0f0f0; color:#333; border-radius:4px; cursor:pointer; font-size:13px; font-weight:500;">Cancel</button>
            <button id="btn-submit-issue" style="padding:6px 14px; border:none; background:#d13438; color:white; border-radius:4px; cursor:pointer; font-size:13px; font-weight:600;">Report Issue</button>
        </div>
    `;
      document.body.appendChild(dialog);

      // Assign to global editorPopup so event listeners ignore it
      editorPopup = dialog;

      // Reinforce Paused state in UI
      isPaused = true;
      setWidgetRecording(true, currentMode);

      const cleanup = () => {
        if (dialog && dialog.parentNode) dialog.remove();
        if (persistBox && persistBox.parentNode) persistBox.remove();

        // Clear global state
        activeReportCleanup = null;
        editorPopup = null;

        // Resume Recording and Refresh UI
        chrome.runtime.sendMessage({ action: "resume" });
        isPaused = false;

        // This will now re-render the widget with the Report button enabled
        setWidgetRecording(false, currentMode);
      };
      activeReportCleanup = cleanup;

      const submit = () => {
        const commentInput = document.getElementById('issue-comment');
        const comment = commentInput.value.trim() || "Manually Reported Issue";
        const timestamp = Date.now();
        chrome.runtime.sendMessage({
          action: "recordIssue",
          issue: {
            timestamp: timestamp,
            comment: comment,
            rect: box
          }
        });
        cleanup();
      };

      document.getElementById('btn-submit-issue').onclick = submit;
      document.getElementById('btn-cancel-issue').onclick = cleanup;

      const textarea = document.getElementById('issue-comment');
      textarea.focus();

      // Submit on Ctrl+Enter
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          submit();
        }
      });
    });
  }

  // Logic for old Import/Export moved to helper functions to keep updateMenuContent clean
  function importEdits() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const changes = JSON.parse(event.target.result);
          if (Array.isArray(changes)) {
            applyImportedChanges(changes);
            alert(`Imported ${changes.length} changes.`);
          } else alert("Invalid format.");
        } catch (err) { alert("Error: " + err.message); }
        fileInput.remove();
      };
      reader.readAsText(file);
    };
    fileInput.click();
  }

  function exportEdits() {
    chrome.runtime.sendMessage({ action: "downloadContentChanges" });
  }

  // Verified logic: 
  // 1. startBtn calls background "start"
  // 2. background "start" attaches debugger and returns callback
  // 3. startBtn callback calls updateOverlayState('standard')
  // 4. updateOverlayState calls setWidgetRecording
  // If "not working", maybe updateOverlayState is missing/broken?

  function updateOverlayState(mode) {
    if (mode === 'standard' || mode === 'buffer') {
      setWidgetRecording(false, mode);
    } else {
      setWidgetIdle();
    }
  }

  // Listen for messages from background
  if (!window.signalContentListenerAttached) {
    window.signalContentListenerAttached = true;
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "showOverlay") {
        updateOverlayState(request.mode);
      }
      if (request.action === "hideOverlay") {
        setWidgetIdle();
        isPaused = false;
      }

      // New actions from Popup
      if (request.action === "toggleEditMode") {
        setEditMode(!isEditMode);
      }
      if (request.action === "triggerScreenshot") {
        performScreenshot(request.type);
      }
      if (request.action === "setWidgetVisibility") {
        forcedHidden = !request.visible;
        updateWidgetVisibility();
      }
    });
  }

  // Check status on load
  chrome.runtime.sendMessage({ action: "checkStatus" }, (response) => {
    if (response && response.isRecording) {
      updateOverlayState(response.mode);
    }
  });





  document.addEventListener('click', (e) => {
    // Ignore events on extension UI
    if (floatingWidget && (floatingWidget === e.target || floatingWidget.contains(e.target))) return;
    if (screenshotDropdown && (screenshotDropdown === e.target || screenshotDropdown.contains(e.target))) return;
    if (editorPopup && (editorPopup === e.target || editorPopup.contains(e.target))) return;

    if (!showClicks) return;
    if (isPaused) return;

    // Visual Ripple Effect
    const size = clickSize;
    const half = size / 2;

    const ripple = document.createElement('div');
    ripple.style.position = 'fixed';
    ripple.style.left = (e.clientX - half) + 'px';
    ripple.style.top = (e.clientY - half) + 'px';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.background = 'rgba(255, 0, 0, 0.5)';
    ripple.style.borderRadius = '50%';
    ripple.style.pointerEvents = 'none'; // Don't block clicks
    ripple.style.zIndex = '999999';
    ripple.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    document.body.appendChild(ripple);

    // Animate
    requestAnimationFrame(() => {
      ripple.style.transform = 'scale(2)';
      ripple.style.opacity = '0';
    });

    // Remove after animation
    setTimeout(() => {
      document.body.removeChild(ripple);
    }, 300);

    chrome.runtime.sendMessage({
      action: "recordUserEvent",
      event: {
        type: 'click',
        timestamp: Date.now(),
        target: {
          tagName: e.target.tagName,
          id: e.target.id,
          className: e.target.className,
          innerText: e.target.innerText ? e.target.innerText.substring(0, 50) : '',
          xpath: getXPath(e.target)
        },
        x: e.clientX,
        y: e.clientY
      }
    });
  }, true);

  document.addEventListener('keydown', (e) => {
    // Ignore events on extension UI
    if (floatingWidget && floatingWidget.contains(e.target)) return;
    if (editorPopup && editorPopup.contains(e.target)) return;
    if (isPaused) return;

    chrome.runtime.sendMessage({
      action: "recordUserEvent",
      event: {
        type: 'keydown',
        timestamp: Date.now(),
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      }
    });
  }, true);

  // Global State (Moved to top)
  function updateOverlayState(mode) {
    currentMode = mode;
    forcedHidden = false; // Reset any forced hidden state

    if (mode === 'standard' || mode === 'buffer') {
      setWidgetRecording(isPaused, mode);
    } else {
      setWidgetIdle();
    }
  }

  // Edit Mode Vars (Moved to top)


  // Helper to manage Edit Mode state
  function setEditMode(enable) {
    isEditMode = enable;

    const editBtn = document.getElementById('widget-edit-btn');
    if (editBtn) {
      editBtn.innerHTML = isEditMode ? `<span>Done</span>` : `<span>Edit Page</span>`;
      editBtn.style.background = isEditMode ? '#107c10' : '#444';
    }

    if (isEditMode) {
      document.body.style.cursor = "default";
      enableEditMode();
      floatingWidget.style.border = "2px solid #0078d4";
    } else {
      disableEditMode();
      floatingWidget.style.border = "1px solid rgba(255,255,255,0.1)";
    }
  }


  function enableEditMode() {
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick, true);
  }

  function disableEditMode() {
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('mouseout', handleMouseOut);
    document.removeEventListener('click', handleClick, true);
    if (selectedElement) {
      selectedElement.style.outline = "";
      selectedElement = null;
    }
    if (editorPopup) {
      editorPopup.remove();
      editorPopup = null;
    }
  }

  function handleMouseOver(e) {
    if (e.target === floatingWidget || floatingWidget.contains(e.target)) return;
    if (editorPopup && editorPopup.contains(e.target)) return;

    e.target.style.outline = "2px dashed #0078d4";
  }

  function handleMouseOut(e) {
    if (e.target === floatingWidget || floatingWidget.contains(e.target)) return;
    e.target.style.outline = "";
  }

  function handleClick(e) {
    if (isEditMode) {
      if (e.target === floatingWidget || floatingWidget.contains(e.target)) return;
      if (editorPopup && editorPopup.contains(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      openEditor(e.target);
    }
  }

  function openEditor(element) {
    if (editorPopup) editorPopup.remove();

    selectedElement = element;

    // Capture original state for Revert
    const originalHTML = element.innerHTML;
    const originalInline = {
      color: element.style.color,
      backgroundColor: element.style.backgroundColor,
      fontSize: element.style.fontSize
    };

    const computedStyle = window.getComputedStyle(element);

    const rgbToHex = (rgb) => {
      if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
      if (rgb.startsWith('#')) return rgb;
      const sep = rgb.indexOf(",") > -1 ? "," : " ";
      const parts = rgb.substr(4).split(")")[0].split(sep);
      const r = (+parts[0]).toString(16).padStart(2, "0");
      const g = (+parts[1]).toString(16).padStart(2, "0");
      const b = (+parts[2]).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    };

    const currentValues = {
      text: element.innerText,
      color: rgbToHex(computedStyle.color),
      backgroundColor: rgbToHex(computedStyle.backgroundColor),
      fontSize: parseInt(computedStyle.fontSize)
    };

    // Create UI
    editorPopup = document.createElement('div');
    editorPopup.style.position = "fixed";
    editorPopup.style.zIndex = "1000000";
    editorPopup.style.background = "white";
    editorPopup.style.padding = "10px";
    editorPopup.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    editorPopup.style.borderRadius = "4px";
    editorPopup.style.border = "1px solid #ddd";
    editorPopup.style.fontFamily = "sans-serif";
    editorPopup.style.minWidth = "250px";

    // Position it near the element
    const rect = element.getBoundingClientRect();
    let top = rect.top + window.scrollY - 10;
    let left = rect.right + window.scrollX + 10;

    // Adjust if off screen
    if (left + 250 > window.innerWidth) left = window.innerWidth - 260;
    if (top < 0) top = 10;

    editorPopup.style.top = top + "px";
    editorPopup.style.left = left + "px";

    editorPopup.innerHTML = `
        <h4 style="margin:0 0 10px 0; font-size:14px; border-bottom:1px solid #eee; padding-bottom:5px;">Edit Content</h4>
        
        <label style="display:block; font-size:12px; margin-bottom:2px;">Text Content:</label>
        <textarea id="edit-text" rows="3" style="width:100%; box-sizing:border-box; border:1px solid #ccc; font-family:inherit; font-size:12px;">${element.innerText}</textarea>
        
        <div style="display:flex; gap:5px; margin-top:5px;">
            <div style="flex:1;">
                <label style="display:block; font-size:12px; margin-bottom:2px;">Color:</label>
                <input type="color" id="edit-color" style="width:100%; height:25px; border:none; padding:0;" value="${currentValues.color}">
            </div>
            <div style="flex:1;">
                <label style="display:block; font-size:12px; margin-bottom:2px;">Bg Color:</label>
                <input type="color" id="edit-bg" style="width:100%; height:25px; border:none; padding:0;" value="${currentValues.backgroundColor}">
            </div>
        </div>

        <div style="margin-top:5px;">
            <label style="display:block; font-size:12px; margin-bottom:2px;">Font Size (px):</label>
            <input type="number" id="edit-size" style="width:100%;" value="${currentValues.fontSize}">
        </div>

        <div style="margin-top:10px; display:flex; justify-content:flex-end; gap:5px;">
            <button id="edit-cancel" style="padding:5px 8px; background:#f0f0f0; border:1px solid #ddd; border-radius:3px; cursor:pointer;">Cancel</button>
            <button id="edit-save" style="padding:5px 8px; background:#0078d4; color:white; border:none; border-radius:3px; cursor:pointer;">Apply & Save</button>
        </div>
    `;

    document.body.appendChild(editorPopup);

    // Live Preview Listeners
    const textInput = document.getElementById('edit-text');
    const colorInput = document.getElementById('edit-color');
    const bgInput = document.getElementById('edit-bg');
    const sizeInput = document.getElementById('edit-size');

    textInput.addEventListener('input', () => { element.innerText = textInput.value; });
    colorInput.addEventListener('input', () => { element.style.setProperty('color', colorInput.value, 'important'); });
    bgInput.addEventListener('input', () => { element.style.setProperty('background-color', bgInput.value, 'important'); });
    sizeInput.addEventListener('input', () => { element.style.setProperty('font-size', sizeInput.value + 'px', 'important'); });

    document.getElementById('edit-cancel').addEventListener('click', () => {
      // Revert changes safely
      element.innerHTML = originalHTML;
      element.style.color = originalInline.color;
      element.style.backgroundColor = originalInline.backgroundColor;
      element.style.fontSize = originalInline.fontSize;

      editorPopup.remove();
      editorPopup = null;
    });

    document.getElementById('edit-save').addEventListener('click', () => {
      const changes = {
        innerText: textInput.value !== currentValues.text ? textInput.value : null,
        style: {}
      };

      if (colorInput.value !== currentValues.color) {
        changes.style.color = colorInput.value;
      }

      if (bgInput.value !== currentValues.backgroundColor) {
        changes.style.backgroundColor = bgInput.value;
      }

      if (parseInt(sizeInput.value) !== currentValues.fontSize) {
        changes.style.fontSize = sizeInput.value + 'px';
      }

      // Send to background
      chrome.runtime.sendMessage({
        action: "recordContentChange",
        change: {
          timestamp: Date.now(),
          xpath: getXPath(element),
          tagName: element.tagName,
          changes: changes
        }
      });

      editorPopup.remove();
      editorPopup = null;
    });
  }

  function applyImportedChanges(changesList) {
    let appliedCount = 0;
    changesList.forEach(changeObj => {
      // changeObj structure from background: { timestamp, xpath, tagName, changes: { innerText, style: { color, backgroundColor, fontSize } } }
      // We need to find the element by xpath.
      const element = getElementByXPath(changeObj.xpath);
      if (element) {
        const updates = changeObj.changes;
        if (updates.innerText !== null && updates.innerText !== undefined) {
          element.innerText = updates.innerText;
        }
        if (updates.style) {
          if (updates.style.color) element.style.setProperty('color', updates.style.color, 'important');
          if (updates.style.backgroundColor) element.style.setProperty('background-color', updates.style.backgroundColor, 'important');
          if (updates.style.fontSize) element.style.setProperty('font-size', updates.style.fontSize, 'important');
        }

        // Optionally, should we tell background we "re-applied" these?
        // If we import, we strictly modify DOM. If user hits export again, they might want these included?
        // If so, we should probably record them again or replace current session data?
        // For now, let's just apply to DOM as a "viewer/restorer" function.
        // If user wants to save this State, they can record new changes on top.
        // Or we simply treat "Import" as "Restore state". 
        // Ideally we should push these to background so Export includes them?
        // Let's stick to DOM modification first.

        // Highlight briefly?
        const originalOutline = element.style.outline;
        element.style.outline = "2px solid #107c10";
        setTimeout(() => { element.style.outline = originalOutline; }, 1000);

        appliedCount++;
      }
    });
    console.log(`Applied ${appliedCount} / ${changesList.length} changes.`);
  }

  function getElementByXPath(xpath) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    } catch (e) {
      console.warn("Invalid XPath or element not found:", xpath);
      return null;
    }
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff'; // Default to white if transparent
    if (rgb.startsWith('#')) return rgb;

    const rgbValues = rgb.match(/\d+/g);
    if (!rgbValues) return '#000000';

    return "#" +
      ("0" + parseInt(rgbValues[0], 10).toString(16)).slice(-2) +
      ("0" + parseInt(rgbValues[1], 10).toString(16)).slice(-2) +
      ("0" + parseInt(rgbValues[2], 10).toString(16)).slice(-2);
  }

  document.addEventListener('input', (e) => {
    if (editorPopup && editorPopup.contains(e.target)) return; // Don't record our own inputs
    if (isPaused) return;
    chrome.runtime.sendMessage({
      action: "recordUserEvent",
      event: {
        type: 'input',
        timestamp: Date.now(),
        target: {
          tagName: e.target.tagName,
          id: e.target.id,
          className: e.target.className,
          xpath: getXPath(e.target)
        },
        value: (e.target.type === 'password') ? '***' : (e.target.value ? e.target.value.substring(0, 100) : '')
      }
    });
  }, true);

  function getXPath(element) {
    if (element.id !== '')
      return 'id("' + element.id + '")';
    if (element === document.body)
      return element.tagName;

    var ix = 0;
    var siblings = element.parentNode.childNodes;
    for (var i = 0; i < siblings.length; i++) {
      var sibling = siblings[i];
      if (sibling === element)
        return getXPath(element.parentNode) + '/' + element.tagName + '[' + (ix + 1) + ']';
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
        ix++;
    }
  }

  let processingToast = null;

  function showProcessingToast(text) {
    if (processingToast) return;
    processingToast = document.createElement('div');
    Object.assign(processingToast.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#333',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '4px',
      zIndex: '2147483648',
      fontFamily: 'Segoe UI, sans-serif',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      transition: 'opacity 0.3s'
    });

    const spinner = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
  </svg>`;

    // Create style for animation if not exists
    if (!document.getElementById('signal-spin-style')) {
      const style = document.createElement('style');
      style.id = 'signal-spin-style';
      style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    processingToast.innerHTML = spinner + `<span>${text}</span>`;
    document.body.appendChild(processingToast);
  }

  function removeProcessingToast() {
    if (processingToast) {
      processingToast.style.opacity = '0';
      setTimeout(() => {
        if (processingToast) {
          processingToast.remove();
          processingToast = null;
        }
      }, 300);
    }
  }
}
