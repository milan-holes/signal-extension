let currentTool = 'highlight';
let isDrawing = false;
let lastX = 0, lastY = 0;
let ctx = null;
let originalImg = new Image();

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['tempScreenshot'], (result) => {
        if (result.tempScreenshot) {
            const { dataUrl, timestamp, highlightBox } = result.tempScreenshot;
            originalImg.src = dataUrl;
            document.getElementById('timestamp').innerText = new Date(timestamp).toLocaleString();

            originalImg.onload = () => initCanvas(highlightBox);
        }
    });

    // Tools
    document.getElementById('tool-highlight').onclick = () => {
        currentTool = 'highlight';
        setActiveTool('tool-highlight');
    };
    document.getElementById('tool-pen').onclick = () => {
        currentTool = 'pen';
        setActiveTool('tool-pen');
    };
    document.getElementById('tool-text').onclick = () => {
        currentTool = 'text';
        setActiveTool('tool-text');
    };
    document.getElementById('tool-clear').onclick = () => initCanvas();

    document.getElementById('downloadBtn').onclick = () => {
        downloadFinal();
    };
    document.getElementById('cancelBtn').onclick = () => window.close();

    if (window.jiraHelper) {
        window.jiraHelper.readyPromise.then(() => {
            if (window.jiraHelper.isConfigured()) {
                document.getElementById('jiraBtn').style.display = 'flex';
                document.getElementById('jiraBtn').onclick = () => {
                    const finalCanvas = generateFinalCanvas();
                    finalCanvas.toBlob((blob) => {
                        window.jiraHelper.showModal(blob, `screenshot-${Date.now()}.png`);
                    });
                };
            }
        });
    }

    setActiveTool('tool-highlight');
});

function setActiveTool(id) {
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.style.outline = 'none';
        b.style.background = 'white';
    });
    // Visual active state
    const btn = document.getElementById(id);
    if (btn) {
        btn.style.outline = '2px solid #333';
        btn.style.background = '#f0f0f0';
    }
}

function initCanvas(highlightBox) {
    const canvas = document.getElementById('editorCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = originalImg.naturalWidth;
    canvas.height = originalImg.naturalHeight;
    ctx.drawImage(originalImg, 0, 0);

    if (highlightBox) {
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 5;
        // Draw the reported region box
        ctx.strokeRect(highlightBox.x, highlightBox.y, highlightBox.width, highlightBox.height);
        ctx.restore();
    }

    canvas.onmousedown = (e) => {
        if (currentTool === 'text') {
            const [x, y] = getPos(e, canvas);
            // Simple prompt for now
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

        isDrawing = true;
        [lastX, lastY] = getPos(e, canvas);
    };

    canvas.onmousemove = (e) => {
        if (!isDrawing) return;
        const [x, y] = getPos(e, canvas);
        draw(lastX, lastY, x, y);
        [lastX, lastY] = [x, y];
    };
    canvas.onmouseup = () => isDrawing = false;
    canvas.onmouseout = () => isDrawing = false;
}

function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY
    ];
}

function draw(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'highlight') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = '#ffff00'; // Pure yellow
        ctx.lineWidth = 30;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
    }

    ctx.stroke();
    // Reset comp op just in case
    ctx.globalCompositeOperation = 'source-over';
}

function generateFinalCanvas() {
    const comment = document.getElementById('commentBox').value;
    const canvas = document.getElementById('editorCanvas');

    const finalCanvas = document.createElement('canvas');
    const fctx = finalCanvas.getContext('2d');

    // Measure comment height
    const fontSize = Math.max(16, Math.floor(canvas.width / 40));
    const padding = fontSize;
    const lineHeight = fontSize * 1.5;
    let textHeight = 0;
    let lines = [];

    // Resize final canvas to Append text at bottom if comment exists
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

    // Draw Image
    fctx.fillStyle = 'white';
    fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    fctx.drawImage(canvas, 0, 0);

    if (comment) {
        // Draw Text Background
        const yStart = canvas.height;
        fctx.fillStyle = 'white'; // White background for appended text
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
}

function downloadFinal() {
    const finalCanvas = generateFinalCanvas();
    const comment = document.getElementById('commentBox').value;
    const finalUrl = finalCanvas.toDataURL('image/png');

    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = `annotated-screenshot-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    chrome.runtime.sendMessage({
        action: "recordIssue",
        issue: { timestamp: Date.now(), type: 'screenshot', comment: comment, dataUrl: finalUrl }
    });
}
