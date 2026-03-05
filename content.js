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

  // 2. Create Widget
  const floatingWidget = document.createElement('signal-floating-widget');
  floatingWidget.id = 'signal-widget-root';
  floatingWidget.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    bottom: 20px;
    right: 20px;
    pointer-events: auto;
    display: none;
    opacity: 1;
    visibility: visible;
    user-select: none;
    cursor: pointer;
  `;

  const widgetShadow = floatingWidget.attachShadow({ mode: 'open' });

  const widgetUI = document.createElement('div');
  widgetUI.id = 'signal-widget-ui';
  widgetUI.style.cssText = `
    border-radius: 30px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-family: "Segoe UI", sans-serif;
    transition: width 0.3s ease, background 0.3s ease, padding 0.3s ease;
    width: auto;
    height: auto;
    display: flex;
  `;

  const widgetStyle = document.createElement('style');
  widgetStyle.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  widgetShadow.appendChild(widgetStyle);
  widgetShadow.appendChild(widgetUI);
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

  function signalToast(message, type) {
    const colors = { error: '#fa383e', success: '#2ea043', info: '#2e89ff' };
    const bg = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      background: bg, color: '#fff', padding: '10px 20px', borderRadius: '8px',
      zIndex: '2147483647', fontSize: '13px', fontFamily: '"Segoe UI", sans-serif',
      fontWeight: '500', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      maxWidth: '500px', textAlign: 'center', lineHeight: '1.4',
      transition: 'opacity 0.3s ease', opacity: '0'
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
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

    widgetUI.innerHTML = '';
    Object.assign(widgetUI.style, {
      width: 'auto', height: 'auto', padding: '6px 12px 6px 6px', background: 'rgba(30, 30, 30, 0.9)',
      borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)'
    });

    const startBtn = createWidgetBtn(`${Icons.record} Start`, '#d13438', () => {
      // Immediate visual feedback
      startBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Starting...`;
      startBtn.style.pointerEvents = 'none';
      startBtn.style.opacity = '0.7';

      // Safety timeout: revert button if no response within 10s
      const safetyTimer = setTimeout(() => {
        if (startBtn.style.pointerEvents === 'none') {
          console.warn('[Signal] Start recording timed out');
          signalToast('Recording start timed out. Try again or refresh the page.', 'error');
          startBtn.innerHTML = `${Icons.record} Start`;
          startBtn.style.pointerEvents = '';
          startBtn.style.opacity = '';
        }
      }, 10000);

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
            clearTimeout(safetyTimer);
            const errMsg = chrome.runtime.lastError.message || 'Unknown error';
            console.error('[Signal] Start recording error:', errMsg);
            if (errMsg.includes("invalidated") || errMsg.includes("Extension context")) {
              signalToast("Extension was updated. Please refresh the page.", "error");
            } else {
              signalToast("Could not start recording: " + errMsg, "error");
            }
            // Revert button
            startBtn.innerHTML = `${Icons.record} Start`;
            startBtn.style.pointerEvents = '';
            startBtn.style.opacity = '';
            return;
          }
          clearTimeout(safetyTimer);
          if (response && response.status === "started") {
            updateOverlayState('standard');
          } else {
            // Handle error response from background (e.g., debugger attach failed)
            const errMsg = (response && response.message) ? response.message : 'Could not start recording';
            console.error('[Signal] Start recording failed:', errMsg);
            if (errMsg.includes('Another debugger') || errMsg.includes('already being inspected')) {
              signalToast("Cannot record: DevTools debugger is already attached. Close DevTools and try again.", "error");
            } else {
              signalToast("Recording failed: " + errMsg, "error");
            }
            // Revert button
            startBtn.innerHTML = `${Icons.record} Start`;
            startBtn.style.pointerEvents = '';
            startBtn.style.opacity = '';
          }
        });
      } catch (e) {
        clearTimeout(safetyTimer);
        console.error('[Signal] Start recording exception:', e);
        signalToast("Extension error. Please refresh the page.", "error");
        startBtn.innerHTML = `${Icons.record} Start`;
        startBtn.style.pointerEvents = '';
        startBtn.style.opacity = '';
      }
    });

    const shotBtn = createWidgetBtn(`${Icons.screenshot} Screenshot ${Icons.chevron}`, '#0078d4', (e) => {
      toggleScreenshotMenu(e.currentTarget);
    });

    widgetUI.appendChild(createDragHandle());
    widgetUI.appendChild(startBtn);
    widgetUI.appendChild(shotBtn);

    floatingWidget.dataset.state = "idle";
    floatingWidget.style.display = showWidget ? "flex" : "none";
  }

  function setWidgetRecording(isPaused = false, mode = 'standard') {
    widgetUI.innerHTML = '';
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

    widgetUI.appendChild(createDragHandle());

    widgetUI.appendChild(stopBtn);
    // widgetUI.appendChild(shotBtn);
    widgetUI.appendChild(reportBtn);
    // widgetUI.appendChild(editBtn);
    widgetUI.appendChild(cancelBtn);

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
  let showClicks = true;
  let clickSize = 20;
  let clickColor = '#fa383e';

  // Initial settings load
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      const settings = result.settings;

      if (settings.showClicks !== undefined) showClicks = settings.showClicks;
      if (settings.clickSize) clickSize = settings.clickSize;
      if (settings.clickColor) clickColor = settings.clickColor;

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
        if (newSettings.clickSize) clickSize = parseInt(newSettings.clickSize) || 20;
        if (newSettings.clickColor) clickColor = newSettings.clickColor;
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

  // updateOverlayState is defined further below after the event listeners

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

      // ── Ping for readiness check ──
      if (request.action === "ping") {
        sendResponse({ ready: true });
        return;
      }

      // ── Replay Widget Messages ──
      if (request.action === "replayWidgetInit") {
        createReplayWidget(request.events, request.tabId, request.readyMode, request.defaultDelay);
      }
      if (request.action === "replayWidgetStarted") {
        switchReplayWidgetToExecuting();
      }
      if (request.action === "replayWidgetUpdate") {
        updateReplayWidgetEvent(request.index, request.status, request.total);
      }
      if (request.action === "replayWidgetFinished") {
        showReplayWidgetFinished(request.total, request.errorCount);
      }
      if (request.action === "replayWidgetRemove") {
        removeReplayWidget();
      }
      if (request.action === "replayHighlightTarget") {
        highlightReplayTarget(request.event, request.index);
      }
      if (request.action === "replayWidgetCountdown") {
        startReplayCountdown(request.index, request.duration);
      }
      if (request.action === "replayWidgetCancelled") {
        showReplayWidgetCancelled(request.completed, request.total);
      }
      if (request.action === "replayWidgetShowSkipOption") {
        showReplaySkipOption(request.index, request.total, request.error);
      }
    });
  }

  // Check status on load
  chrome.runtime.sendMessage({ action: "checkStatus" }, (response) => {
    if (response && response.isRecording) {
      updateOverlayState(response.mode);
    }
  });





  // Input Debouncing Logic
  let inputTimer = null;
  let pendingInput = null;

  function flushInput() {
    if (inputTimer) {
      clearTimeout(inputTimer);
      inputTimer = null;
    }
    if (pendingInput) {
      chrome.runtime.sendMessage({
        action: "recordUserEvent",
        event: pendingInput
      });
      pendingInput = null;
    }
  }

  // Flush input on blur as well to ensure we catch end of typing if user switches windows/tabs
  // Flush input on blur as well to ensure we catch end of typing if user switches windows/tabs
  document.addEventListener('blur', flushInput, true);
  document.addEventListener('focusout', flushInput, true);
  window.addEventListener('beforeunload', flushInput);

  document.addEventListener('click', (e) => {
    flushInput(); // Ensure any pending typing is recorded before the click logic triggers

    // Ignore events on extension UI
    if (floatingWidget && (floatingWidget === e.target || floatingWidget.contains(e.target))) return;
    if (screenshotDropdown && (screenshotDropdown === e.target || screenshotDropdown.contains(e.target))) return;
    if (editorPopup && (editorPopup === e.target || editorPopup.contains(e.target))) return;

    if (!showClicks) return;
    if (isPaused) return;

    // Visual Ripple Effect
    const size = clickSize;
    const half = size / 2;
    const color = clickColor || '#fa383e'; // Fallback

    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: fixed;
      left: ${e.clientX - half}px;
      top: ${e.clientY - half}px;
      width: ${size}px;
      height: ${size}px;
      background-color: ${color} !important;
      opacity: 0.6;
      border-radius: 50%;
      pointer-events: none;
      z-index: 2147483647;
      transition: transform 0.4s ease-out, opacity 0.4s ease-out;
    `;
    document.body.appendChild(ripple);

    requestAnimationFrame(() => {
      ripple.style.transform = 'scale(1.5)';
      ripple.style.opacity = '0';
      setTimeout(() => ripple.remove(), 400);
    });



    // Resolve the actual interactive target: walk up from e.target to find the
    // nearest standard clickable element.
    // Clickable elements should be: a, button, input, textarea
    // If not found in the parent chain, stick with the original element.
    const standardClickable = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA']);
    let resolvedTarget = e.target;
    let walkEl = e.target;
    while (walkEl && walkEl !== document.body && walkEl !== document.documentElement) {
      if (standardClickable.has(walkEl.tagName)) {
        resolvedTarget = walkEl;
        break;
      }
      walkEl = walkEl.parentElement;
    }

    // Safe className extraction (SVG elements have SVGAnimatedString, not a plain string)
    const safeClassName = (typeof resolvedTarget.className === 'string')
      ? resolvedTarget.className
      : (resolvedTarget.className && resolvedTarget.className.baseVal) || '';

    chrome.runtime.sendMessage({
      action: "recordUserEvent",
      event: {
        type: 'click',
        timestamp: Date.now(),
        target: {
          tagName: resolvedTarget.tagName,
          id: resolvedTarget.id,
          className: safeClassName,
          innerText: resolvedTarget.innerText ? resolvedTarget.innerText.substring(0, 50) : '',
          ...getElementBundle(resolvedTarget)
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

    flushInput(); // Flush any pending input before processing command keys

    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Defines which keys are worth recording
    let shouldRecord = false;

    if (isInput) {
      // In an input field, we only care about keys that commit action or change focus
      // We ignore navigation (arrows) and editing (backspace/delete) as they are implicit in the final value
      const allowed = ['Enter', 'Tab', 'Escape'];
      if (allowed.includes(e.key)) shouldRecord = true;
    } else {
      // Outside input, we track navigation and shortcuts
      const meaningfulKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];
      const isShortcut = e.ctrlKey || e.metaKey || e.altKey;
      if (meaningfulKeys.includes(e.key) || isShortcut) shouldRecord = true;
    }

    if (shouldRecord) {
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
    }
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

  // ----- PII Detection & Masking -----
  function detectPII(element, value) {
    const el = element;
    const tag = (el.tagName || '').toLowerCase();

    // Already masked by input type
    if (el.type === 'password') return { masked: true, label: 'Password' };

    // Gather all identifying attributes into one lowercased string for quick scanning
    const attrs = [
      el.type || '',
      el.name || '',
      el.id || '',
      el.getAttribute('autocomplete') || '',
      el.getAttribute('placeholder') || '',
      el.getAttribute('aria-label') || '',
      el.getAttribute('data-field') || '',
      el.getAttribute('data-type') || '',
      (el.className || '').replace(/\s+/g, ' ')
    ].join(' ').toLowerCase();

    // --- Attribute-based detection (highest confidence) ---
    const attrRules = [
      // Credit card
      { patterns: ['card-number', 'cardnumber', 'cc-number', 'ccnumber', 'credit-card', 'creditcard', 'card number'], label: 'Credit Card Number' },
      { patterns: ['card-cvc', 'cvc', 'cvv', 'card-cvv', 'security-code', 'securitycode'], label: 'Card CVV/CVC' },
      { patterns: ['card-expiry', 'cardexpiry', 'cc-exp', 'expiry', 'expiration', 'card-exp'], label: 'Card Expiry' },
      { patterns: ['card-name', 'cardholder', 'card holder', 'name-on-card'], label: 'Cardholder Name' },
      // Identity
      { patterns: ['ssn', 'social-security', 'tax-id', 'taxid', 'national-id'], label: 'SSN / Tax ID' },
      { patterns: ['passport'], label: 'Passport Number' },
      { patterns: ['driver-license', 'drivers-license', 'license-number'], label: 'Driver\'s License' },
      // Contact
      { patterns: ['email', 'e-mail', 'mail'], label: 'Email Address' },
      { patterns: ['phone', 'tel', 'mobile', 'cell', 'phonenumber', 'phone-number'], label: 'Phone Number' },
      // Personal
      { patterns: ['first-name', 'firstname', 'last-name', 'lastname', 'full-name', 'fullname', 'given-name', 'family-name', 'surname'], label: 'Full Name' },
      { patterns: ['dob', 'date-of-birth', 'dateofbirth', 'birthday', 'birth-date', 'birthdate'], label: 'Date of Birth' },
      // Address
      { patterns: ['address', 'street', 'addr-line', 'address-line', 'delivery-address', 'billing-address', 'shipping-address'], label: 'Address' },
      { patterns: ['postcode', 'post-code', 'postal', 'zipcode', 'zip-code', 'zip'], label: 'Postal / ZIP Code' },
      { patterns: ['city', 'town', 'locality'], label: 'City' },
      { patterns: ['country', 'nation'], label: 'Country' },
      // Financial
      { patterns: ['iban', 'bank-account', 'account-number', 'routing-number', 'sort-code'], label: 'Bank Account / IBAN' },
    ];

    for (const rule of attrRules) {
      if (rule.patterns.some(p => attrs.includes(p))) {
        return { masked: true, label: rule.label };
      }
    }

    // --- Value-based pattern detection (regex fallback) ---
    const val = (value || '').trim();

    if (/^[2-6]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/.test(val.replace(/\s/g, ''))) {
      return { masked: true, label: 'Credit Card Number' };
    }
    if (/^\d{3,4}$/.test(val) && attrs.match(/cc|card|payment/)) {
      return { masked: true, label: 'Card CVV/CVC' };
    }
    if (/^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(val)) {
      return { masked: true, label: 'Email Address' };
    }
    // Phone: various international formats
    if (/^(\+?[\d\s\-().]{7,15})$/.test(val) && /\d{7,}/.test(val.replace(/\D/g, ''))) {
      return { masked: true, label: 'Phone Number' };
    }
    // SSN format: 123-45-6789
    if (/^\d{3}-\d{2}-\d{4}$/.test(val)) {
      return { masked: true, label: 'SSN' };
    }
    // IBAN: starts with 2 letters then digits
    if (/^[A-Z]{2}\d{2}[\dA-Z]{11,30}$/.test(val.replace(/\s/g, ''))) {
      return { masked: true, label: 'IBAN' };
    }

    return { masked: false };
  }

  document.addEventListener('input', (e) => {
    if (editorPopup && editorPopup.contains(e.target)) return; // Don't record our own inputs
    if (isPaused) return;

    if (inputTimer) clearTimeout(inputTimer);

    // Check PII before storing
    const rawValue = e.target.value ? e.target.value.substring(0, 500) : '';
    const pii = detectPII(e.target, rawValue);
    const recordedValue = pii.masked ? '[REDACTED: ' + pii.label + ']' : rawValue;

    // Update pending input with latest value
    // We DO NOT set a timeout here anymore. We wait for explicit actions (blur, click, enter)
    // to determine when the typing session is "done".
    pendingInput = {
      type: 'input',
      timestamp: Date.now(),
      target: {
        tagName: e.target.tagName,
        id: e.target.id,
        className: (typeof e.target.className === 'string') ? e.target.className : ((e.target.className && e.target.className.baseVal) || ''),
        ...getElementBundle(e.target)
      },
      value: recordedValue,
      piiMasked: pii.masked
    };
  }, true);

  function getCssSelector(element) {
    if (element.nodeType !== Node.ELEMENT_NODE) return '';

    const testAttrs = ['data-testid', 'data-cy', 'data-test', 'data-qa', 'data-id', 'data-e2e'];
    for (const attr of testAttrs) {
      const val = element.getAttribute(attr);
      if (val) {
        const safeVal = val.replace(/(['"\\\\])/g, '\\\\$1');
        const sel = `[${attr}="${safeVal}"]`;
        try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (e) { }
      }
    }

    if (element.id) {
      try {
        const idSel = `#${CSS.escape(element.id)}`;
        if (document.querySelectorAll(idSel).length === 1) return idSel;
      } catch (e) { }
    }

    let path = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      let hasUniqueAttr = false;
      for (const attr of testAttrs) {
        const val = current.getAttribute(attr);
        if (val) {
          const safeVal = val.replace(/(['"\\\\])/g, '\\\\$1');
          selector = `[${attr}="${safeVal}"]`;
          hasUniqueAttr = true;
          break;
        }
      }

      if (!hasUniqueAttr && current.id) {
        try {
          const idSel = `#${CSS.escape(current.id)}`;
          if (document.querySelectorAll(idSel).length === 1) {
            path.unshift(idSel);
            return path.join(' > ');
          } else {
            selector = idSel;
            hasUniqueAttr = true;
          }
        } catch (e) { }
      }

      if (!hasUniqueAttr) {
        let index = 1;
        let sibling = current.previousElementSibling;
        let hasSameTagSiblings = false;

        while (sibling) {
          if (sibling.tagName === current.tagName) { index++; hasSameTagSiblings = true; }
          sibling = sibling.previousElementSibling;
        }
        let nextSibling = current.nextElementSibling;
        while (nextSibling && !hasSameTagSiblings) {
          if (nextSibling.tagName === current.tagName) { hasSameTagSiblings = true; }
          nextSibling = nextSibling.nextElementSibling;
        }

        if (hasSameTagSiblings || index > 1) {
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      const fullSelector = path.join(' > ');
      try {
        if (document.querySelectorAll(fullSelector).length === 1) {
          return fullSelector;
        }
      } catch (e) { }

      current = current.parentElement;
    }

    return path.join(' > ');
  }

  function getSelectorPath(element) {
    const standardClickable = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA']);
    const containerTags = new Set(['NAV', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'SECTION', 'ARTICLE', 'FORM', 'DIALOG']);

    function isInteractive(el) {
      // Standard clickable elements as defined
      return standardClickable.has(el.tagName);
    }

    function isContainer(el) {
      if (containerTags.has(el.tagName)) return true;
      const role = el.getAttribute('role');
      if (role && ['navigation', 'banner', 'main', 'complementary', 'contentinfo', 'form', 'dialog', 'toolbar', 'menu', 'menubar', 'tablist'].includes(role.toLowerCase())) return true;
      return false;
    }

    function buildLayer(el) {
      return {
        tagName: el.tagName,
        id: el.id || null,
        selector: getCssSelector(el),
        xpath: getXPath(el),
        role: el.getAttribute('role') || null,
        text: (el.innerText || '').replace(/\s+/g, ' ').trim().substring(0, 80) || null,
        ariaLabel: el.getAttribute('aria-label') || null
      };
    }

    const path = [];

    // Layer 0: Deep Target (the actual e.target)
    path.push({ ...buildLayer(element), role_in_path: 'deepTarget' });

    // Walk up to find interactive parent and container
    let interactiveFound = false;
    let containerFound = false;
    let current = element.parentElement;

    while (current && current !== document.body && current !== document.documentElement) {
      if (!interactiveFound && isInteractive(current)) {
        // Don't add if it's the same element as deepTarget
        if (current !== element) {
          path.push({ ...buildLayer(current), role_in_path: 'interactiveParent' });
        }
        interactiveFound = true;
      } else if (interactiveFound && !containerFound && isContainer(current)) {
        path.push({ ...buildLayer(current), role_in_path: 'container' });
        containerFound = true;
        break; // We have all three layers
      }
      current = current.parentElement;
    }

    // If deepTarget IS the interactive element, mark it
    if (!interactiveFound && isInteractive(element)) {
      path[0].role_in_path = 'interactiveParent';
    }

    return path;
  }

  function getElementBundle(element) {
    const rect = element.getBoundingClientRect();
    const boundingBox = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      bottom: Math.round(rect.bottom),
      right: Math.round(rect.right)
    };

    // Nearest Heading
    let nearestHeading = null;
    let current = element;
    const headings = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

    // Traverse up and check prev siblings
    while (current && current !== document.body && !nearestHeading) {
      if (headings.includes(current.tagName)) {
        nearestHeading = current.innerText;
        break;
      }

      let sibling = current.previousElementSibling;
      while (sibling) {
        if (headings.includes(sibling.tagName)) {
          nearestHeading = sibling.innerText;
          break;
        }
        sibling = sibling.previousElementSibling;
      }
      if (nearestHeading) break;
      current = current.parentElement;
    }

    const uniqueSel = getCssSelector(element);
    const selectors = uniqueSel ? [uniqueSel] : [];

    // Test attributes (used by testing frameworks - highest priority)
    const testAttrs = ['data-testid', 'data-cy', 'data-test', 'data-qa', 'data-id', 'data-e2e'];
    let testAttr = null;
    for (const attr of testAttrs) {
      const val = element.getAttribute(attr);
      if (val) {
        testAttr = { attr, value: val, selector: uniqueSel || `[${attr}="${val}"]` };
        break; // use first found
      }
    }

    // Include fallback selectors
    if (element.id) {
      const idSel = `#${CSS.escape(element.id)}`;
      if (!selectors.includes(idSel)) selectors.push(idSel);
    }

    ['aria-label', 'name', 'placeholder', 'role', 'type'].forEach(attr => {
      const val = element.getAttribute(attr);
      if (val) {
        const sel = `[${attr}="${val.replace(/(['"\\\\])/g, '\\\\$1')}"]`;
        if (!selectors.includes(sel)) selectors.push(sel);
      }
    });

    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\\s+/).filter(c => c);
      if (classes.length > 0) {
        const classSel = `${element.tagName.toLowerCase()}.${classes.join('.')}`;
        if (!selectors.includes(classSel)) selectors.push(classSel);
      }
    }

    const tagSel = element.tagName.toLowerCase();
    if (!selectors.includes(tagSel)) selectors.push(tagSel);

    return {
      xpath: getXPath(element),
      boundingBox,
      nearestHeading: nearestHeading ? nearestHeading.substring(0, 100) : null,
      selectors: selectors,
      testAttr: testAttr,
      selectorPath: getSelectorPath(element)
    };
  }

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

  // ── Replay Widget Implementation ──────────────────────────────────
  let replayWidgetEl = null;
  let replayWidgetTabId = null;
  let replayHighlightEl = null;
  let replayHighlightLabelEl = null;

  function createReplayWidget(events, tabId, readyMode, defaultDelay = null) {
    replayWidgetTabId = tabId;

    // Remove old widget if exists
    if (replayWidgetEl) replayWidgetEl.remove();

    const host = document.createElement('signal-replay-widget');
    host.style.cssText = 'all: initial;';
    const shadow = host.attachShadow({ mode: 'open' });

    let styleEl = document.createElement('style');
    styleEl.id = 'signal-replay-styles';
    styleEl.textContent = `
        #signal-replay-widget {
          position: fixed;
          top: 16px;
          right: 16px;
          width: 340px;
          max-height: 70vh;
          background: #1a1d23;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          color: #e4e6eb;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          backdrop-filter: blur(20px);
          animation: sr-slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: default;
          user-select: none;
        }
        @keyframes sr-slide-in {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        #signal-replay-widget .sr-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: linear-gradient(135deg, rgba(0,120,212,0.15), rgba(0,120,212,0.05));
          border-bottom: 1px solid rgba(255,255,255,0.06);
          cursor: grab;
        }
        #signal-replay-widget .sr-header.dragging { cursor: grabbing; }
        #signal-replay-widget .sr-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 13px;
          color: #fff;
        }
        #signal-replay-widget .sr-title svg { color: #4ca6ff; }
        #signal-replay-widget .sr-counter {
          font-size: 11px;
          font-weight: 500;
          background: rgba(255,255,255,0.08);
          padding: 2px 8px;
          border-radius: 10px;
          color: #8b949e;
        }
        #signal-replay-widget .sr-controls { display: flex; gap: 6px; align-items: center; }
        #signal-replay-widget .sr-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          background: rgba(255,255,255,0.06);
          color: #c9d1d9;
          cursor: pointer;
          font-size: 11px;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        #signal-replay-widget .sr-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
        #signal-replay-widget .sr-pause-btn.paused { background: rgba(76,166,255,0.15); color: #4ca6ff; border-color: rgba(76,166,255,0.3); }
        #signal-replay-widget .sr-close-btn { padding: 5px 7px; }
        #signal-replay-widget .sr-close-btn:hover { background: rgba(250,56,62,0.2); color: #fa383e; border-color: rgba(250,56,62,0.3); }
        #signal-replay-widget .sr-remove-btn {
          display: none;
          background: none;
          border: none;
          color: #484f58;
          cursor: pointer;
          padding: 0 4px;
          font-size: 14px;
          line-height: 1;
          flex-shrink: 0;
          transition: color 0.15s ease;
        }
        #signal-replay-widget .sr-remove-btn:hover { color: #fa383e; }
        #signal-replay-widget.sr-ready-mode .sr-remove-btn { display: inline; }
        #signal-replay-widget .sr-inspect-btn,
        #signal-replay-widget .sr-copy-btn {
          background: none;
          border: none;
          color: #8b949e;
          cursor: pointer;
          padding: 0 4px;
          font-size: 14px;
          flex-shrink: 0;
          transition: color 0.15s ease;
        }
        #signal-replay-widget .sr-inspect-btn:hover,
        #signal-replay-widget .sr-copy-btn:hover { color: #4ca6ff; }
        #signal-replay-widget .sr-start-bar {
          padding: 10px 14px;
          border-top: 1px solid rgba(255,255,255,0.06);
          text-align: center;
        }
        #signal-replay-widget .sr-start-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 24px;
          border: none;
          border-radius: 6px;
          background: linear-gradient(135deg, #2ea043, #3fb950);
          color: #fff;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(46,160,67,0.3);
        }
        #signal-replay-widget .sr-start-btn:hover { background: linear-gradient(135deg, #3fb950, #56d364); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(46,160,67,0.4); }
        #signal-replay-widget .sr-restart-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          border: 1px solid rgba(210,153,34,0.3);
          border-radius: 6px;
          background: rgba(210,153,34,0.12);
          color: #e3b341;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.15s ease;
          margin-top: 8px;
        }
        #signal-replay-widget .sr-restart-btn:hover { background: rgba(210,153,34,0.25); color: #f0c75e; }
        #signal-replay-widget .sr-progress-bar {
          height: 3px;
          background: rgba(255,255,255,0.06);
          width: 100%;
        }
        #signal-replay-widget .sr-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #0078d4, #4ca6ff);
          transition: width 0.4s ease;
          border-radius: 0 3px 3px 0;
        }
        #signal-replay-widget .sr-event-list {
          flex: 1;
          overflow-y: auto;
          max-height: 45vh;
          padding: 6px 0;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        #signal-replay-widget .sr-event-list::-webkit-scrollbar { width: 5px; }
        #signal-replay-widget .sr-event-list::-webkit-scrollbar-track { background: transparent; }
        #signal-replay-widget .sr-event-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        #signal-replay-widget .sr-event-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          transition: background 0.15s ease;
          border-left: 3px solid transparent;
        }
        #signal-replay-widget .sr-event-row:hover { background: rgba(255,255,255,0.03); }
        #signal-replay-widget .sr-event-row.active {
          background: rgba(76,166,255,0.08);
          border-left-color: #4ca6ff;
        }
        #signal-replay-widget .sr-event-row.done { opacity: 0.55; }
        #signal-replay-widget .sr-event-row.done .sr-event-status { color: #3fb950; }
        #signal-replay-widget .sr-event-row.error { opacity: 1; }
        #signal-replay-widget .sr-event-row.error .sr-event-status { color: #fa383e; }
        #signal-replay-widget .sr-event-status { font-size: 13px; flex-shrink: 0; width: 18px; text-align: center; }
        #signal-replay-widget .sr-event-idx { color: #484f58; font-size: 11px; min-width: 20px; }
        #signal-replay-widget .sr-event-type {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 3px;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        #signal-replay-widget .sr-event-type.click { background: rgba(136,98,237,0.2); color: #b185f7; }
        #signal-replay-widget .sr-event-type.input { background: rgba(255,166,0,0.15); color: #ffb74d; }
        #signal-replay-widget .sr-event-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #8b949e;
        }
        #signal-replay-widget .sr-retry-btn {
          background: rgba(250,56,62,0.12);
          border: 1px solid rgba(250,56,62,0.25);
          color: #fa383e;
          border-radius: 4px;
          cursor: pointer;
          padding: 2px 6px;
          font-size: 12px;
          font-family: inherit;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        #signal-replay-widget .sr-retry-btn:hover { background: rgba(250,56,62,0.25); color: #ff6b6b; }
        #signal-replay-widget .sr-skip-failed-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          border: 1px solid rgba(210,153,34,0.3);
          border-radius: 5px;
          background: rgba(210,153,34,0.12);
          color: #e3b341;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        #signal-replay-widget .sr-skip-failed-btn:hover { background: rgba(210,153,34,0.25); color: #f0c75e; }
        #signal-replay-widget .sr-error-detail {
          font-size: 11px;
          margin: 4px 0;
          color: #ff8b8b;
          word-break: break-word;
          line-height: 1.3;
        }
        #signal-replay-widget .sr-footer {
          padding: 8px 14px;
          font-size: 11px;
          color: #8b949e;
          border-top: 1px solid rgba(255,255,255,0.06);
          text-align: center;
          font-style: italic;
        }
        #signal-replay-widget .sr-footer.success { color: #3fb950; font-style: normal; font-weight: 600; }
        #signal-replay-widget .sr-footer.has-errors { color: #fa383e; font-style: normal; }
        #signal-replay-widget .sr-footer.cancelled { color: #d29922; font-style: normal; font-weight: 600; }
        @keyframes sr-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        #signal-replay-widget .sr-event-row.active .sr-event-status {
          animation: sr-pulse 1.2s ease-in-out infinite;
          color: #4ca6ff;
        }
        #signal-replay-widget .sr-event-row.countdown .sr-event-status {
          color: #d29922;
          font-size: 10px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        #signal-replay-widget .sr-event-row.countdown {
          background: rgba(210,153,34,0.06);
          border-left-color: #d29922;
        }
        #signal-replay-widget .sr-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
        }
        #signal-replay-widget .sr-toolbar-label {
          font-size: 10px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        #signal-replay-widget .sr-delay-select {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
          color: #c9d1d9;
          font-size: 11px;
          font-family: inherit;
          padding: 2px 6px;
          cursor: pointer;
          outline: none;
        }
        #signal-replay-widget .sr-delay-select:hover { border-color: rgba(255,255,255,0.2); }
        #signal-replay-widget .sr-delay-select option { background: #1a1d23; color: #e4e6eb; }
        #signal-replay-widget .sr-skip-btn { padding: 3px 8px; font-size: 10px; gap: 3px; }
        #signal-replay-widget .sr-skip-btn:hover { background: rgba(210,153,34,0.2); color: #d29922; border-color: rgba(210,153,34,0.3); }
        #signal-replay-widget .sr-cancel-btn { padding: 3px 8px; font-size: 10px; gap: 3px; }
        #signal-replay-widget .sr-cancel-btn:hover { background: rgba(250,56,62,0.2); color: #fa383e; border-color: rgba(250,56,62,0.3); }
        #signal-replay-widget .sr-play-now-btn {
          display: none;
          background: rgba(76,166,255,0.12);
          border: 1px solid rgba(76,166,255,0.25);
          color: #4ca6ff;
          border-radius: 4px;
          cursor: pointer;
          padding: 2px 6px;
          font-size: 10px;
          font-family: inherit;
          transition: all 0.15s ease;
          flex-shrink: 0;
          align-items: center;
          gap: 3px;
        }
        #signal-replay-widget .sr-play-now-btn:hover { background: rgba(76,166,255,0.25); color: #79c0ff; }
        #signal-replay-widget .sr-event-row.countdown .sr-play-now-btn { display: inline-flex; }
        @keyframes sr-highlight-pulse {
          0% { box-shadow: 0 0 0 0 rgba(76,166,255,0.5), inset 0 0 12px rgba(76,166,255,0.15); }
          50% { box-shadow: 0 0 20px 8px rgba(76,166,255,0.3), inset 0 0 20px rgba(76,166,255,0.1); }
          100% { box-shadow: 0 0 0 0 rgba(76,166,255,0.5), inset 0 0 12px rgba(76,166,255,0.15); }
        }
        #signal-replay-highlight {
          position: absolute;
          border: 2px solid #4ca6ff;
          border-radius: 4px;
          pointer-events: none;
          z-index: 2147483646;
          animation: sr-highlight-pulse 1s ease-in-out infinite;
          transition: all 0.3s ease;
        }
        #signal-replay-highlight-label {
          position: absolute;
          background: #1a1d23;
          color: #e4e6eb;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid rgba(76,166,255,0.3);
          pointer-events: none;
          z-index: 2147483646;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          transition: all 0.3s ease;
        }
        #signal-replay-highlight-label .sr-hl-type {
          display: inline-block;
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 2px;
          margin-right: 5px;
          text-transform: uppercase;
        }
        #signal-replay-highlight-label .sr-hl-type.click { background: rgba(136,98,237,0.3); color: #b185f7; }
        #signal-replay-highlight-label .sr-hl-type.input { background: rgba(255,166,0,0.2); color: #ffb74d; }
      `;
    shadow.appendChild(styleEl);

    // Build widget
    const widget = document.createElement('div');
    widget.id = 'signal-replay-widget';

    // Header
    const header = document.createElement('div');
    header.className = 'sr-header';
    header.innerHTML = `
      <div class="sr-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Replay Events</span>
        <span class="sr-counter" id="sr-counter">0 / ${events.length}</span>
      </div>
      <div class="sr-controls">
        <button class="sr-btn sr-pause-btn" id="sr-pause-btn" title="Pause replay">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          <span>Pause</span>
        </button>
        <button class="sr-btn sr-close-btn" id="sr-close-btn" title="Close widget" style="display:none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;

    // Toolbar row (delay selector + skip + cancel)
    const toolbar = document.createElement('div');
    toolbar.className = 'sr-toolbar';
    toolbar.id = 'sr-toolbar';
    const delayAuto = defaultDelay === null ? 'selected' : '';
    const delay500 = defaultDelay === 500 ? 'selected' : '';
    const delay1000 = defaultDelay === 1000 ? 'selected' : '';
    const delay2000 = defaultDelay === 2000 ? 'selected' : '';
    const delay5000 = defaultDelay === 5000 ? 'selected' : '';

    toolbar.innerHTML = `
      <span class="sr-toolbar-label">Delay:</span>
      <select class="sr-delay-select" id="sr-delay-select">
        <option value="auto" ${delayAuto}>Auto</option>
        <option value="500" ${delay500}>0.5s</option>
        <option value="1000" ${delay1000}>1s</option>
        <option value="2000" ${delay2000}>2s</option>
        <option value="5000" ${delay5000}>5s</option>
      </select>
      <button class="sr-btn sr-skip-btn" id="sr-skip-btn" title="Skip to next event">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 15 12 5 21"/><rect x="16" y="3" width="3" height="18"/></svg>
        <span>Skip</span>
      </button>
      <button class="sr-btn sr-cancel-btn" id="sr-cancel-btn" title="Cancel replay">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        <span>Stop</span>
      </button>
    `;

    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'sr-progress-bar';
    progressBar.innerHTML = '<div class="sr-progress-fill" id="sr-progress-fill" style="width:0%"></div>';

    // Event list
    const eventList = document.createElement('div');
    eventList.className = 'sr-event-list';
    eventList.id = 'sr-event-list';

    events.forEach((e, i) => {
      let descText = '';
      if (e.target) {
        // Try to find the most representative text: aria-label, title, name, placeholder, alt, then innerText
        if (e.target.attributes) {
          if (e.target.attributes['aria-label']) descText = e.target.attributes['aria-label'];
          else if (e.target.attributes['title']) descText = e.target.attributes['title'];
          else if (e.target.attributes['name']) descText = e.target.attributes['name'];
          else if (e.target.attributes['placeholder']) descText = e.target.attributes['placeholder'];
          else if (e.target.attributes['alt']) descText = e.target.attributes['alt'];
        }
        if (!descText && e.target.innerText) {
          // Clean up innerText: remove newlines, collapse spaces
          descText = e.target.innerText.replace(/\\s+/g, ' ').trim();
        }
        if (descText && descText.length > 30) {
          descText = descText.substring(0, 30) + '...';
        }
      }

      let label = '';
      if (e.type === 'click') {
        label = 'Click ' + (descText ? '"' + descText + '"' : (e.target && e.target.tagName ? '<' + e.target.tagName.toLowerCase() + '>' : ''));
      } else {
        label = 'Input ' + (descText ? 'on "' + descText + '"' : (e.target && e.target.tagName ? '<' + e.target.tagName.toLowerCase() + '>' : '')) + (e.value ? ' \u2192 "' + e.value.substring(0, 20) + '"' : '');
      }

      const row = document.createElement('div');
      row.className = 'sr-event-row';
      row.id = 'sr-event-' + i;
      row.dataset.index = i;

      const statusSpan = document.createElement('span');
      statusSpan.className = 'sr-event-status';
      statusSpan.id = 'sr-status-' + i;
      statusSpan.textContent = '\u23f3';

      const idxSpan = document.createElement('span');
      idxSpan.className = 'sr-event-idx';
      idxSpan.textContent = (i + 1) + '.';

      const typeSpan = document.createElement('span');
      typeSpan.className = 'sr-event-type ' + e.type;
      typeSpan.textContent = e.type.toUpperCase();

      const labelSpan = document.createElement('span');
      labelSpan.className = 'sr-event-label';
      labelSpan.title = label;
      labelSpan.textContent = label;

      const retryBtn = document.createElement('button');
      retryBtn.className = 'sr-retry-btn';
      retryBtn.id = 'sr-retry-' + i;
      retryBtn.style.display = 'none';
      retryBtn.title = 'Retry this event';
      retryBtn.textContent = '\u21bb';

      const playNowBtn = document.createElement('button');
      playNowBtn.className = 'sr-play-now-btn';
      playNowBtn.id = 'sr-play-now-' + i;
      playNowBtn.title = 'Execute now';
      playNowBtn.innerHTML = '\u25b6 Now';

      const inspectBtn = document.createElement('button');
      inspectBtn.className = 'sr-inspect-btn';
      inspectBtn.id = 'sr-inspect-' + i;
      inspectBtn.title = 'Highlight & Log Element';
      inspectBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'sr-copy-btn';
      copyBtn.id = 'sr-copy-' + i;
      copyBtn.title = 'Copy Selector';
      copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'sr-remove-btn';
      removeBtn.title = 'Remove this event';
      removeBtn.textContent = '\u00d7';

      row.appendChild(statusSpan);
      row.appendChild(idxSpan);
      row.appendChild(typeSpan);
      row.appendChild(labelSpan);
      row.appendChild(playNowBtn);
      row.appendChild(retryBtn);
      row.appendChild(copyBtn);
      row.appendChild(inspectBtn);
      row.appendChild(removeBtn);
      eventList.appendChild(row);
    });

    // Footer
    const footer = document.createElement('div');
    footer.className = 'sr-footer';
    footer.id = 'sr-footer';
    footer.textContent = readyMode ? 'Review events and click Start when ready' : 'Waiting for page to load...';

    // Start bar (ready mode only)
    const startBar = document.createElement('div');
    startBar.className = 'sr-start-bar';
    startBar.id = 'sr-start-bar';
    startBar.innerHTML = `
      <button class="sr-start-btn" id="sr-start-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Start Replay
      </button>
    `;

    // Apply ready mode
    if (readyMode) {
      widget.classList.add('sr-ready-mode');
    }

    widget.appendChild(header);
    widget.appendChild(toolbar);
    widget.appendChild(progressBar);
    widget.appendChild(eventList);
    widget.appendChild(startBar);
    widget.appendChild(footer);
    shadow.appendChild(widget);
    document.body.appendChild(host);
    replayWidgetEl = host;

    // In ready mode, hide pause btn and toolbar initially
    if (readyMode) {
      const pauseBtn = widget.querySelector('#sr-pause-btn');
      if (pauseBtn) pauseBtn.style.display = 'none';
      toolbar.style.display = 'none';
    } else {
      startBar.style.display = 'none';
    }

    // ── Dragging ──
    let isDragging = false, dragStartX, dragStartY, dragOrigX, dragOrigY;
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.sr-btn')) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = widget.getBoundingClientRect();
      dragOrigX = rect.left;
      dragOrigY = rect.top;
      header.classList.add('dragging');
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      widget.style.right = 'auto';
      widget.style.left = (dragOrigX + e.clientX - dragStartX) + 'px';
      widget.style.top = (dragOrigY + e.clientY - dragStartY) + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.classList.remove('dragging');
      }
    });

    // ── Button Handlers ──
    const pauseBtn = widget.querySelector('#sr-pause-btn');
    const closeBtn = widget.querySelector('#sr-close-btn');

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        const wasPaused = pauseBtn.classList.contains('paused');
        if (wasPaused) {
          chrome.runtime.sendMessage({ action: 'replayResume', tabId: tabId });
          pauseBtn.classList.remove('paused');
          pauseBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>Pause</span>';
        } else {
          chrome.runtime.sendMessage({ action: 'replayPause', tabId: tabId });
          pauseBtn.classList.add('paused');
          pauseBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Resume</span>';
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'replayClose', tabId: tabId });
      });
    }

    // Skip button
    const skipBtn = widget.querySelector('#sr-skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'replaySkip', tabId: tabId });
      });
    }

    // Cancel button
    const cancelBtn = widget.querySelector('#sr-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'replayCancel', tabId: tabId });
      });
    }

    // Delay selector
    const delaySelect = widget.querySelector('#sr-delay-select');
    if (delaySelect) {
      delaySelect.addEventListener('change', () => {
        const val = delaySelect.value;
        const delay = val === 'auto' ? null : parseInt(val);
        chrome.runtime.sendMessage({ action: 'replaySetDelay', tabId: tabId, delay: delay });
      });
      // Initial setup message
      chrome.runtime.sendMessage({ action: 'replaySetDelay', tabId: tabId, delay: defaultDelay });
    }

    // Retry and play-now delegation
    eventList.addEventListener('click', (e) => {
      const retryBtn = e.target.closest('.sr-retry-btn');
      if (retryBtn) {
        const row = retryBtn.closest('.sr-event-row');
        const idx = parseInt(row.dataset.index);
        chrome.runtime.sendMessage({ action: 'replayRetry', tabId: tabId, eventIndex: idx });
      }
      const playNowBtn = e.target.closest('.sr-play-now-btn');
      if (playNowBtn) {
        chrome.runtime.sendMessage({ action: 'replaySkip', tabId: tabId });
      }
      const copyBtn = e.target.closest('.sr-copy-btn');
      if (copyBtn) {
        const row = copyBtn.closest('.sr-event-row');
        const idx = parseInt(row.dataset.index);
        const event = events[idx];
        let selectorToCopy = '';
        if (event.target.testAttr && event.target.testAttr.selector) {
          selectorToCopy = event.target.testAttr.selector;
        } else if (event.target.id) {
          selectorToCopy = '#' + event.target.id;
        } else if (event.target.selectors && event.target.selectors.length > 0) {
          selectorToCopy = event.target.selectors[0];
        } else if (event.target.xpath) {
          selectorToCopy = event.target.xpath;
        }

        if (selectorToCopy) {
          navigator.clipboard.writeText(selectorToCopy).then(() => {
            const originalHtml = copyBtn.innerHTML;
            copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            setTimeout(() => {
              if (copyBtn.isConnected) {
                copyBtn.innerHTML = originalHtml;
              }
            }, 1000);
          }).catch(err => {
            console.error('[Signal Recorder] Failed to copy selector:', err);
          });
        }
      }
      const inspectBtn = e.target.closest('.sr-inspect-btn');
      if (inspectBtn) {
        const row = inspectBtn.closest('.sr-event-row');
        const idx = parseInt(row.dataset.index);
        const event = events[idx];
        highlightReplayTarget(event, idx);

        let el = null;
        if (event.target.xpath) {
          try {
            const result = document.evaluate(event.target.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            el = result.singleNodeValue;
          } catch (err) { }
        }
        if (!el && event.target.id) el = document.getElementById(event.target.id);
        if (!el && event.target.selectors && event.target.selectors.length > 0) {
          try { el = document.querySelector(event.target.selectors[0]); } catch (err) { }
        }

        if (el) {
          console.log('%c[Signal Recorder]%c Inspected Element (Row ' + (idx + 1) + '):', 'color:#4ca6ff;font-weight:bold', 'color:inherit', el);
          setTimeout(() => clearReplayHighlight(), 3000);
        } else {
          console.warn('[Signal Recorder] Could not find element for Row ' + (idx + 1), event.target);
          setTimeout(() => clearReplayHighlight(), 3000);
        }
      }
      const removeBtn = e.target.closest('.sr-remove-btn');
      if (removeBtn) {
        const row = removeBtn.closest('.sr-event-row');
        const idx = parseInt(row.dataset.index);
        chrome.runtime.sendMessage({ action: 'replayRemoveEvent', tabId: tabId, eventIndex: idx }, (response) => {
          if (response && response.status === 'removed') {
            events.splice(idx, 1);
            row.remove();
            // Re-index remaining rows
            const allRows = widget.querySelectorAll('.sr-event-row');
            allRows.forEach((r, i) => {
              r.id = 'sr-event-' + i;
              r.dataset.index = i;
              const idxSpan = r.querySelector('.sr-event-idx');
              if (idxSpan) idxSpan.textContent = (i + 1) + '.';
              // Also update retry and play-now specific IDs
              const retryBtn = r.querySelector('.sr-retry-btn');
              if (retryBtn) retryBtn.id = 'sr-retry-' + i;
              const playBtn = r.querySelector('.sr-play-now-btn');
              if (playBtn) playBtn.id = 'sr-play-now-' + i;
              const copyBtnRow = r.querySelector('.sr-copy-btn');
              if (copyBtnRow) copyBtnRow.id = 'sr-copy-' + i;
              const inspectBtnRow = r.querySelector('.sr-inspect-btn');
              if (inspectBtnRow) inspectBtnRow.id = 'sr-inspect-' + i;
              const statusSpan = r.querySelector('.sr-event-status');
              if (statusSpan) statusSpan.id = 'sr-status-' + i;
            });
            const counter = replayWidgetEl.shadowRoot.getElementById('sr-counter');
            if (counter) counter.textContent = '0 / ' + response.remaining;
            // Update total label in header
            const titleSpan = widget.querySelector('.sr-title span:last-child');
            if (titleSpan) titleSpan.textContent = '0 / ' + response.remaining;

            if (response.events) {
              events.length = 0;
              events.push(...response.events);
            }
          }
        });
      }
    });

    // Start button
    const startBtn = widget.querySelector('#sr-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        startBtn.disabled = true;
        startBtn.innerHTML = 'Starting...';
        chrome.runtime.sendMessage({ action: 'replayStart', tabId: tabId });
      });
    }

    // Restart button delegation
    widget.addEventListener('click', (e) => {
      const restartBtn = e.target.closest('.sr-restart-btn');
      if (restartBtn) {
        restartBtn.disabled = true;
        restartBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Restarting...';
        chrome.runtime.sendMessage({ action: 'replayRestart', tabId: tabId });
      }
    });
  }

  function switchReplayWidgetToExecuting() {
    if (!replayWidgetEl) return;
    const widget = replayWidgetEl.shadowRoot.getElementById('signal-replay-widget');
    if (widget) widget.classList.remove('sr-ready-mode');

    const startBar = replayWidgetEl.shadowRoot.querySelector('#sr-start-bar');
    if (startBar) startBar.style.display = 'none';

    const toolbar = replayWidgetEl.shadowRoot.querySelector('#sr-toolbar');
    if (toolbar) toolbar.style.display = 'flex';

    const pauseBtn = replayWidgetEl.shadowRoot.querySelector('#sr-pause-btn');
    if (pauseBtn) pauseBtn.style.display = 'inline-flex';

    const footer = replayWidgetEl.shadowRoot.querySelector('#sr-footer');
    if (footer) footer.textContent = 'Executing events...';
  }

  function updateReplayWidgetEvent(index, status, total) {
    // Stop any running countdown
    stopReplayCountdown();

    const row = replayWidgetEl.shadowRoot.getElementById('sr-event-' + index);
    if (!row) return;

    // Clear all 'active' and 'countdown' states
    const allRows = replayWidgetEl.shadowRoot.querySelectorAll('#signal-replay-widget .sr-event-row');
    allRows.forEach(r => { r.classList.remove('active'); r.classList.remove('countdown'); });

    const statusIcon = status === 'done' ? '\u2713' : status === 'error' ? '\u2717' : '\u25b6';
    row.className = 'sr-event-row ' + status;

    const statusEl = replayWidgetEl.shadowRoot.getElementById('sr-status-' + index);
    if (statusEl) statusEl.textContent = statusIcon;

    if (status === 'error') {
      const retryBtn = replayWidgetEl.shadowRoot.getElementById('sr-retry-' + index);
      if (retryBtn) retryBtn.style.display = 'inline-flex';
    }

    // Hide skip option footer when retrying (status becomes active again)
    if (status === 'active' || status === 'done') {
      const footer = replayWidgetEl.shadowRoot.getElementById('sr-footer');
      if (footer) {
        const skipBtn = footer.querySelector('.sr-skip-failed-btn');
        if (skipBtn) skipBtn.remove();
      }
    }

    // Counter & progress
    const completed = (status === 'done' || status === 'error') ? (index + 1) : index;
    const counter = replayWidgetEl.shadowRoot.getElementById('sr-counter');
    if (counter) counter.textContent = completed + ' / ' + total;

    const pf = replayWidgetEl.shadowRoot.getElementById('sr-progress-fill');
    if (pf) pf.style.width = Math.round((completed / total) * 100) + '%';

    // Footer
    const footer = replayWidgetEl.shadowRoot.getElementById('sr-footer');
    if (footer && status === 'active') {
      footer.textContent = 'Executing event ' + (index + 1) + ' of ' + total + '...';
      footer.className = 'sr-footer';
    }

    // Auto-scroll
    const list = replayWidgetEl.shadowRoot.getElementById('sr-event-list');
    if (list && row) {
      const rowTop = row.offsetTop - list.offsetTop;
      const rowBottom = rowTop + row.offsetHeight;
      const listScroll = list.scrollTop;
      const listHeight = list.clientHeight;
      if (rowBottom > listScroll + listHeight || rowTop < listScroll) {
        list.scrollTop = rowTop - listHeight / 3;
      }
    }
  }

  function showReplayWidgetFinished(total, errorCount) {
    const counter = replayWidgetEl.shadowRoot.getElementById('sr-counter');
    if (counter) counter.textContent = total + ' / ' + total;

    const pf = replayWidgetEl.shadowRoot.getElementById('sr-progress-fill');
    if (pf) {
      pf.style.width = '100%';
      pf.style.background = errorCount > 0
        ? 'linear-gradient(90deg, #fa383e, #ff6b6b)'
        : 'linear-gradient(90deg, #2ea043, #3fb950)';
    }

    const footer = replayWidgetEl.shadowRoot.getElementById('sr-footer');
    if (footer) {
      const restartSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path></svg>';
      if (errorCount > 0) {
        footer.innerHTML = 'Replay finished with ' + errorCount + ' error(s). Use \u21bb to retry specific events.<br><button class="sr-restart-btn">' + restartSvg + ' Restart Replay</button>';
        footer.className = 'sr-footer has-errors';
      } else {
        footer.innerHTML = 'All ' + total + ' events replayed successfully!<br><button class="sr-restart-btn">' + restartSvg + ' Replay Again</button>';
        footer.className = 'sr-footer success';
      }
    }

    // Show close, hide pause and toolbar
    const closeBtn = replayWidgetEl.shadowRoot.getElementById('sr-close-btn');
    if (closeBtn) closeBtn.style.display = 'inline-flex';
    const pauseBtn = replayWidgetEl.shadowRoot.getElementById('sr-pause-btn');
    if (pauseBtn) pauseBtn.style.display = 'none';
    const toolbar = replayWidgetEl.shadowRoot.getElementById('sr-toolbar');
    if (toolbar) toolbar.style.display = 'none';

    // Stop countdown and remove highlight
    stopReplayCountdown();
    clearReplayHighlight();
  }

  function removeReplayWidget() {
    stopReplayCountdown();
    if (replayWidgetEl) {
      replayWidgetEl.remove();
      replayWidgetEl = null;
    }
    clearReplayHighlight();
    const styleEl = document.getElementById('signal-replay-styles');
    if (styleEl) styleEl.remove();
  }

  function clearReplayHighlight() {
    if (replayHighlightEl) {
      replayHighlightEl.remove();
      replayHighlightEl = null;
    }
    if (replayHighlightLabelEl) {
      replayHighlightLabelEl.remove();
      replayHighlightLabelEl = null;
    }
  }

  function highlightReplayTarget(event, index) {
    clearReplayHighlight();

    if (!event || !event.target) return;

    // Find element by xpath
    let el = null;
    if (event.target.xpath) {
      try {
        const result = document.evaluate(event.target.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        el = result.singleNodeValue;
      } catch (e) { }
    }

    // Fallback: find by id
    if (!el && event.target.id) {
      el = document.getElementById(event.target.id);
    }

    // Fallback: find by selectors
    if (!el && event.target.selectors && event.target.selectors.length > 0) {
      try { el = document.querySelector(event.target.selectors[0]); } catch (e) { }
    }

    if (!el) return;

    // Scroll element into view
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

    // Create highlight overlay
    const rect = el.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const pad = 6;

    const highlight = document.createElement('div');
    highlight.id = 'signal-replay-highlight';
    highlight.style.left = (rect.left + scrollX - pad) + 'px';
    highlight.style.top = (rect.top + scrollY - pad) + 'px';
    highlight.style.width = (rect.width + pad * 2) + 'px';
    highlight.style.height = (rect.height + pad * 2) + 'px';
    document.body.appendChild(highlight);
    replayHighlightEl = highlight;

    // Create label
    // Create label
    const typeLabel = event.type === 'click' ? 'CLICK' : 'INPUT';
    let detail = '';

    let descText = '';
    if (event.target) {
      if (event.target.attributes) {
        if (event.target.attributes['aria-label']) descText = event.target.attributes['aria-label'];
        else if (event.target.attributes['title']) descText = event.target.attributes['title'];
        else if (event.target.attributes['name']) descText = event.target.attributes['name'];
        else if (event.target.attributes['placeholder']) descText = event.target.attributes['placeholder'];
        else if (event.target.attributes['alt']) descText = event.target.attributes['alt'];
      }
      if (!descText && event.target.innerText) {
        descText = event.target.innerText.replace(/\\s+/g, ' ').trim();
      }
      if (descText && descText.length > 30) {
        descText = descText.substring(0, 30) + '...';
      }
    }

    if (event.type === 'click' && descText) {
      detail = '"' + descText + '"';
    } else if (event.type === 'input' && event.value) {
      detail = (descText ? '"' + descText + '" \u2192 ' : '') + '"' + event.value.substring(0, 25) + '"';
    }

    const labelEl = document.createElement('div');
    labelEl.id = 'signal-replay-highlight-label';

    const typeTag = document.createElement('span');
    typeTag.className = 'sr-hl-type ' + event.type;
    typeTag.textContent = typeLabel;

    const descSpan = document.createElement('span');
    descSpan.textContent = '#' + (index + 1) + (detail ? ' ' + detail : '');

    labelEl.appendChild(typeTag);
    labelEl.appendChild(descSpan);

    // Position label above the element
    let labelTop = rect.top + scrollY - 34;
    let labelLeft = rect.left + scrollX;
    if (labelTop < scrollY + 10) {
      labelTop = rect.bottom + scrollY + 8;
    }
    labelEl.style.left = labelLeft + 'px';
    labelEl.style.top = labelTop + 'px';
    document.body.appendChild(labelEl);
    replayHighlightLabelEl = labelEl;
  }

  // ── Countdown Timer ──
  let replayCountdownInterval = null;

  function startReplayCountdown(index, durationMs) {
    stopReplayCountdown();

    const row = replayWidgetEl.shadowRoot.getElementById('sr-event-' + index);
    const statusEl = replayWidgetEl.shadowRoot.getElementById('sr-status-' + index);
    if (!row || !statusEl) return;

    // Clear previous countdown styles
    const allRows = document.querySelectorAll('#signal-replay-widget .sr-event-row');
    allRows.forEach(r => r.classList.remove('countdown'));

    row.classList.add('countdown');

    const endTime = Date.now() + durationMs;

    // Format countdown: show decimal below 2s for precision
    function formatCountdown(msLeft) {
      const secs = Math.max(0, msLeft / 1000);
      if (secs >= 2) return Math.ceil(secs) + 's';
      if (secs > 0) return secs.toFixed(1) + 's';
      return '0s';
    }

    // Update footer
    const footer = replayWidgetEl.shadowRoot.getElementById('sr-footer');
    if (footer) {
      footer.textContent = 'Waiting before event ' + (index + 1) + '...';
      footer.className = 'sr-footer';
    }

    // Immediate first update
    statusEl.textContent = formatCountdown(endTime - Date.now());

    // Auto-scroll to countdown row
    const list = replayWidgetEl.shadowRoot.getElementById('sr-event-list');
    if (list && row) {
      const rowTop = row.offsetTop - list.offsetTop;
      const rowBottom = rowTop + row.offsetHeight;
      const listScroll = list.scrollTop;
      const listHeight = list.clientHeight;
      if (rowBottom > listScroll + listHeight || rowTop < listScroll) {
        list.scrollTop = rowTop - listHeight / 3;
      }
    }

    replayCountdownInterval = setInterval(() => {
      if (!replayWidgetEl.shadowRoot.getElementById('sr-status-' + index)) {
        stopReplayCountdown();
        return;
      }
      const msLeft = endTime - Date.now();
      statusEl.textContent = formatCountdown(msLeft);
      // Don't self-stop at 0 - let updateReplayWidgetEvent stop it
      // when the event actually fires. This shows '0s' while waiting.
    }, 100);
  }

  function stopReplayCountdown() {
    if (replayCountdownInterval) {
      clearInterval(replayCountdownInterval);
      replayCountdownInterval = null;
    }
  }

  function showReplaySkipOption(index, total, errorMsg) {
    if (!replayWidgetEl) return;
    const footer = replayWidgetEl.shadowRoot.getElementById('sr-footer');
    if (!footer) return;

    const skipSvg = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 15 12 5 21"/><rect x="16" y="3" width="3" height="18"/></svg>';

    let errorHtml = '';
    if (errorMsg) {
      errorHtml = '<div class="sr-error-detail">' + escapeHtml(errorMsg) + '</div>';
    }

    footer.innerHTML = 'Event ' + (index + 1) + ' failed. Retry with \u21bb or skip to continue.' +
      errorHtml +
      '<br><button class="sr-skip-failed-btn" id="sr-skip-failed-btn">' + skipSvg + ' Skip & Continue</button>';
    footer.className = 'sr-footer has-errors';

    const skipBtn = footer.querySelector('#sr-skip-failed-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'replaySkipFailed', tabId: replayWidgetTabId });
        footer.textContent = 'Skipped event ' + (index + 1) + ', continuing...';
        footer.className = 'sr-footer';
      });
    }
  }

  function showReplayWidgetCancelled(completed, total) {
    stopReplayCountdown();

    const counter = replayWidgetEl.shadowRoot.getElementById('sr-counter');
    if (counter) counter.textContent = completed + ' / ' + total;

    const pf = replayWidgetEl.shadowRoot.getElementById('sr-progress-fill');
    if (pf) {
      pf.style.width = Math.round((completed / total) * 100) + '%';
      pf.style.background = 'linear-gradient(90deg, #d29922, #e3b341)';
    }

    const footer = replayWidgetEl.shadowRoot.getElementById('sr-footer');
    if (footer) {
      const restartSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path></svg>';
      footer.innerHTML = 'Replay cancelled (' + completed + ' of ' + total + ' events completed)<br><button class="sr-restart-btn">' + restartSvg + ' Restart Replay</button>';
      footer.className = 'sr-footer cancelled';
    }

    // Show close, hide pause and toolbar
    const closeBtn = replayWidgetEl.shadowRoot.getElementById('sr-close-btn');
    if (closeBtn) closeBtn.style.display = 'inline-flex';
    const pauseBtn = replayWidgetEl.shadowRoot.getElementById('sr-pause-btn');
    if (pauseBtn) pauseBtn.style.display = 'none';
    const toolbar = replayWidgetEl.shadowRoot.getElementById('sr-toolbar');
    if (toolbar) toolbar.style.display = 'none';

    clearReplayHighlight();
  }
}
