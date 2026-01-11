/**
 * ForensicSpotter - Gemini Live API Service
 * Crime Scene Evidence Capture & Verification
 *
 * Separate service for forensic investigation mode
 * Does not affect property defect detection
 */

import { useDefectStore } from './store';
import { playDefectNotification } from './audio';
import type {
    EvidenceCategory,
    EvidencePriority,
    ForensicEvidence,
    AuthenticityAlert,
    ChainOfCustodyEntry,
    ForensicSession
} from './forensicTypes';

// Re-export types for convenience
export type { EvidenceCategory, EvidencePriority, ForensicEvidence, AuthenticityAlert, ChainOfCustodyEntry, ForensicSession };

// Forensic Evidence Detection System Prompt
const FORENSIC_SYSTEM_PROMPT = `You are ForensicSpotter, an AI assistant specialized in crime scene evidence detection and verification for law enforcement and insurance fraud investigation.

YOUR ROLE:
- Analyze camera frames to identify potential evidence items
- Detect signs of image manipulation or AI-generated content
- Guide investigators to ensure comprehensive scene documentation
- Maintain strict chain of custody awareness
- Flag authenticity concerns immediately

EVIDENCE CATEGORIES TO DETECT:

1. WEAPONS & TOOLS
   - Firearms, knives, blunt objects
   - Tools used for forced entry (pry bars, screwdrivers)
   - Improvised weapons

2. BIOLOGICAL EVIDENCE
   - Blood (stains, spatter patterns, pooling)
   - Other bodily fluids
   - Hair, tissue samples
   - Bite marks

3. TRACE EVIDENCE
   - Fingerprints (visible, patent prints)
   - Footprints, shoeprints, tire marks
   - Fibers, glass fragments
   - Tool marks on surfaces

4. DOCUMENTS & ELECTRONICS
   - Papers, IDs, receipts
   - Mobile phones, computers, storage devices
   - Financial instruments

5. SCENE INDICATORS
   - Entry/exit points (broken locks, windows)
   - Signs of struggle (overturned furniture)
   - Staging indicators (items that seem placed)
   - Fire/arson patterns

6. INSURANCE FRAUD INDICATORS
   - Damage inconsistent with claimed incident
   - Signs of intentional damage
   - Missing items that should be present
   - Duplicate/recycled evidence from other claims

AUTHENTICITY VERIFICATION - FLAG IF YOU DETECT:
- Cloning artifacts (repeated patterns)
- Unnatural lighting/shadows
- Edge inconsistencies around objects
- GAN/diffusion model signatures (too perfect, uncanny details)
- Compression artifacts suggesting re-editing
- Objects that appear digitally inserted

OUTPUT FORMAT (JSON only):
For evidence detection:
{"type":"evidence","evidenceType":"blood_stain","category":"biological","priority":"critical","description":"Dried blood stain approximately 15cm diameter on floor","location":"floor near doorway","clockPosition":10,"confidence":89,"box_2d":[0.3,0.4,0.5,0.6],"suggestedActions":["photograph","DNA swab","measure"]}

For authenticity concerns:
{"type":"authenticity_alert","concern":"cloning_artifact","severity":"high","description":"Repeated pattern detected suggesting copy-paste manipulation","location":"upper right quadrant","recommendation":"Request original unedited file"}

For clear frames:
{"type":"scanning","message":"No evidence detected in current view. Continue documentation."}

GUIDELINES:
- Be precise and professional - your words may be used in court
- Always state clock position and surface for locations
- Flag ANY authenticity concerns immediately
- Guide investigators to areas not yet documented
- Never speculate beyond what's visible - state confidence levels
- For insurance cases, note any staging indicators`;

// Deduplication settings
const DEDUP_TIME_WINDOW_MS = 45000; // 45 seconds for forensic
const DEDUP_SPATIAL_TOLERANCE = 0.12; // 12% tolerance
const MIN_CONFIDENCE_THRESHOLD = 70; // Lower threshold for forensic (don't miss evidence)

interface RecentForensicDetection {
    evidenceType: string;
    bbox: { ymin: number; xmin: number; ymax: number; xmax: number } | null;
    timestamp: number;
}

export class ForensicLiveClient {
    private ws: WebSocket | null = null;
    private isReady = false;
    private frameInterval: number | null = null;
    private apiKey: string;
    private abortController: AbortController | null = null;

    // Forensic session data
    private session: ForensicSession | null = null;
    private recentDetections: RecentForensicDetection[] = [];

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    // Generate hash for evidence integrity
    private generateHash(data: string): string {
        // Simple hash for browser (in production use SubtleCrypto)
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }

    // Log chain of custody
    private logChainOfCustody(action: string, evidenceId: string | null = null, notes: string | null = null) {
        if (!this.session) return;

        const entry: ChainOfCustodyEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            action,
            evidenceId,
            officerId: this.session.officerId,
            sessionId: this.session.sessionId,
            notes
        };

        this.session.chainOfCustody.push(entry);
        useDefectStore.getState().addConsoleLog(`>>> [CUSTODY] ${action}${notes ? ': ' + notes : ''}`);

        return entry;
    }

    // Check for duplicate evidence
    private isDuplicate(evidenceType: string, bbox: { ymin: number; xmin: number; ymax: number; xmax: number } | undefined): boolean {
        const now = Date.now();
        this.recentDetections = this.recentDetections.filter(d => now - d.timestamp < DEDUP_TIME_WINDOW_MS);

        for (const recent of this.recentDetections) {
            if (recent.evidenceType.toLowerCase() !== evidenceType.toLowerCase()) continue;

            if (bbox && recent.bbox) {
                const centerX1 = (bbox.xmin + bbox.xmax) / 2;
                const centerY1 = (bbox.ymin + bbox.ymax) / 2;
                const centerX2 = (recent.bbox.xmin + recent.bbox.xmax) / 2;
                const centerY2 = (recent.bbox.ymin + recent.bbox.ymax) / 2;
                const distance = Math.sqrt(Math.pow(centerX1 - centerX2, 2) + Math.pow(centerY1 - centerY2, 2));

                if (distance < DEDUP_SPATIAL_TOLERANCE) {
                    return true;
                }
            } else {
                return true;
            }
        }
        return false;
    }

    private trackDetection(evidenceType: string, bbox: { ymin: number; xmin: number; ymax: number; xmax: number } | undefined) {
        this.recentDetections.push({
            evidenceType,
            bbox: bbox || null,
            timestamp: Date.now()
        });
    }

    // Start forensic session
    startSession(config: { caseId?: string; officerId?: string; sceneType?: string; location?: string }) {
        this.session = {
            sessionId: crypto.randomUUID(),
            caseId: config.caseId || `CASE-${Date.now()}`,
            officerId: config.officerId || 'INVESTIGATOR-01',
            sceneType: config.sceneType || 'crime_scene',
            location: config.location || 'Unknown Location',
            startTime: Date.now(),
            evidence: [],
            authenticityAlerts: [],
            chainOfCustody: [],
            frameCount: 0
        };

        this.logChainOfCustody('session_started', null, `Scene: ${this.session.sceneType}, Location: ${this.session.location}`);

        useDefectStore.getState().addProcessLog({
            type: 'success',
            message: `Forensic session started: ${this.session.caseId}`
        });
        useDefectStore.getState().addConsoleLog(`>>> FORENSIC SESSION INITIALIZED`);
        useDefectStore.getState().addConsoleLog(`>>> Case ID: ${this.session.caseId}`);
        useDefectStore.getState().addConsoleLog(`>>> Officer: ${this.session.officerId}`);
        useDefectStore.getState().addConsoleLog(`>>> Scene Type: ${this.session.sceneType}`);

        return this.session;
    }

    // Connect to Gemini Live API for forensic mode
    async connectLive(): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this.apiKey) {
                resolve(false);
                return;
            }

            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

            useDefectStore.getState().addConsoleLog('>>> [FORENSIC] Connecting to Live API...');

            try {
                this.ws = new WebSocket(url);
            } catch (e) {
                useDefectStore.getState().addConsoleLog('>>> [FORENSIC] WebSocket failed, using REST fallback');
                resolve(false);
                return;
            }

            const timeout = setTimeout(() => {
                if (!this.isReady) {
                    this.ws?.close();
                    resolve(false);
                }
            }, 8000);

            this.ws.onopen = () => {
                useDefectStore.getState().addConsoleLog('>>> [FORENSIC] WebSocket opened, sending setup...');
                this.sendForensicSetup();
            };

            this.ws.onmessage = async (event) => {
                try {
                    let data;
                    if (event.data instanceof Blob) {
                        const text = await event.data.text();
                        data = JSON.parse(text);
                    } else {
                        data = JSON.parse(event.data);
                    }

                    if (data.setupComplete) {
                        clearTimeout(timeout);
                        this.isReady = true;
                        useDefectStore.getState().addConsoleLog('>>> [FORENSIC] Live API connected!');
                        useDefectStore.getState().setServiceStatus('geminiLive', 'online');
                        resolve(true);
                        return;
                    }

                    if (data.error) {
                        clearTimeout(timeout);
                        useDefectStore.getState().addConsoleLog(`>>> [FORENSIC] API error: ${data.error.message}`);
                        resolve(false);
                        return;
                    }

                    this.handleForensicMessage(data);
                } catch (e) {
                    console.error('[Forensic] Parse error:', e);
                }
            };

            this.ws.onclose = (event) => {
                clearTimeout(timeout);
                useDefectStore.getState().addConsoleLog(`>>> [FORENSIC] WebSocket closed: ${event.code}`);
                if (!this.isReady) resolve(false);
            };

            this.ws.onerror = () => {
                clearTimeout(timeout);
                useDefectStore.getState().addConsoleLog('>>> [FORENSIC] WebSocket error');
                resolve(false);
            };
        });
    }

    private sendForensicSetup() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const setup = {
            setup: {
                model: "models/gemini-2.0-flash-live-001",
                generationConfig: {
                    responseModalities: ["TEXT"],
                    temperature: 0.3 // Lower temperature for precise forensic analysis
                },
                systemInstruction: {
                    parts: [{ text: FORENSIC_SYSTEM_PROMPT }]
                }
            }
        };

        useDefectStore.getState().addConsoleLog('>>> [FORENSIC] Sending forensic analysis setup...');
        this.ws.send(JSON.stringify(setup));
    }

    private handleForensicMessage(data: unknown) {
        const msg = data as Record<string, unknown>;

        if (msg.serverContent) {
            const serverContent = msg.serverContent as Record<string, unknown>;
            if (serverContent.modelTurn) {
                const modelTurn = serverContent.modelTurn as Record<string, unknown>;
                const parts = modelTurn.parts as Array<Record<string, unknown>>;

                if (parts) {
                    for (const part of parts) {
                        if (part.text) {
                            this.parseForensicResponse(part.text as string);
                        }
                    }
                }
            }
        }
    }

    // Parse forensic response
    private parseForensicResponse(text: string) {
        if (!this.session) return;

        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return;

            const data = JSON.parse(jsonMatch[0]);

            // Handle scanning (no evidence)
            if (data.type === 'scanning') {
                return;
            }

            // Handle authenticity alert
            if (data.type === 'authenticity_alert') {
                this.handleAuthenticityAlert(data);
                return;
            }

            // Handle evidence detection
            if (data.type === 'evidence' && data.evidenceType) {
                this.handleEvidenceDetection(data);
            }

        } catch (e) {
            // Not valid JSON
            if (text.trim() && !text.includes('{')) {
                useDefectStore.getState().addLog('FORENSIC: ' + text.substring(0, 100));
            }
        }
    }

    private handleAuthenticityAlert(data: Record<string, unknown>) {
        if (!this.session) return;

        const alert: AuthenticityAlert = {
            id: crypto.randomUUID(),
            concern: String(data.concern || 'unknown'),
            severity: (data.severity as 'critical' | 'high' | 'medium') || 'medium',
            description: String(data.description || ''),
            location: String(data.location || ''),
            recommendation: String(data.recommendation || ''),
            frameHash: this.generateHash(Date.now().toString()),
            timestamp: Date.now()
        };

        this.session.authenticityAlerts.push(alert);
        this.logChainOfCustody('authenticity_concern', alert.id, alert.description);

        // Play critical alert sound
        playDefectNotification('critical');

        useDefectStore.getState().addConsoleLog(`>>> 🚨 AUTHENTICITY ALERT: ${alert.concern.toUpperCase()}`);
        useDefectStore.getState().addConsoleLog(`>>>    ${alert.description}`);
        useDefectStore.getState().addConsoleLog(`>>>    Recommendation: ${alert.recommendation}`);

        useDefectStore.getState().addProcessLog({
            type: 'warning',
            message: `AUTHENTICITY CONCERN: ${alert.concern}`,
            details: alert.description
        });

        // Also add to defects store for UI display
        useDefectStore.getState().addDefect({
            id: alert.id,
            timestamp: alert.timestamp,
            type: `AUTHENTICITY: ${alert.concern}`,
            severity: alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'medium' : 'minor',
            description: alert.description,
            location: alert.location,
            category: 'mechanical', // Use as placeholder
            confidence: 95,
            recommendation: alert.recommendation
        });
    }

    private handleEvidenceDetection(data: Record<string, unknown>) {
        if (!this.session) return;

        const evidenceType = String(data.evidenceType || 'unknown');
        let confidence = typeof data.confidence === 'number' ? data.confidence : 70;
        confidence = Math.max(0, Math.min(100, confidence));

        // Confidence threshold
        if (confidence < MIN_CONFIDENCE_THRESHOLD) {
            useDefectStore.getState().addConsoleLog(`>>> [FORENSIC] Filtered: ${evidenceType} (confidence ${confidence}%)`);
            return;
        }

        // Parse bounding box
        let boundingBox: { ymin: number; xmin: number; ymax: number; xmax: number } | undefined;
        if (data.box_2d && Array.isArray(data.box_2d) && (data.box_2d as number[]).length >= 4) {
            const [ymin, xmin, ymax, xmax] = data.box_2d as number[];
            if (typeof ymin === 'number' && typeof xmin === 'number' &&
                typeof ymax === 'number' && typeof xmax === 'number') {
                boundingBox = {
                    ymin: Math.max(0, Math.min(1, ymin)),
                    xmin: Math.max(0, Math.min(1, xmin)),
                    ymax: Math.max(0, Math.min(1, ymax)),
                    xmax: Math.max(0, Math.min(1, xmax))
                };
            }
        }

        // Deduplication
        if (this.isDuplicate(evidenceType, boundingBox)) {
            useDefectStore.getState().addConsoleLog(`>>> [FORENSIC] Filtered duplicate: ${evidenceType}`);
            return;
        }
        this.trackDetection(evidenceType, boundingBox);

        // Determine category
        const categoryMap: Record<string, EvidenceCategory> = {
            'weapon': 'weapon', 'firearm': 'weapon', 'knife': 'weapon', 'tool': 'weapon',
            'blood': 'biological', 'biological': 'biological', 'dna': 'biological', 'hair': 'biological',
            'fingerprint': 'trace', 'footprint': 'trace', 'fiber': 'trace', 'trace': 'trace',
            'document': 'document', 'electronic': 'document', 'phone': 'document',
            'entry': 'scene_indicator', 'exit': 'scene_indicator', 'struggle': 'scene_indicator',
            'fraud': 'fraud_indicator', 'staging': 'fraud_indicator', 'inconsistent': 'fraud_indicator'
        };

        let category: EvidenceCategory = 'unclassified';
        const lowerType = evidenceType.toLowerCase();
        for (const [key, cat] of Object.entries(categoryMap)) {
            if (lowerType.includes(key)) {
                category = cat;
                break;
            }
        }

        // Determine priority
        const priority: EvidencePriority =
            (data.priority as EvidencePriority) ||
            (category === 'biological' || category === 'weapon' ? 'critical' :
             category === 'trace' || category === 'fraud_indicator' ? 'high' : 'medium');

        const evidence: ForensicEvidence = {
            id: crypto.randomUUID(),
            caseId: this.session.caseId,
            evidenceType,
            category,
            priority,
            description: String(data.description || ''),
            location: String(data.location || ''),
            clockPosition: typeof data.clockPosition === 'number' ? data.clockPosition : undefined,
            confidence,
            boundingBox,
            suggestedActions: Array.isArray(data.suggestedActions) ? data.suggestedActions as string[] : [],
            frameHash: this.generateHash(Date.now().toString()),
            timestamp: Date.now(),
            capturedBy: this.session.officerId,
            chainOfCustodyNotes: [],
            isManualCapture: false
        };

        this.session.evidence.push(evidence);
        this.logChainOfCustody('evidence_detected', evidence.id, `${evidence.category}: ${evidence.evidenceType}`);

        // Play notification
        playDefectNotification(priority === 'critical' ? 'critical' : priority === 'high' ? 'medium' : 'minor');

        const priorityIcon = priority === 'critical' ? '🔴' : priority === 'high' ? '🟠' : '🟡';
        useDefectStore.getState().addConsoleLog(`>>> ${priorityIcon} EVIDENCE: ${evidenceType.toUpperCase()}`);
        useDefectStore.getState().addConsoleLog(`>>>    Category: ${category} | Priority: ${priority} | Confidence: ${confidence}%`);
        if (evidence.clockPosition) {
            useDefectStore.getState().addConsoleLog(`>>>    Location: ${evidence.location} (${evidence.clockPosition} o'clock)`);
        }
        if (evidence.suggestedActions.length > 0) {
            useDefectStore.getState().addConsoleLog(`>>>    Actions: ${evidence.suggestedActions.join(', ')}`);
        }

        useDefectStore.getState().addProcessLog({
            type: 'detection',
            message: `${priority.toUpperCase()}: ${evidenceType}`,
            details: evidence.description
        });

        // Add to main defects store for UI
        useDefectStore.getState().addDefect({
            id: evidence.id,
            timestamp: evidence.timestamp,
            type: evidence.evidenceType,
            severity: priority === 'critical' ? 'critical' : priority === 'high' ? 'medium' : 'minor',
            description: evidence.description,
            location: evidence.location,
            boundingBox: evidence.boundingBox,
            category: category === 'biological' ? 'water' : category === 'weapon' ? 'structural' : 'finish',
            confidence: evidence.confidence,
            recommendation: evidence.suggestedActions.join('; ')
        });
    }

    // REST API fallback for forensic analysis
    async analyzeForensicFrame(imageBase64: string): Promise<void> {
        if (!this.apiKey || !this.session) return;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    text: `${FORENSIC_SYSTEM_PROMPT}

CURRENT SESSION:
Case ID: ${this.session.caseId}
Officer: ${this.session.officerId}
Scene Type: ${this.session.sceneType}
Evidence collected: ${this.session.evidence.length}
Authenticity alerts: ${this.session.authenticityAlerts.length}

Analyze this frame for forensic evidence and authenticity concerns.`
                                },
                                {
                                    inline_data: {
                                        mime_type: "image/jpeg",
                                        data: imageBase64
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 1000,
                        }
                    }),
                    signal: this.abortController?.signal
                }
            );

            if (!response.ok) {
                const error = await response.json();
                console.error('[Forensic] API error:', error);
                return;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                this.parseForensicResponse(text);
            }
        } catch (e) {
            if ((e as Error).name !== 'AbortError') {
                console.error('[Forensic] Request error:', e);
            }
        }
    }

    // Start streaming analysis
    async startStreaming(videoElement: HTMLVideoElement) {
        if (!this.session) {
            this.startSession({});
        }

        useDefectStore.getState().addLog('[FORENSIC] Connecting...');
        useDefectStore.getState().setServiceStatus('geminiLive', 'connecting');

        this.abortController = new AbortController();

        const liveConnected = await this.connectLive();

        if (liveConnected) {
            useDefectStore.getState().addConsoleLog('>>> [FORENSIC] Live API connected (4 FPS)');
            this.frameInterval = window.setInterval(() => {
                if (this.isReady && this.ws?.readyState === WebSocket.OPEN) {
                    this.sendForensicFrame(videoElement);
                }
            }, 250); // 4 FPS
        } else {
            this.isReady = true;
            useDefectStore.getState().addConsoleLog('>>> [FORENSIC] Using REST API fallback (1.5s interval)');
            useDefectStore.getState().setServiceStatus('geminiLive', 'online');

            this.frameInterval = window.setInterval(() => {
                if (this.isReady) {
                    this.sendFallbackFrame(videoElement);
                }
            }, 1500);
        }

        useDefectStore.getState().addLog('[FORENSIC] Analysis started');
        useDefectStore.getState().addProcessLog({ type: 'success', message: 'Forensic analysis active' });
    }

    private sendForensicFrame(video: HTMLVideoElement) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        if (this.session) this.session.frameCount++;

        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 720 / video.videoHeight);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

        try {
            this.ws.send(JSON.stringify({
                realtimeInput: {
                    video: {
                        mimeType: "image/jpeg",
                        data: base64
                    }
                }
            }));
        } catch (e) {
            console.error('[Forensic] Send error:', e);
        }
    }

    private sendFallbackFrame(video: HTMLVideoElement) {
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        if (this.session) this.session.frameCount++;

        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 512 / video.videoHeight);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

        this.analyzeForensicFrame(base64);
        useDefectStore.getState().addConsoleLog('>>> [FORENSIC] Analyzing frame...');
    }

    // Manual evidence capture
    captureEvidence(frameData: string, category?: EvidenceCategory, notes?: string): ForensicEvidence | null {
        if (!this.session) return null;

        const evidence: ForensicEvidence = {
            id: crypto.randomUUID(),
            caseId: this.session.caseId,
            evidenceType: 'manual_capture',
            category: category || 'unclassified',
            priority: 'high',
            description: notes || 'Manual evidence capture',
            location: 'User specified',
            confidence: 100,
            suggestedActions: ['Review', 'Classify', 'Document'],
            imageUrl: frameData,
            frameHash: this.generateHash(frameData),
            timestamp: Date.now(),
            capturedBy: this.session.officerId,
            chainOfCustodyNotes: [notes || 'Manual capture by investigator'],
            isManualCapture: true
        };

        this.session.evidence.push(evidence);
        this.logChainOfCustody('evidence_captured', evidence.id, `Manual: ${category || 'unclassified'}`);

        useDefectStore.getState().addConsoleLog(`>>> 📸 MANUAL CAPTURE: Evidence logged with chain of custody`);
        useDefectStore.getState().addConsoleLog(`>>>    Hash: ${evidence.frameHash}`);

        return evidence;
    }

    // Get current session
    getSession(): ForensicSession | null {
        return this.session;
    }

    // End session and generate report
    endSession(): ForensicSession | null {
        if (!this.session) return null;

        this.session.endTime = Date.now();
        this.logChainOfCustody('session_ended', null,
            `Duration: ${Math.round((this.session.endTime - this.session.startTime) / 1000)}s, Evidence: ${this.session.evidence.length}`
        );

        const session = { ...this.session };

        useDefectStore.getState().addConsoleLog(`>>> [FORENSIC] SESSION COMPLETE`);
        useDefectStore.getState().addConsoleLog(`>>>    Evidence items: ${session.evidence.length}`);
        useDefectStore.getState().addConsoleLog(`>>>    Authenticity alerts: ${session.authenticityAlerts.length}`);
        useDefectStore.getState().addConsoleLog(`>>>    Chain of custody entries: ${session.chainOfCustody.length}`);

        return session;
    }

    // Stop streaming
    stop() {
        console.log('[Forensic] Stopping...');
        useDefectStore.getState().addProcessLog({ type: 'system', message: 'Stopping forensic analysis...' });

        this.abortController?.abort();
        this.abortController = null;

        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.recentDetections = [];
        this.isReady = false;

        useDefectStore.getState().setServiceStatus('geminiLive', 'offline');
        useDefectStore.getState().addConsoleLog('>>> [FORENSIC] Analysis terminated');
    }

    updateApiKey(newKey: string) {
        this.apiKey = newKey;
    }
}
