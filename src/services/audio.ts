// Audio context singleton for notifications
let notificationAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
    if (!notificationAudioCtx) {
        notificationAudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return notificationAudioCtx;
};

/**
 * Play notification sound when defect is detected
 * Different tones for different severity levels
 */
export function playDefectNotification(severity: 'minor' | 'medium' | 'critical' = 'medium') {
    try {
        const ctx = getAudioContext();

        // Resume context if suspended (browser autoplay policy)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const now = ctx.currentTime;

        // Create oscillator for the tone
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Different frequencies and patterns for each severity
        switch (severity) {
            case 'critical':
                // Urgent double beep - high pitch
                oscillator.frequency.setValueAtTime(880, now); // A5
                oscillator.frequency.setValueAtTime(0, now + 0.1);
                oscillator.frequency.setValueAtTime(880, now + 0.15);
                gainNode.gain.setValueAtTime(0.4, now);
                gainNode.gain.setValueAtTime(0, now + 0.1);
                gainNode.gain.setValueAtTime(0.4, now + 0.15);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.type = 'square';
                break;

            case 'medium':
                // Single alert tone - medium pitch
                oscillator.frequency.setValueAtTime(660, now); // E5
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                oscillator.type = 'sine';
                break;

            case 'minor':
            default:
                // Soft notification - lower pitch
                oscillator.frequency.setValueAtTime(440, now); // A4
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                oscillator.type = 'sine';
                break;
        }

        // Connect and play
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.35);

    } catch (error) {
        console.error('Error playing notification:', error);
    }
}

/**
 * Play a pleasant chime for scan start/stop
 */
export function playStartStopChime(isStart: boolean) {
    try {
        const ctx = getAudioContext();

        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';

        if (isStart) {
            // Rising tone for start
            oscillator.frequency.setValueAtTime(400, now);
            oscillator.frequency.linearRampToValueAtTime(600, now + 0.15);
        } else {
            // Falling tone for stop
            oscillator.frequency.setValueAtTime(600, now);
            oscillator.frequency.linearRampToValueAtTime(400, now + 0.15);
        }

        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.25);

    } catch (error) {
        console.error('Error playing chime:', error);
    }
}

/**
 * Utility to convert Float32 audio data (Web Audio API) to PCM Int16 (Gemini Requirement)
 */
export function float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

/**
 * Utility to convert base64 PCM Int16 back to AudioBuffer for playback
 * Note: Gemini returns raw PCM 16-bit at 24kHz usually
 */
export async function playPCMChunk(base64Data: string, sampleRate = 24000) {
    try {
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const int16Data = new Int16Array(bytes.buffer);
        const float32Data = new Float32Array(int16Data.length);

        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 32768.0;
        }

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
        const buffer = audioCtx.createBuffer(1, float32Data.length, sampleRate);
        buffer.getChannelData(0).set(float32Data);

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
    } catch (error) {
        console.error("Error playback PCM:", error);
    }
}
