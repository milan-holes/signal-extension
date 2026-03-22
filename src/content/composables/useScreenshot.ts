import html2canvas from 'html2canvas';

export function useScreenshot() {

    const captureVisible = async (): Promise<string | null> => {
        const signalWidget = document.getElementById('signal-root');
        if (signalWidget) signalWidget.style.display = 'none';

        // Brief delay to ensure DOM repaints without the widget
        await new Promise(r => setTimeout(r, 50));

        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "captureScreenshot", type: "visible" }, (response) => {
                if (signalWidget) signalWidget.style.display = '';
                const dataUrl = response?.dataUrl || null;
                if (dataUrl) {
                    chrome.runtime.sendMessage({ action: "openScreenshotEditor", dataUrl });
                }
                resolve(dataUrl);
            });
        });
    };

    const captureFullPage = async (): Promise<string | null> => {
        // Hide Signal overlays for clean screenshot
        const signalWidget = document.getElementById('signal-root');
        if (signalWidget) signalWidget.style.display = 'none';

        // Brief delay to ensure DOM repaints without the widget
        await new Promise(r => setTimeout(r, 50));

        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "captureScreenshot", type: "full" }, (response) => {
                if (signalWidget) signalWidget.style.display = '';
                const dataUrl = response?.dataUrl || null;
                if (dataUrl) {
                    chrome.runtime.sendMessage({ action: "openScreenshotEditor", dataUrl });
                }
                resolve(dataUrl);
            });
        });
    };

    const captureRegion = async (): Promise<void> => {
        const signalWidget = document.getElementById('signal-root');
        if (signalWidget) signalWidget.style.display = 'none';

        // Enter crosshair mode
        return new Promise((resolve) => {
            let isSelecting = false;
            let startX = 0, startY = 0;
            let box: HTMLDivElement | null = null;
            let overlay: HTMLDivElement | null = null;

            const finishSelection = async () => {
                if (overlay) overlay.remove();
                if (box) {
                    const rect = box.getBoundingClientRect();
                    box.remove();
                    // Adjust for device pixel ratio
                    const pixelRatio = window.devicePixelRatio || 1;
                    const captureRect = {
                        x: rect.left * pixelRatio,
                        y: rect.top * pixelRatio,
                        width: rect.width * pixelRatio,
                        height: rect.height * pixelRatio
                    };

                    // Manually fetch dataUrl without triggering editor twice:
                    const dataUrl = await new Promise<string | null>((res) => {
                        chrome.runtime.sendMessage({ action: "captureScreenshot", type: "visible" }, (resp) => res(resp?.dataUrl || null));
                    });

                    if (signalWidget) signalWidget.style.display = '';

                    if (dataUrl) {
                        // We must crop the image using canvas
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = captureRect.width;
                            canvas.height = captureRect.height;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(img, captureRect.x, captureRect.y, captureRect.width, captureRect.height, 0, 0, captureRect.width, captureRect.height);
                                const cropped = canvas.toDataURL('image/png');

                                // Send cropped screenshot to editor component
                                chrome.runtime.sendMessage({ action: "openScreenshotEditor", dataUrl: cropped });
                            }
                        };
                        img.src = dataUrl;
                    }
                }
                document.body.style.cursor = 'default';
                resolve();
            };

            const handleMouseDown = (e: MouseEvent) => {
                isSelecting = true;
                startX = e.clientX;
                startY = e.clientY;
                box = document.createElement('div');
                box.style.position = 'fixed';
                box.style.border = '2px dashed #ff4081';
                box.style.backgroundColor = 'rgba(255, 64, 129, 0.2)';
                box.style.pointerEvents = 'none';
                box.style.left = startX + 'px';
                box.style.top = startY + 'px';
                box.style.width = '0px';
                box.style.height = '0px';
                box.style.zIndex = '2147483647';
                document.body.appendChild(box);
            };

            const handleMouseMove = (e: MouseEvent) => {
                if (!isSelecting || !box) return;
                const currentX = e.clientX;
                const currentY = e.clientY;
                box.style.left = Math.min(startX, currentX) + 'px';
                box.style.top = Math.min(startY, currentY) + 'px';
                box.style.width = Math.abs(currentX - startX) + 'px';
                box.style.height = Math.abs(currentY - startY) + 'px';
            };

            const handleMouseUp = (e: MouseEvent) => {
                isSelecting = false;
                overlay?.removeEventListener('mousedown', handleMouseDown);
                overlay?.removeEventListener('mousemove', handleMouseMove);
                overlay?.removeEventListener('mouseup', handleMouseUp);
                finishSelection();
            };

            const setupOverlay = () => {
                overlay = document.createElement('div');
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.zIndex = '2147483646';
                overlay.style.cursor = 'crosshair';
                overlay.addEventListener('mousedown', handleMouseDown);
                overlay.addEventListener('mousemove', handleMouseMove);
                overlay.addEventListener('mouseup', handleMouseUp);
                document.body.appendChild(overlay);

                // Escape handles clearing
                const handleKeyDown = (e: KeyboardEvent) => {
                    if (e.key === 'Escape') {
                        document.removeEventListener('keydown', handleKeyDown);
                        if (overlay) overlay.remove();
                        if (box) box.remove();
                        document.body.style.cursor = 'default';
                        if (signalWidget) signalWidget.style.display = '';
                        resolve();
                    }
                };
                document.addEventListener('keydown', handleKeyDown);
            };

            setupOverlay();
        });
    };

    return {
        captureVisible,
        captureFullPage,
        captureRegion
    };
}
