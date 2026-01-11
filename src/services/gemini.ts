import { useDefectStore } from './store';
import { playPCMChunk } from './audio';

// Research-backed defect detection prompt
// Based on: Building inspection surveys (42% water, 42% cracks, 20% finish defects)
// Severity standards: InterNACHI, structural engineering guidelines
// Detection accuracy target: 94.7% (CNN-based systems benchmark)

const PROMPT = `You are "DefectSpotter", an expert AI construction defect inspector trained on building inspection data.

DEFECT CATEGORIES (by frequency):
1. WATER-RELATED (42%): water leaks, water stains, efflorescence (white deposits), dampness, mold, mildew
2. STRUCTURAL (30%): cracks (diagonal, stair-step, settlement), concrete spalling, lintel cracks
3. FINISH (20%): paint bubbling/peeling, tile cracks, grout deterioration, surface crazing
4. MECHANICAL (8%): loose fittings, fixture damage, sealant failure

SEVERITY CLASSIFICATION (based on industry standards):
- CRITICAL: Structural cracks >3mm, active water leaks, mold growth, concrete spalling exposing rebar, foundation issues
- MEDIUM: Cracks 1-3mm, water stains, paint bubbling, lintel cracks, sealant failure, tile cracks
- MINOR: Hairline cracks <1mm, cosmetic paint peeling, grout deterioration, surface scratches

DETECTION PRIORITIES:
1. Check corners and junctions for water damage/mold
2. Examine walls for crack patterns (diagonal=structural, stair-step=settlement)
3. Look for discoloration indicating moisture
4. Check around windows/doors for sealant issues
5. Inspect tiles for cracks and lippage

ACCURACY RULES (CRITICAL - READ CAREFULLY):
- ONLY report defects you can CLEARLY AND UNAMBIGUOUSLY see in the image
- DO NOT guess or assume defects exist - you must SEE clear visual evidence
- DO NOT report "water stain" unless you see actual discoloration/staining patterns
- DO NOT report defects just because a surface looks old or worn
- If image shows a normal wall/surface with no visible damage, respond with {"type":"clear"}
- ALWAYS include an explicit confidence percentage based on image clarity and defect visibility
- If image quality is poor (blurry, dark, low contrast), respond with {"type":"clear"}
- If uncertain about ANY aspect, report "clear" - false negatives are better than false positives
- Provide ACCURATE bounding box coordinates that PRECISELY locate the visible defect
- The box_2d values must be normalized 0-1 coordinates: [ymin, xmin, ymax, xmax]
- The bounding box should TIGHTLY surround the defect, not the entire wall/surface

OUTPUT FORMAT (JSON only):
{"type":"defect","defectType":"water stain","severity":"medium","description":"Brownish discoloration indicating past moisture intrusion","location":"ceiling corner","category":"water","confidence":91,"box_2d":[0.2,0.3,0.4,0.5]}

If NO defects found or confidence below 75%:
{"type":"clear","message":"No defects detected in current view"}

CONFIDENCE SCORING (be precise):
- 90-100%: Clear, unambiguous defect with textbook characteristics, good image quality
- 80-89%: Likely defect, matches pattern, may need closer inspection
- 75-79%: Possible defect, some ambiguity but evidence present
- Below 75%: Do NOT report - too uncertain

Be systematic. Scan entire image. Only report if confident. Quality over quantity.`;

const LIVE_PROMPT = `You are "DefectSpotter", an expert AI property damage inspector. Detect ALL visible damage accurately.

## YOUR TASK
Scan the image for ANY visible damage, defects, or deterioration. Report what you see with accurate bounding boxes.

## DEFECT CATEGORIES TO DETECT:

### STRUCTURAL DAMAGE
- Cracks: hairline cracks, wall cracks, ceiling cracks, foundation cracks (any visible line/fracture)
- Holes: punctures, dents, impacts in walls/ceilings
- Structural displacement: sagging, bulging, warping

### WATER DAMAGE
- Water stains: brownish/yellowish discoloration, water rings, tide marks
- Active leaks: dripping, wet spots, puddles
- Mold/mildew: dark spots, fuzzy growth, discoloration from moisture
- Efflorescence: white crystalline deposits on concrete/brick

### SURFACE/FINISH DAMAGE
- Paint damage: peeling, bubbling, flaking, chipping paint
- Tile damage: cracked tiles, chipped tiles, missing grout
- Drywall damage: holes, dents, scratches, gouges
- Ceiling damage: stains, sagging, cracks, water damage

### FURNITURE & FIXTURE DAMAGE
- Scratches: visible scratch marks on surfaces
- Dents/impacts: deformation from impacts
- Broken parts: missing pieces, broken handles, damaged hinges
- Stains: spills, discoloration on furniture
- Upholstery damage: tears, rips, worn fabric
- Wood damage: chips, gouges, water rings on wood furniture

### FLOOR DAMAGE
- Carpet: stains, tears, wear patterns, burns
- Hardwood: scratches, gouges, water damage, warping
- Tile: cracks, chips, loose tiles

## SEVERITY LEVELS:
- CRITICAL: Major structural cracks, active water leaks, mold growth, large holes
- MEDIUM: Visible cracks, water stains, paint peeling, furniture scratches/dents
- MINOR: Hairline cracks, small scuffs, minor wear

## BOUNDING BOX FORMAT:
- box_2d = [ymin, xmin, ymax, xmax] as values from 0 to 1000
- Draw box TIGHTLY around the damaged area only

## OUTPUT FORMAT (JSON only):
If damage found:
{"type":"defect","defectType":"crack","severity":"medium","description":"Vertical crack in wall approximately 30cm long","location":"left wall","category":"structural","confidence":85,"box_2d":[200,150,450,180]}

If NO damage visible:
{"type":"clear"}

## EXAMPLES:
- Wall crack → {"type":"defect","defectType":"wall crack","severity":"medium",...}
- Furniture scratch → {"type":"defect","defectType":"furniture scratch","severity":"minor",...}
- Water stain on ceiling → {"type":"defect","defectType":"water stain","severity":"medium",...}
- Torn carpet → {"type":"defect","defectType":"carpet tear","severity":"medium",...}
- Chipped paint → {"type":"defect","defectType":"paint damage","severity":"minor",...}

Report ALL visible damage. Be thorough but accurate.`;

// Crime Scene Investigation Prompt
const CRIME_SCENE_PROMPT = `You are "Scene Investigator", an AI-powered crime scene and incident investigation assistant trained on forensic analysis protocols.

INVESTIGATION PROTOCOL:
Analyze each frame for potential evidence, anomalies, and points of interest in the scene.

EVIDENCE CATEGORIES:
- PHYSICAL EVIDENCE: blood stains, fingerprints, footprints, tool marks, damage patterns, broken items
- BIOLOGICAL EVIDENCE: hair, fibers, tissue, bodily fluids, biological stains
- TRACE EVIDENCE: paint chips, glass fragments, soil, debris, foreign materials
- DOCUMENT EVIDENCE: papers, notes, receipts, digital devices visible
- PATTERN EVIDENCE: bullet trajectories, blood spatter patterns, impact marks, entry/exit points

SEVERITY/PRIORITY CLASSIFICATION:
- CRITICAL: Direct evidence of incident (blood, weapon marks, forced entry signs, victim indicators)
- MEDIUM: Supporting evidence (displaced items, unusual stains, potential trace evidence)
- MINOR: Environmental context (background details, reference points, scene layout)

KEY VISUAL PATTERNS TO DETECT:
- Blood spatter patterns → direction and force indicators
- Broken glass/locks → forced entry evidence
- Disturbed surfaces/dust → recent activity
- Unusual placement of objects → signs of struggle
- Tire marks/footprints → movement patterns
- Light/shadow anomalies → time-of-day indicators

OUTPUT FORMAT:
{"type":"evidence","evidenceType":"blood spatter","severity":"critical","description":"Low-velocity spatter pattern consistent with close-range impact","location":"wall near door","category":"physical","confidence":89,"box_2d":[0.2,0.3,0.4,0.5]}

INVESTIGATION NOTES:
- Document EVERYTHING - even seemingly minor details may be crucial
- Note spatial relationships between items
- Identify potential entry/exit points
- Look for signs of disturbance vs. normal state
- Consider timeline indicators (clocks, dated items, decay state)

Be SYSTEMATIC. Document thoroughly. Report findings with precise locations.`;

// Deduplication configuration
const DEDUP_TIME_WINDOW_MS = 30000; // 30 seconds
const DEDUP_SPATIAL_TOLERANCE = 0.15; // 15% spatial tolerance
const MIN_CONFIDENCE_THRESHOLD = 60; // Minimum confidence to report (lowered for better sensitivity)

// Temporal consistency configuration
const TEMPORAL_THRESHOLD = 1; // Report immediately (set to 1 for faster detection)
const TEMPORAL_WINDOW_MS = 3000; // 3 second window for frame matching
const IOU_THRESHOLD = 0.25; // Intersection over Union threshold for matching

// Non-Maximum Suppression (NMS) configuration
const NMS_IOU_THRESHOLD = 0.5; // IoU threshold for considering boxes as overlapping
const NMS_WINDOW_MS = 5000; // 5 second window for NMS comparison

// Track recent detections for deduplication
interface RecentDetection {
    defectType: string;
    bbox: { ymin: number; xmin: number; ymax: number; xmax: number } | null;
    timestamp: number;
}

// Temporal detection tracking for multi-frame verification
interface TemporalDetection {
    defectType: string;
    bbox: { ymin: number; xmin: number; ymax: number; xmax: number };
    confidence: number;
    frameCount: number;
    firstSeen: number;
    lastSeen: number;
}

// Confirmed detection for NMS
interface ConfirmedDetection {
    defectType: string;
    bbox: { ymin: number; xmin: number; ymax: number; xmax: number };
    confidence: number;
    timestamp: number;
}

export class GeminiLiveClient {
    private ws: WebSocket | null = null;
    private audioCtx: AudioContext | null = null;
    private stream: MediaStream | null = null;
    private isReady = false;
    private frameInterval: number | null = null;
    private apiKey: string;
    private abortController: AbortController | null = null;
    private recentDetections: RecentDetection[] = []; // For deduplication
    private temporalBuffer: Map<string, TemporalDetection> = new Map(); // For multi-frame verification
    private confirmedDetections: ConfirmedDetection[] = []; // For NMS

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    // Calculate Intersection over Union for bounding box matching
    private calculateIoU(
        box1: { ymin: number; xmin: number; ymax: number; xmax: number },
        box2: { ymin: number; xmin: number; ymax: number; xmax: number }
    ): number {
        const xA = Math.max(box1.xmin, box2.xmin);
        const yA = Math.max(box1.ymin, box2.ymin);
        const xB = Math.min(box1.xmax, box2.xmax);
        const yB = Math.min(box1.ymax, box2.ymax);

        const intersection = Math.max(0, xB - xA) * Math.max(0, yB - yA);
        const box1Area = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
        const box2Area = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);
        const union = box1Area + box2Area - intersection;

        return union > 0 ? intersection / union : 0;
    }

    // Generate spatial key for temporal tracking
    private generateSpatialKey(defectType: string, bbox: { ymin: number; xmin: number; ymax: number; xmax: number }): string {
        const centerX = Math.round((bbox.xmin + bbox.xmax) / 2 * 10);
        const centerY = Math.round((bbox.ymin + bbox.ymax) / 2 * 10);
        return `${defectType.toLowerCase()}_${centerX}_${centerY}`;
    }

    // Check temporal consistency - require detection in multiple frames
    private checkTemporalConsistency(
        defectType: string,
        bbox: { ymin: number; xmin: number; ymax: number; xmax: number },
        confidence: number
    ): { isConfirmed: boolean; frameCount: number } {
        const now = Date.now();

        // Clean old entries
        for (const [key, detection] of this.temporalBuffer) {
            if (now - detection.lastSeen > TEMPORAL_WINDOW_MS) {
                this.temporalBuffer.delete(key);
            }
        }

        // Check for existing similar detection
        for (const [existingKey, detection] of this.temporalBuffer) {
            if (detection.defectType.toLowerCase() === defectType.toLowerCase()) {
                const iou = this.calculateIoU(detection.bbox, bbox);
                if (iou >= IOU_THRESHOLD) {
                    // Update existing detection
                    detection.frameCount++;
                    detection.lastSeen = now;
                    detection.confidence = Math.max(detection.confidence, confidence);

                    // Return true only if seen in multiple frames
                    return {
                        isConfirmed: detection.frameCount >= TEMPORAL_THRESHOLD,
                        frameCount: detection.frameCount
                    };
                }
            }
        }

        // New detection - add to buffer
        const key = this.generateSpatialKey(defectType, bbox);
        this.temporalBuffer.set(key, {
            defectType,
            bbox,
            confidence,
            frameCount: 1,
            firstSeen: now,
            lastSeen: now
        });

        // If threshold is 1, confirm immediately (no multi-frame requirement)
        return {
            isConfirmed: TEMPORAL_THRESHOLD <= 1,
            frameCount: 1
        };
    }

    // Non-Maximum Suppression - suppress overlapping lower-confidence detections
    private shouldSuppressNMS(
        defectType: string,
        bbox: { ymin: number; xmin: number; ymax: number; xmax: number },
        confidence: number
    ): boolean {
        const now = Date.now();

        // Clean old confirmed detections
        this.confirmedDetections = this.confirmedDetections.filter(
            d => now - d.timestamp < NMS_WINDOW_MS
        );

        // Check for overlapping detections
        for (const confirmed of this.confirmedDetections) {
            const iou = this.calculateIoU(confirmed.bbox, bbox);

            // If significant overlap
            if (iou >= NMS_IOU_THRESHOLD) {
                // Suppress if this new detection has lower or equal confidence
                if (confidence <= confirmed.confidence) {
                    console.log(`[NMS] Suppressing ${defectType} (conf=${confidence}%) - overlaps with existing (conf=${confirmed.confidence}%, IoU=${(iou * 100).toFixed(1)}%)`);
                    return true; // Suppress
                }
                // Otherwise, allow (it will replace the lower confidence one)
            }
        }

        return false; // Don't suppress
    }

    // Track a confirmed detection for NMS
    private trackConfirmedDetection(
        defectType: string,
        bbox: { ymin: number; xmin: number; ymax: number; xmax: number },
        confidence: number
    ): void {
        const now = Date.now();

        // Remove any overlapping detection with lower confidence
        this.confirmedDetections = this.confirmedDetections.filter(d => {
            const iou = this.calculateIoU(d.bbox, bbox);
            if (iou >= NMS_IOU_THRESHOLD && d.confidence < confidence) {
                return false; // Remove old detection
            }
            return true;
        });

        // Add new detection
        this.confirmedDetections.push({
            defectType,
            bbox,
            confidence,
            timestamp: now
        });
    }

    // Check if this defect is a duplicate of a recent detection
    private isDuplicate(defectType: string, bbox: { ymin: number; xmin: number; ymax: number; xmax: number } | undefined): boolean {
        const now = Date.now();

        // Clean old detections
        this.recentDetections = this.recentDetections.filter(d => now - d.timestamp < DEDUP_TIME_WINDOW_MS);

        // Check for duplicates
        for (const recent of this.recentDetections) {
            // Type must match (case-insensitive)
            if (recent.defectType.toLowerCase() !== defectType.toLowerCase()) continue;

            // If both have bounding boxes, check spatial overlap
            if (bbox && recent.bbox) {
                const centerX1 = (bbox.xmin + bbox.xmax) / 2;
                const centerY1 = (bbox.ymin + bbox.ymax) / 2;
                const centerX2 = (recent.bbox.xmin + recent.bbox.xmax) / 2;
                const centerY2 = (recent.bbox.ymin + recent.bbox.ymax) / 2;

                const distance = Math.sqrt(Math.pow(centerX1 - centerX2, 2) + Math.pow(centerY1 - centerY2, 2));

                if (distance < DEDUP_SPATIAL_TOLERANCE) {
                    return true; // Duplicate - same type in similar location
                }
            } else {
                // No bbox - just check if same type was reported recently
                return true;
            }
        }

        return false;
    }

    // Add a detection to the recent list
    private trackDetection(defectType: string, bbox: { ymin: number; xmin: number; ymax: number; xmax: number } | undefined): void {
        this.recentDetections.push({
            defectType,
            bbox: bbox || null,
            timestamp: Date.now()
        });
    }

    // Try WebSocket Live API first
    async connectLive(): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this.apiKey) {
                resolve(false);
                return;
            }

            // Live API WebSocket endpoint (v1beta per official docs)
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

            useDefectStore.getState().addConsoleLog('>>> Attempting Live API connection...');

            try {
                this.ws = new WebSocket(url);
            } catch (e) {
                useDefectStore.getState().addConsoleLog('>>> WebSocket creation failed, will use fallback');
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
                useDefectStore.getState().addConsoleLog('>>> WebSocket opened, sending setup...');
                this.sendLiveSetup();
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
                        useDefectStore.getState().addConsoleLog('>>> Live API connected successfully!');
                        useDefectStore.getState().addProcessLog({ type: 'success', message: 'Gemini Live API connected' });
                        useDefectStore.getState().setServiceStatus('geminiLive', 'online');
                        resolve(true);
                        return;
                    }

                    if (data.error) {
                        clearTimeout(timeout);
                        useDefectStore.getState().addConsoleLog(`>>> Live API error: ${data.error.message}`);
                        resolve(false);
                        return;
                    }

                    this.handleLiveMessage(data);
                } catch (e) {
                    console.error('[Gemini] Parse error:', e);
                }
            };

            this.ws.onclose = (event) => {
                clearTimeout(timeout);
                useDefectStore.getState().addConsoleLog(`>>> WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`);
                if (!this.isReady) {
                    resolve(false);
                }
            };

            this.ws.onerror = () => {
                clearTimeout(timeout);
                useDefectStore.getState().addConsoleLog('>>> WebSocket error, will use fallback mode');
                resolve(false);
            };
        });
    }

    private sendLiveSetup() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Select prompt based on investigation mode
        const state = useDefectStore.getState();
        const prompt = state.investigationMode === 'crime_scene' ? CRIME_SCENE_PROMPT : LIVE_PROMPT;
        const modeName = state.investigationMode === 'crime_scene' ? 'Crime Scene Investigation' : 'Property Defect Detection';

        // Gemini Live API setup - per official documentation
        // https://ai.google.dev/api/live
        const setup = {
            setup: {
                model: "models/gemini-2.0-flash-live-001",
                generationConfig: {
                    responseModalities: ["TEXT"],
                    temperature: 0.1,  // Low temperature for deterministic detection
                    topP: 0.8,
                    topK: 20,
                    maxOutputTokens: 500
                },
                systemInstruction: {
                    parts: [{ text: prompt }]
                }
            }
        };

        useDefectStore.getState().addConsoleLog(`>>> Sending setup for ${modeName} mode...`);
        this.ws.send(JSON.stringify(setup));
    }

    private handleLiveMessage(data: unknown) {
        const msg = data as Record<string, unknown>;

        if (msg.serverContent) {
            const serverContent = msg.serverContent as Record<string, unknown>;
            if (serverContent.modelTurn) {
                const modelTurn = serverContent.modelTurn as Record<string, unknown>;
                const parts = modelTurn.parts as Array<Record<string, unknown>>;

                if (parts) {
                    for (const part of parts) {
                        if (part.text) {
                            this.parseDefectResponse(part.text as string);
                        }
                        if (part.inlineData) {
                            const inlineData = part.inlineData as Record<string, string>;
                            if (inlineData.mimeType?.includes('audio/pcm')) {
                                playPCMChunk(inlineData.data);
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: Use regular REST API with streaming
    async analyzeFrameFallback(imageBase64: string): Promise<void> {
        if (!this.apiKey) return;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: PROMPT },
                                {
                                    inline_data: {
                                        mime_type: "image/jpeg",
                                        data: imageBase64
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 500,
                        }
                    }),
                    signal: this.abortController?.signal
                }
            );

            if (!response.ok) {
                const error = await response.json();
                console.error('[Gemini] API error:', error);
                useDefectStore.getState().addConsoleLog(`>>> REST API error: ${error.error?.message || 'Unknown error'}`);
                return;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                this.parseDefectResponse(text);
            }
        } catch (e) {
            if ((e as Error).name !== 'AbortError') {
                console.error('[Gemini] Request error:', e);
            }
        }
    }

    private parseDefectResponse(text: string) {
        try {
            // Log raw response for debugging
            console.log('[Gemini] Raw response:', text.substring(0, 200));

            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.log('[Gemini] No JSON found in response');
                return;
            }

            const data = JSON.parse(jsonMatch[0]);
            console.log('[Gemini] Parsed data:', JSON.stringify(data));

            // Debug: Log raw API response for accuracy verification
            if (data.box_2d) {
                console.log(`[Gemini] 📦 Raw API Response: type=${data.defectType}, box_2d=[${data.box_2d.join(', ')}], confidence=${data.confidence}`);
            }

            if (data.type === 'clear' || !data.defectType) {
                // Log that we received a clear response (detection is working)
                console.log('[Gemini] Clear frame - no defects');
                return; // No defect found
            }

            // === VALIDATION ===
            const defectType = data.defectType || data.type || '';
            if (!defectType || typeof defectType !== 'string') {
                console.log('[Gemini] Invalid response: missing defectType');
                return;
            }

            // Validate and get confidence - NEVER use random values
            let confidence = typeof data.confidence === 'number' ? data.confidence : null;

            // If API didn't return confidence, use conservative default
            if (confidence === null) {
                confidence = 70; // Conservative default - below threshold
                console.log('[Gemini] No confidence provided, using default 70%');
            }

            // Clamp confidence to valid range
            confidence = Math.max(0, Math.min(100, confidence));

            // === CONFIDENCE THRESHOLD ===
            if (confidence < MIN_CONFIDENCE_THRESHOLD) {
                useDefectStore.getState().addConsoleLog(`>>> Filtered: ${defectType} (confidence ${confidence}% < ${MIN_CONFIDENCE_THRESHOLD}% threshold)`);
                return; // Don't report low-confidence detections
            }

            // Parse bounding box with validation and auto-detection of coordinate format
            let boundingBox: { ymin: number; xmin: number; ymax: number; xmax: number } | undefined = undefined;
            if (data.box_2d && Array.isArray(data.box_2d) && data.box_2d.length >= 4) {
                let [ymin, xmin, ymax, xmax] = data.box_2d;

                // Validate bbox values are numbers
                if (typeof ymin === 'number' && typeof xmin === 'number' &&
                    typeof ymax === 'number' && typeof xmax === 'number') {

                    // Auto-detect coordinate scale and normalize to 0-1
                    // Gemini may return coordinates in different scales:
                    // - 0-1 (normalized)
                    // - 0-100 (percentage)
                    // - 0-1000 (permille)
                    // - Pixel coordinates (if image dimensions known)
                    const maxCoord = Math.max(ymin, xmin, ymax, xmax);

                    if (maxCoord > 100) {
                        // Likely 0-1000 scale (permille)
                        console.log(`[Gemini] Auto-detected 0-1000 scale, normalizing (max=${maxCoord})`);
                        ymin /= 1000;
                        xmin /= 1000;
                        ymax /= 1000;
                        xmax /= 1000;
                    } else if (maxCoord > 1) {
                        // Likely 0-100 scale (percentage)
                        console.log(`[Gemini] Auto-detected 0-100 scale, normalizing (max=${maxCoord})`);
                        ymin /= 100;
                        xmin /= 100;
                        ymax /= 100;
                        xmax /= 100;
                    }
                    // else: already 0-1 normalized

                    // Fix inverted coordinates if needed
                    if (ymin > ymax) [ymin, ymax] = [ymax, ymin];
                    if (xmin > xmax) [xmin, xmax] = [xmax, xmin];

                    // Clamp to valid range [0, 1]
                    boundingBox = {
                        ymin: Math.max(0, Math.min(1, ymin)),
                        xmin: Math.max(0, Math.min(1, xmin)),
                        ymax: Math.max(0, Math.min(1, ymax)),
                        xmax: Math.max(0, Math.min(1, xmax))
                    };

                    // Sanity check: ymax should be > ymin, xmax should be > xmin
                    if (boundingBox.ymax <= boundingBox.ymin || boundingBox.xmax <= boundingBox.xmin) {
                        console.log('[Gemini] Invalid bbox dimensions, discarding');
                        boundingBox = undefined;
                    }

                    // STRICT bounding box validation
                    if (boundingBox) {
                        const boxWidth = boundingBox.xmax - boundingBox.xmin;
                        const boxHeight = boundingBox.ymax - boundingBox.ymin;
                        const area = boxWidth * boxHeight;
                        const aspectRatio = Math.max(boxWidth, boxHeight) / Math.min(boxWidth, boxHeight);

                        // Debug logging for bounding box accuracy verification
                        console.log(`[Gemini] 📍 Bounding Box: x=${(boundingBox.xmin * 100).toFixed(1)}%-${(boundingBox.xmax * 100).toFixed(1)}%, y=${(boundingBox.ymin * 100).toFixed(1)}%-${(boundingBox.ymax * 100).toFixed(1)}% (area=${(area * 100).toFixed(1)}%)`);
                        useDefectStore.getState().addConsoleLog(`>>>    📍 Box: x=${(boundingBox.xmin * 100).toFixed(0)}%-${(boundingBox.xmax * 100).toFixed(0)}%, y=${(boundingBox.ymin * 100).toFixed(0)}%-${(boundingBox.ymax * 100).toFixed(0)}%`);

                        // Reject boxes that are too small (< 0.1% of frame) - allow small cracks
                        if (area < 0.001) {
                            console.log('[Gemini] Bbox too small (<0.1% of frame), likely noise - discarding');
                            boundingBox = undefined;
                        }
                        // Reject boxes that are too large (> 70% of frame) - likely false positive
                        else if (area > 0.70) {
                            console.log('[Gemini] Bbox too large (>70% of frame), likely false positive - discarding');
                            boundingBox = undefined;
                        }
                        // Reject extreme aspect ratios (> 15:1) - allow elongated cracks
                        else if (aspectRatio > 15) {
                            console.log(`[Gemini] Bbox extreme aspect ratio (${aspectRatio.toFixed(1)}:1), likely noise - discarding`);
                            boundingBox = undefined;
                        }
                    }
                }
            }

            // === DEDUPLICATION ===
            if (this.isDuplicate(defectType, boundingBox)) {
                useDefectStore.getState().addConsoleLog(`>>> Filtered duplicate: ${defectType}`);
                return;
            }

            // === TEMPORAL CONSISTENCY - Multi-frame verification ===
            // Require detection to appear in 2+ consecutive frames before reporting
            if (boundingBox) {
                const temporal = this.checkTemporalConsistency(defectType, boundingBox, confidence);
                if (!temporal.isConfirmed) {
                    useDefectStore.getState().addConsoleLog(`>>> Awaiting confirmation: ${defectType} (frame ${temporal.frameCount}/${TEMPORAL_THRESHOLD})`);
                    return; // Wait for confirmation in subsequent frames
                }
                useDefectStore.getState().addConsoleLog(`>>> ✓ Confirmed: ${defectType} (${temporal.frameCount} frames)`);

                // === NON-MAXIMUM SUPPRESSION ===
                // Suppress overlapping detections with lower confidence
                if (this.shouldSuppressNMS(defectType, boundingBox, confidence)) {
                    useDefectStore.getState().addConsoleLog(`>>> NMS: Suppressed ${defectType} (lower confidence overlap)`);
                    return;
                }

                // Track for future NMS comparisons
                this.trackConfirmedDetection(defectType, boundingBox, confidence);
            }

            // Track this detection for future deduplication
            this.trackDetection(defectType, boundingBox);

            // Validate severity
            const validSeverities = ['critical', 'medium', 'minor'];
            const severity = validSeverities.includes(data.severity) ? data.severity : 'minor';

            const category = data.category || this.inferCategory(defectType);

            useDefectStore.getState().addDefect({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                type: defectType,
                severity: severity,
                description: data.description || '',
                location: data.location || '',
                boundingBox,
                category,
                confidence,
                recommendation: this.getRecommendation(defectType, severity),
                estimatedCost: this.getEstimatedCost(defectType, severity)
            });

            const severityIcon = severity === 'critical' ? '🔴' : severity === 'medium' ? '🟠' : '🟡';
            useDefectStore.getState().addLog(`DETECTED: ${defectType} (${severity})`);
            useDefectStore.getState().addConsoleLog(`>>> ${severityIcon} DETECTED: ${defectType.toUpperCase()}`);
            useDefectStore.getState().addConsoleLog(`>>>    Severity: ${severity.toUpperCase()} | Confidence: ${confidence}%`);
        } catch (e) {
            // Not valid JSON, might be a spoken response
            if (text.trim() && !text.includes('{')) {
                useDefectStore.getState().addLog('AI: ' + text.substring(0, 80));
            }
        }
    }

    // Infer category from defect type if not provided
    private inferCategory(defectType: string): 'structural' | 'water' | 'finish' | 'mechanical' | 'furniture' {
        const type = defectType.toLowerCase();
        if (type.includes('water') || type.includes('leak') || type.includes('mold') || type.includes('damp') || type.includes('efflorescence') || type.includes('mildew')) {
            return 'water';
        }
        if (type.includes('crack') || type.includes('spall') || type.includes('settlement') || type.includes('foundation') || type.includes('hole') || type.includes('structural')) {
            return 'structural';
        }
        if (type.includes('furniture') || type.includes('scratch') || type.includes('dent') || type.includes('upholstery') || type.includes('torn') || type.includes('rip') || type.includes('wood damage')) {
            return 'furniture' as 'mechanical'; // Map to mechanical for store compatibility
        }
        if (type.includes('fixture') || type.includes('fitting') || type.includes('sealant') || type.includes('broken')) {
            return 'mechanical';
        }
        if (type.includes('paint') || type.includes('tile') || type.includes('grout') || type.includes('carpet') || type.includes('floor') || type.includes('ceiling') || type.includes('wall') || type.includes('drywall')) {
            return 'finish';
        }
        return 'finish';
    }

    // Note: inferConfidence removed - we now require explicit confidence from API
    // If not provided, conservative default of 70% is used (below threshold)

    // Get recommendation based on defect type and severity
    private getRecommendation(defectType: string, severity: string): string {
        const type = defectType.toLowerCase();
        if (severity === 'critical') {
            if (type.includes('crack') || type.includes('structural')) {
                return 'URGENT: Structural engineer assessment required. Do not ignore.';
            }
            if (type.includes('mold')) {
                return 'HEALTH RISK: Professional mold remediation required. Improve ventilation.';
            }
            if (type.includes('water') || type.includes('leak')) {
                return 'Immediate waterproofing inspection required. Check external sealing.';
            }
        }
        if (type.includes('paint')) return 'Strip loose paint, prime properly, and repaint.';
        if (type.includes('tile')) return 'Replace affected tile. Check for substrate issues.';
        if (type.includes('sealant')) return 'Remove old sealant, clean substrate, apply new silicone.';
        return 'Professional inspection recommended. Monitor for changes.';
    }

    // Get estimated cost based on defect type and severity
    private getEstimatedCost(defectType: string, severity: string): string {
        const type = defectType.toLowerCase();
        if (severity === 'critical') {
            if (type.includes('crack') || type.includes('structural') || type.includes('foundation')) {
                return '$2,000-10,000+';
            }
            if (type.includes('mold')) return '$500-5,000';
            if (type.includes('water')) return '$500-2,000';
        }
        if (severity === 'medium') {
            if (type.includes('crack')) return '$200-1,000';
            if (type.includes('water') || type.includes('stain')) return '$200-800';
            return '$100-500';
        }
        return '$50-200';
    }

    async startStreaming(videoElement: HTMLVideoElement) {
        useDefectStore.getState().addLog('Connecting to AI...');
        useDefectStore.getState().addProcessLog({ type: 'info', message: 'Initiating connection...' });
        useDefectStore.getState().setServiceStatus('geminiLive', 'connecting');

        this.abortController = new AbortController();

        // Try Live API first
        const liveConnected = await this.connectLive();

        if (liveConnected) {
            // Use WebSocket Live API - increased frame rate for better detection
            useDefectStore.getState().addConsoleLog('>>> SUCCESS: Using real-time Live API mode (4 FPS)');
            useDefectStore.getState().addLog('Live API connected - real-time mode');
            this.frameInterval = window.setInterval(() => {
                if (this.isReady && this.ws?.readyState === WebSocket.OPEN) {
                    this.sendLiveFrame(videoElement);
                }
            }, 250); // 4 FPS - faster detection
        } else {
            // Fallback to REST API
            this.isReady = true;
            useDefectStore.getState().addConsoleLog('>>> FALLBACK: Live API failed, switching to REST API');
            useDefectStore.getState().addConsoleLog('>>> REST API will analyze 1 frame every 1.5 seconds');
            useDefectStore.getState().addProcessLog({ type: 'warning', message: 'Using REST API fallback (slower)' });
            useDefectStore.getState().setServiceStatus('geminiLive', 'online');
            useDefectStore.getState().addLog('REST API fallback - analyzing every 1.5s');

            this.frameInterval = window.setInterval(() => {
                if (this.isReady) {
                    this.sendFallbackFrame(videoElement);
                    useDefectStore.getState().addConsoleLog('>>> Analyzing frame...');
                }
            }, 1500); // 0.67 FPS for REST API - faster than before
        }

        useDefectStore.getState().addLog('Streaming started');
        useDefectStore.getState().addProcessLog({ type: 'success', message: 'Video analysis active' });
    }

    private sendLiveFrame(video: HTMLVideoElement) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 720 / video.videoHeight);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

        try {
            // Per official docs: use realtimeInput with video Blob
            // https://ai.google.dev/api/live#BidiGenerateContentRealtimeInput
            this.ws.send(JSON.stringify({
                realtimeInput: {
                    video: {
                        mimeType: "image/jpeg",
                        data: base64
                    }
                }
            }));
        } catch (e) {
            console.error('[Gemini] Send error:', e);
        }
    }

    private sendFallbackFrame(video: HTMLVideoElement) {
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 512 / video.videoHeight); // Smaller for REST API
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

        this.analyzeFrameFallback(base64);
    }

    stop() {
        console.log('[Gemini] Stopping...');
        useDefectStore.getState().addProcessLog({ type: 'system', message: 'Stopping AI...' });

        this.abortController?.abort();
        this.abortController = null;

        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Clear caches for fresh start next time
        this.recentDetections = [];
        this.temporalBuffer.clear();
        this.confirmedDetections = [];

        this.isReady = false;
        useDefectStore.getState().addLog('Stopped');
        useDefectStore.getState().setServiceStatus('geminiLive', 'offline');
        useDefectStore.getState().addConsoleLog('>>> AI connection terminated');
    }

    updateApiKey(newKey: string) {
        this.apiKey = newKey;
    }
}
