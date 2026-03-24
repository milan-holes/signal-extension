<template>
  <div class="toast-container">
    <transition-group name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast-item', `toast-${toast.type}`]"
      >
        <div class="toast-icon" v-html="getIcon(toast.type)"></div>
        <div class="toast-body">
          <span class="toast-label">{{ getLabel(toast.type) }}</span>
          <span class="toast-message">{{ truncate(toast.message) }}</span>
        </div>
        <button class="toast-dismiss" @click="dismiss(toast.id)">✕</button>
        <div class="toast-progress">
          <div class="toast-progress-bar" :style="{ animationDuration: '5s' }"></div>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { contentState, removeToast } from '../composables/useContentState';

const toasts = computed(() => contentState.toasts);

const consoleIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10,10-4.48,10-10S17.52,2,12,2Zm1,15h-2v-2h2v2Zm0-4h-2V7h2v6Z"/></svg>`;
const networkIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M1,21h22L12,2,1,21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z"/></svg>`;
const infoIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10,10-4.48,10-10S17.52,2,12,2Zm1,15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg>`;

function getIcon(type: string): string {
  if (type === 'console') return consoleIcon;
  if (type === 'network') return networkIcon;
  if (type === 'info') return infoIcon;
  return infoIcon;
}

function getLabel(type: string): string {
  if (type === 'console') return 'Console Error';
  if (type === 'network') return 'Network Error';
  if (type === 'info') return 'Info';
  return 'Info';
}

function truncate(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function dismiss(id: number) {
  removeToast(id);
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  max-width: 420px;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  font-family: 'Segoe UI', 'Roboto', sans-serif;
  font-size: 13px;
  color: #f0f0f0;
  background: rgba(28, 28, 30, 0.92);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06);
  position: relative;
  overflow: hidden;
  pointer-events: auto;
  animation: toast-slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-console {
  border-left: 3px solid #ef4444;
}

.toast-network {
  border-left: 3px solid #f59e0b;
}

.toast-info {
  border-left: 3px solid #3b82f6;
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-top: 1px;
}

.toast-console .toast-icon {
  color: #ef4444;
}

.toast-network .toast-icon {
  color: #f59e0b;
}

.toast-info .toast-icon {
  color: #3b82f6;
}

.toast-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toast-label {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
}

.toast-message {
  font-size: 12.5px;
  line-height: 1.4;
  word-break: break-word;
  color: #e0e0e0;
}

.toast-dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  transition: color 0.15s;
}

.toast-dismiss:hover {
  color: #ffffff;
}

/* Progress bar */
.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
}

.toast-progress-bar {
  height: 100%;
  width: 100%;
  transform-origin: left;
  animation: toast-shrink 5s linear forwards;
}

.toast-console .toast-progress-bar {
  background: #ef4444;
}

.toast-network .toast-progress-bar {
  background: #f59e0b;
}

.toast-info .toast-progress-bar {
  background: #3b82f6;
}

/* Animations */
@keyframes toast-slide-in {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes toast-shrink {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

/* Vue transition group */
.toast-enter-active {
  animation: toast-slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
