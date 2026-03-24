<template>
  <button 
    class="action-btn" 
    :class="{ 'copy-icon-btn': !label, 'primary': primary }"
    :style="!label ? 'padding: 4px; color: var(--text-main);' : 'display: flex; align-items: center;'"
    @click.stop="copy" 
    :title="title || 'Copy'"
  >
    <template v-if="copied">
      <span style="font-size:10px; font-weight:bold; color:var(--success);">Copied!</span>
    </template>
    <template v-else>
      <svg 
        style="pointer-events:none;" 
        :style="label ? 'margin-right: 6px;' : ''"
        width="14" height="14" 
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span v-if="label">{{ label }}</span>
    </template>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  content: string;
  label?: string;
  title?: string;
  primary?: boolean;
}>();

const copied = ref(false);

const copy = async () => {
  if (copied.value || !props.content) return;
  
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(props.content);
    } else {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = props.content;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  } catch (err) {
    console.error('Failed to copy', err);
    return;
  }
  
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
};
</script>

<style scoped>
.action-btn {
  background: var(--bg-card);
  color: var(--text-main);
  border: 1px solid var(--border);
  box-shadow: none;
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  padding: 6px 10px;
}
.action-btn:hover {
  background: var(--bg-hover);
}
.action-btn.primary {
  background: var(--primary);
  color: white;
  border: none;
}
.action-btn.primary:hover {
  background: var(--primary-hover);
}
.copy-icon-btn {
  background: transparent;
  border: none;
}
.copy-icon-btn:hover {
  background: var(--bg-hover);
}
</style>
