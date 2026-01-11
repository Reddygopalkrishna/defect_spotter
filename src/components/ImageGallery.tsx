import React, { useRef, useEffect, useState } from 'react';
import { useDefectStore } from '../services/store';
import type { Defect, Screenshot } from '../services/store';
import { Image, AlertTriangle, MapPin, Maximize2, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface DamageOverlayProps {
    defect: Defect;
    containerWidth: number;
    containerHeight: number;
}

const DamageOverlay: React.FC<DamageOverlayProps> = ({ defect, containerWidth, containerHeight }) => {
    if (!defect.boundingBox) return null;

    const { ymin, xmin, ymax, xmax } = defect.boundingBox;
    const x = xmin * containerWidth;
    const y = ymin * containerHeight;
    const w = (xmax - xmin) * containerWidth;
    const h = (ymax - ymin) * containerHeight;

    const severityColors = {
        critical: { border: 'border-red-500', bg: 'bg-red-500/20', text: 'text-red-400', glow: 'shadow-red-500/50' },
        medium: { border: 'border-amber-500', bg: 'bg-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/50' },
        minor: { border: 'border-yellow-400', bg: 'bg-yellow-400/20', text: 'text-yellow-400', glow: 'shadow-yellow-400/50' },
    };

    const colors = severityColors[defect.severity];

    return (
        <>
            {/* Bounding Box */}
            <div
                className={`absolute border-2 ${colors.border} ${colors.bg} shadow-lg ${colors.glow} pointer-events-none animate-pulse`}
                style={{
                    left: x,
                    top: y,
                    width: w,
                    height: h,
                }}
            >
                {/* Corner Markers - NanoBanana style */}
                <div className={`absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 ${colors.border}`} />
                <div className={`absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 ${colors.border}`} />
                <div className={`absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 ${colors.border}`} />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 ${colors.border}`} />
            </div>

            {/* Label */}
            <div
                className={`absolute ${colors.bg} backdrop-blur-sm border ${colors.border} rounded px-2 py-0.5 pointer-events-none`}
                style={{
                    left: x,
                    top: Math.max(0, y - 24),
                }}
            >
                <span className={`text-[10px] font-mono font-bold uppercase ${colors.text}`}>
                    {defect.type}
                </span>
            </div>
        </>
    );
};

interface ImageCardProps {
    screenshot: Screenshot;
    onClick: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ screenshot, onClick }) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            setDimensions({ width, height });
        }
    }, []);

    const criticalCount = screenshot.defects.filter(d => d.severity === 'critical').length;
    const hasIssues = screenshot.defects.length > 0;

    return (
        <div
            ref={containerRef}
            onClick={onClick}
            className={`relative aspect-video bg-zinc-900 rounded-lg overflow-hidden cursor-pointer group border transition-all duration-300 ${
                hasIssues
                    ? 'border-yellow-500/30 hover:border-yellow-500/60'
                    : 'border-zinc-800 hover:border-zinc-700'
            }`}
        >
            {/* Image */}
            <img
                src={screenshot.imageUrl}
                alt="Captured frame"
                className="w-full h-full object-cover"
            />

            {/* Damage Overlays */}
            {screenshot.defects.map(defect => (
                <DamageOverlay
                    key={defect.id}
                    defect={defect}
                    containerWidth={dimensions.width}
                    containerHeight={dimensions.height}
                />
            ))}

            {/* Single Line Notification Bar */}
            {hasIssues && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-yellow-500/90 via-amber-500/90 to-orange-500/90 backdrop-blur-sm px-3 py-1.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={12} className="text-black" />
                            <span className="text-[11px] font-mono font-bold text-black uppercase">
                                {screenshot.defects.length} Issue{screenshot.defects.length > 1 ? 's' : ''} Detected
                            </span>
                        </div>
                        {criticalCount > 0 && (
                            <span className="text-[9px] font-mono font-bold bg-red-600 text-white px-1.5 py-0.5 rounded">
                                {criticalCount} CRITICAL
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Maximize2 size={24} className="text-white" />
            </div>

            {/* Timestamp */}
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5">
                <span className="text-[9px] font-mono text-zinc-300">
                    {new Date(screenshot.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </span>
            </div>
        </div>
    );
};

interface ImageModalProps {
    screenshot: Screenshot;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    hasPrev: boolean;
    hasNext: boolean;
}

const ImageModal: React.FC<ImageModalProps> = ({ screenshot, onClose, onPrev, onNext, hasPrev, hasNext }) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const imageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (imageRef.current) {
            const { width, height } = imageRef.current.getBoundingClientRect();
            setDimensions({ width, height });
        }
    }, [screenshot]);

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-colors z-10"
            >
                <X size={20} className="text-white" />
            </button>

            {/* Navigation */}
            {hasPrev && (
                <button
                    onClick={onPrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-colors"
                >
                    <ChevronLeft size={24} className="text-white" />
                </button>
            )}
            {hasNext && (
                <button
                    onClick={onNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-colors"
                >
                    <ChevronRight size={24} className="text-white" />
                </button>
            )}

            {/* Image Container */}
            <div
                ref={imageRef}
                className="relative max-w-4xl max-h-[80vh] w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden"
            >
                <img
                    src={screenshot.imageUrl}
                    alt="Captured frame"
                    className="w-full h-full object-contain"
                />

                {/* Damage Overlays */}
                {screenshot.defects.map(defect => (
                    <DamageOverlay
                        key={defect.id}
                        defect={defect}
                        containerWidth={dimensions.width}
                        containerHeight={dimensions.height}
                    />
                ))}
            </div>

            {/* Defect Details Panel */}
            {screenshot.defects.length > 0 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-3 max-w-2xl w-full mx-4">
                    <div className="flex items-center gap-4 overflow-x-auto">
                        {screenshot.defects.map(defect => (
                            <div
                                key={defect.id}
                                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded border ${
                                    defect.severity === 'critical'
                                        ? 'border-red-500/50 bg-red-500/10'
                                        : defect.severity === 'medium'
                                        ? 'border-amber-500/50 bg-amber-500/10'
                                        : 'border-yellow-500/50 bg-yellow-500/10'
                                }`}
                            >
                                <MapPin size={12} className={
                                    defect.severity === 'critical'
                                        ? 'text-red-400'
                                        : defect.severity === 'medium'
                                        ? 'text-amber-400'
                                        : 'text-yellow-400'
                                } />
                                <div>
                                    <span className="text-[11px] font-mono font-bold text-white capitalize">
                                        {defect.type}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 ml-2">
                                        {defect.location}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const ImageGallery: React.FC = () => {
    const screenshots = useDefectStore(state => state.screenshots);
    const defects = useDefectStore(state => state.defects);
    const isScanning = useDefectStore(state => state.isScanning);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Create virtual screenshots from recent defects if no screenshots exist
    const displayItems = screenshots.length > 0 ? screenshots : [];

    return (
        <div className="h-full flex flex-col bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <Image size={12} className="text-yellow-400" />
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                        Captured Frames
                    </span>
                    <span className="text-[9px] font-mono text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                        {displayItems.length}
                    </span>
                </div>
                {defects.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[9px] font-mono">
                        <span className="text-red-400">{defects.filter(d => d.severity === 'critical').length} CRIT</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-amber-400">{defects.filter(d => d.severity === 'medium').length} MED</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-yellow-400">{defects.filter(d => d.severity === 'minor').length} MIN</span>
                    </div>
                )}
            </div>

            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
                {displayItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                        <Image size={32} className="opacity-30 mb-3" />
                        <p className="text-[11px] text-center">
                            {isScanning
                                ? 'Capturing frames with detected issues...'
                                : 'No captured frames yet'
                            }
                        </p>
                        <p className="text-[9px] text-zinc-700 mt-1">
                            Frames with defects will appear here
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {displayItems.map((screenshot, index) => (
                            <ImageCard
                                key={screenshot.id}
                                screenshot={screenshot}
                                onClick={() => setSelectedIndex(index)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {selectedIndex !== null && displayItems[selectedIndex] && (
                <ImageModal
                    screenshot={displayItems[selectedIndex]}
                    onClose={() => setSelectedIndex(null)}
                    onPrev={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                    onNext={() => setSelectedIndex(Math.min(displayItems.length - 1, selectedIndex + 1))}
                    hasPrev={selectedIndex > 0}
                    hasNext={selectedIndex < displayItems.length - 1}
                />
            )}
        </div>
    );
};
