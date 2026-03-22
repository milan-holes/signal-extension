<template>
    <div class="container">
        <h2>
            Screenshot Editor
            <span style="font-size:12px; font-weight:normal; color:#666;" id="timestamp">{{ timestamp }}</span>
        </h2>

        <div class="toolbar"
            style="display:flex; gap:10px; padding-bottom:10px; justify-content:center; align-items:center;">
            <button id="tool-highlight" class="tool-btn" :class="{ 'active': currentTool === 'highlight' }" title="Highlighter"
                @click="setTool('highlight')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2">
                    <path d="M9 11l-6 6v3h9l-3-3" />
                    <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
                </svg>
            </button>
            <button id="tool-pen" class="tool-btn" :class="{ 'active': currentTool === 'pen' }" title="Pen"
                @click="setTool('pen')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff0000" stroke-width="2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
            </button>
            <button id="tool-text" class="tool-btn" :class="{ 'active': currentTool === 'text' }" title="Add Text"
                @click="setTool('text')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 7V4h16v3" />
                    <path d="M9 20h6" />
                    <path d="M12 4v16" />
                </svg>
            </button>
            <div style="width:1px; background:#ddd; height:24px; margin:0 5px;"></div>
            <button id="tool-clear" class="tool-btn" title="Clear All"
                @click="clearCanvas">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
            </button>
        </div>
        <div class="preview-container" style="position:relative; overflow:auto; max-height:85vh; text-align:center;">
            <canvas ref="editorCanvas" id="editorCanvas" style="max-width:100%; height:auto; display:inline-block;"
                @mousedown="handleMouseDown"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseUp"
                @mouseout="handleMouseOut"
            ></canvas>
        </div>

        <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-weight:600; font-size:13px;">Add Comment / Annotation Note:</label>
            <textarea v-model="commentText" id="commentBox" placeholder="Describe what is shown in this screenshot..."></textarea>
        </div>

        <div class="actions">
            <button class="btn-cancel" id="cancelBtn" @click="closeWindow">Close</button>
            <button class="btn-download" id="jiraBtn" style="background: #0052cc; margin-right:10px;"
                v-if="jiraConfigured" @click="sendToJira">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
                    <path d="M16 16l-4-4" />
                </svg>
                Create JIRA Ticket
            </button>
            <button class="btn-download" id="downloadBtn" @click="downloadFinal">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download Image
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const timestamp = ref('');
const currentTool = ref('highlight');
const isDrawing = ref(false);
const editorCanvas = ref<HTMLCanvasElement | null>(null);
const commentText = ref('');
const jiraConfigured = ref(false);

let ctx: CanvasRenderingContext2D | null = null;
let lastX = 0;
let lastY = 0;
const originalImg = new Image();
let currentHighlightBox: any = null;

const setTool = (tool: string) => { currentTool.value = tool; };

const clearCanvas = () => { initCanvas(currentHighlightBox); };
const closeWindow = () => { window.close(); };

const initCanvas = (highlightBox?: any) => {
    if (highlightBox !== undefined) currentHighlightBox = highlightBox;

    const canvas = editorCanvas.value;
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = originalImg.naturalWidth;
    canvas.height = originalImg.naturalHeight;
    ctx.drawImage(originalImg, 0, 0);

    const aspect = originalImg.naturalWidth / originalImg.naturalHeight;
    if (aspect > 2.0 && originalImg.naturalWidth > 2000) {
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
    } else {
        canvas.style.maxWidth = '100%';
        canvas.style.width = 'auto';
        canvas.style.height = 'auto';
        const container = canvas.closest('.preview-container') as HTMLElement;
        if (container) container.style.maxHeight = 'none';
    }

    if (currentHighlightBox) {
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 5;
        ctx.strokeRect(currentHighlightBox.x, currentHighlightBox.y, currentHighlightBox.width, currentHighlightBox.height);
        ctx.restore();
    }
};

const getPos = (e: MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY
    ];
};

const draw = (x1: number, y1: number, x2: number, y2: number) => {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool.value === 'highlight') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 30;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
    }

    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
};

const handleMouseDown = (e: MouseEvent) => {
    const canvas = editorCanvas.value;
    if (!canvas || !ctx) return;

    if (currentTool.value === 'text') {
        const [x, y] = getPos(e, canvas);
        const text = prompt("Enter text annotation:");
        if (text) {
            ctx.save();
            ctx.font = "bold 24px Arial, sans-serif";
            ctx.fillStyle = "red";
            ctx.strokeStyle = "white";
            ctx.lineWidth = 3;
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
            ctx.restore();
        }
        return;
    }

    isDrawing.value = true;
    const pos = getPos(e, canvas);
    lastX = pos[0];
    lastY = pos[1];
};

const handleMouseMove = (e: MouseEvent) => {
    if (!isDrawing.value) return;
    const canvas = editorCanvas.value;
    if (!canvas) return;
    
    const [x, y] = getPos(e, canvas);
    draw(lastX, lastY, x, y);
    [lastX, lastY] = [x, y];
};

const handleMouseUp = () => { isDrawing.value = false; };
const handleMouseOut = () => { isDrawing.value = false; };

const generateFinalCanvas = () => {
    const canvas = editorCanvas.value;
    if (!canvas) return null;

    const finalCanvas = document.createElement('canvas');
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return null;

    const comment = commentText.value;
    const fontSize = Math.max(16, Math.floor(canvas.width / 40));
    const padding = fontSize;
    const lineHeight = fontSize * 1.5;
    let textHeight = 0;
    let lines: string[] = [];

    if (comment) {
        fctx.font = `${fontSize}px Arial`;
        const words = comment.split(' ');
        let line = '';
        const maxWidth = canvas.width - (padding * 2);

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            if (fctx.measureText(testLine).width > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else { line = testLine; }
        }
        lines.push(line);
        textHeight = (lines.length * lineHeight) + (padding * 2);
    }

    finalCanvas.width = canvas.width;
    finalCanvas.height = canvas.height + textHeight;

    fctx.fillStyle = 'white';
    fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    fctx.drawImage(canvas, 0, 0);

    if (comment) {
        const yStart = canvas.height;
        fctx.fillStyle = 'white';
        fctx.fillRect(0, yStart, finalCanvas.width, textHeight);

        fctx.fillStyle = '#333';
        fctx.font = `${fontSize}px Arial`;
        fctx.textBaseline = 'top';
        let y = yStart + padding;

        lines.forEach(l => {
            fctx.fillText(l.trim(), padding, y);
            y += lineHeight;
        });
    }

    return finalCanvas;
};

const downloadFinal = () => {
    const finalCanvas = generateFinalCanvas();
    if (!finalCanvas) return;

    const finalUrl = finalCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = `annotated-screenshot-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    chrome.runtime.sendMessage({
        action: "recordIssue",
        issue: { timestamp: Date.now(), type: 'screenshot', comment: commentText.value, dataUrl: finalUrl }
    });
};

const sendToJira = () => {
    const finalCanvas = generateFinalCanvas();
    if (!finalCanvas) return;
    const w = window as any;
    finalCanvas.toBlob((blob: Blob | null) => {
        if (blob && w.jiraHelper) {
            w.jiraHelper.showModal(blob, `screenshot-${Date.now()}.png`);
        }
    });
};

onMounted(() => {
    // Load Theme
    chrome.storage.local.get(['theme'], (result) => {
        if (result.theme) document.documentElement.setAttribute('data-theme', result.theme as string);
    });

    // Sync Theme
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.theme) {
            document.documentElement.setAttribute('data-theme', changes.theme.newValue as string);
        }
    });

    chrome.storage.local.get(['tempScreenshot'], (result) => {
        if (result.tempScreenshot) {
            const temp = result.tempScreenshot as { dataUrl: string; ts?: string; timestamp?: string; highlightBox?: any; };
            const { dataUrl, ts, highlightBox } = temp;
            originalImg.src = dataUrl;
            timestamp.value = new Date(ts || temp.timestamp || Date.now()).toLocaleString();

            originalImg.onload = () => initCanvas(highlightBox);
        }
    });

    const w = window as any;
    if (w.jiraHelper) {
        w.jiraHelper.readyPromise.then(() => {
            if (w.jiraHelper.isConfigured()) {
                jiraConfigured.value = true;
            }
        });
    }
});
</script>

<style>
/* Unscoped global CSS for Editor specific overrides and variables */
:root {
    /* Light Theme (Default) */
    --bg-app: #f0f2f5;
    --bg-container: #ffffff;
    --text-main: #333333;
    --text-secondary: #666666;
    --border: #dddddd;
    --bg-toolbar: #ffffff;
    --bg-hover: #f3f3f3;
    --shadow: rgba(0, 0, 0, 0.1);

    --primary: #0078d4;
    --primary-hover: #106ebe;
}

[data-theme="dark"] {
    /* Dark Theme */
    --bg-app: #121212;
    --bg-container: #242526;
    --text-main: #e4e6eb;
    --text-secondary: #b0b3b8;
    --border: #3e4042;
    --bg-toolbar: #18191a;
    --bg-hover: #2d2e30;
    --shadow: rgba(0, 0, 0, 0.3);

    --primary: #2e89ff;
    --primary-hover: #1877f2;
}

body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    margin: 0;
    padding: 20px;
    background: var(--bg-app);
    color: var(--text-main);
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
}
</style>

<style scoped>
.container {
    background: var(--bg-container);
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px var(--shadow);
    max-width: 95%;
    width: 1200px;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

h2 {
    margin: 0;
    color: var(--text-main);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.preview-container {
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg-app);
    display: flex;
    justify-content: center;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
}

textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
    background: var(--bg-app);
    color: var(--text-main);
}

.actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding-top: 15px;
}

button {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    transition: background 0.2s;
}

.btn-cancel {
    background: var(--bg-hover);
    color: var(--text-main);
}

.btn-cancel:hover {
    opacity: 0.8;
}

.btn-download {
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    gap: 5px;
}

.btn-download:hover {
    background: var(--primary-hover);
}

.tool-btn {
    padding: 6px;
    background: var(--bg-toolbar) !important;
    border: 1px solid var(--border) !important;
    border-radius: 4px;
    cursor: pointer;
}

.tool-btn svg {
    stroke: var(--text-secondary);
}

.tool-btn.active {
    outline: 2px solid #333 !important;
    background: #f0f0f0 !important;
}

.tool-btn.active svg {
    /* If we want we can change color or active has specific overrides */
}
</style>
