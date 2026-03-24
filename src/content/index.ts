import { createApp } from 'vue';
import Widget from './components/Widget.vue';
import IssueDialog from './components/IssueDialog.vue';
import ReplayWidget from './components/ReplayWidget.vue';
import ErrorToast from './components/ErrorToast.vue';
import IssueOverlay from './components/IssueOverlay.vue';

import { useRecording } from './composables/useRecording';
import { useScreenshot } from './composables/useScreenshot';
import { useEventTracking } from './composables/useEventTracking';
import { contentState, setRecordingState, setWidgetVisibility, setMinimized, setReplayingState, addToast, addIssue, clearIssues } from './composables/useContentState';

// Composables instance
const recordingControls = useRecording();
const screenshotControls = useScreenshot();
const trackingControls = useEventTracking('#fa383e', 30); // Default sizes, will sync w/ settings later

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSignalContext);
} else {
  initSignalContext();
}

function initSignalContext() {
  const existing = document.getElementById('signal-root');
  if (existing) return;

  // Root shadow DOM host for all extension UI elements
  const host = document.createElement('div');
  host.id = 'signal-root';
  Object.assign(host.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: '2147483647',
    width: 'auto',
    height: 'auto',
    pointerEvents: 'none',
    display: 'none',
  });
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Baseline widget styling
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    .signal-widget-container {
        pointer-events: auto;
    }

    #signal-dialog-container {
        pointer-events: auto;
        position: absolute;
    }
  `;
  shadow.appendChild(styleEl);

  // Vue Component Styling
  chrome.runtime.sendMessage({ action: 'getCss' }, (response) => {
    if (response && response.css) {
      const componentStyle = document.createElement('style');
      componentStyle.textContent = response.css;
      shadow.appendChild(componentStyle);
    } else {
      console.error('Signal Extension: Failed to load widget styles via background script', response?.error);
    }
    // Only show the host after styles are processed
    host.style.display = 'block';
  });

  // Widget Vue Mount Profile
  const widgetBox = document.createElement('div');
  widgetBox.className = 'signal-widget-container';
  shadow.appendChild(widgetBox);

  const appWidget = createApp(Widget);
  appWidget.mount(widgetBox);

  // Toast Notifications Mount
  const toastBox = document.createElement('div');
  toastBox.id = 'signal-toast-container';
  shadow.appendChild(toastBox);
  const toastApp = createApp(ErrorToast);
  toastApp.mount(toastBox);

  // Dialog / Overlays Container (for Report Issue Dialog & Replay)
  const dialogBox = document.createElement('div');
  dialogBox.id = 'signal-dialog-container';
  shadow.appendChild(dialogBox);

  // Replay Component Mount - Moved to dynamic initialization in listener

  // Issue Dialog setup
  const issueApp = createApp(IssueDialog, {
    onSubmit: (data: {
      currentState: string;
      desiredState: string;
      comment: string;
      rect: any;
      resolvedElements: any[];
      primaryElement: any;
      selectedText: string | null;
    }) => {
      const issue = {
        timestamp: Date.now(),
        currentState: data.currentState,
        desiredState: data.desiredState,
        comment: data.comment,
        rect: data.rect,
        resolvedElements: data.resolvedElements,
        primaryElement: data.primaryElement,
        selectedText: data.selectedText
      };

      // Add to local state for immediate display
      addIssue(issue);
      updateRecordingIssueOverlay();

      // Send to background
      chrome.runtime.sendMessage({
        action: "recordIssue",
        issue: {
          ...issue,
          url: window.location.href
        }
      });
      chrome.runtime.sendMessage({ action: "resume" });
      setRecordingState(true, false, contentState.currentMode);
    },
    onCancel: () => {
      chrome.runtime.sendMessage({ action: "resume" });
      setRecordingState(true, false, contentState.currentMode);
    }
  });

  const issueNode = document.createElement('div');
  dialogBox.appendChild(issueNode);
  const issueInstance = issueApp.mount(issueNode) as any;

  // Issue Overlay Component Mount (for showing issue markers on page)
  // IMPORTANT: Use shadow DOM so styles work correctly, but position on document.body
  let issueOverlayInstance: any = null;
  let recordingIssueOverlayInstance: any = null;
  const issueOverlayHost = document.createElement('div');
  issueOverlayHost.id = 'signal-issue-overlay-host';
  issueOverlayHost.style.position = 'absolute';
  issueOverlayHost.style.top = '0';
  issueOverlayHost.style.left = '0';
  issueOverlayHost.style.width = '100%';
  issueOverlayHost.style.minHeight = '100vh';
  issueOverlayHost.style.pointerEvents = 'none';
  issueOverlayHost.style.zIndex = '2147483644';
  document.body.appendChild(issueOverlayHost);

  const issueOverlayShadow = issueOverlayHost.attachShadow({ mode: 'open' });

  // Add CSS to shadow root
  const issueOverlayStyle = document.createElement('style');
  issueOverlayStyle.textContent = `* { box-sizing: border-box; }`;
  issueOverlayShadow.appendChild(issueOverlayStyle);

  // Load component styles
  chrome.runtime.sendMessage({ action: 'getCss' }, (response) => {
    if (response && response.css) {
      const componentStyle = document.createElement('style');
      componentStyle.textContent = response.css;
      issueOverlayShadow.appendChild(componentStyle);
    }
  });

  const issueOverlayNode = document.createElement('div');
  issueOverlayNode.id = 'signal-issue-overlay-container';
  issueOverlayNode.style.width = '100%';
  issueOverlayNode.style.height = '100%';
  issueOverlayShadow.appendChild(issueOverlayNode);

  // Function to mount/update issue overlay during recording
  function updateRecordingIssueOverlay() {
    if (recordingIssueOverlayInstance) {
      recordingIssueOverlayInstance.unmount();
      recordingIssueOverlayInstance = null;
    }
    while (issueOverlayNode.firstChild) {
      issueOverlayNode.removeChild(issueOverlayNode.firstChild);
    }

    if (contentState.issues.length > 0) {
      const overlayNode = document.createElement('div');
      issueOverlayNode.appendChild(overlayNode);
      recordingIssueOverlayInstance = createApp(IssueOverlay, {
        issues: contentState.issues,
        visible: true
      });
      recordingIssueOverlayInstance.mount(overlayNode);
    }
  }

  // ------------------------------------------------------------------
  // Drag implementation
  // ------------------------------------------------------------------
  let isDragging = false;
  let offsetX = 0, offsetY = 0;

  host.addEventListener('mousedown', (e: MouseEvent) => {
    const target = e.composedPath()[0] as HTMLElement;
    
    // Ignore interactive elements to allow default behavior (e.g., dropdowns opening)
    if (target.closest && target.closest('button, a, input, select, textarea, label')) return;

    // Ignore if clicking inside dialogs or replay widget (they handle their own logic/drag)
    if (target.closest && target.closest('#signal-dialog-container')) return;

    e.preventDefault();
    isDragging = false;

    const rect = host.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    const startX = e.clientX;
    const startY = e.clientY;
    host.style.transition = 'none';

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;

      if (isDragging) {
        let newTop = ev.clientY - offsetY;
        let newLeft = ev.clientX - offsetX;
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - host.offsetHeight));
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - host.offsetWidth));
        host.style.top = newTop + 'px';
        host.style.left = newLeft + 'px';
        host.style.bottom = 'auto';
        host.style.right = 'auto';
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      host.style.transition = '';
      if (isDragging) {
        try {
          chrome.storage.local.set({
            'signal-widget-pos': {
              top: host.style.top,
              left: host.style.left,
            }
          });
        } catch { }
      }
      isDragging = false;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Load drag position
  try {
    chrome.storage.local.get(['signal-widget-pos'], (result) => {
      const pos = result['signal-widget-pos'] as { top: string, left: string };
      if (pos) {
        const t = parseInt(pos.top);
        const l = parseInt(pos.left);
        if (!isNaN(t) && !isNaN(l) && t >= 0 && l >= 0 && t < window.innerHeight && l < window.innerWidth) {
          host.style.top = t + 'px';
          host.style.left = l + 'px';
          host.style.bottom = 'auto';
          host.style.right = 'auto';
        }
      }
    });
  } catch { }


  // ------------------------------------------------------------------
  // Vue Custom Event Bus Listeners
  // ------------------------------------------------------------------

  window.addEventListener('signal-start-recording', () => {
    try {
      const env = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
        deviceMemory: (navigator as any).deviceMemory || 'N/A',
        connectionType: (navigator as any).connection ? (navigator as any).connection.effectiveType : 'N/A',
        url: window.location.href
      };

      const getStorage = (type: string) => {
        let store: any = {};
        for (let i = 0; i < window[type as any as keyof Window].length; i++) {
          const key = window[type as any as keyof Window].key(i);
          if (key) store[key] = window[type as any as keyof Window].getItem(key);
        }
        return store;
      };

      const getCookies = () => {
        const pairs = document.cookie.split(";");
        const cookies: any = {};
        for (let i = 0; i < pairs.length; i++) {
          const pair = pairs[i].split("=");
          if (pair[0]) cookies[(pair[0] || '').trim()] = unescape((pair[1] || '').trim());
        }
        return cookies;
      };

      const storage = {
        localStorage: getStorage('localStorage'),
        sessionStorage: getStorage('sessionStorage'),
        cookies: getCookies()
      };

      chrome.runtime.sendMessage({
        action: "start",
        env: env,
        storage: storage
      }, (response) => {
        if (response && response.status === 'started') {
          setRecordingState(true, false, 'standard');
          trackingControls.initEventTracking();
        } else {
          // Failure handling
        }
      });

    } catch (e) {
      console.error('[Signal] Start recording exception:', e);
    }
  });

  window.addEventListener('signal-stop-recording', () => {
    trackingControls.detachEventTracking();
    setRecordingState(false, false, 'idle'); // Stop
    clearIssues();
    updateRecordingIssueOverlay();
    chrome.runtime.sendMessage({ action: "stop" }, () => {
      chrome.runtime.sendMessage({ action: 'saveReport' }, (res) => {
        if (res && res.status === 'saved') {
          chrome.runtime.sendMessage({ action: 'openViewer' });
        }
      });
    });
  });

  window.addEventListener('signal-cancel-recording', () => {
    trackingControls.detachEventTracking();
    setRecordingState(false, false, 'idle'); // Stop
    clearIssues();
    updateRecordingIssueOverlay();
    chrome.runtime.sendMessage({ action: "stop" });
  });

  window.addEventListener('signal-create-report', () => {
    // "Select Issue Box Mode"
    document.body.style.cursor = "crosshair";

    let overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '2147483645';
    overlay.style.cursor = 'crosshair';
    document.body.appendChild(overlay);

    let selectionBox = document.createElement('div');
    selectionBox.style.position = 'fixed';
    selectionBox.style.border = '2px dashed #fa383e';
    selectionBox.style.backgroundColor = 'rgba(250,56,62,0.1)';
    selectionBox.style.zIndex = '2147483646';
    selectionBox.style.pointerEvents = 'none';
    selectionBox.style.display = 'none';
    document.body.appendChild(selectionBox);

    let startX = 0, startY = 0, isSelecting = false;

    const onDown = (e: MouseEvent) => {
      if ((e.target as Element).id === 'signal-root') return;
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.left = startX + 'px';
      selectionBox.style.top = startY + 'px';
      selectionBox.style.width = '0px';
      selectionBox.style.height = '0px';
      selectionBox.style.display = 'block';
    };

    const onMove = (e: MouseEvent) => {
      if (!isSelecting) return;
      const currentX = e.clientX;
      const currentY = e.clientY;
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
    };

    const onUp = (e: MouseEvent) => {
      if (!isSelecting) return;
      isSelecting = false;

      // Remove the overlay but KEEP the selection box visible
      overlay.remove();

      const currentX = e.clientX;
      const currentY = e.clientY;
      const box = {
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY)
      };

      document.body.style.cursor = "default";

      // Trigger the IssueDialog Vue component with this rect!
      chrome.runtime.sendMessage({ action: "pause" });
      setRecordingState(true, true, contentState.currentMode); // Pausing state

      // Pass cleanup function to issue dialog to remove selection box when done
      const cleanup = () => {
        selectionBox.remove();
      };

      issueInstance.open(box, cleanup);
    };

    overlay.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  window.addEventListener('signal-take-screenshot', (e: any) => {
    const type = e.detail?.type || 'visible';
    if (type === 'visible') screenshotControls.captureVisible();
    else if (type === 'full') screenshotControls.captureFullPage();
    else if (type === 'region') screenshotControls.captureRegion();
  });


  // ------------------------------------------------------------------
  // Background Listener Orchestration
  // ------------------------------------------------------------------

  if (!(window as any).signalContentListenerAttached) {
    (window as any).signalContentListenerAttached = true;
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "showOverlay") {
        setWidgetVisibility(true);
        setRecordingState(true, false, request.mode);
        trackingControls.initEventTracking();
        clearIssues(); // Clear issues from previous session
        updateRecordingIssueOverlay();
      }
      if (request.action === "hideOverlay") {
        setRecordingState(false, false, 'idle');
        setWidgetVisibility(false);
        clearIssues();
        updateRecordingIssueOverlay();
      }
      if (request.action === "triggerScreenshot") {
        if (request.type === 'visible') screenshotControls.captureVisible();
        else if (request.type === 'full') screenshotControls.captureFullPage();
        else if (request.type === 'region') screenshotControls.captureRegion();
      }

      if (request.action === "setWidgetVisibility") {
        setWidgetVisibility(request.visible);
      }

      if (request.action === "showToast") {
        addToast(request.toastType, request.message);
      }

      if (request.action === "ping") {
        sendResponse({ ready: true });
        return;
      }

      // ── Replay Widget Messages Proxy passed to global Window callbacks map ──
      let currentReplayApp: any = null;

      if (request.action === "replayWidgetInit") {
        // Unmount existing if any
        if (currentReplayApp) {
          currentReplayApp.unmount();
          currentReplayApp = null;
        }
        // Clear issue overlay node but keep container
        while (issueOverlayNode.firstChild) {
          issueOverlayNode.removeChild(issueOverlayNode.firstChild);
        }
        dialogBox.innerHTML = '';

        // Mount dynamic ReplayWidget details
        const node = document.createElement('div');
        dialogBox.appendChild(node);

        currentReplayApp = createApp(ReplayWidget, {
          events: request.events,
          tabId: request.tabId,
          readyMode: request.readyMode,
          defaultDelay: request.defaultDelay,
          issues: request.issues || [],
          onClose: () => {
            if (currentReplayApp) {
               currentReplayApp.unmount();
               currentReplayApp = null;
            }
            if (issueOverlayInstance) {
              issueOverlayInstance.unmount();
              issueOverlayInstance = null;
            }
            node.remove();
          },
          onToggleIssues: (visible: boolean, filteredIssues: any[]) => {
            // Toggle issue overlay visibility
            if (visible && filteredIssues && filteredIssues.length > 0) {
              if (issueOverlayInstance) {
                issueOverlayInstance.unmount();
              }
              const overlayNode = document.createElement('div');
              issueOverlayNode.appendChild(overlayNode);
              issueOverlayInstance = createApp(IssueOverlay, {
                issues: filteredIssues,
                visible: true
              });
              issueOverlayInstance.mount(overlayNode);
            } else {
              if (issueOverlayInstance) {
                issueOverlayInstance.unmount();
                issueOverlayInstance = null;
              }
              while (issueOverlayNode.firstChild) {
                issueOverlayNode.removeChild(issueOverlayNode.firstChild);
              }
            }
          }
        });

        const replayInstance = currentReplayApp.mount(node);

        // Setup cleanup hook
        // @ts-ignore
        replayInstance.$el.addEventListener('close', () => {
          if(currentReplayApp) { currentReplayApp.unmount(); currentReplayApp = null; }
          if (issueOverlayInstance) { issueOverlayInstance.unmount(); issueOverlayInstance = null; }
          node.remove();
        });
        setReplayingState(true);
      }

      if (request.action === "replayWidgetStarted") {
        // ReplayWidget execution state switch
        if ((window as any)._updateReplayWidgetEvent) {
          // Wait.. actually `switchReplayWidgetToExecuting` logic 
          // In Vue we just toggle inner execution flag, which changes UI implicitly based on current events playing
        }
      }

      if (request.action === "replayWidgetUpdate") {
        if ((window as any)._updateReplayWidgetEvent) {
          (window as any)._updateReplayWidgetEvent(request.index, request.status, request.total, request.errorMessage);
        }
      }
      if (request.action === "replayWidgetFinished") {
        if ((window as any)._showReplayFinished) {
          (window as any)._showReplayFinished(request.total, request.errorCount);
        }
      }
      // Remove replay widget - destroy component
      if (request.action === "replayWidgetRemove") {
        if (currentReplayApp) {
          currentReplayApp.unmount();
          currentReplayApp = null;
        }
        dialogBox.innerHTML = '';
        setReplayingState(false);
      }
      if (request.action === "replayHighlightTarget") {
        if ((window as any)._highlightTarget) {
          (window as any)._highlightTarget(request.event, request.index);
        }
      }
      if (request.action === "replayWidgetCountdown") {
        if ((window as any)._startReplayCountdown) {
          (window as any)._startReplayCountdown(request.index, request.duration);
        }
      }
      if (request.action === "replayWidgetCancelled") {
        if ((window as any)._cancelReplayView) {
          (window as any)._cancelReplayView(request.completed, request.total);
        }
      }
      // Note: showReplaySkipOption does not exist cleanly mapped yet, we can expand later
    });
  }


  // Sync initial state if active — retry on failure (service worker may be waking up)
  function syncRecordingState() {
    try {
      chrome.runtime.sendMessage({ action: "checkStatus" }, (response) => {
        if (chrome.runtime.lastError) {
          // Service worker may be waking up — retry once
          setTimeout(syncRecordingState, 500);
          return;
        }
        if (response && response.isRecording) {
          setWidgetVisibility(true);
          setRecordingState(true, response.isPaused || false, response.mode || 'standard');
          trackingControls.initEventTracking();
        }
      });
    } catch {
      // Extension context invalidated — ignore
    }
  }
  syncRecordingState();
}
