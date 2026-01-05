document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const activeControls = document.getElementById('activeControls');
  const screenshotBtn = document.getElementById('screenshotBtn');
  // downloadBtn removed
  const importBtn = document.getElementById('importBtn');
  const fileInput = document.getElementById('fileInput');
  const statusDiv = document.getElementById('status');
  const errorMsg = document.getElementById('errorMsg');

  let currentTabId;

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabId = tab.id;
    checkStatus();
  }

  function updateUI(isRecording, hasData, mode, isPaused) {
    if (isRecording) {
      startBtn.classList.add('hidden');
      activeControls.classList.remove('hidden');
      if (screenshotBtn) screenshotBtn.disabled = true;

      if (isPaused) {
        pauseBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
            </svg>
            Resume
          `;
        pauseBtn.style.color = "#107c10";
        pauseBtn.style.borderColor = "#107c10";
      } else {
        pauseBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            Pause
          `;
        pauseBtn.style.color = "#0078d4";
        pauseBtn.style.borderColor = "#0078d4";
      }
    } else {
      startBtn.classList.remove('hidden');
      activeControls.classList.add('hidden');
      if (screenshotBtn) screenshotBtn.disabled = false;
    }
  }

  function checkStatus() {
    chrome.runtime.sendMessage({ action: "checkStatus", tabId: currentTabId }, (response) => {
      if (response && response.isRecording) {
        updateUI(true, response.hasData, response.mode, response.isPaused);
      } else {
        updateUI(false, response ? response.hasData : false, null, false);
      }
    });
  }

  startBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "start", tabId: currentTabId }, (response) => {
      if (response.status === "started") {
        updateUI(true, true, 'standard');
        errorMsg.textContent = "";
      } else {
        errorMsg.textContent = "Error: " + response.message;
      }
    });
  });

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "stop", tabId: currentTabId }, (response) => {
      updateUI(false, true, null);
      // Auto-open viewer
      chrome.runtime.sendMessage({ action: "saveReport", tabId: currentTabId }, (res) => {
        if (res && res.status === "saved") {
          chrome.tabs.create({ url: 'viewer.html' });
          window.close();
        }
      });
    });
  });

  pauseBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "togglePause", tabId: currentTabId }, () => {
      setTimeout(checkStatus, 100);
    });
  });

  /* Download Removed */

  importBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'viewer.html' });
  });

  /* Edit Page Button Removed */

  const screenshotMenu = document.getElementById('screenshotMenu');
  document.getElementById('screenshotBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    screenshotMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!screenshotMenu.contains(e.target) && e.target.closest('#screenshotBtn') === null) {
      screenshotMenu.classList.add('hidden');
    }
  });

  function sendScreenshotCommand(type) {
    chrome.tabs.sendMessage(currentTabId, { action: "triggerScreenshot", type: type });
    window.close();
  }

  document.getElementById('shotVisible').addEventListener('click', () => sendScreenshotCommand('visible'));
  document.getElementById('shotRegion').addEventListener('click', () => sendScreenshotCommand('region'));
  document.getElementById('shotFull').addEventListener('click', () => sendScreenshotCommand('full'));

  // Hover effects
  [document.getElementById('shotVisible'), document.getElementById('shotRegion'), document.getElementById('shotFull')].forEach(el => {
    el.onmouseover = () => el.style.background = "#f3f2f1";
    el.onmouseout = () => el.style.background = "white";
  });

  // Settings Logic
  const autoRecordCheckbox = document.getElementById('autoRecordCheckbox');
  const showWidgetCheckbox = document.getElementById('showWidgetCheckbox');
  const showClicksCheckbox = document.getElementById('showClicksCheckbox');
  const clickSizeInput = document.getElementById('clickSizeInput');
  const domainsInput = document.getElementById('domainsInput');
  const bufferDurationInput = document.getElementById('bufferDurationInput');
  const jiraDomainInput = document.getElementById('jiraDomainInput');
  const jiraEmailInput = document.getElementById('jiraEmailInput');
  const jiraTokenInput = document.getElementById('jiraTokenInput');
  const jiraTypeInput = document.getElementById('jiraTypeInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  // Load settings
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      autoRecordCheckbox.checked = result.settings.autoRecord;
      showWidgetCheckbox.checked = result.settings.showWidget !== false;
      if (showClicksCheckbox) showClicksCheckbox.checked = result.settings.showClicks !== false;
      if (clickSizeInput && result.settings.clickSize) clickSizeInput.value = result.settings.clickSize;

      domainsInput.value = result.settings.domains.join('\n');
      if (result.settings.bufferMinutes) {
        bufferDurationInput.value = result.settings.bufferMinutes;
      }
      if (result.settings.jiraType) jiraTypeInput.value = result.settings.jiraType;
      if (result.settings.jiraDomain) jiraDomainInput.value = result.settings.jiraDomain;
      if (result.settings.jiraEmail) jiraEmailInput.value = result.settings.jiraEmail;
      if (result.settings.jiraToken) jiraTokenInput.value = result.settings.jiraToken;
    }
  });

  saveSettingsBtn.addEventListener('click', () => {
    const settings = {
      autoRecord: autoRecordCheckbox.checked,
      showWidget: showWidgetCheckbox.checked,
      showClicks: showClicksCheckbox ? showClicksCheckbox.checked : true,
      clickSize: clickSizeInput ? (parseInt(clickSizeInput.value) || 20) : 20,
      domains: domainsInput.value.split('\n').map(d => d.trim()).filter(d => d),
      bufferMinutes: parseInt(bufferDurationInput.value) || 2,
      jiraType: jiraTypeInput.value,
      jiraDomain: jiraDomainInput.value.trim(),
      jiraEmail: jiraEmailInput.value.trim(),
      jiraToken: jiraTokenInput.value.trim()
    };
    chrome.storage.local.set({ settings: settings }, () => {
      saveSettingsBtn.textContent = "Saved!";
      setTimeout(() => saveSettingsBtn.textContent = "Save Settings", 1000);
    });
  });
});
