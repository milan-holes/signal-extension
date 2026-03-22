export function useRecording() {
    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let audioStream: MediaStream | null = null;
    let recordedChunks: Blob[] = [];

    const startMediaRecording = async (withAudio: boolean = false) => {
        recordedChunks = [];

        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'browser'
                },
                audio: withAudio
            });

            if (withAudio && stream.getAudioTracks().length === 0) {
                // Fallback or explicit mic request if desired
                try {
                    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    audioStream.getAudioTracks().forEach(track => stream?.addTrack(track));
                } catch (e) {
                    console.warn("Could not capture mic audio:", e);
                }
            }

            // Cleanup logic if user stops sharing cleanly from system UI
            stream.getVideoTracks()[0].onended = () => {
                if (recorder?.state === 'recording') {
                    stopMediaRecording();
                    window.dispatchEvent(new CustomEvent('signal-stop-recording-initiated-by-system'));
                }
            };

            recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    recordedChunks.push(e.data);
                }
            };

            recorder.start(100); // Record chunks every 100ms
            return true;

        } catch (err: any) {
            console.error("Error obtaining screen capture:", err);
            // Clean up whatever we have
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (audioStream) audioStream.getTracks().forEach(t => t.stop());
            stream = null;
            audioStream = null;
            throw err;
        }
    };

    const getRecordingBlob = () => {
        return new Blob(recordedChunks, { type: 'video/webm' });
    };

    const pauseMediaRecording = () => {
        if (recorder && recorder.state === 'recording') {
            recorder.pause();
        }
    };

    const resumeMediaRecording = () => {
        if (recorder && recorder.state === 'paused') {
            recorder.resume();
        }
    };

    const stopMediaRecording = () => {
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }

        // Stop all tracks to clear the browser "sharing" indicator
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
    };

    const resetRecordingData = () => {
        recordedChunks = [];
    };

    return {
        startMediaRecording,
        stopMediaRecording,
        pauseMediaRecording,
        resumeMediaRecording,
        getRecordingBlob,
        resetRecordingData
    };
}
