<template>
  <div v-if="isVisible" class="issue-dialog-overlay">
    <div class="issue-dialog">
      <div class="header">
        <label>Report Issue</label>
        <div class="subtitle">Describe the problem in the selected area.</div>
      </div>

      <!-- Resolved Elements Info -->
      <div v-if="resolvedInfo && resolvedInfo.resolvedElements.length > 0" class="resolved-elements">
        <div class="resolved-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{{ resolvedInfo.resolvedElements.length }} element(s) identified</span>
        </div>
        <div class="resolved-primary" v-if="resolvedInfo.primaryElement">
          <code>&lt;{{ resolvedInfo.primaryElement.tagName }}&gt;</code>
          <span v-if="resolvedInfo.primaryElement.textContent" class="element-text">
            {{ resolvedInfo.primaryElement.textContent.substring(0, 40) }}{{ resolvedInfo.primaryElement.textContent.length > 40 ? '...' : '' }}
          </span>
        </div>
      </div>

      <div class="form-group">
        <label for="current-state">Current State</label>
        <textarea
          id="current-state"
          ref="currentStateInput"
          v-model="currentState"
          rows="2"
          class="issue-textarea"
          placeholder="What do you see? (e.g., 'Price shows $0.00')"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="desired-state">Expected State</label>
        <textarea
          id="desired-state"
          v-model="desiredState"
          rows="2"
          class="issue-textarea"
          placeholder="What should it be? (e.g., 'Price should show $29.99')"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="additional-notes">Additional Notes (Optional)</label>
        <textarea
          id="additional-notes"
          v-model="comment"
          rows="2"
          class="issue-textarea"
          placeholder="Any other details..."
          @keydown="handleKeydown"
        ></textarea>
      </div>

      <div class="actions">
        <button class="btn-cancel" @click="cancel">Cancel</button>
        <button class="btn-submit" @click="submit" :disabled="!canSubmit">Report Issue</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue';
import { useHighlightResolver, type HighlightResolution } from '../composables/useHighlightResolver';

const isVisible = ref(false);
const rect = ref<any>(null);
let cleanupFn: (() => void) | null = null;

const emit = defineEmits(['submit', 'cancel']);

const currentState = ref('');
const desiredState = ref('');
const comment = ref('');
const resolvedInfo = ref<HighlightResolution | null>(null);
const currentStateInput = ref<HTMLTextAreaElement | null>(null);

const { resolveHighlightToElements } = useHighlightResolver();

const canSubmit = computed(() => {
    return currentState.value.trim().length > 0 || desiredState.value.trim().length > 0;
});

const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        submit();
    }
};

const open = (newRect: any, cleanup?: () => void) => {
    rect.value = newRect;
    currentState.value = '';
    desiredState.value = '';
    comment.value = '';
    resolvedInfo.value = null;
    isVisible.value = true;
    cleanupFn = cleanup || null;

    // Resolve elements from highlight
    try {
        resolvedInfo.value = resolveHighlightToElements(newRect);
    } catch (e) {
        console.warn('[Signal] Failed to resolve highlighted elements:', e);
    }
};

const close = () => {
    isVisible.value = false;
    currentState.value = '';
    desiredState.value = '';
    comment.value = '';
    resolvedInfo.value = null;
    // Call cleanup function to remove selection box
    if (cleanupFn) {
        cleanupFn();
        cleanupFn = null;
    }
};

const submit = () => {
    if (!canSubmit.value) return;

    const issueData = {
        currentState: currentState.value.trim(),
        desiredState: desiredState.value.trim(),
        comment: comment.value.trim(),
        rect: rect.value,
        resolvedElements: resolvedInfo.value?.resolvedElements || [],
        primaryElement: resolvedInfo.value?.primaryElement || null,
        selectedText: resolvedInfo.value?.selectedText || null
    };

    emit('submit', issueData);
    close();
};

const cancel = () => {
    emit('cancel');
    close();
};

watch(isVisible, (newVal) => {
    if (newVal) {
        nextTick(() => {
            currentStateInput.value?.focus();
        });
    }
});

defineExpose({
    open,
    close,
    isVisible
});
</script>

<style scoped>
.issue-dialog-overlay {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 18px;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  z-index: 2147483648;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
}

.header label {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  display: block;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 13px;
  color: #666;
}

.resolved-elements {
  background: #f0f7ff;
  border: 1px solid #b8d4f1;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
}

.resolved-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #0066cc;
  font-weight: 600;
  margin-bottom: 6px;
}

.resolved-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.resolved-primary code {
  background: rgba(0, 102, 204, 0.1);
  color: #0066cc;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.element-text {
  color: #555;
  font-size: 11px;
  font-style: italic;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.issue-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 10px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
  color: #1a1a1a;
  background-color: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.issue-textarea:focus {
  outline: none;
  border-color: #0078d4;
  box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.1);
}

.issue-textarea::placeholder {
  color: #999;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.btn-cancel {
  padding: 8px 16px;
  border: 1px solid #ccc;
  background: #f5f5f5;
  color: #333;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #e8e8e8;
  border-color: #aaa;
}

.btn-submit {
  padding: 8px 18px;
  border: none;
  background: #d13438;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-submit:hover:not(:disabled) {
  background: #b82a2e;
  box-shadow: 0 2px 8px rgba(209, 52, 56, 0.3);
}

.btn-submit:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
