<template>
  <div v-show="isVisible && !isReplaying" class="signal-widget" :class="[isRecording ? 'recording' : 'idle']">
    <div class="drag-handle" v-html="icons.drag"></div>

    <!-- IDLE STATE -->
    <template v-if="!isRecording">
      <div 
        class="widget-btn start-btn" 
        @click.stop="startRecording"
        @mousedown.stop
        :style="{ pointerEvents: isStarting ? 'none' : 'auto', opacity: isStarting ? '0.7' : '1' }"
      >
        <span v-if="!isStarting" v-html="icons.record" class="icon-wrapper"></span>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" class="icon-wrapper">
          <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" fill="currentColor" style="animation:spin 1s linear infinite"/>
        </svg>
        {{ isStarting ? 'Starting...' : 'Start' }}
      </div>
      
      <div class="screenshot-wrapper">
        <div class="widget-btn screenshot-btn" @click.stop="toggleMenu" @mousedown.stop>
          <span v-html="icons.screenshot" class="icon-wrapper"></span>
          Screenshot
          <span v-html="icons.chevron" class="icon-wrapper"></span>
        </div>
        
        <!-- Screenshot Dropdown Menu -->
        <div v-show="showMenu" class="screenshot-menu">
          <div class="screenshot-menu-item" @click.stop="takeScreenshot('visible')" @mousedown.stop>Visible Area</div>
          <div class="screenshot-menu-item" @click.stop="takeScreenshot('region')" @mousedown.stop>Selected Area</div>
          <div class="screenshot-menu-item" @click.stop="takeScreenshot('full')" @mousedown.stop>Whole Page</div>
        </div>
      </div>
    </template>

    <!-- RECORDING STATE -->
    <template v-else>
      <div 
        class="widget-btn stop-btn" 
        @click.stop="stopRecording"
        @mousedown.stop
        :style="{ pointerEvents: isStopping ? 'none' : 'auto', opacity: isStopping ? '0.7' : '1' }"
      >
        <span v-if="!isStopping" v-html="isPaused ? icons.pause : icons.stop" class="icon-wrapper"></span>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" class="icon-wrapper">
          <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" fill="currentColor" style="animation:spin 1s linear infinite"/>
        </svg>
        {{ isStopping ? 'Generating Report...' : (isPaused ? 'Paused' : 'Recording') }}
      </div>
      
      <div 
        v-if="!isStopping"
        class="widget-btn report-btn" 
        @click.stop="createReport"
        @mousedown.stop
      >
        <span v-html="icons.report" class="icon-wrapper"></span>
        Report
      </div>
      
      <div v-if="!isStopping" class="widget-btn cancel-btn" @click.stop="cancelRecording" @mousedown.stop title="Discard Recording">
        <span v-html="icons.cancel" class="icon-wrapper"></span>
        Cancel
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { contentState } from '../composables/useContentState';

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
const isVisible = computed(() => contentState.showWidget);
const isRecording = computed(() => contentState.isRecording);
const isReplaying = computed(() => contentState.isReplaying);
const isPaused = computed(() => contentState.isPaused);
const currentMode = computed(() => contentState.currentMode);

const isStarting = ref(false);
const isStopping = ref(false);
const showMenu = ref(false);

// ------------------------------------------------------------------
// Icons (Ported from content.js)
// ------------------------------------------------------------------
const icons = {
  record: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444"><path d="M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2Z"/></svg>`,
  stop: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#2e89ff"><path d="M6,6h12v12H6Z"/></svg>`,
  pause: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6,19h4V5H6v14Zm8,-14v14h4V5h-4Z"/></svg>`,
  screenshot: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4,4h3l2,-2h6l2,2h3c1.1,0 2,0.9 2,2v12c0,1.1 -0.9,2 -2,2H4c-1.1,0 -2,-0.9 -2,-2V6c0,-1.1 0.9,-2 2,-2Zm8,3c-2.76,0 -5,2.24 -5,5s2.24,5 5,5 5,-2.24 5,-5 -2.24,-5 -5,-5Zm0,8c-1.65,0 -3,-1.35 -3,-3s1.35,-3 3,-3 3,1.35 3,3 -1.35,3 -3,3Z"/></svg>`,
  report: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#f0ad4e"><path d="M20,8h-2.81c-0.45,-0.78 -1.07,-1.45 -1.82,-1.96L17,4.41 15.59,3l-2.17,2.17C12.96,5.06 12.49,5 12,5c-0.49,0 -0.96,0.06 -1.41,0.17L8.41,3 7,4.41l1.62,1.63C7.88,6.55 7.26,7.22 6.81,8H4v2h2.09c-0.05,0.33 -0.09,0.66 -0.09,1v1H4v2h2v1c0,0.34 0.04,0.67 0.09,1H4v2h2.81c1.04,1.79 2.97,3 5.19,3s4.15,-1.21 5.19,-3H20v-2h-2.09c0.05,-0.33 0.09,-0.66 0.09,-1v-1h2v-2h-2v-1c0,-0.34 -0.04,-0.67 -0.09,-1H20V8Zm-6,8h-4v-2h4v2Zm0,-4h-4v-2h4v2Z"/></svg>`,
  drag: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11,18c0,1.1 -0.9,2 -2,2s-2,-0.9 -2,-2 0.9,-2 2,-2 2,0.9 2,2Zm-2,-8c-1.1,0 -2,0.9 -2,2s0.9,2 2,2 2,-0.9 2,-2 -0.9,-2 -2,-2Zm0,-6c-1.1,0 -2,0.9 -2,2s0.9,2 2,2 2,-0.9 2,-2 -0.9,-2 -2,-2Zm6,4c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2Zm0,2c-1.1,0 -2,0.9 -2,2s0.9,2 2,2 2,-0.9 2,-2 -0.9,-2 -2,-2Zm0,6c-1.1,0 -2,0.9 -2,2s0.9,2 2,2 2,-0.9 2,-2 -0.9,-2 -2,-2Z"/></svg>`,
  cancel: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19,6.41L17.59,5 12,10.59 6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 12,13.41 17.59,19 19,17.59 13.41,12z"/></svg>`,
  chevron: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7,10l5,5 5,-5z"/></svg>`
};

// ------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------
const startRecording = () => {
  isStarting.value = true;
  window.dispatchEvent(new CustomEvent('signal-start-recording'));
  setTimeout(() => { isStarting.value = false; }, 10000);
};

const stopRecording = () => {
  if (isStopping.value) return;
  isStopping.value = true;
  window.dispatchEvent(new CustomEvent('signal-stop-recording'));
  setTimeout(() => { isStopping.value = false; }, 10000);
};

const cancelRecording = () => {
  window.dispatchEvent(new CustomEvent('signal-cancel-recording'));
};

const createReport = () => {
  console.log('[Signal Widget] Creating report - dispatching signal-create-report event');
  window.dispatchEvent(new CustomEvent('signal-create-report'));
};

// Screenshot menu
const toggleMenu = () => {
  showMenu.value = !showMenu.value;
};

const takeScreenshot = (type: string) => {
  showMenu.value = false;
  window.dispatchEvent(new CustomEvent('signal-take-screenshot', {
    detail: { type }
  }));
};

// Close menu on outside click
const onDocClick = () => { showMenu.value = false; };
onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));

</script>

<style scoped>
/* Base animations */
@keyframes spin { 
  from { transform: rotate(0deg); } 
  to { transform: rotate(360deg); } 
}

/* Widget Container */
.signal-widget {
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
  user-select: none;
}

.signal-widget.idle {
  padding: 6px 12px 6px 6px;
  background: rgba(30, 30, 30, 0.9);
  gap: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);
}

.signal-widget.recording {
  padding: 6px 12px 6px 6px;
  background: rgba(30, 30, 30, 0.9);
  gap: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);
}

/* Drag Handle */
.drag-handle {
  color: rgba(255,255,255,0.5);
  cursor: move;
  margin-right: 4px;
  display: flex;
  align-items: center;
  padding: 2px;
}

/* Buttons */
.widget-btn {
  padding: 6px 12px;
  border-radius: 6px; /* Material design border radius */
  color: #e8eaed; /* Material dark theme text */
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  gap: 6px;
  align-items: center;
  background: transparent;
  transition: background 0.2s, color 0.2s;
  font-family: 'Roboto', 'Segoe UI', sans-serif;
}

.widget-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* SVG deep selector to ensure inner svgs match the color properly if needed */
:deep(svg) {
  display: block;
}

/* Screenshot Menu Options */
.screenshot-wrapper {
  position: relative;
  display: flex;
}

.screenshot-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 140px;
  backdrop-filter: blur(8px);
  z-index: 100;
}

.screenshot-menu-item {
  color: #e8eaed;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
  font-family: 'Roboto', 'Segoe UI', sans-serif;
}

.screenshot-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
