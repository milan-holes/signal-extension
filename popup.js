document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  // Tab elements removed
  // const tabRecord = document.getElementById('tabRecord');
  // const tabScreenshot = document.getElementById('tabScreenshot');
  // const viewRecord = document.getElementById('viewRecord');
  // const viewScreenshot = document.getElementById('viewScreenshot');

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const activeControls = document.getElementById('activeControls');
  const mainView = document.getElementById('mainView');

  const shotVisible = document.getElementById('shotVisible');
  const shotRegion = document.getElementById('shotRegion');
  const shotFull = document.getElementById('shotFull');

  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const settingsView = document.getElementById('settingsView');

  const importBtn = document.getElementById('importBtn'); // Opens Viewer now
  const errorMsg = document.getElementById('errorMsg');

  // == Settings Inputs ==
  const autoRecordCheckbox = document.getElementById('autoRecordCheckbox');
  const showWidgetCheckbox = document.getElementById('showWidgetCheckbox');
  const showClicksCheckbox = document.getElementById('showClicksCheckbox');
  const bufferDurationInput = document.getElementById('bufferDurationInput');
  const jiraDomainInput = document.getElementById('jiraDomainInput');
  const jiraEmailInput = document.getElementById('jiraEmailInput');
  const jiraTokenInput = document.getElementById('jiraTokenInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const jiraTypeInput = document.getElementById('jiraTypeInput');
  const domainsInput = document.getElementById('domainsInput');
  const clickSizeInput = document.getElementById('clickSizeInput');
  const clickColorInput = document.getElementById('clickColorInput');
  const clickSettingsContainer = document.getElementById('clickSettingsContainer');
  const themeToggle = document.getElementById('themeToggle');

  // Security Inputs
  const securityHeadersInput = document.getElementById('securityHeadersInput');
  const securityStorageInput = document.getElementById('securityStorageInput');
  const securityCookiesInput = document.getElementById('securityCookiesInput');
  const loadDefaultsBtn = document.getElementById('loadDefaultsBtn');

  // Toggle Click Settings visibility
  if (showClicksCheckbox && clickSettingsContainer) {
    showClicksCheckbox.addEventListener('change', () => {
      clickSettingsContainer.style.opacity = showClicksCheckbox.checked ? '1' : '0.5';
      clickSettingsContainer.style.pointerEvents = showClicksCheckbox.checked ? 'auto' : 'none';
      // Or display none? Opacity is smoother if we had transitions, but let's stick to opacity/disabled look
    });
  }

  // == Theme Logic ==
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = theme === 'dark'
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>` // Sun
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`; // Moon

    if (themeToggle) themeToggle.innerHTML = icon;
  }

  // Load stored theme or default to 'light'
  chrome.storage.local.get(['theme'], (result) => {
    applyTheme(result.theme || 'light');
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      chrome.storage.local.get(['theme'], (result) => {
        const current = result.theme || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        chrome.storage.local.set({ theme: next });
        applyTheme(next);
      });
    });
  }

  let currentTabId;
  let isRestricted = false;

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabId = tab.id;
    const restrictedProtocols = ['chrome:', 'edge:', 'about:', 'view-source:', 'chrome-extension:', 'https://chrome.google.com/webstore'];
    if (tab.url && restrictedProtocols.some(p => tab.url.startsWith(p))) {
      isRestricted = true;
    }
    checkStatus();
  }

  // == Settings Tab Switching ==
  document.querySelectorAll('.setting-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      document.querySelectorAll('.setting-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-content').forEach(c => c.classList.remove('active'));

      // Add active to clicked tab
      tab.classList.add('active');
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });

  // == Settings View ==
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      settingsView.classList.remove('hidden');
    });
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsView.classList.add('hidden');
    });
  }

  // == Status Logic ==
  function updateUI(isRecording, hasData, mode, isPaused) {
    if (isRecording) {
      mainView.classList.add('hidden');
      activeControls.classList.remove('hidden');

      if (isPaused) {
        pauseBtn.innerHTML = `
            <svg class="icon-sm" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Resume
          `;
        pauseBtn.style.color = "#00cf95"; // Primary
      } else {
        pauseBtn.innerHTML = `
            <svg class="icon-sm" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            Pause
          `;
        pauseBtn.style.color = ""; // Default
      }
    } else {
      mainView.classList.remove('hidden');
      activeControls.classList.add('hidden');

      // Restore Start Button
      const startIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3" fill="white"></circle></svg>`;
      startBtn.innerHTML = `${startIcon} Start Recording`;

      if (isRestricted) {
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';
        startBtn.style.cursor = 'not-allowed';
        startBtn.title = 'Recording is not allowed on system pages';

        [shotVisible, shotRegion, shotFull].forEach(btn => {
          if (btn) {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
          }
        });

        errorMsg.textContent = "Recording is disabled on this page.";
      } else {
        startBtn.disabled = false;
        startBtn.style.opacity = '';
        startBtn.style.cursor = '';
        startBtn.title = '';

        [shotVisible, shotRegion, shotFull].forEach(btn => {
          if (btn) {
            btn.style.opacity = '';
            btn.style.pointerEvents = '';
          }
        });
        errorMsg.textContent = "";
      }
    }
  }

  function checkStatus() {
    chrome.runtime.sendMessage({ action: "checkStatus", tabId: currentTabId }, (response) => {
      // Handle potential lastError
      if (chrome.runtime.lastError) {
        // Extension context invalidated or other error
        return;
      }

      if (response && response.isRecording) {
        updateUI(true, response.hasData, response.mode, response.isPaused);
      } else {
        updateUI(false, response ? response.hasData : false, null, false);
      }
    });
  }

  // == Recording Controls ==
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startBtn.innerHTML = "Starting...";
      startBtn.disabled = true;

      chrome.runtime.sendMessage({ action: "start", tabId: currentTabId }, (response) => {
        if (response && response.status === "started") {
          updateUI(true, true, 'standard');
          errorMsg.textContent = "";
        } else {
          startBtn.innerHTML = "Start Recording";
          startBtn.disabled = false;
          errorMsg.textContent = "Error: " + (response ? response.message : "Unknown error");
        }
      });
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopBtn.disabled = true;
      stopBtn.innerHTML = "Processing...";

      chrome.runtime.sendMessage({ action: "stop", tabId: currentTabId }, (response) => {
        // Auto-open viewer
        chrome.runtime.sendMessage({ action: "saveReport", tabId: currentTabId }, (res) => {
          if (res && res.status === "saved") {
            chrome.tabs.create({ url: 'viewer.html' });
            window.close();
          } else {
            stopBtn.disabled = false;
            stopBtn.innerHTML = `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" fill="currentColor"></rect></svg> Stop`;
            if (res && res.error) {
              errorMsg.textContent = "Error saving report: " + res.error;
              // Go back to main view so user sees error?
              updateUI(false);
            }
          }
        });
      });
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "togglePause", tabId: currentTabId }, () => {
        setTimeout(checkStatus, 100);
      });
    });
  }

  // == Screenshot Controls ==
  function sendScreenshotCommand(type) {
    chrome.runtime.sendMessage({ action: "initiateScreenshot", type: type, tabId: currentTabId });
    window.close();
  }

  if (shotVisible) shotVisible.addEventListener('click', () => sendScreenshotCommand('visible'));
  if (shotRegion) shotRegion.addEventListener('click', () => sendScreenshotCommand('region'));
  if (shotFull) shotFull.addEventListener('click', () => sendScreenshotCommand('full'));


  // == Viewer / Import ==
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'viewer.html' });
    });
  }

  // == Settings Logic ==
  // Default list of sensitive headers to keep (whitelist)
  // Everything else is potentially redacted if we implement strict mode,
  // but here user asked for "Anonymize Whitelisted Headers" -> usually means "Only keep these, redact others".
  // Or "Anonymize specific headers"?
  // User Prompt: "option to configure whit headers... create and use default list of common sensitive keys to anonymize"
  // Wait, "configure whit headers" might mean "White list headers"?
  // And "default list of common sensitive keys to anonymize" might mean blacklist?
  // Let's interpret:
  // 1. "Configure whitelist headers" -> The headers we WANT to see.
  // 2. "Default list of common sensitive keys to anonymize" -> Maybe defaults for the blacklist?
  // Let's stick to: "Header Whitelist" (keep these, hide others) vs "Header Blacklist".
  // Usually for security, you blacklist sensitive ones (Auth, Cookie, etc).
  // But user said "configure whitelist headers". So maybe we only show whitelisted ones?
  // Let's implement a "Headers to Keep" list.

  const DEFAULT_SENSITIVE_STORAGE = ['token', 'auth', 'session', 'secret', 'key', 'password', 'user', 'account'];
  const DEFAULT_SENSITIVE_COOKIES = ['JSESSIONID', 'PHPSESSID', 'connect.sid', 'token', 'auth'];
  // For headers, user mentioned whitelist. Let's assume input is "Headers to Keep".
  // But typically you just want to redact specific ones.
  // Re-reading: "option to configure whit headers, localStorage keys, cookies will be anonymized"
  // Typo "whit" -> probably "whitelist"? Or "with"?
  // "configure whitelist headers" makes sense.
  // Left side: "Anonymize Whitelisted Headers"
  // Wait, if I whitelist "Content-Type", do I anonymize it? No.
  // I anonymize everything NOT in the whitelist? That's strict.
  // Or maybe "Headers to Anonymize"?
  // Let's go with "Headers to Anonymize" based on "localStorage keys... will be anonymized".
  // So: List of Headers to Redact.
  // Default: Authorization, Cookie, Set-Cookie.

  const DEFAULT_SENSITIVE_HEADERS = ['Authorization', 'Cookie', 'Set-Cookie', 'X-Auth-Token', 'Proxy-Authorization'];

  if (loadDefaultsBtn) {
    loadDefaultsBtn.addEventListener('click', () => {
      securityHeadersInput.value = DEFAULT_SENSITIVE_HEADERS.join(', ');
      securityStorageInput.value = DEFAULT_SENSITIVE_STORAGE.join(', ');
      securityCookiesInput.value = DEFAULT_SENSITIVE_COOKIES.join(', ');
    });
  }

  // Load settings
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      if (showWidgetCheckbox) showWidgetCheckbox.checked = result.settings.showWidget !== false;
      if (showClicksCheckbox) {
        showClicksCheckbox.checked = result.settings.showClicks !== false;
        // Trigger visibility update
        if (clickSettingsContainer) {
          clickSettingsContainer.style.opacity = showClicksCheckbox.checked ? '1' : '0.5';
          clickSettingsContainer.style.pointerEvents = showClicksCheckbox.checked ? 'auto' : 'none';
        }
      }
      if (bufferDurationInput && result.settings.bufferMinutes) bufferDurationInput.value = result.settings.bufferMinutes;

      // Update buffer badge
      const bufferBadge = document.getElementById('bufferBadge');
      if (bufferBadge) {
        const mins = result.settings.bufferMinutes || 2;
        bufferBadge.textContent = `Buffer: ${mins}m`;
      }

      if (jiraDomainInput && result.settings.jiraDomain) jiraDomainInput.value = result.settings.jiraDomain;
      if (jiraEmailInput && result.settings.jiraEmail) jiraEmailInput.value = result.settings.jiraEmail;
      if (jiraTokenInput && result.settings.jiraToken) jiraTokenInput.value = result.settings.jiraToken;

      if (clickSizeInput && result.settings.clickSize) clickSizeInput.value = result.settings.clickSize;
      if (clickColorInput && result.settings.clickColor) clickColorInput.value = result.settings.clickColor;

      if (domainsInput && result.settings.domains) domainsInput.value = result.settings.domains.join('\n');

      // Security
      if (securityHeadersInput) {
        const headers = result.settings.securityHeaders || DEFAULT_SENSITIVE_HEADERS;
        securityHeadersInput.value = Array.isArray(headers) ? headers.join(', ') : headers;
      }
      if (securityStorageInput) {
        const storage = result.settings.securityStorage || DEFAULT_SENSITIVE_STORAGE;
        securityStorageInput.value = Array.isArray(storage) ? storage.join(', ') : storage;
      }
      if (securityCookiesInput) {
        const cookies = result.settings.securityCookies || DEFAULT_SENSITIVE_COOKIES;
        securityCookiesInput.value = Array.isArray(cookies) ? cookies.join(', ') : cookies;
      }
    }
  });

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const settings = {
        autoRecord: false, // Force false since removed from UI
        showWidget: showWidgetCheckbox ? showWidgetCheckbox.checked : true,
        showClicks: showClicksCheckbox ? showClicksCheckbox.checked : true,
        clickSize: clickSizeInput ? (parseInt(clickSizeInput.value) || 20) : 20,
        clickColor: clickColorInput ? clickColorInput.value : '#fa383e',
        domains: domainsInput ? domainsInput.value.split('\n').map(d => d.trim()).filter(d => d) : [],
        bufferMinutes: bufferDurationInput ? (parseInt(bufferDurationInput.value) || 2) : 2,
        jiraType: jiraTypeInput ? jiraTypeInput.value : 'server',
        jiraDomain: jiraDomainInput ? jiraDomainInput.value.trim() : '',
        jiraEmail: jiraEmailInput ? jiraEmailInput.value.trim() : '',
        jiraToken: jiraTokenInput ? jiraTokenInput.value.trim() : '',

        // Security Settings (store as Arrays)
        securityHeaders: securityHeadersInput ? securityHeadersInput.value.split(',').map(s => s.trim()).filter(s => s) : [],
        securityStorage: securityStorageInput ? securityStorageInput.value.split(',').map(s => s.trim()).filter(s => s) : [],
        securityCookies: securityCookiesInput ? securityCookiesInput.value.split(',').map(s => s.trim()).filter(s => s) : []
      };

      chrome.storage.local.set({ settings: settings }, () => {
        const originalHTML = saveSettingsBtn.innerHTML;
        saveSettingsBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--success);"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        // Update buffer badge immediately
        const bufferBadge = document.getElementById('bufferBadge');
        if (bufferBadge) bufferBadge.textContent = `Buffer: ${settings.bufferMinutes}m`;

        setTimeout(() => saveSettingsBtn.innerHTML = originalHTML, 1000);

        // Clean up view
        setTimeout(() => settingsView.classList.add('hidden'), 500);
      });
    });
  }

});
