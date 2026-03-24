<template>
  <div v-if="visible">
    <div
      v-for="(issue, index) in issues"
      :key="index"
      class="issue-overlay-marker"
      :style="getIssueStyle(issue)"
      @mouseenter="hoveredIndex = index"
      @mouseleave="hoveredIndex = null"
    >
      <div class="issue-marker-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>

      <!-- Tooltip -->
      <div v-if="hoveredIndex === index" class="issue-tooltip">
        <div class="issue-tooltip-header">
          <span :class="'issue-badge issue-badge-' + getSeverityClass(issue)">
            {{ issue.severity || issue.type || 'info' }}
          </span>
          <span class="issue-time">{{ formatTime(issue.timestamp) }}</span>
        </div>
        <p class="issue-comment">{{ issue.comment || issue.description || 'No details provided' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  issues: any[];
  visible: boolean;
}>();

const hoveredIndex = ref<number | null>(null);
const issuePositions = ref<Record<number, { x: number; y: number; width: number; height: number }>>({});

const initializePositions = () => {
  props.issues.forEach((issue, index) => {
    if (issue.rect) {
      issuePositions.value[index] = { ...issue.rect };
    }
  });
};

const getIssueStyle = (issue: any) => {
  if (!issue.rect) return {};

  const rect = issue.rect;
  // Use absolute positioning with scroll offsets so markers stay with the element
  return {
    left: (rect.x + window.scrollX) + 'px',
    top: (rect.y + window.scrollY) + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px'
  };
};

onMounted(() => {
  initializePositions();
});

onUnmounted(() => {
  // Cleanup if needed
});

const getSeverityClass = (issue: any) => {
  const severity = (issue.severity || issue.type || 'info').toLowerCase();
  if (severity.includes('error') || severity.includes('critical')) return 'error';
  if (severity.includes('warn')) return 'warn';
  return 'info';
};

const formatTime = (ts: number) => {
  if (!ts) return '';
  try {
    let t = ts;
    if (t < 100000000000) t *= 1000;
    return new Date(t).toLocaleTimeString();
  } catch {
    return '';
  }
};

defineExpose({
  hoveredIndex
});
</script>

<style scoped>
.issue-overlay-marker {
  position: absolute;
  border: 3px dashed #fa383e;
  background: rgba(250, 56, 62, 0.1);
  z-index: 2147483645;
  pointer-events: auto;
  cursor: pointer;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.issue-overlay-marker:hover {
  background: rgba(250, 56, 62, 0.2);
  border-color: #ff4d52;
  box-shadow: 0 0 20px rgba(250, 56, 62, 0.4);
}

.issue-marker-icon {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 32px;
  height: 32px;
  background: #fa383e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 2px solid white;
}

.issue-tooltip {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: #1a1d23;
  border: 1px solid rgba(250, 56, 62, 0.3);
  border-radius: 8px;
  padding: 12px;
  min-width: 250px;
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  z-index: 2147483646;
  pointer-events: none;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.issue-tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.issue-badge {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.issue-badge-error {
  background: rgba(250, 56, 62, 0.2);
  color: #f87171;
}

.issue-badge-warn {
  background: rgba(240, 173, 78, 0.2);
  color: #fcd34d;
}

.issue-badge-info {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.issue-time {
  color: #64748b;
  font-size: 11px;
}

.issue-comment {
  color: #e2e8f0;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
