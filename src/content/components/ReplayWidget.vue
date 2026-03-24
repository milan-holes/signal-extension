<template>
  <div 
    v-if="isVisible && localEvents && localEvents.length > 0" 
    id="signal-replay-widget" 
    class="signal-replay-widget-wrapper"
    :class="{ 'sr-ready-mode': readyMode }"
    :style="{ top: pos.y + 'px', left: pos.x + 'px', right: 'auto', position: 'fixed', zIndex: 2147483647 }"
  >
    <!-- Header -->
    <header
        class="sr-header"
        :class="{ 'dragging': isDragging }"
        @mousedown="startDrag"
    >
      <div class="sr-title-container">
        <div class="sr-title-icon-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="sr-icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
        </div>
        <div>
          <h2 class="sr-title-text">Signal - Replay Events</h2>
          <p class="sr-title-subtext">PREMIUM CONTROL</p>
        </div>
      </div>
      <div class="sr-header-actions">
        <div class="sr-counter-badge">
          <span>{{ completedCount }} / {{ localEvents.length }}</span>
        </div>
        <button v-show="!readyMode && !isFinished" class="sr-icon-btn" @click="togglePause" :title="isPaused ? 'Resume replay' : 'Pause replay'">
          <svg v-if="!isPaused" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <button v-show="isFinished" class="sr-icon-btn" @click="close" title="Close widget">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </header>

    <!-- Loading/Navigation Indicator -->
    <div v-if="isNavigating || isWaitingForDOM" class="sr-loading-banner">
      <div class="sr-loading-spinner"></div>
      <span>{{ isNavigating ? 'Navigating to page...' : 'Waiting for page to load...' }}</span>
    </div>

    <!-- Element Not Found Warning -->
    <div v-if="elementNotFoundWarning" class="sr-warning-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <span>{{ elementNotFoundWarning }}</span>
    </div>

    <!-- Toolbar -->
    <div v-show="!isFinished" class="sr-toolbar">
      <div class="sr-toolbar-group">
        <span class="sr-toolbar-label">DELAY:</span>
        <select class="sr-delay-select" v-model="selectedDelay" @change="changeDelay">
          <option value="auto">Auto</option>
          <option value="500">0.5s</option>
          <option value="1000">1s</option>
          <option value="2000">2s</option>
          <option value="5000">5s</option>
        </select>
      </div>
      <div v-show="executing" class="sr-toolbar-group">
        <button class="sr-action-btn-skip" @click="skipEvent" title="Skip to next event">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 15 12 5 21"/><rect x="16" y="3" width="3" height="18"/></svg>
          <span>Skip</span>
        </button>
        <button class="sr-action-btn-stop" @click="cancelReplay" title="Stop Replay">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </button>
      </div>
    </div>

    <!-- Progress -->
    <div class="sr-progress-track">
      <div class="sr-progress-fill" :style="{ width: progressPercent + '%', background: progressColor }"></div>
    </div>

    <!-- Event List -->
    <div class="sr-event-list custom-scrollbar" ref="listEl">
      <div
        v-for="(event, index) in localEvents"
        :key="index"
        class="sr-event-row group"
        :class="{
          'skipped': getEventClasses(index) === 'skipped',
          'sr-event-active': eventStatuses[index] === 'active',
          'sr-event-countdown': eventStatuses[index] === 'countdown'
        }"
      >
        <div
          class="sr-event-status-icon"
          :class="{ 'sr-countdown-interactive': isCountdown(index) }"
          @click="isCountdown(index) ? skipCurrentEvent() : null"
          :title="isCountdown(index) ? 'Click to execute now' : ''"
        >
          <span v-if="isCountdown(index)" class="sr-countdown-number">{{ countdownValues[index] || 0 }}s</span>
          <span v-else v-html="getEventStatusIcon(index)"></span>
          <div v-if="isCountdown(index)" class="sr-countdown-play-overlay">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        </div>
        <div class="sr-event-content">
          <div class="sr-event-content-header">
            <span :class="getTypeBadgeClasses(event.type)">{{ event.type }}</span>
            <span class="sr-event-title">{{ index + 1 }}. {{ getEventLabelShort(event) }}</span>
          </div>
          <p class="sr-event-desc" :title="getEventLabel(event)">{{ getEventLabelDesc(event) }}</p>
          <div v-if="eventErrors[index]" class="sr-event-error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{{ eventErrors[index] }}</span>
          </div>
        </div>
        
        <div class="sr-event-actions hover-actions">
          <button v-show="isCountdown(index) || eventStatuses[index] === 'active'" class="sr-row-action-btn sr-pause-btn" @click="togglePause" :title="isPaused ? 'Resume replay' : 'Pause replay'">
            <svg v-if="!isPaused" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button v-show="isCountdown(index)" class="sr-row-action-btn" @click="skipCurrentEvent" title="Skip this event">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4l10 8-10 8V4z"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
          </button>
          <button v-show="isError(index)" class="sr-row-action-btn" @click="retryEvent(index)" title="Retry this event">↻</button>

          <button v-show="!executing" class="sr-row-action-btn hover-primary" @click="copySelector(event, index)" title="Copy Selector">
            <svg v-if="copiedIndex !== index" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <button v-show="!executing" class="sr-row-action-btn hover-primary" @click="inspectEvent(event, index)" :disabled="!canHighlightEvent(event)" :title="canHighlightEvent(event) ? 'Highlight & Log Element' : 'Element not found on page'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </button>
          <button v-show="!executing" class="sr-row-action-btn danger" @click="removeEvent(index)" title="Remove">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="sr-footer">
      <button v-show="!executing && !isFinished" class="sr-primary-btn" @click="startReplay" :disabled="isStarting">
        <svg v-if="!isStarting" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>{{ isStarting ? 'Starting...' : 'Start Replay' }}</span>
      </button>

      <button v-show="isFinished" class="sr-secondary-btn" @click="restartReplay">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path></svg>
        <span>{{ errorCount > 0 ? 'Restart Replay' : 'Replay Again' }}</span>
      </button>

      <button v-show="hasIssues" class="sr-toggle-issues-btn" @click="toggleIssues">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{{ showIssues ? 'Hide' : 'Show' }} Issues ({{ currentPageIssues.length }})</span>
      </button>

      <p class="sr-footer-message" :class="footerType === 'error' ? 'text-red-400' : 'text-slate-500'">
        <span v-html="footerHTML"></span>
      </p>
    </footer>
    
  </div>
  
  <!-- Highlight Overlay -->
  <div v-if="highlightRect" id="signal-replay-highlight" :style="highlightStyle"></div>
  <div v-if="highlightRect" id="signal-replay-highlight-label" :style="highlightLabelStyle">
    <span class="sr-event-type-badge bg-blue mr-2">{{ highlightEvent?.type }}</span>
    <span class="sr-highlight-text">{{ highlightRect.desc }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps<{
  events: any[];
  tabId: number;
  readyMode: boolean;
  defaultDelay: number | null;
  issues?: any[];
}>();

const emit = defineEmits(['start', 'pause', 'resume', 'close', 'skip', 'cancel', 'retried', 'removed', 'delay-changed', 'toggle-issues']);

const isVisible = ref(true);
const isPaused = ref(false);
const executing = ref(!props.readyMode); // If not in ready mode, replay is already executing
const isStarting = ref(false);
const isFinished = ref(false);
const errorCount = ref(0);
const footerMessage = ref('Review events and click Start when ready');
const footerType = ref('normal'); // 'normal', 'success', 'error', 'cancelled'
const copiedIndex = ref<number | null>(null);
const showIssues = ref(false);

const eventStatuses = ref<Record<number, string>>({}); // 'active', 'done', 'error', 'countdown'
const countdownValues = ref<Record<number, number>>({});
const eventErrors = ref<Record<number, string>>({});
const countdownInterval = ref<number | null>(null);

const localEvents = ref([...props.events]);

const selectedDelay = ref(props.defaultDelay === null ? 'auto' : String(props.defaultDelay));

// Loading and warning states
const isNavigating = ref(false);
const isWaitingForDOM = ref(false);
const elementNotFoundWarning = ref('');
let elementWarningTimeout: number | null = null;

// DOM ref
const listEl = ref<HTMLElement | null>(null);

// Highlight state
const highlightRect = ref<{ x: number, y: number, w: number, h: number, desc: string } | null>(null);
const highlightEvent = ref<any>(null);
const highlightElement = ref<HTMLElement | null>(null);
const highlightUpdateInterval = ref<number | null>(null);

const highlightStyle = computed(() => {
    if (!highlightRect.value) return {};
    return {
        left: highlightRect.value.x + 'px',
        top: highlightRect.value.y + 'px',
        width: highlightRect.value.w + 'px',
        height: highlightRect.value.h + 'px'
    };
});

const highlightLabelStyle = computed(() => {
    if (!highlightRect.value) return {};
    return {
        left: highlightRect.value.x + 'px',
        top: (highlightRect.value.y - 28) + 'px'
    };
});

// Drag State
const pos = ref({ x: document.documentElement.clientWidth - 360, y: 16 });
const isDragging = ref(false);
let dragStartParams = { x: 0, y: 0, startX: 0, startY: 0 };

const progressPercent = computed(() => {
    let completed = 0;
    for (let i = 0; i < localEvents.value.length; i++) {
        if (eventStatuses.value[i] === 'done' || eventStatuses.value[i] === 'error') completed++;
    }
    return localEvents.value.length > 0 ? Math.round((completed / localEvents.value.length) * 100) : 0;
});

const progressColor = computed(() => {
    return errorCount.value > 0 ? 'linear-gradient(90deg, #fa383e, #ff6b6b)' : 'linear-gradient(90deg, #0078d4, #4ca6ff)';
});

const completedCount = computed(() => {
    let count = 0;
    for (let i = 0; i < localEvents.value.length; i++) {
        if (eventStatuses.value[i] === 'done' || eventStatuses.value[i] === 'error') count++;
    }
    return count;
});

const footerClass = computed(() => {
   if (footerType.value === 'success') return 'success';
   if (footerType.value === 'error') return 'has-errors';
   if (footerType.value === 'cancelled') return 'cancelled';
   return '';
});

const footerHTML = computed(() => {
    return footerMessage.value;
});

const currentPageIssues = computed(() => {
    if (!props.issues || props.issues.length === 0) return [];

    const currentUrl = window.location.href;
    return props.issues.filter((issue: any) => {
        // If issue doesn't have a URL, include it (backward compatibility)
        if (!issue.url) return true;
        // Match exact URL or same page (ignoring hash/query params for flexibility)
        try {
            const issueUrl = new URL(issue.url);
            const pageUrl = new URL(currentUrl);
            return issueUrl.origin === pageUrl.origin && issueUrl.pathname === pageUrl.pathname;
        } catch {
            return issue.url === currentUrl;
        }
    });
});

const hasIssues = computed(() => {
    return currentPageIssues.value.length > 0;
});

const toggleIssues = () => {
    const newState = !showIssues.value;
    showIssues.value = newState;

    // Auto-pause when showing issues
    if (newState && executing.value && !isPaused.value) {
        togglePause();
    }

    emit('toggle-issues', newState, currentPageIssues.value);
};

const canHighlightEvent = (event: any): boolean => {
    const el = findElementByEvent(event);
    return el !== null;
};

// Drag Methods
const startDrag = (e: MouseEvent) => {
    if ((e.target as Element).closest('.sr-btn')) return;
    isDragging.value = true;
    dragStartParams = {
        x: e.clientX,
        y: e.clientY,
        startX: pos.value.x,
        startY: pos.value.y
    };
};

const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;
    pos.value.x = dragStartParams.startX + e.clientX - dragStartParams.x;
    pos.value.y = dragStartParams.startY + e.clientY - dragStartParams.y;
};

const onMouseUp = () => {
    isDragging.value = false;
};

onMounted(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    // Assign global callback to handle messages mapped from core content script orchestrator
    // Because this runs isolated, the parent index.ts will pass methods here.
    (window as any)._updateReplayWidgetEvent = updateEvent;
    (window as any)._showReplayFinished = setFinished;
    (window as any)._startReplayCountdown = setCountdown;
    (window as any)._cancelReplayView = setCancelled;
    (window as any)._highlightTarget = highlightTarget;
});

onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    clearHighlight();
    if (countdownInterval.value) {
        clearInterval(countdownInterval.value);
        countdownInterval.value = null;
    }
    delete (window as any)._updateReplayWidgetEvent;
    delete (window as any)._showReplayFinished;
    delete (window as any)._startReplayCountdown;
    delete (window as any)._cancelReplayView;
    delete (window as any)._highlightTarget;
});

// Actions
const startReplay = () => {
    isStarting.value = true;
    chrome.runtime.sendMessage({ action: 'replayStart', tabId: props.tabId });
    executing.value = true;
    footerType.value = 'normal';
    footerMessage.value = 'Executing events...';
};

const togglePause = () => {
    if (isPaused.value) {
        chrome.runtime.sendMessage({ action: 'replayResume', tabId: props.tabId });
    } else {
        chrome.runtime.sendMessage({ action: 'replayPause', tabId: props.tabId });
    }
    isPaused.value = !isPaused.value;
};

const close = () => {
    chrome.runtime.sendMessage({ action: 'replayClose', tabId: props.tabId });
    isVisible.value = false;
    emit('close');
};

const skipEvent = () => {
    chrome.runtime.sendMessage({ action: 'replaySkip', tabId: props.tabId });
};

const skipCurrentEvent = () => {
    chrome.runtime.sendMessage({ action: 'replaySkipEvent', tabId: props.tabId });
};

const cancelReplay = () => {
    chrome.runtime.sendMessage({ action: 'replayCancel', tabId: props.tabId });
};

const changeDelay = () => {
    const val = selectedDelay.value === 'auto' ? null : parseInt(selectedDelay.value);
    chrome.runtime.sendMessage({ action: 'replaySetDelay', tabId: props.tabId, delay: val });
};

const restartReplay = () => {
    isStarting.value = true;
    executing.value = true;
    isFinished.value = false;
    footerType.value = 'normal';
    footerMessage.value = 'Restarting replay...';
    for (const key in eventStatuses.value) {
        delete eventStatuses.value[key];
    }
    chrome.runtime.sendMessage({ action: 'replayRestart', tabId: props.tabId });
};

const retryEvent = (index: number) => {
    chrome.runtime.sendMessage({ action: 'replayRetry', tabId: props.tabId, eventIndex: index });
};

const copySelector = (event: any, index: number) => {
    let selector = '';
    if (event.target?.testAttr?.selector) selector = event.target.testAttr.selector;
    else if (event.target?.id) selector = '#' + event.target.id;
    else if (event.target?.selectors?.length > 0) selector = event.target.selectors[0];
    else if (event.target?.xpath) selector = event.target.xpath;

    if (selector) {
        navigator.clipboard.writeText(selector);
        copiedIndex.value = index;
        setTimeout(() => {
            if (copiedIndex.value === index) copiedIndex.value = null;
        }, 2000);
    }
};

const updateHighlightPosition = () => {
    if (!highlightElement.value) return;
    const rect = highlightElement.value.getBoundingClientRect();
    if (highlightRect.value) {
        // Use fixed positioning - no need to add scroll offsets
        highlightRect.value.x = rect.left - 4;
        highlightRect.value.y = rect.top - 4;
        highlightRect.value.w = rect.width + 8;
        highlightRect.value.h = rect.height + 8;
    }
};

const findElementByEvent = (event: any): HTMLElement | null => {
    let el: HTMLElement | null = null;

    // Try different selector strategies in priority order
    if (event.target?.testAttr?.selector) {
        try { el = document.querySelector(event.target.testAttr.selector) as HTMLElement; } catch(e) {}
    }
    if (!el && event.target?.id) {
        el = document.getElementById(event.target.id);
    }
    if (!el && event.target?.selectors?.length > 0) {
        try { el = document.querySelector(event.target.selectors[0]) as HTMLElement; } catch(e) {}
    }
    if (!el && event.target?.xpath) {
        try { el = document.evaluate(event.target.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement; } catch (e) {}
    }

    return el;
};

const clearHighlight = () => {
    highlightRect.value = null;
    highlightEvent.value = null;
    highlightElement.value = null;
    if (highlightUpdateInterval.value) {
        clearInterval(highlightUpdateInterval.value);
        highlightUpdateInterval.value = null;
    }
};

const inspectEvent = (event: any, index: number) => {
    const el = findElementByEvent(event);

    if (el) {
        console.log(`%c[Signal Recorder]%c Inspected Element (Row ${index + 1}):`, 'color:#4ca6ff;font-weight:bold', 'color:inherit', el);
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        highlightElement.value = el;
        const rect = el.getBoundingClientRect();
        highlightRect.value = {
            x: rect.left - 4,
            y: rect.top - 4,
            w: rect.width + 8,
            h: rect.height + 8,
            desc: getEventLabel(event)
        };
        highlightEvent.value = event;

        // Start dynamic position update
        if (highlightUpdateInterval.value) clearInterval(highlightUpdateInterval.value);
        highlightUpdateInterval.value = window.setInterval(updateHighlightPosition, 100);
    } else {
        console.warn(`%c[Signal Recorder]%c Element not found for event (Row ${index + 1})`, 'color:#4ca6ff;font-weight:bold', 'color:#f87171');
    }
};

const highlightTarget = (event: any, index: number) => {
    if (!event) {
        clearHighlight();
        return;
    }

    const el = findElementByEvent(event);

    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        highlightElement.value = el;
        const rect = el.getBoundingClientRect();
        highlightRect.value = {
            x: rect.left - 4,
            y: rect.top - 4,
            w: rect.width + 8,
            h: rect.height + 8,
            desc: getEventLabel(event)
        };
        highlightEvent.value = event;

        // Start dynamic position update
        if (highlightUpdateInterval.value) clearInterval(highlightUpdateInterval.value);
        highlightUpdateInterval.value = window.setInterval(updateHighlightPosition, 100);
    }
};

const removeEvent = (index: number) => {
    chrome.runtime.sendMessage({ action: 'replayRemoveEvent', tabId: props.tabId, eventIndex: index }, (response) => {
        if (response && response.status === 'removed') {
            localEvents.value.splice(index, 1);
            emit('removed', index, response.events);
        }
    });
};

const showElementNotFoundWarning = (message: string) => {
    elementNotFoundWarning.value = message;
    if (elementWarningTimeout) clearTimeout(elementWarningTimeout);
    elementWarningTimeout = window.setTimeout(() => {
        elementNotFoundWarning.value = '';
    }, 8000);
};

const clearElementWarning = () => {
    elementNotFoundWarning.value = '';
    if (elementWarningTimeout) clearTimeout(elementWarningTimeout);
};

const setNavigationState = (navigating: boolean) => {
    isNavigating.value = navigating;
};

const setDOMLoadingState = (loading: boolean) => {
    isWaitingForDOM.value = loading;
};

// Expose functions for external calls from content script
(window as any)._replayWidgetShowElementWarning = showElementNotFoundWarning;
(window as any)._replayWidgetClearElementWarning = clearElementWarning;
(window as any)._replayWidgetSetNavigating = setNavigationState;
(window as any)._replayWidgetSetDOMLoading = setDOMLoadingState;

const getEventLabel = (e: any) => {
    let descText = '';
    if (e.target) {
        if (e.target.attributes) {
            if (e.target.attributes['aria-label']) descText = e.target.attributes['aria-label'];
            else if (e.target.attributes['title']) descText = e.target.attributes['title'];
            else if (e.target.attributes['name']) descText = e.target.attributes['name'];
            else if (e.target.attributes['placeholder']) descText = e.target.attributes['placeholder'];
        }
        if (!descText && e.target.innerText) {
            descText = e.target.innerText.replace(/\s+/g, ' ').trim();
        }
        if (descText && descText.length > 30) {
            descText = descText.substring(0, 30) + '...';
        }
    }

    if (e.type === 'click') {
        return 'Click ' + (descText ? '"' + descText + '"' : (e.target?.tagName ? '<' + e.target.tagName.toLowerCase() + '>' : ''));
    } else {
        return 'Input ' + (descText ? 'on "' + descText + '"' : (e.target?.tagName ? '<' + e.target.tagName.toLowerCase() + '>' : '')) + (e.value ? ' → "' + e.value.substring(0, 20) + '"' : '');
    }
};

const getEventClasses = (index: number) => {
    const status = eventStatuses.value[index];
    if (status === 'countdown') return 'countdown';
    if (status) return status;
    return '';
};

const getEventStatusIcon = (index: number) => {
    // Countdown is now handled in the template, not here
    if (eventStatuses.value[index] === 'done') return '<span class="sr-event-status-done">✓</span>';
    if (eventStatuses.value[index] === 'error') return '<span class="sr-event-status-error">✗</span>';
    if (eventStatuses.value[index] === 'active') return '<span class="sr-event-status-active">▶</span>';
    return `<span class="sr-event-status-number">${index+1}</span>`;
};

const getTypeBadgeClasses = (type: string) => {
    switch (type.toLowerCase()) {
        case 'click': return 'sr-event-type-badge bg-purple';
        case 'input': return 'sr-event-type-badge bg-blue';
        case 'keydown': return 'sr-event-type-badge bg-emerald';
        default: return 'sr-event-type-badge bg-slate';
    }
};

const getEventLabelShort = (event: any) => {
    const fullLabel = getEventLabel(event);
    if (fullLabel.startsWith('Click ')) return fullLabel.substring(6);
    if (fullLabel.startsWith('Input ')) return fullLabel.substring(6);
    return event.type;
};

const getEventLabelDesc = (event: any) => {
    let desc = '';
    if (event.target?.testAttr?.selector) desc = event.target.testAttr.selector;
    else if (event.target?.id) desc = '#' + event.target.id;
    else if (event.target?.selectors && event.target.selectors.length > 0) desc = event.target.selectors[0];
    else if (event.target?.xpath) desc = event.target.xpath;

    if (event.type === 'input' && event.value) desc += ` → "${event.value}"`;
    return desc || 'coordinates';
};

const isCountdown = (index: number) => eventStatuses.value[index] === 'countdown';
const isError = (index: number) => eventStatuses.value[index] === 'error';

// External Controller Methods (Called by Background script -> map back here)
const updateEvent = (index: number, status: string, total: number, errorMessage?: string) => {
    // Clear countdowns
    for (const key in eventStatuses.value) {
        if (eventStatuses.value[key] === 'countdown') delete eventStatuses.value[key];
    }

    eventStatuses.value[index] = status;

    // Store error message if status is error
    if (status === 'error' && errorMessage) {
        eventErrors.value[index] = errorMessage;
    }

    if (status === 'active') {
        isStarting.value = false;
        footerMessage.value = `Executing event ${index + 1} of ${total}...`;
        scrollToActiveRow(index);
    }
    // Clear highlight when event completes (done or error)
    if (status === 'done' || status === 'error') {
        clearHighlight();
    }
};

const setCountdown = (index: number, duration: number) => {
    eventStatuses.value[index] = 'countdown';
    countdownValues.value[index] = Math.ceil(duration / 1000);
    scrollToActiveRow(index);

    // Start countdown timer if not already running
    if (!countdownInterval.value) {
        countdownInterval.value = window.setInterval(() => {
            // Don't countdown if paused
            if (isPaused.value) return;

            let hasActiveCountdown = false;
            for (const key in countdownValues.value) {
                const idx = parseInt(key);
                if (eventStatuses.value[idx] === 'countdown' && countdownValues.value[idx] > 0) {
                    countdownValues.value[idx]--;
                    hasActiveCountdown = true;
                }
            }
            // Stop interval if no active countdowns
            if (!hasActiveCountdown && countdownInterval.value) {
                clearInterval(countdownInterval.value);
                countdownInterval.value = null;
            }
        }, 1000);
    }
};

const scrollToActiveRow = (index: number) => {
    nextTick(() => {
        if (!listEl.value) return;
        const rows = listEl.value.children;
        if (rows && rows[index]) {
            const row = rows[index] as HTMLElement;
            const top = row.offsetTop - listEl.value.offsetTop;
            if (top > listEl.value.scrollTop + listEl.value.clientHeight || top < listEl.value.scrollTop) {
                listEl.value.scrollTop = top - 30; // buffer
            }
        }
    });
};

const setFinished = (total: number, errs: number) => {
    errorCount.value = errs;
    isFinished.value = true;
    executing.value = false;
    isStarting.value = false;
    if (errs > 0) {
        footerType.value = 'error';
        footerMessage.value = `Replay finished with ${errs} error(s). Use ↻ to retry specific events.`;
    } else {
        footerType.value = 'success';
        footerMessage.value = `All ${total} events replayed successfully!`;
    }
};

const setCancelled = (completed: number, total: number) => {
    executing.value = false;
    isFinished.value = true;
    isStarting.value = false;
    footerType.value = 'cancelled';
    footerMessage.value = `Replay cancelled. Completed ${completed} of ${total} events.`;
};
</script>

<style scoped>
#signal-replay-widget {
    --bg-deep: #1a1d23;
    --glass-border: rgba(59, 130, 246, 0.15);
    background: rgba(26, 29, 35, 0.95);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: white;
    width: 100%;
    min-width: 320px;
    max-width: 460px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 32px);
}

@media (max-width: 768px) {
    #signal-replay-widget {
        min-width: 280px;
        max-width: calc(100vw - 32px);
        border-radius: 12px;
    }
}

@media (max-width: 480px) {
    #signal-replay-widget {
        min-width: 260px;
        max-width: calc(100vw - 16px);
        border-radius: 8px;
    }
}

#signal-replay-widget * {
   box-sizing: border-box;
}

.sr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(59, 130, 246, 0.1);
    cursor: move;
}

@media (max-width: 768px) {
    .sr-header {
        padding: 18px 20px;
    }
}

@media (max-width: 480px) {
    .sr-header {
        padding: 14px 16px;
    }
}

.sr-header.dragging {
    opacity: 0.8;
}

.sr-title-container {
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: none;
}

.sr-title-icon-wrapper {
    background: rgba(59, 130, 246, 0.2);
    padding: 6px;
    border-radius: 8px;
    color: #3b82f6;
}

@media (max-width: 480px) {
    .sr-title-icon-wrapper {
        display: none;
    }
}

.sr-title-text {
    color: white;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: -0.025em;
    line-height: 1.25;
    margin: 0;
}

@media (max-width: 480px) {
    .sr-title-text {
        font-size: 14px;
    }
}

.sr-title-subtext {
    font-size: 9px;
    color: rgba(59, 130, 246, 0.7);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-top: 1px;
    margin-bottom: 0;
}

.sr-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.sr-counter-badge {
    background: rgba(59, 130, 246, 0.1);
    padding: 4px 10px;
    border-radius: 9999px;
    border: 1px solid rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    font-weight: 700;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
}

.sr-icon-btn {
    color: #64748b;
    padding: 4px;
    transition: color 0.2s;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.sr-icon-btn:hover {
    color: white;
}

/* Loading and Warning Banners */
.sr-loading-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.1), rgba(96, 165, 250, 0.1));
    border-bottom: 1px solid rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    font-size: 13px;
    font-weight: 500;
}

.sr-loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(96, 165, 250, 0.3);
    border-top-color: #60a5fa;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.sr-warning-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: linear-gradient(90deg, rgba(251, 191, 36, 0.15), rgba(252, 211, 77, 0.1));
    border-bottom: 1px solid rgba(251, 191, 36, 0.3);
    color: #fbbf24;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
}

.sr-warning-banner svg {
    flex-shrink: 0;
}

.sr-toolbar {
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(59, 130, 246, 0.1);
}

@media (max-width: 768px) {
    .sr-toolbar {
        padding: 12px 18px;
    }
}

@media (max-width: 480px) {
    .sr-toolbar {
        padding: 10px 14px;
        flex-wrap: wrap;
        gap: 8px;
    }
}

.sr-toolbar-group {
    display: flex;
    align-items: center;
    gap: 12px;
}

.sr-toolbar-label {
    font-size: 11px;
    font-weight: 900;
    color: #64748b;
    letter-spacing: 0.05em;
}

.sr-delay-select {
    background: #1e293b;
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 12px;
    font-weight: 700;
    color: #3b82f6;
    cursor: pointer;
    outline: none;
    transition: all 0.2s;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.sr-delay-select:hover {
    background: rgba(59, 130, 246, 0.1);
}

.sr-action-btn-skip {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 16px;
    border-radius: 8px;
    background: #1e293b;
    color: #cbd5e1;
    border: 1px solid rgba(51, 65, 85, 0.5);
    gap: 8px;
    transition: all 0.2s;
    cursor: pointer;
}

.sr-action-btn-skip:hover {
    background: #334155;
    color: white;
}

.sr-action-btn-skip span {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
}

.sr-action-btn-stop {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    transition: all 0.2s;
    cursor: pointer;
}

.sr-action-btn-stop:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
}

.sr-progress-track {
    height: 4px;
    width: 100%;
    background: rgba(15, 23, 42, 0.5);
}

.sr-progress-fill {
    height: 100%;
    transition: all 0.3s ease-out;
}

.sr-event-list {
    flex: 1;
    max-height: 320px;
    overflow-y: auto;
}

@media (max-width: 768px) {
    .sr-event-list {
        max-height: 280px;
    }
}

@media (max-width: 480px) {
    .sr-event-list {
        max-height: 240px;
    }
}

.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.3);
    border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.5);
}

.sr-event-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background-color 0.2s;
}

@media (max-width: 768px) {
    .sr-event-row {
        gap: 12px;
        padding: 12px 18px;
    }
}

@media (max-width: 480px) {
    .sr-event-row {
        gap: 10px;
        padding: 10px 14px;
    }
}

.sr-event-row:hover {
    background: rgba(255, 255, 255, 0.03);
}

.sr-event-row.skipped {
    opacity: 0.5;
    filter: grayscale(100%);
}

.sr-event-row.sr-event-countdown {
    background: rgba(59, 130, 246, 0.08);
    border-left: 3px solid #3b82f6;
    animation: sr-row-countdown-glow 2s ease-in-out infinite;
}

.sr-event-row.sr-event-active {
    background: rgba(59, 130, 246, 0.12);
    border-left: 3px solid #60a5fa;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
}

@keyframes sr-row-countdown-glow {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.1);
    }
    50% {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
    }
}

.sr-event-status-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 9999px;
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(51, 65, 85, 0.5);
    color: #94a3b8;
    flex-shrink: 0;
}

.sr-event-status-number {
    font-size: 10px;
    font-weight: 700;
    opacity: 0;
    transition: opacity 0.2s;
}

.sr-event-row:hover .sr-event-status-number {
    opacity: 1;
}

.sr-event-status-countdown {
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    color: #3b82f6;
    animation: sr-countdown-pulse 1s ease-in-out infinite;
}

/* Interactive countdown with hover play button */
.sr-countdown-interactive {
    cursor: pointer;
    transition: all 0.2s ease;
}

.sr-countdown-interactive:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.5);
    transform: scale(1.05);
}

.sr-countdown-number {
    font-size: 11px;
    font-weight: 800;
    color: #3b82f6;
    position: relative;
    z-index: 1;
    transition: opacity 0.2s;
}

.sr-countdown-play-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(59, 130, 246, 0.9);
    border-radius: 9999px;
    opacity: 0;
    transition: opacity 0.2s;
    color: white;
}

.sr-countdown-interactive:hover .sr-countdown-number {
    opacity: 0;
}

.sr-countdown-interactive:hover .sr-countdown-play-overlay {
    opacity: 1;
}

.sr-countdown-interactive:active {
    transform: scale(0.95);
}

.sr-event-status-done { font-size: 12px; font-weight: 700; color: #34d399; }
.sr-event-status-error { font-size: 12px; font-weight: 700; color: #ef4444; }
.sr-event-status-active { font-size: 12px; font-weight: 700; color: #3b82f6; animation: sr-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

@keyframes sr-countdown-pulse {
    0%, 100% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.1);
        opacity: 0.8;
    }
}

.sr-event-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: hidden;
}

.sr-event-content-header {
    display: flex;
    align-items: center;
    gap: 8px;
}

.sr-event-type-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    border: 1px solid transparent;
}

.sr-event-type-badge.bg-purple { background: rgba(168, 85, 247, 0.2); color: #c084fc; border-color: rgba(168, 85, 247, 0.3); }
.sr-event-type-badge.bg-blue { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border-color: rgba(59, 130, 246, 0.3); }
.sr-event-type-badge.bg-emerald { background: rgba(16, 185, 129, 0.2); color: #34d399; border-color: rgba(16, 185, 129, 0.3); }
.sr-event-type-badge.bg-slate { background: rgba(100, 116, 139, 0.2); color: #94a3b8; border-color: rgba(100, 116, 139, 0.3); }

.sr-event-title {
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sr-event-desc {
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    margin: 0;
}

.sr-event-error {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 6px;
    padding: 6px 10px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    font-size: 11px;
    color: #f87171;
    line-height: 1.4;
}

.sr-event-error svg {
    flex-shrink: 0;
    margin-top: 1px;
}

.sr-event-error span {
    flex: 1;
    word-break: break-word;
}

@media (max-width: 480px) {
    .sr-event-error {
        font-size: 10px;
        padding: 4px 8px;
    }
}

.sr-event-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    opacity: 0.2;
    transition: opacity 0.2s;
}

.sr-event-row:hover .sr-event-actions {
    opacity: 1;
}

@media (max-width: 480px) {
    .sr-event-actions {
        opacity: 0.5;
        gap: 4px;
    }

    .sr-row-action-btn {
        width: 28px;
        height: 28px;
    }
}

.sr-row-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: rgba(30, 41, 59, 0.5);
    color: #94a3b8;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.sr-row-action-btn:hover, .sr-row-action-btn.hover-primary:hover {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
}

.sr-row-action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.sr-row-action-btn:disabled:hover {
    color: #94a3b8;
    background: rgba(30, 41, 59, 0.5);
}

.sr-row-action-btn.danger {
    background: rgba(239, 68, 68, 0.1);
    color: rgba(248, 113, 113, 0.7);
}

.sr-row-action-btn.danger:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.2);
}

.sr-row-action-btn.sr-pause-btn {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
}

.sr-row-action-btn.sr-pause-btn:hover {
    background: rgba(59, 130, 246, 0.25);
    color: #3b82f6;
}

.sr-footer {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(255, 255, 255, 0.01);
}

@media (max-width: 768px) {
    .sr-footer {
        padding: 18px;
        gap: 12px;
    }
}

@media (max-width: 480px) {
    .sr-footer {
        padding: 14px;
        gap: 10px;
    }
}

.sr-primary-btn {
    width: 100%;
    background: #3b82f6;
    color: white;
    font-weight: 700;
    padding: 10px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none;
    cursor: pointer;
    box-shadow: 0 0 25px rgba(59, 130, 246, 0.35);
    transition: all 0.2s;
}

.sr-primary-btn:hover {
    background: #2563eb;
}

.sr-primary-btn:active {
    transform: scale(0.98);
}

.sr-primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.sr-primary-btn span {
    font-size: 13px;
    letter-spacing: 0.025em;
}

@media (max-width: 480px) {
    .sr-primary-btn {
        padding: 12px;
    }

    .sr-primary-btn span {
        font-size: 13px;
    }
}

.sr-secondary-btn {
    width: 100%;
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
    font-weight: 700;
    padding: 10px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.sr-secondary-btn:hover {
    background: rgba(59, 130, 246, 0.3);
}

.sr-secondary-btn:active {
    transform: scale(0.98);
}

.sr-toggle-issues-btn {
    width: 100%;
    background: rgba(250, 56, 62, 0.2);
    color: #fa383e;
    border: 1px solid rgba(250, 56, 62, 0.3);
    font-weight: 600;
    padding: 8px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
}

.sr-toggle-issues-btn:hover {
    background: rgba(250, 56, 62, 0.3);
}

.sr-toggle-issues-btn:active {
    transform: scale(0.98);
}

.sr-footer-message {
    text-align: center;
    font-size: 12px;
    font-style: italic;
    margin: 0;
}

.text-red-400 { color: #f87171; }
.text-slate-500 { color: #64748b; }
.text-emerald-400 { color: #34d399; }
.text-primary { color: #3b82f6; }

@keyframes sr-pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: .5;
    }
}

#signal-replay-highlight {
    position: fixed;
    border: 3px solid #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 4px;
    z-index: 2147483647;
    pointer-events: none;
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.5), inset 0 0 10px rgba(59, 130, 246, 0.2);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    animation: sr-highlight-pulse 1.5s ease-in-out infinite;
}

@keyframes sr-highlight-pulse {
    0% {
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.5), inset 0 0 10px rgba(59, 130, 246, 0.2);
        border-color: #3b82f6;
    }
    50% {
        box-shadow: 0 0 30px rgba(59, 130, 246, 0.8), 0 0 60px rgba(59, 130, 246, 0.4), inset 0 0 20px rgba(59, 130, 246, 0.3);
        border-color: #60a5fa;
    }
    100% {
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.5), inset 0 0 10px rgba(59, 130, 246, 0.2);
        border-color: #3b82f6;
    }
}

#signal-replay-highlight-label {
    position: fixed;
    background: #1a1d23;
    color: #fff;
    padding: 6px 12px;
    border-radius: 6px;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px;
    white-space: nowrap;
    z-index: 2147483647;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid rgba(59, 130, 246, 0.3);
    display: flex;
    align-items: center;
    font-weight: 600;
}

.sr-highlight-text {
    font-size: 12px;
    font-weight: 600;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
</style>
