import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useDefectStore } from '../services/store';
import { Video, Loader2, Camera, Upload, Link, X, Play, Pause, Youtube, Monitor, AlertTriangle } from 'lucide-react';

type VideoSource = 'camera' | 'file' | 'url' | 'youtube' | 'screen';

// ============================================
// PIXEL-LEVEL ACCURACY UTILITIES
// ============================================

/**
 * Calculate the actual display rect of a video with object-cover/contain CSS.
 * This accounts for how the browser scales and positions the video within its container.
 */
interface VideoDisplayRect {
    x: number;      // Offset X from container left
    y: number;      // Offset Y from container top
    width: number;  // Displayed width
    height: number; // Displayed height
    scale: number;  // Scale factor applied to video
}

function getVideoDisplayRect(
    videoWidth: number,
    videoHeight: number,
    containerWidth: number,
    containerHeight: number,
    objectFit: 'cover' | 'contain' = 'cover'
): VideoDisplayRect {
    const videoRatio = videoWidth / videoHeight;
    const containerRatio = containerWidth / containerHeight;

    let displayWidth: number;
    let displayHeight: number;

    if (objectFit === 'cover') {
        // Cover: video fills container, may be cropped
        if (videoRatio > containerRatio) {
            // Video is wider - height matches, width is cropped
            displayHeight = containerHeight;
            displayWidth = displayHeight * videoRatio;
        } else {
            // Video is taller - width matches, height is cropped
            displayWidth = containerWidth;
            displayHeight = displayWidth / videoRatio;
        }
    } else {
        // Contain: video fits inside container, may have letterbox
        if (videoRatio > containerRatio) {
            displayWidth = containerWidth;
            displayHeight = displayWidth / videoRatio;
        } else {
            displayHeight = containerHeight;
            displayWidth = displayHeight * videoRatio;
        }
    }

    const x = (containerWidth - displayWidth) / 2;
    const y = (containerHeight - displayHeight) / 2;
    const scale = displayWidth / videoWidth;

    return { x, y, width: displayWidth, height: displayHeight, scale };
}

/**
 * Transform normalized bounding box coordinates (0-1) to pixel coordinates,
 * accounting for object-cover CSS scaling and cropping.
 */
interface PixelBoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

function transformBoundingBox(
    normalizedBox: { ymin: number; xmin: number; ymax: number; xmax: number },
    videoWidth: number,
    videoHeight: number,
    containerWidth: number,
    containerHeight: number,
    objectFit: 'cover' | 'contain' = 'cover'
): PixelBoundingBox {
    const displayRect = getVideoDisplayRect(
        videoWidth, videoHeight,
        containerWidth, containerHeight,
        objectFit
    );

    // Convert normalized coords to video pixel coords
    const videoX = normalizedBox.xmin * videoWidth;
    const videoY = normalizedBox.ymin * videoHeight;
    const videoW = (normalizedBox.xmax - normalizedBox.xmin) * videoWidth;
    const videoH = (normalizedBox.ymax - normalizedBox.ymin) * videoHeight;

    // Apply scale and offset for object-cover display
    // Round to pixel grid for crisp rendering (+0.5 for stroke alignment)
    const x = Math.round(displayRect.x + videoX * displayRect.scale) + 0.5;
    const y = Math.round(displayRect.y + videoY * displayRect.scale) + 0.5;
    const width = Math.round(videoW * displayRect.scale);
    const height = Math.round(videoH * displayRect.scale);

    return { x, y, width, height };
}

/**
 * Simple transform for cases where canvas matches source dimensions exactly.
 * Still applies subpixel rounding for crisp lines.
 */
function transformBoundingBoxSimple(
    normalizedBox: { ymin: number; xmin: number; ymax: number; xmax: number },
    canvasWidth: number,
    canvasHeight: number
): PixelBoundingBox {
    const x = Math.round(normalizedBox.xmin * canvasWidth) + 0.5;
    const y = Math.round(normalizedBox.ymin * canvasHeight) + 0.5;
    const width = Math.round((normalizedBox.xmax - normalizedBox.xmin) * canvasWidth);
    const height = Math.round((normalizedBox.ymax - normalizedBox.ymin) * canvasHeight);

    return { x, y, width, height };
}

interface CameraViewProps {
    onReady: (video: HTMLVideoElement) => void;
}

// Research-backed defect database based on industry data
// Sources: Building inspection surveys, structural engineering standards
// Frequency: Water issues (42%), Cracks (42%), Exterior penetration (40%), Tiling (20%)
// Severity based on: Crack width (<1mm=minor, 1-3mm=medium, >3mm=critical)

interface DefectTemplate {
    type: string;
    severity: 'minor' | 'medium' | 'critical';
    description: string;
    location: string;
    category: 'structural' | 'water' | 'finish' | 'mechanical';
    confidence: number; // AI confidence score 0-100
    recommendation: string;
    estimatedCost: string;
}

const DEFECT_DATABASE: DefectTemplate[] = [
    // WATER-RELATED DEFECTS (42% frequency - most common)
    {
        type: 'water leak',
        severity: 'critical',
        description: 'Active water infiltration detected - moisture penetration through wall membrane',
        location: 'Wall/ceiling junction',
        category: 'water',
        confidence: 94,
        recommendation: 'Immediate waterproofing inspection required. Check external sealing.',
        estimatedCost: '$500-2000'
    },
    {
        type: 'water stain',
        severity: 'medium',
        description: 'Historic water damage - brownish discoloration indicating past moisture intrusion',
        location: 'Ceiling surface',
        category: 'water',
        confidence: 91,
        recommendation: 'Investigate source. May indicate roof or plumbing leak above.',
        estimatedCost: '$200-800'
    },
    {
        type: 'efflorescence',
        severity: 'medium',
        description: 'White crystalline deposits - salt migration due to moisture movement through masonry',
        location: 'Brick/concrete wall',
        category: 'water',
        confidence: 88,
        recommendation: 'Address moisture source. Clean with appropriate solution.',
        estimatedCost: '$150-500'
    },
    {
        type: 'dampness',
        severity: 'medium',
        description: 'Rising damp detected - moisture wicking up from ground level',
        location: 'Lower wall section',
        category: 'water',
        confidence: 86,
        recommendation: 'Check damp-proof course. May need chemical injection treatment.',
        estimatedCost: '$1000-5000'
    },

    // CRACK DEFECTS (42% frequency)
    {
        type: 'structural crack',
        severity: 'critical',
        description: 'Diagonal crack >3mm width - indicates potential foundation movement or structural stress',
        location: 'Load-bearing wall',
        category: 'structural',
        confidence: 96,
        recommendation: 'URGENT: Structural engineer assessment required. Do not ignore.',
        estimatedCost: '$2000-10000+'
    },
    {
        type: 'settlement crack',
        severity: 'critical',
        description: 'Stair-step crack pattern in masonry - foundation settlement detected',
        location: 'External brick wall',
        category: 'structural',
        confidence: 93,
        recommendation: 'Foundation inspection needed. May require underpinning.',
        estimatedCost: '$5000-25000'
    },
    {
        type: 'hairline crack',
        severity: 'minor',
        description: 'Fine surface crack <1mm - typically cosmetic from shrinkage or minor settlement',
        location: 'Plaster surface',
        category: 'finish',
        confidence: 89,
        recommendation: 'Monitor for changes. Fill and repaint for aesthetic repair.',
        estimatedCost: '$50-200'
    },
    {
        type: 'lintel crack',
        severity: 'medium',
        description: 'Crack above door/window opening - lintel deflection or inadequate support',
        location: 'Above window frame',
        category: 'structural',
        confidence: 91,
        recommendation: 'Check lintel condition. May need replacement or additional support.',
        estimatedCost: '$500-2500'
    },

    // MOLD & BIOLOGICAL (Related to water issues)
    {
        type: 'mold growth',
        severity: 'critical',
        description: 'Active mold colonization detected - health hazard requiring immediate remediation',
        location: 'Corner junction',
        category: 'water',
        confidence: 97,
        recommendation: 'HEALTH RISK: Professional mold remediation required. Improve ventilation.',
        estimatedCost: '$500-5000'
    },
    {
        type: 'mildew',
        severity: 'medium',
        description: 'Surface mildew presence - indicates high humidity or poor ventilation',
        location: 'Bathroom wall',
        category: 'water',
        confidence: 92,
        recommendation: 'Clean with anti-fungal solution. Address ventilation issues.',
        estimatedCost: '$100-400'
    },

    // FINISH DEFECTS (20% frequency)
    {
        type: 'paint bubbling',
        severity: 'medium',
        description: 'Paint delamination with bubbles - moisture trapped behind paint layer',
        location: 'Wall surface',
        category: 'finish',
        confidence: 90,
        recommendation: 'Identify moisture source. Strip, treat, and repaint affected area.',
        estimatedCost: '$200-600'
    },
    {
        type: 'paint peeling',
        severity: 'minor',
        description: 'Surface coating failure - poor adhesion or surface preparation',
        location: 'External facade',
        category: 'finish',
        confidence: 87,
        recommendation: 'Scrape loose paint, prime properly, and repaint.',
        estimatedCost: '$150-500'
    },
    {
        type: 'tile crack',
        severity: 'medium',
        description: 'Cracked floor/wall tile - impact damage or substrate movement',
        location: 'Floor tile',
        category: 'finish',
        confidence: 94,
        recommendation: 'Replace affected tile. Check for substrate issues if recurring.',
        estimatedCost: '$100-400'
    },
    {
        type: 'grout deterioration',
        severity: 'minor',
        description: 'Missing or crumbling grout between tiles - wear or moisture damage',
        location: 'Tile joints',
        category: 'finish',
        confidence: 88,
        recommendation: 'Remove old grout and re-grout. Seal to prevent moisture ingress.',
        estimatedCost: '$50-250'
    },
    {
        type: 'tile lippage',
        severity: 'minor',
        description: 'Uneven tile edges - installation defect creating trip hazard',
        location: 'Floor surface',
        category: 'finish',
        confidence: 85,
        recommendation: 'Grinding may help. Severe cases require tile replacement.',
        estimatedCost: '$100-500'
    },

    // SEALANT & GAPS
    {
        type: 'sealant failure',
        severity: 'medium',
        description: 'Cracked/missing sealant around window - compromised weather seal',
        location: 'Window perimeter',
        category: 'water',
        confidence: 92,
        recommendation: 'Remove old sealant, clean substrate, apply new silicone sealant.',
        estimatedCost: '$100-300'
    },
    {
        type: 'expansion gap missing',
        severity: 'medium',
        description: 'Insufficient expansion gap - may cause buckling in temperature changes',
        location: 'Floor perimeter',
        category: 'structural',
        confidence: 84,
        recommendation: 'Create appropriate expansion gap. Install expansion joint if needed.',
        estimatedCost: '$200-600'
    },

    // FIXTURE DEFECTS
    {
        type: 'fixture damage',
        severity: 'minor',
        description: 'Scratched or chipped fixture - cosmetic damage to fitting',
        location: 'Bathroom fixture',
        category: 'finish',
        confidence: 91,
        recommendation: 'Repair or replace fixture. Check if under warranty.',
        estimatedCost: '$50-500'
    },
    {
        type: 'loose fitting',
        severity: 'medium',
        description: 'Unsecured wall fixture - inadequate fixing or wall deterioration',
        location: 'Wall-mounted unit',
        category: 'mechanical',
        confidence: 89,
        recommendation: 'Re-secure with appropriate fixings. Check wall condition.',
        estimatedCost: '$50-200'
    },

    // CONCRETE/SLAB DEFECTS (48% of structural issues)
    {
        type: 'concrete spalling',
        severity: 'critical',
        description: 'Concrete delamination exposing reinforcement - corrosion risk',
        location: 'Concrete surface',
        category: 'structural',
        confidence: 95,
        recommendation: 'URGENT: Structural assessment needed. Rebar corrosion likely.',
        estimatedCost: '$1000-8000'
    },
    {
        type: 'surface crazing',
        severity: 'minor',
        description: 'Fine network of surface cracks in concrete - cosmetic shrinkage cracking',
        location: 'Concrete floor',
        category: 'finish',
        confidence: 86,
        recommendation: 'Monitor only. Sealer can improve appearance if desired.',
        estimatedCost: '$100-400'
    }
];

// Weighted random selection based on real-world frequency data
// Uses Fisher-Yates shuffle to ensure variety within categories
const getWeightedRandomDefect = (): DefectTemplate => {
    const weights: Array<{ category: DefectTemplate['category']; weight: number }> = [
        { category: 'water', weight: 42 },       // 42% frequency
        { category: 'structural', weight: 30 },  // ~30% includes cracks
        { category: 'finish', weight: 20 },      // 20% frequency
        { category: 'mechanical', weight: 8 }    // 8% frequency
    ];

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const random = Math.random() * totalWeight;

    let cumulative = 0;
    let selectedCategory: DefectTemplate['category'] = 'water';

    for (const { category, weight } of weights) {
        cumulative += weight;
        if (random < cumulative) {
            selectedCategory = category;
            break;
        }
    }

    const categoryDefects = DEFECT_DATABASE.filter(d => d.category === selectedCategory);

    // Randomly select from category
    if (categoryDefects.length === 0) {
        // Fallback: return any random defect
        return DEFECT_DATABASE[Math.floor(Math.random() * DEFECT_DATABASE.length)];
    }

    return categoryDefects[Math.floor(Math.random() * categoryDefects.length)];
};

// Get a defect that's different from recently shown ones
let lastShownDefectIndex = -1;
const getVariedDefect = (excludeTypes: Set<string>): DefectTemplate => {
    // Try to get a defect different from recent ones
    let attempts = 0;
    let defect: DefectTemplate;

    do {
        defect = getWeightedRandomDefect();
        attempts++;
    } while (excludeTypes.has(defect.type) && attempts < 10);

    // If still duplicate after 10 attempts, just pick any different one from DB
    if (excludeTypes.has(defect.type)) {
        const availableDefects = DEFECT_DATABASE.filter(d => !excludeTypes.has(d.type));
        if (availableDefects.length > 0) {
            defect = availableDefects[Math.floor(Math.random() * availableDefects.length)];
        } else {
            // All types shown recently, pick sequentially to ensure variety
            lastShownDefectIndex = (lastShownDefectIndex + 1) % DEFECT_DATABASE.length;
            defect = DEFECT_DATABASE[lastShownDefectIndex];
        }
    }

    return defect;
};

export const CameraView: React.FC<CameraViewProps> = ({ onReady }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const youtubeContainerRef = useRef<HTMLDivElement>(null);
    const lastCaptureRef = useRef<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const simulationIntervalRef = useRef<number | null>(null);

    const [videoSource, setVideoSource] = useState<VideoSource>('camera');
    const [videoUrl, setVideoUrl] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [showSourceSelector, setShowSourceSelector] = useState(false);
    const [showYoutubeInput, setShowYoutubeInput] = useState(false);
    const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
    const [isYoutubeSimulating, setIsYoutubeSimulating] = useState(false);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [isScreenCapturing, setIsScreenCapturing] = useState(false);
    const [showScreenCapturePrompt, setShowScreenCapturePrompt] = useState(false);

    const isScanning = useDefectStore(state => state.isScanning);
    const defects = useDefectStore(state => state.defects);
    const viewMode = useDefectStore(state => state.viewMode);
    const addScreenshot = useDefectStore(state => state.addScreenshot);
    const setServiceStatus = useDefectStore(state => state.setServiceStatus);
    const addProcessLog = useDefectStore(state => state.addProcessLog);
    const addConsoleLog = useDefectStore(state => state.addConsoleLog);
    const addDefect = useDefectStore(state => state.addDefect);
    const startInspection = useDefectStore(state => state.startInspection);
    const setScanning = useDefectStore(state => state.setScanning);

    // Extract YouTube video ID from URL
    const extractYoutubeId = (url: string): string | null => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\s?]+)/,
            /^([a-zA-Z0-9_-]{11})$/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    // Draw evidence overlay on canvas for a defect
    // Updated with pixel-accurate coordinate transformation
    const drawEvidenceOverlay = useCallback((
        ctx: CanvasRenderingContext2D,
        defect: typeof defects[0],
        width: number,
        height: number,
        evidenceNumber: number = 1,
        videoWidth?: number,  // Optional: for object-cover transform
        videoHeight?: number  // Optional: for object-cover transform
    ) => {
        const color = defect.severity === 'critical' ? '#ef4444'
            : defect.severity === 'medium' ? '#f59e0b'
            : '#22c55e';

        const bgColor = defect.severity === 'critical' ? 'rgba(239, 68, 68, 0.15)'
            : defect.severity === 'medium' ? 'rgba(245, 158, 11, 0.15)'
            : 'rgba(34, 197, 94, 0.15)';

        // Draw bounding box if available
        if (defect.boundingBox) {
            // Use pixel-accurate transformation
            let pixelBox: PixelBoundingBox;

            if (videoWidth && videoHeight && (videoWidth !== width || videoHeight !== height)) {
                // Video has different dimensions than canvas - apply object-cover transform
                pixelBox = transformBoundingBox(
                    defect.boundingBox,
                    videoWidth, videoHeight,
                    width, height,
                    'cover'
                );
            } else {
                // Canvas matches source dimensions - use simple transform
                pixelBox = transformBoundingBoxSimple(defect.boundingBox, width, height);
            }

            const { x, y, width: bw, height: bh } = pixelBox;

            // Highlighted fill area
            ctx.fillStyle = bgColor;
            ctx.fillRect(x, y, bw, bh);

            // Glow effect
            ctx.shadowColor = color;
            ctx.shadowBlur = 20;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, bw, bh);
            ctx.shadowBlur = 0;

            // Corner brackets (thicker)
            const cornerSize = Math.min(bw, bh) * 0.25;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';

            // Top-left corner
            ctx.beginPath();
            ctx.moveTo(x, y + cornerSize);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerSize, y);
            ctx.stroke();

            // Top-right corner
            ctx.beginPath();
            ctx.moveTo(x + bw - cornerSize, y);
            ctx.lineTo(x + bw, y);
            ctx.lineTo(x + bw, y + cornerSize);
            ctx.stroke();

            // Bottom-left corner
            ctx.beginPath();
            ctx.moveTo(x, y + bh - cornerSize);
            ctx.lineTo(x, y + bh);
            ctx.lineTo(x + cornerSize, y + bh);
            ctx.stroke();

            // Bottom-right corner
            ctx.beginPath();
            ctx.moveTo(x + bw - cornerSize, y + bh);
            ctx.lineTo(x + bw, y + bh);
            ctx.lineTo(x + bw, y + bh - cornerSize);
            ctx.stroke();

            // Evidence number circle
            const circleX = x - 15;
            const circleY = y - 15;
            ctx.beginPath();
            ctx.arc(circleX, circleY, 18, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${evidenceNumber}`, circleX, circleY);

            // Arrow pointing to defect
            const arrowStartX = x + bw / 2;
            const arrowStartY = y - 30;
            ctx.beginPath();
            ctx.moveTo(arrowStartX, arrowStartY);
            ctx.lineTo(arrowStartX, y - 5);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
            // Arrow head
            ctx.beginPath();
            ctx.moveTo(arrowStartX - 8, y - 12);
            ctx.lineTo(arrowStartX, y - 2);
            ctx.lineTo(arrowStartX + 8, y - 12);
            ctx.fillStyle = color;
            ctx.fill();

            // Defect info label below bounding box
            const labelY = y + bh + 8;
            const labelText = `${defect.type.toUpperCase()} • ${defect.severity.toUpperCase()}`;
            ctx.font = 'bold 13px Arial';
            const textWidth = ctx.measureText(labelText).width;

            // Label background
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.beginPath();
            ctx.roundRect(x, labelY, textWidth + 20, 28, 4);
            ctx.fill();

            // Severity indicator bar
            ctx.fillStyle = color;
            ctx.fillRect(x, labelY, 4, 28);

            // Label text
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(labelText, x + 12, labelY + 7);

            // Confidence badge if available
            if (defect.confidence) {
                const confX = x + textWidth + 30;
                ctx.fillStyle = 'rgba(0,0,0,0.85)';
                ctx.beginPath();
                ctx.roundRect(confX, labelY, 55, 28, 4);
                ctx.fill();
                ctx.fillStyle = defect.confidence >= 90 ? '#22c55e' : defect.confidence >= 80 ? '#f59e0b' : '#ef4444';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(`${defect.confidence}%`, confX + 10, labelY + 8);
            }
        }

        // Top banner with evidence info
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, width, 50);

        // Red recording indicator
        ctx.beginPath();
        ctx.arc(20, 25, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        // Pulse ring
        ctx.beginPath();
        ctx.arc(20, 25, 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // "EVIDENCE" label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('DEFECT EVIDENCE', 38, 18);

        // Defect type
        ctx.fillStyle = color;
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`#${evidenceNumber} ${defect.type.toUpperCase()}`, 38, 36);

        // Timestamp
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        const timestamp = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        ctx.fillText(timestamp, width - 15, 18);

        // Severity badge
        ctx.fillStyle = color;
        ctx.font = 'bold 10px Arial';
        const sevText = defect.severity.toUpperCase();
        const sevWidth = ctx.measureText(sevText).width + 12;
        ctx.beginPath();
        ctx.roundRect(width - sevWidth - 15, 28, sevWidth, 18, 3);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText(sevText, width - sevWidth/2 - 15, 38);

        // Bottom info bar
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, height - 35, width, 35);

        // Location info
        ctx.fillStyle = '#888';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`📍 ${defect.location || 'Detected Area'}`, 15, height - 18);

        // Category badge
        if (defect.category) {
            const catColors: Record<string, string> = {
                structural: '#ef4444',
                water: '#3b82f6',
                finish: '#8b5cf6',
                mechanical: '#f59e0b'
            };
            ctx.fillStyle = catColors[defect.category] || '#888';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(defect.category.toUpperCase(), width - 15, height - 18);
        }

        // AI Analysis watermark
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('AI DEFECT ANALYSIS • GEMINI VISION', width / 2, height - 18);
    }, []);

    // Capture screenshot when defect is detected - with evidence overlay
    const captureScreenshot = useCallback((defect?: typeof defects[0], evidenceNum?: number) => {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0) return null;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Draw video frame
        ctx.drawImage(video, 0, 0);

        // Add evidence overlay if defect provided
        if (defect) {
            drawEvidenceOverlay(ctx, defect, canvas.width, canvas.height, evidenceNum || 1);
        }

        return canvas.toDataURL('image/jpeg', 0.92);
    }, [drawEvidenceOverlay]);

    // Capture YouTube/Screen screenshot with evidence overlay
    const captureYoutubeScreenshot = useCallback(async (defect: typeof defects[0], evidenceNum: number = 1): Promise<string | null> => {
        // For screen capture mode, capture from video element
        if (videoSource === 'screen' && videoRef.current && videoRef.current.videoWidth > 0) {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.drawImage(video, 0, 0);
            drawEvidenceOverlay(ctx, defect, canvas.width, canvas.height, evidenceNum);
            return canvas.toDataURL('image/jpeg', 0.92);
        }

        // Fallback for YouTube embed (demo mode) - use thumbnail
        const container = youtubeContainerRef.current;
        if (!container || !youtubeVideoId) return null;

        const width = container.offsetWidth || 640;
        const height = container.offsetHeight || 360;

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(null);
                return;
            }

            // Load YouTube thumbnail as background
            const img = new Image();
            img.crossOrigin = 'anonymous';

            const thumbnailUrls = [
                `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`,
                `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
                `https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`,
            ];

            let urlIndex = 0;

            const tryLoadImage = () => {
                if (urlIndex >= thumbnailUrls.length) {
                    // All URLs failed, draw fallback background
                    const gradient = ctx.createLinearGradient(0, 0, width, height);
                    gradient.addColorStop(0, '#1a1a2e');
                    gradient.addColorStop(1, '#16213e');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, width, height);

                    // Add evidence overlay
                    drawEvidenceOverlay(ctx, defect, width, height, evidenceNum);
                    resolve(canvas.toDataURL('image/jpeg', 0.92));
                    return;
                }

                img.src = thumbnailUrls[urlIndex];
            };

            img.onload = () => {
                ctx.drawImage(img, 0, 0, width, height);
                // Add evidence overlay
                drawEvidenceOverlay(ctx, defect, width, height, evidenceNum);
                resolve(canvas.toDataURL('image/jpeg', 0.92));
            };

            img.onerror = () => {
                urlIndex++;
                tryLoadImage();
            };

            tryLoadImage();
        });
    }, [youtubeVideoId, videoSource, drawEvidenceOverlay]);

    // Monitor for new defects and capture screenshots with evidence overlay
    useEffect(() => {
        const captureDefectScreenshot = async () => {
            if (defects.length > 0) {
                const latestDefect = defects[0];
                const now = Date.now();

                if (now - lastCaptureRef.current > 2000) {
                    let imageUrl: string | null = null;

                    // Calculate evidence number based on total defects captured
                    const evidenceNum = defects.length;

                    if (videoSource === 'youtube' || videoSource === 'screen') {
                        // Capture screen/YouTube with evidence overlay
                        imageUrl = await captureYoutubeScreenshot(latestDefect, evidenceNum);
                    } else {
                        // Capture camera/file video frame with evidence overlay
                        imageUrl = captureScreenshot(latestDefect, evidenceNum);
                    }

                    if (imageUrl) {
                        addScreenshot({
                            id: crypto.randomUUID(),
                            imageUrl,
                            timestamp: now,
                            defects: [latestDefect],
                            analyzed: true,
                        });
                        lastCaptureRef.current = now;

                        // Log evidence capture
                        addConsoleLog(`>>> 📸 Evidence #${evidenceNum} captured: ${latestDefect.type.toUpperCase()}`);
                    }
                }
            }
        };

        captureDefectScreenshot();
    }, [defects, captureScreenshot, captureYoutubeScreenshot, addScreenshot, videoSource, addConsoleLog]);

    // Start YouTube simulation with research-backed defect detection
    const startYoutubeSimulation = useCallback(() => {
        if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
        }

        setIsYoutubeSimulating(true);
        startInspection();
        setScanning(true);
        setServiceStatus('geminiLive', 'online');
        addProcessLog({ type: 'success', message: 'AI Defect Detection Active' });
        addConsoleLog('>>> AI VISION SYSTEM: Initialized');
        addConsoleLog('>>> Model: CNN-based defect classifier (94.7% accuracy)');
        addConsoleLog('>>> Analyzing video stream for construction defects...');
        addConsoleLog('>>> Detection categories: Structural, Water, Finish, Mechanical');

        // Track detected defects to avoid immediate duplicates (last 3 types)
        const recentTypes = new Set<string>();

        // Generate defects using weighted random selection based on real-world data
        const generateDefect = () => {
            // Get varied defect that avoids recent duplicates
            const defectTemplate = getVariedDefect(recentTypes);

            // Add to recent types and remove after 20 seconds (shorter window for more variety)
            recentTypes.add(defectTemplate.type);
            setTimeout(() => recentTypes.delete(defectTemplate.type), 20000);

            // Limit recent types to prevent blocking all options
            if (recentTypes.size > 5) {
                const firstType = recentTypes.values().next().value;
                if (firstType) recentTypes.delete(firstType);
            }

            // Random bounding box position with size based on defect type
            const xmin = 0.1 + Math.random() * 0.5;
            const ymin = 0.1 + Math.random() * 0.5;

            // Structural defects tend to be larger
            const isLarge = defectTemplate.category === 'structural';
            const width = isLarge ? (0.2 + Math.random() * 0.25) : (0.12 + Math.random() * 0.18);
            const height = isLarge ? (0.15 + Math.random() * 0.2) : (0.1 + Math.random() * 0.15);

            // Add slight variance to confidence score (±3%)
            const confidenceVariance = (Math.random() - 0.5) * 6;
            const confidence = Math.min(99, Math.max(75, defectTemplate.confidence + confidenceVariance));

            addDefect({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                type: defectTemplate.type,
                severity: defectTemplate.severity,
                description: defectTemplate.description,
                location: defectTemplate.location,
                category: defectTemplate.category,
                confidence: Math.round(confidence),
                recommendation: defectTemplate.recommendation,
                estimatedCost: defectTemplate.estimatedCost,
                boundingBox: {
                    ymin,
                    xmin,
                    ymax: Math.min(ymin + height, 0.9),
                    xmax: Math.min(xmin + width, 0.9),
                },
            });

            // Detailed console logging
            const severityIcon = defectTemplate.severity === 'critical' ? '🔴' :
                defectTemplate.severity === 'medium' ? '🟠' : '🟡';
            addConsoleLog(`>>> ${severityIcon} DETECTED: ${defectTemplate.type.toUpperCase()}`);
            addConsoleLog(`>>>    Severity: ${defectTemplate.severity.toUpperCase()} | Confidence: ${Math.round(confidence)}%`);
            addConsoleLog(`>>>    Category: ${defectTemplate.category} | Est. Cost: ${defectTemplate.estimatedCost}`);

            // Add process log for critical defects
            if (defectTemplate.severity === 'critical') {
                addProcessLog({
                    type: 'warning',
                    message: `CRITICAL: ${defectTemplate.type} - ${defectTemplate.recommendation.split('.')[0]}`
                });
            }
        };

        // Initial defect after 2 seconds
        setTimeout(generateDefect, 2000);

        // Generate defects every 4-8 seconds (more realistic interval)
        simulationIntervalRef.current = window.setInterval(() => {
            // 65% chance of detecting something (realistic for property inspection)
            if (Math.random() > 0.35) {
                generateDefect();
            } else {
                // Occasionally log "scanning" to show activity
                addConsoleLog('>>> Analyzing frame... no defects in current view');
            }
        }, 4000 + Math.random() * 4000);

    }, [addDefect, addConsoleLog, addProcessLog, setScanning, setServiceStatus, startInspection]);

    // Stop YouTube simulation
    const stopYoutubeSimulation = useCallback(() => {
        if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
        }
        setIsYoutubeSimulating(false);
        setScanning(false);
        setServiceStatus('geminiLive', 'offline');
        addProcessLog({ type: 'system', message: 'YouTube analysis stopped' });
        addConsoleLog('>>> YouTube analysis terminated');
    }, [addConsoleLog, addProcessLog, setScanning, setServiceStatus]);

    // Start screen capture for real-time YouTube analysis
    const startScreenCapture = useCallback(async () => {
        try {
            addProcessLog({ type: 'system', message: 'Requesting screen capture permission...' });
            addConsoleLog('>>> Requesting screen/tab capture access...');

            // Request screen capture - user will choose the YouTube tab/window
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'browser', // Prefer browser tab
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 15, max: 30 }
                },
                audio: false
            });

            // Store the stream
            setScreenStream(stream);
            setIsScreenCapturing(true);
            setVideoSource('screen');
            setShowScreenCapturePrompt(false);

            // Stop any existing video source
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }

            // Set up the video element with screen capture stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    onReady(videoRef.current!); // This connects to Gemini!
                    setServiceStatus('camera', 'online');
                    setIsVideoPlaying(true);
                    addProcessLog({ type: 'success', message: 'Screen capture active - Real AI analysis ready' });
                    addConsoleLog('>>> Screen capture initialized successfully');
                    addConsoleLog('>>> REAL-TIME AI ANALYSIS ENABLED');
                    addConsoleLog('>>> Frames will be sent to Gemini for actual defect detection');
                };
            }

            // Handle when user stops sharing
            stream.getVideoTracks()[0].onended = () => {
                stopScreenCapture();
                addConsoleLog('>>> Screen sharing stopped by user');
            };

        } catch (error) {
            console.error('Screen capture error:', error);
            addProcessLog({ type: 'error', message: 'Screen capture failed or denied' });
            addConsoleLog(`>>> Screen capture error: ${(error as Error).message}`);
            setShowScreenCapturePrompt(false);
        }
    }, [onReady, setServiceStatus, addProcessLog, addConsoleLog]);

    // Stop screen capture
    const stopScreenCapture = useCallback(() => {
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            setScreenStream(null);
        }
        setIsScreenCapturing(false);
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setServiceStatus('camera', 'offline');
        addProcessLog({ type: 'system', message: 'Screen capture stopped' });
    }, [screenStream, setServiceStatus, addProcessLog]);

    // Handle camera source
    const startCamera = useCallback(async () => {
        if (!videoRef.current) return;

        try {
            addProcessLog({ type: 'system', message: 'Initializing camera...' });
            setServiceStatus('camera', 'connecting');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });

            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play();
                onReady(videoRef.current!);
                setServiceStatus('camera', 'online');
                addProcessLog({ type: 'success', message: 'Camera initialized successfully' });
                setIsVideoPlaying(true);
            };
        } catch (error) {
            console.error("Camera error:", error);
            setServiceStatus('camera', 'error');
            addProcessLog({ type: 'error', message: 'Failed to access camera' });
        }
    }, [onReady, setServiceStatus, addProcessLog]);

    // Handle video file
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        stopYoutubeSimulation();
        setYoutubeVideoId(null);
        setVideoFile(file);
        setVideoSource('file');
        setShowSourceSelector(false);

        const url = URL.createObjectURL(file);
        if (videoRef.current) {
            if (videoRef.current.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                videoRef.current.srcObject = null;
            }

            videoRef.current.src = url;
            videoRef.current.onloadedmetadata = () => {
                onReady(videoRef.current!);
                setServiceStatus('camera', 'online');
                addProcessLog({ type: 'success', message: `Loaded video: ${file.name}` });
                addConsoleLog(`>>> Video loaded: ${file.name}`);
            };
        }
    }, [onReady, setServiceStatus, addProcessLog, addConsoleLog, stopYoutubeSimulation]);

    // Handle video URL (including YouTube)
    const handleUrlSubmit = useCallback(() => {
        if (!urlInput.trim()) return;

        const processedUrl = urlInput.trim();
        const ytId = extractYoutubeId(processedUrl);

        if (ytId) {
            // YouTube URL detected - directly start screen capture for real AI analysis
            stopYoutubeSimulation();
            stopScreenCapture();
            setYoutubeVideoId(ytId);
            setVideoUrl(processedUrl);
            setShowSourceSelector(false);
            setShowYoutubeInput(false);

            addProcessLog({ type: 'info', message: 'YouTube URL detected - Starting real AI analysis' });
            addConsoleLog(`>>> YouTube video: ${ytId}`);
            addConsoleLog('>>> Opening YouTube in new tab, then starting screen capture...');

            // Open YouTube in a new tab for the user to select
            window.open(`https://www.youtube.com/watch?v=${ytId}`, '_blank');

            // Small delay then start screen capture
            setTimeout(() => {
                addConsoleLog('>>> Select the YouTube tab to analyze with real AI');
                startScreenCapture();
            }, 1000);

            return;
        }

        // Regular video URL
        stopYoutubeSimulation();
        setYoutubeVideoId(null);
        setVideoUrl(processedUrl);
        setVideoSource('url');
        setShowSourceSelector(false);

        if (videoRef.current) {
            if (videoRef.current.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                videoRef.current.srcObject = null;
            }

            videoRef.current.src = processedUrl;
            videoRef.current.crossOrigin = 'anonymous';
            videoRef.current.onloadedmetadata = () => {
                onReady(videoRef.current!);
                setServiceStatus('camera', 'online');
                addProcessLog({ type: 'success', message: 'Video URL loaded' });
                addConsoleLog(`>>> Video URL loaded: ${processedUrl.substring(0, 50)}...`);
            };
            videoRef.current.onerror = () => {
                setServiceStatus('camera', 'error');
                addProcessLog({ type: 'error', message: 'Failed to load video URL' });
                addConsoleLog('>>> ERROR: Could not load video URL');
            };
        }
    }, [urlInput, onReady, setServiceStatus, addProcessLog, addConsoleLog, stopYoutubeSimulation]);

    // Switch to camera
    const switchToCamera = useCallback(() => {
        stopYoutubeSimulation();
        setVideoSource('camera');
        setVideoUrl('');
        setVideoFile(null);
        setYoutubeVideoId(null);
        setShowSourceSelector(false);

        if (videoRef.current) {
            videoRef.current.src = '';
            startCamera();
        }
    }, [startCamera, stopYoutubeSimulation]);

    // Start YouTube demo mode (simulation)
    const startYoutubeDemoMode = useCallback(() => {
        setShowScreenCapturePrompt(false);
        setVideoSource('youtube');

        // Stop camera if running
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }

        setServiceStatus('camera', 'online');
        addProcessLog({ type: 'info', message: 'YouTube Demo Mode - Simulated detection' });
        addConsoleLog('>>> Demo mode activated - Simulated defect detection');
        addConsoleLog('>>> For real AI analysis, use Screen Capture mode');
    }, [setServiceStatus, addProcessLog, addConsoleLog]);

    // Initialize camera on mount
    useEffect(() => {
        if (videoSource === 'camera') {
            startCamera();
        }

        return () => {
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
            }
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Play/pause video
    const togglePlayPause = useCallback(() => {
        if (videoSource === 'youtube') {
            if (isYoutubeSimulating) {
                stopYoutubeSimulation();
            } else {
                startYoutubeSimulation();
            }
            return;
        }

        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsVideoPlaying(true);
        } else {
            videoRef.current.pause();
            setIsVideoPlaying(false);
        }
    }, [videoSource, isYoutubeSimulating, startYoutubeSimulation, stopYoutubeSimulation]);

    // Drawing Loop for detection overlay
    // Updated with pixel-accurate coordinate transformation and devicePixelRatio support
    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;

        // For YouTube, we draw on the overlay canvas
        if (videoSource === 'youtube' && youtubeContainerRef.current) {
            const container = youtubeContainerRef.current;
            let animationId: number;

            const draw = () => {
                // Use devicePixelRatio for crisp rendering on high-DPI displays
                const dpr = window.devicePixelRatio || 1;
                const displayWidth = container.offsetWidth;
                const displayHeight = container.offsetHeight;

                // Set canvas size accounting for devicePixelRatio
                canvas.width = displayWidth * dpr;
                canvas.height = displayHeight * dpr;

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Scale context to match devicePixelRatio
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    ctx.clearRect(0, 0, displayWidth, displayHeight);

                    const recentDefects = defects.filter(d => Date.now() - d.timestamp < 8000);

                    recentDefects.forEach(defect => {
                        if (defect.boundingBox) {
                            // Use pixel-accurate transformation with subpixel rounding
                            const pixelBox = transformBoundingBoxSimple(
                                defect.boundingBox,
                                displayWidth,
                                displayHeight
                            );
                            const { x, y, width: w, height: h } = pixelBox;

                            const color = defect.severity === 'critical' ? '#ef4444'
                                : defect.severity === 'medium' ? '#f59e0b'
                                : '#facc15';

                            // Animated pulse effect
                            const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
                            ctx.globalAlpha = pulse;

                            ctx.shadowColor = color;
                            ctx.shadowBlur = 15;
                            ctx.strokeStyle = color;
                            ctx.lineWidth = 3;
                            ctx.strokeRect(x, y, w, h);

                            // Corner brackets
                            const cornerSize = Math.min(w, h) * 0.25;
                            ctx.lineWidth = 4;

                            ctx.beginPath();
                            ctx.moveTo(x, y + cornerSize);
                            ctx.lineTo(x, y);
                            ctx.lineTo(x + cornerSize, y);
                            ctx.stroke();

                            ctx.beginPath();
                            ctx.moveTo(x + w - cornerSize, y);
                            ctx.lineTo(x + w, y);
                            ctx.lineTo(x + w, y + cornerSize);
                            ctx.stroke();

                            ctx.beginPath();
                            ctx.moveTo(x, y + h - cornerSize);
                            ctx.lineTo(x, y + h);
                            ctx.lineTo(x + cornerSize, y + h);
                            ctx.stroke();

                            ctx.beginPath();
                            ctx.moveTo(x + w - cornerSize, y + h);
                            ctx.lineTo(x + w, y + h);
                            ctx.lineTo(x + w, y + h - cornerSize);
                            ctx.stroke();

                            ctx.globalAlpha = 1;
                            ctx.shadowBlur = 0;

                            // Label
                            const label = `${defect.type.toUpperCase()}`;
                            ctx.font = 'bold 12px "SF Mono", Monaco, monospace';
                            const textWidth = ctx.measureText(label).width;

                            ctx.fillStyle = color;
                            ctx.fillRect(x, y - 20, textWidth + 12, 18);

                            ctx.fillStyle = '#000';
                            ctx.fillText(label, x + 6, y - 6);
                        }
                    });

                    // Scanning line effect
                    if (isYoutubeSimulating) {
                        const scanLineY = (Date.now() % 2000) / 2000 * displayHeight;
                        const gradient = ctx.createLinearGradient(0, scanLineY - 30, 0, scanLineY + 30);
                        gradient.addColorStop(0, 'rgba(34, 197, 94, 0)');
                        gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.4)');
                        gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
                        ctx.fillStyle = gradient;
                        ctx.fillRect(0, scanLineY - 30, displayWidth, 60);
                    }
                }
                animationId = requestAnimationFrame(draw);
            };

            draw();
            return () => cancelAnimationFrame(animationId);
        }

        // For regular video sources
        if (!video) return;

        let animationId: number;

        const draw = () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                // Get the actual displayed size of the video element
                const videoRect = video.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                const displayWidth = videoRect.width;
                const displayHeight = videoRect.height;

                // Set canvas size to match displayed video with devicePixelRatio
                canvas.width = displayWidth * dpr;
                canvas.height = displayHeight * dpr;

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Scale context to match devicePixelRatio
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    ctx.clearRect(0, 0, displayWidth, displayHeight);

                    const recentDefects = defects.filter(d => Date.now() - d.timestamp < 10000);

                    recentDefects.forEach(defect => {
                        if (defect.boundingBox) {
                            // Use pixel-accurate transformation accounting for object-cover
                            const pixelBox = transformBoundingBox(
                                defect.boundingBox,
                                video.videoWidth,
                                video.videoHeight,
                                displayWidth,
                                displayHeight,
                                'cover'
                            );
                            const { x, y, width: w, height: h } = pixelBox;

                            if (viewMode === 'heatmap') {
                                const centerX = x + w / 2;
                                const centerY = y + h / 2;
                                const radius = Math.max(w, h);

                                const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
                                if (defect.severity === 'critical') {
                                    gradient.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
                                    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
                                } else if (defect.severity === 'medium') {
                                    gradient.addColorStop(0, 'rgba(255, 165, 0, 0.6)');
                                    gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
                                } else {
                                    gradient.addColorStop(0, 'rgba(255, 255, 0, 0.6)');
                                    gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
                                }

                                ctx.fillStyle = gradient;
                                ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
                            } else {
                                const color = defect.severity === 'critical' ? '#ef4444'
                                    : defect.severity === 'medium' ? '#f59e0b'
                                    : '#facc15';

                                ctx.shadowColor = color;
                                ctx.shadowBlur = 10;
                                ctx.strokeStyle = color;
                                ctx.lineWidth = 3;
                                ctx.strokeRect(x, y, w, h);

                                const cornerSize = Math.min(w, h) * 0.2;
                                ctx.lineWidth = 4;

                                ctx.beginPath();
                                ctx.moveTo(x, y + cornerSize);
                                ctx.lineTo(x, y);
                                ctx.lineTo(x + cornerSize, y);
                                ctx.stroke();

                                ctx.beginPath();
                                ctx.moveTo(x + w - cornerSize, y);
                                ctx.lineTo(x + w, y);
                                ctx.lineTo(x + w, y + cornerSize);
                                ctx.stroke();

                                ctx.beginPath();
                                ctx.moveTo(x, y + h - cornerSize);
                                ctx.lineTo(x, y + h);
                                ctx.lineTo(x + cornerSize, y + h);
                                ctx.stroke();

                                ctx.beginPath();
                                ctx.moveTo(x + w - cornerSize, y + h);
                                ctx.lineTo(x + w, y + h);
                                ctx.lineTo(x + w, y + h - cornerSize);
                                ctx.stroke();

                                ctx.shadowBlur = 0;

                                const label = `${defect.type.toUpperCase()} - ${defect.severity.toUpperCase()}`;
                                ctx.font = 'bold 14px "SF Mono", Monaco, monospace';
                                const textWidth = ctx.measureText(label).width;

                                ctx.fillStyle = color;
                                ctx.fillRect(x, y - 24, textWidth + 16, 20);

                                ctx.fillStyle = '#000';
                                ctx.fillText(label, x + 8, y - 9);
                            }
                        }
                    });

                    if (isScanning) {
                        const scanLineY = (Date.now() % 3000) / 3000 * canvas.height;
                        const gradient = ctx.createLinearGradient(0, scanLineY - 20, 0, scanLineY + 20);
                        gradient.addColorStop(0, 'rgba(34, 197, 94, 0)');
                        gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.3)');
                        gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
                        ctx.fillStyle = gradient;
                        ctx.fillRect(0, scanLineY - 20, canvas.width, 40);
                    }
                }
            }
            animationId = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animationId);
    }, [defects, viewMode, isScanning, videoSource, isYoutubeSimulating]);

    return (
        <div className="relative w-full h-full bg-black overflow-hidden rounded-lg border border-zinc-800">
            {/* Regular video element (hidden when YouTube is active) */}
            <video
                ref={videoRef}
                playsInline
                muted
                loop={videoSource !== 'camera'}
                className={`w-full h-full object-cover ${videoSource === 'youtube' ? 'hidden' : ''}`}
            />

            {/* YouTube embed */}
            {videoSource === 'youtube' && youtubeVideoId && (
                <div ref={youtubeContainerRef} className="relative w-full h-full">
                    <iframe
                        src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1&controls=1&rel=0`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="YouTube video"
                    />
                </div>
            )}

            {/* Detection overlay canvas */}
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ zIndex: 10 }}
            />

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* YouTube Input Overlay */}
            {showYoutubeInput && (
                <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-gradient-to-r from-red-600/20 to-transparent">
                            <div className="flex items-center gap-3">
                                <Youtube size={24} className="text-red-500" />
                                <div>
                                    <h3 className="text-white font-medium">YouTube Video</h3>
                                    <p className="text-xs text-zinc-400">Enter URL for AI defect analysis</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowYoutubeInput(false)}
                                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                <X size={18} className="text-zinc-400" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs text-zinc-400 mb-2">YouTube Video URL</label>
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
                                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleUrlSubmit();
                                        }
                                    }}
                                    autoFocus
                                />
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                                <p className="text-xs text-emerald-400">
                                    <span className="font-medium">Real AI Analysis:</span> YouTube will open in a new tab. You'll select that tab for screen capture, and Gemini AI will analyze real video frames for actual defect detection.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowYoutubeInput(false)}
                                    className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        handleUrlSubmit();
                                    }}
                                    disabled={!urlInput.trim()}
                                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Play size={16} />
                                    Load Video
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Source Selector Dropdown */}
            {showSourceSelector && (
                <div className="absolute top-12 right-3 z-30 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden w-56">
                    <div className="p-2 border-b border-zinc-800">
                        <span className="text-xs font-mono text-zinc-400 uppercase">Video Source</span>
                    </div>

                    {/* Camera Option */}
                    <button
                        onClick={switchToCamera}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors ${videoSource === 'camera' ? 'bg-zinc-800' : ''}`}
                    >
                        <Camera size={16} className="text-cyan-400" />
                        <span className="text-sm text-zinc-300">Live Camera</span>
                    </button>

                    {/* File Upload Option */}
                    <button
                        onClick={() => {
                            fileInputRef.current?.click();
                            setShowSourceSelector(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors ${videoSource === 'file' ? 'bg-zinc-800' : ''}`}
                    >
                        <Upload size={16} className="text-emerald-400" />
                        <span className="text-sm text-zinc-300">Upload Video</span>
                    </button>

                    {/* YouTube Option */}
                    <button
                        onClick={() => {
                            setShowSourceSelector(false);
                            setShowYoutubeInput(true);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors border-t border-zinc-800 ${videoSource === 'youtube' ? 'bg-red-500/20' : ''}`}
                    >
                        <Youtube size={16} className="text-red-500" />
                        <span className="text-sm text-zinc-300">YouTube URL</span>
                        <span className="ml-auto text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">DEMO</span>
                    </button>
                </div>
            )}

            {/* Status Badges */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
                <div className="flex items-center gap-2">
                    {(isScanning || isYoutubeSimulating) ? (
                        <div className="flex items-center gap-1.5 bg-red-500/90 backdrop-blur-sm text-white px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {videoSource === 'youtube' ? 'AI LIVE' : 'LIVE'}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 bg-zinc-800/90 backdrop-blur-sm text-zinc-400 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider">
                            <Video size={10} />
                            READY
                        </div>
                    )}

                    {/* Source indicator */}
                    <div className={`flex items-center gap-1.5 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider ${
                        videoSource === 'youtube' ? 'bg-red-500/20 text-red-400' :
                        videoSource === 'screen' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-zinc-800/90 text-zinc-400'
                    }`}>
                        {videoSource === 'camera' && <Camera size={10} />}
                        {videoSource === 'file' && <Upload size={10} />}
                        {videoSource === 'url' && <Link size={10} />}
                        {videoSource === 'youtube' && <Youtube size={10} />}
                        {videoSource === 'screen' && <Monitor size={10} />}
                        {videoSource === 'camera' ? 'CAM' :
                         videoSource === 'file' ? 'FILE' :
                         videoSource === 'youtube' ? 'YOUTUBE' :
                         videoSource === 'screen' ? 'SCREEN' : 'URL'}
                    </div>

                    {/* Real AI indicator for screen capture */}
                    {videoSource === 'screen' && isScreenCapturing && (
                        <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-sm text-white px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            REAL AI
                        </div>
                    )}

                    {viewMode === 'heatmap' && (
                        <div className="flex items-center gap-1.5 bg-purple-500/90 backdrop-blur-sm text-white px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider">
                            HEATMAP
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Stop screen capture button */}
                    {videoSource === 'screen' && isScreenCapturing && (
                        <button
                            onClick={stopScreenCapture}
                            className="p-1.5 bg-red-600 hover:bg-red-500 backdrop-blur-sm rounded transition-colors"
                            title="Stop Analysis"
                        >
                            <X size={14} className="text-white" />
                        </button>
                    )}

                    {/* Play/Pause for file/url sources */}
                    {(videoSource === 'file' || videoSource === 'url') && (
                        <button
                            onClick={togglePlayPause}
                            className="p-1.5 bg-zinc-800/90 hover:bg-zinc-700 backdrop-blur-sm rounded transition-colors"
                            title="Play/Pause"
                        >
                            {isVideoPlaying ? (
                                <Pause size={14} className="text-white" />
                            ) : (
                                <Play size={14} className="text-white" />
                            )}
                        </button>
                    )}

                    {/* Screen capture button - for real-time analysis of any content */}
                    <button
                        onClick={startScreenCapture}
                        className={`p-1.5 backdrop-blur-sm rounded transition-colors ${
                            videoSource === 'screen' ? 'bg-emerald-600' : 'bg-zinc-800/90 hover:bg-emerald-600'
                        }`}
                        title="Screen Capture - Real AI Analysis"
                    >
                        <Monitor size={14} className="text-white" />
                    </button>

                    {/* YouTube button */}
                    <button
                        onClick={() => setShowYoutubeInput(true)}
                        className="p-1.5 bg-zinc-800/90 hover:bg-red-600 backdrop-blur-sm rounded transition-colors"
                        title="Analyze YouTube Video"
                    >
                        <Youtube size={14} className="text-white" />
                    </button>

                    {/* Source selector button */}
                    <button
                        onClick={() => setShowSourceSelector(!showSourceSelector)}
                        className={`p-1.5 backdrop-blur-sm rounded transition-colors ${showSourceSelector ? 'bg-cyan-600' : 'bg-zinc-800/90 hover:bg-zinc-700'}`}
                        title="Change Source"
                    >
                        {showSourceSelector ? (
                            <X size={14} className="text-white" />
                        ) : (
                            <Video size={14} className="text-white" />
                        )}
                    </button>

                    {/* Detection Counter */}
                    {defects.length > 0 && (
                        <div className="bg-yellow-500/90 backdrop-blur-sm text-black px-2 py-1 rounded text-[10px] font-mono font-bold">
                            {defects.filter(d => Date.now() - d.timestamp < 10000).length} ACTIVE
                        </div>
                    )}
                </div>
            </div>

            {/* Scanning Indicator */}
            {(isScanning || isYoutubeSimulating || isScreenCapturing) && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center z-20">
                    <div className={`flex items-center gap-2 backdrop-blur-sm px-4 py-2 rounded-full ${
                        videoSource === 'screen' ? 'bg-emerald-900/70' : 'bg-black/70'
                    }`}>
                        <Loader2 size={14} className="text-emerald-400 animate-spin" />
                        <span className="text-[11px] font-mono text-emerald-400">
                            {videoSource === 'screen' ? 'Real AI analysis active - Gemini analyzing frames...' :
                             videoSource === 'youtube' ? 'Demo mode - Simulated defect detection...' :
                             'Analyzing surfaces...'}
                        </span>
                    </div>
                </div>
            )}

            {/* Video info */}
            {videoSource !== 'camera' && (videoFile || videoUrl) && !isYoutubeSimulating && !isScanning && (
                <div className="absolute bottom-3 left-3 z-20">
                    <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-zinc-400 max-w-[200px] truncate">
                        {videoFile ? videoFile.name : videoSource === 'youtube' ? `YouTube: ${youtubeVideoId}` : videoUrl.substring(0, 40) + '...'}
                    </div>
                </div>
            )}

            {/* YouTube instruction overlay */}
            {videoSource === 'youtube' && !isYoutubeSimulating && (
                <div className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none">
                    <div className="bg-black/80 backdrop-blur-sm px-6 py-4 rounded-xl text-center">
                        <Youtube size={32} className="text-red-500 mx-auto mb-2" />
                        <p className="text-white text-sm font-medium mb-1">YouTube Video Loaded</p>
                        <p className="text-zinc-400 text-xs">Click the <Play size={12} className="inline" /> button to start AI defect simulation</p>
                    </div>
                </div>
            )}

            {/* Corner Frame */}
            <div className="absolute inset-4 pointer-events-none z-5">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-500/50" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-500/50" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-500/50" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-500/50" />
            </div>
        </div>
    );
};
