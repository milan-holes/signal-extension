<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">{{ title }}</span>
        <div style="display:flex; gap:8px; align-items:center;">
          <CopyButton :content="content" label="Copy to Clipboard" primary />
          <span class="close-icon" @click="$emit('close')">✕</span>
        </div>
      </div>
      <div class="modal-body">
        <textarea ref="textareaRef" class="code-editor" readonly :value="content"></textarea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import CopyButton from './CopyButton.vue';

const props = defineProps<{
  visible: boolean;
  title: string;
  content: string;
}>();

defineEmits(['close']);
</script>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: var(--bg-card); display: flex; flex-direction: column; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 10px 40px rgba(0,0,0,0.5); width: 85vw; max-width: 1100px; height: 80vh; }
.modal-header { padding: 12px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-header); border-radius: 8px 8px 0 0; flex-shrink: 0; }
.modal-title { font-weight: 600; color: var(--text-main); font-size: 15px; }
.close-icon { cursor: pointer; opacity: 0.6; font-size: 18px; }
.close-icon:hover { opacity: 1; }
.modal-body { flex: 1; display: flex; overflow: hidden; }
.code-editor { flex: 1; background: var(--bg-input); color: var(--text-main); border: none; padding: 20px; font-family: 'Menlo', 'Monaco', 'Cascadia Code', monospace; font-size: 13px; resize: none; white-space: pre-wrap; overflow: auto; line-height: 1.6; }
</style>
