<template>
  <div v-if="isVisible" class="issue-dialog-overlay">
    <div class="issue-dialog">
      <div class="header">
        <label>Report Issue</label>
        <div class="subtitle">Describe the issue found in the selected area.</div>
      </div>
      
      <textarea
        ref="issueInput"
        v-model="comment"
        rows="4"
        class="issue-textarea"
        placeholder="What's wrong here?"
        @keydown="handleKeydown"
      ></textarea>
      
      <div class="actions">
        <button class="btn-cancel" @click="cancel">Cancel</button>
        <button class="btn-submit" @click="submit">Report Issue</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';

const isVisible = ref(false);
const rect = ref<any>(null);

const emit = defineEmits(['submit', 'cancel']);

const comment = ref('');
const issueInput = ref<HTMLTextAreaElement | null>(null);

const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        submit();
    }
};

const open = (newRect: any) => {
    rect.value = newRect;
    comment.value = '';
    isVisible.value = true;
};

const close = () => {
    isVisible.value = false;
    comment.value = '';
};

const submit = () => {
    const finalComment = comment.value.trim() || 'Manually Reported Issue';
    emit('submit', { comment: finalComment, rect: rect.value });
    close();
};

const cancel = () => {
    emit('cancel');
    close();
};

watch(isVisible, (newVal) => {
    if (newVal) {
        nextTick(() => {
            issueInput.value?.focus();
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
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 25px rgba(0,0,0,0.4);
  z-index: 2147483648;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 320px;
  font-family: 'Segoe UI', sans-serif;
}

.header label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: block;
}

.subtitle {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.issue-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  font-family: inherit;
  font-size: 13px;
  resize: none;
  color: #000;
  background-color: #fff;
}
.issue-textarea:focus {
  outline: 2px solid #0078d4;
  border-color: transparent;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.btn-cancel {
  padding: 6px 14px;
  border: 1px solid #ccc;
  background: #f0f0f0;
  color: #333;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}
.btn-cancel:hover { background: #e0e0e0; }

.btn-submit {
  padding: 6px 14px;
  border: none;
  background: #d13438;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.btn-submit:hover { background: #b82a2e; }
</style>
