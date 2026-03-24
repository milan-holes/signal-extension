<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content" style="width: 550px">
      <div class="modal-header">
        <span class="modal-title">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            style="margin-right: 8px; vertical-align: middle"
          >
            <path
              d="M3.9,12c0-1.71,1.39-3.1,3.1-3.1h4V7H7c-2.76,0-5,2.24-5,5s2.24,5,5,5h4v-1.9H7C5.29,15.1,3.9,13.71,3.9,12z M8,13h8v-2H8V13z M17,7h-4v1.9h4c1.71,0,3.1,1.39,3.1,3.1s-1.39,3.1-3.1,3.1h-4V17h4c2.76,0,5-2.24,5-5S19.76,7,17,7z"
            />
          </svg>
          Send via Webhook
        </span>
        <span class="close-icon" @click="$emit('close')">✕</span>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group flex-3">
            <label class="field-label">Webhook URL</label>
            <input
              class="form-input"
              v-model="webhookUrl"
              placeholder="https://hooks.example.com/endpoint"
            />
          </div>
          <div class="form-group flex-1">
            <label class="field-label">Method</label>
            <select class="form-input" v-model="method">
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="field-label"
            >Custom Headers (optional, one per line)</label
          >
          <textarea
            class="form-input mono"
            v-model="headers"
            rows="2"
            placeholder="Authorization: Bearer my-token&#10;X-Custom-Header: value"
          ></textarea>
        </div>

        <div class="form-group">
          <label class="field-label">Payload Template (JSON)</label>
          <div class="helper-text">
            Use <code>%export%</code> to attach report data as a file, and
            <code>%screenshot%</code> for a screenshot.
          </div>
          <textarea
            class="form-input mono"
            v-model="payload"
            rows="6"
            placeholder='{&#10;  "file": "%export%",&#10;  "screenshot": "%screenshot%",&#10;  "text": "New debug report"&#10;}'
          ></textarea>
        </div>

        <div v-if="status" :class="['status-msg', status.type]">
          <div v-html="status.text"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="action-btn" @click="$emit('close')">Cancel</button>
        <button class="action-btn primary" @click="send" :disabled="sending">
          <svg
            v-if="!sending"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            style="margin-right: 6px"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
          <svg
            v-else
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            class="spin-icon"
            style="margin-right: 6px"
          >
            <path
              d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"
              fill="currentColor"
            />
          </svg>
          {{ sending ? "Sending..." : "Send Webhook" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  reportData: any;
  screenshot?: string;
}>();

const emit = defineEmits(["close"]);

const webhookUrl = ref(localStorage.getItem("signal_webhook_url") || "");
const method = ref(localStorage.getItem("signal_webhook_method") || "POST");
const headers = ref(localStorage.getItem("signal_webhook_headers") || "");
const payload = ref(
  localStorage.getItem("signal_webhook_payload") ||
    '{\n  "file": "%export%",\n  "screenshot": "%screenshot%",\n  "text": "New debug report"\n}'
);

const sending = ref(false);
const status = ref<{ type: string; text: string } | null>(null);

// Persist settings
watch([webhookUrl, method, headers, payload], () => {
  localStorage.setItem("signal_webhook_url", webhookUrl.value);
  localStorage.setItem("signal_webhook_method", method.value);
  localStorage.setItem("signal_webhook_headers", headers.value);
  localStorage.setItem("signal_webhook_payload", payload.value);
});

async function send() {
  if (!webhookUrl.value.trim()) {
    status.value = { type: "error", text: "URL is required" };
    return;
  }
  if (!props.reportData) {
    status.value = { type: "error", text: "No report data loaded" };
    return;
  }

  let fields: Record<string, string>;
  try {
    fields = JSON.parse(payload.value.trim());
    if (typeof fields !== "object" || Array.isArray(fields)) {
      throw new Error("Payload template must be a JSON object.");
    }
  } catch (parseErr: any) {
    status.value = {
      type: "error",
      text: "Invalid JSON in Payload template: " + parseErr.message,
    };
    return;
  }

  sending.value = true;
  status.value = null;

  const ts = Date.now();
  const formData = new FormData();
  const attachedParts: string[] = [];

  try {
    for (const [fieldName, val] of Object.entries(fields)) {
      if (val === "%export%") {
        const jsonBlob = new Blob([JSON.stringify(props.reportData)], {
          type: "application/json",
        });
        formData.append(fieldName, jsonBlob, `debug-report-${ts}.json`);
        attachedParts.push(fieldName + " (export)");
      } else if (val === "%screenshot%") {
        if (props.screenshot && props.screenshot.startsWith("data:image")) {
          const byteString = atob(props.screenshot.split(",")[1]);
          const mimeType = props.screenshot.split(",")[0].split(":")[1].split(";")[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const screenshotBlob = new Blob([ab], { type: mimeType });
          formData.append(fieldName, screenshotBlob, `screenshot-${ts}.jpg`);
          attachedParts.push(fieldName + " (screenshot)");
        } else {
          attachedParts.push(fieldName + " (no screenshot available)");
        }
      } else {
        formData.append(fieldName, val);
        attachedParts.push(fieldName);
      }
    }

    const customHeaders: Record<string, string> = {};
    if (headers.value.trim()) {
      headers.value
        .trim()
        .split("\n")
        .forEach((line) => {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const val = line.substring(colonIndex + 1).trim();
            if (key && key.toLowerCase() !== "content-type")
              customHeaders[key] = val;
          }
        });
    }

    const res = await fetch(webhookUrl.value.trim(), {
      method: method.value,
      headers: customHeaders,
      body: formData,
    });

    if (res.ok) {
      status.value = {
        type: "success",
        text: `Sent successfully (${res.status})<br><span style="font-size:11px; opacity:0.8;">Fields: ${attachedParts.join(
          ", "
        )}</span>`,
      };
      setTimeout(() => emit("close"), 2500);
    } else {
      const errText = await res.text().catch(() => "");
      status.value = {
        type: "error",
        text: `Failed: ${res.status} ${res.statusText}${
          errText
            ? '<br><span style="font-size:11px; opacity:0.8;">' +
              errText.substring(0, 200) +
              "</span>"
            : ""
        }`,
      };
    }
  } catch (e: any) {
    status.value = { type: "error", text: `Error: ${e.message}` };
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: #1e1e1e;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  max-width: 90%;
  color: #e8eaed;
}
.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
}
.modal-title {
  font-weight: 600;
  font-size: 16px;
  display: flex;
  align-items: center;
}
.close-icon {
  cursor: pointer;
  opacity: 0.6;
  font-size: 18px;
}
.close-icon:hover {
  opacity: 1;
}
.modal-body {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}
.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.flex-3 {
  flex: 3;
}
.flex-1 {
  flex: 1;
}
.form-group {
  margin-bottom: 16px;
}
.field-label {
  font-size: 12px;
  color: #9aa0a6;
  margin-bottom: 6px;
  font-weight: 600;
  display: block;
}
.helper-text {
  font-size: 11px;
  color: #80868b;
  margin-bottom: 6px;
}
.helper-text code {
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 3px;
  border-radius: 3px;
  color: #e8eaed;
}
.form-input {
  background: #2a2a2a;
  color: #e8eaed;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 10px 12px;
  border-radius: 6px;
  outline: none;
  width: 100%;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}
.form-input:focus {
  border-color: #8ab4f8;
}
.form-input.mono {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}
select.form-input {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%239aa0a6'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 32px;
}
.status-msg {
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-top: 10px;
  line-height: 1.4;
}
.status-msg.success {
  background: rgba(129, 201, 149, 0.1);
  color: #81c995;
  border: 1px solid rgba(129, 201, 149, 0.2);
}
.status-msg.error {
  background: rgba(242, 139, 130, 0.1);
  color: #f28b82;
  border: 1px solid rgba(242, 139, 130, 0.2);
}
.action-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e8eaed;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  font-family: inherit;
}
.action-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}
.action-btn.primary {
  background: #8ab4f8;
  border-color: #8ab4f8;
  color: #1e1e1e;
}
.action-btn.primary:hover {
  background: #93b9f9;
}
.action-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.spin-icon {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
