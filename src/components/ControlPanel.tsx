import React from 'react';
import { Play, Square, Settings, FileText, Trash2, RotateCcw, Sparkles, Home, Search } from 'lucide-react';
import { useDefectStore } from '../services/store';

// Demo defects for testing UI without live API
const DEMO_DEFECTS = [
    { type: 'structural crack', severity: 'critical' as const, description: 'Large diagonal crack in load-bearing wall, approximately 5mm wide', location: 'Living Room - East Wall' },
    { type: 'water damage', severity: 'critical' as const, description: 'Water staining and bubbling paint indicating moisture infiltration', location: 'Bathroom Ceiling' },
    { type: 'paint peeling', severity: 'medium' as const, description: 'Paint peeling in multiple areas, likely due to moisture', location: 'Kitchen - Near Window' },
    { type: 'tile crack', severity: 'medium' as const, description: 'Hairline crack in floor tile, cosmetic damage', location: 'Entryway Floor' },
    { type: 'gap in sealant', severity: 'medium' as const, description: 'Deteriorated silicone sealant around bathtub edge', location: 'Master Bathroom' },
    { type: 'scuff marks', severity: 'minor' as const, description: 'Surface scuff marks on wall, easily repairable', location: 'Hallway' },
    { type: 'minor chip', severity: 'minor' as const, description: 'Small chip in door frame paint', location: 'Bedroom Door' },
    { type: 'discoloration', severity: 'minor' as const, description: 'Slight discoloration on ceiling, no structural concern', location: 'Dining Room' },
];

interface ControlPanelProps {
    onToggle: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ onToggle }) => {
    const isScanning = useDefectStore(state => state.isScanning);
    const viewMode = useDefectStore(state => state.viewMode);
    const setViewMode = useDefectStore(state => state.setViewMode);
    const investigationMode = useDefectStore(state => state.investigationMode);
    const setInvestigationMode = useDefectStore(state => state.setInvestigationMode);
    const defects = useDefectStore(state => state.defects);
    const generateReport = useDefectStore(state => state.generateReport);
    const clearAll = useDefectStore(state => state.clearAll);
    const inspectionStartTime = useDefectStore(state => state.inspectionStartTime);
    const addDefect = useDefectStore(state => state.addDefect);
    const startInspection = useDefectStore(state => state.startInspection);
    const addProcessLog = useDefectStore(state => state.addProcessLog);
    const addConsoleLog = useDefectStore(state => state.addConsoleLog);

    const handleGenerateReport = () => {
        if (defects.length > 0) {
            generateReport();
        }
    };

    const runDemoMode = async () => {
        // Start inspection
        startInspection();
        addProcessLog({ type: 'system', message: 'Demo mode started - simulating defect detection' });
        addConsoleLog('>>> DEMO MODE: Simulating property inspection...');

        // Add defects with delays to simulate real detection
        for (let i = 0; i < DEMO_DEFECTS.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

            const demo = DEMO_DEFECTS[i];
            addDefect({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                type: demo.type,
                severity: demo.severity,
                description: demo.description,
                location: demo.location,
                boundingBox: {
                    ymin: 0.2 + Math.random() * 0.3,
                    xmin: 0.2 + Math.random() * 0.3,
                    ymax: 0.5 + Math.random() * 0.3,
                    xmax: 0.5 + Math.random() * 0.3,
                },
            });

            addConsoleLog(`>>> DETECTED: ${demo.type.toUpperCase()} - ${demo.severity.toUpperCase()}`);
        }

        addProcessLog({ type: 'success', message: 'Demo inspection complete - 8 defects detected' });
        addConsoleLog('>>> Demo complete! Click "Generate Report" to see results.');
    };

    return (
        <div className="flex items-center justify-center gap-3 p-3 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 rounded-lg">
            {/* Investigation Mode Toggle */}
            <button
                onClick={() => setInvestigationMode(investigationMode === 'property_defect' ? 'crime_scene' : 'property_defect')}
                disabled={isScanning}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all border ${investigationMode === 'crime_scene'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                    } ${isScanning ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                title={investigationMode === 'crime_scene' ? 'Switch to Property Defect Mode' : 'Switch to Crime Scene Mode'}
            >
                {investigationMode === 'crime_scene' ? <Search size={16} /> : <Home size={16} />}
                <span className="text-xs font-medium">
                    {investigationMode === 'crime_scene' ? 'Crime Scene' : 'Property'}
                </span>
            </button>

            {/* Demo Mode Button */}
            <button
                onClick={runDemoMode}
                disabled={isScanning || defects.length > 0}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all border ${isScanning || defects.length > 0
                    ? 'bg-zinc-800/50 text-zinc-600 border-zinc-700/30 cursor-not-allowed'
                    : 'bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30'
                    }`}
                title="Run Demo Mode (Test without API)"
            >
                <Sparkles size={16} />
                <span className="text-xs font-medium">Demo</span>
            </button>

            {/* View Mode Toggle */}
            <button
                onClick={() => setViewMode(viewMode === 'regular' ? 'heatmap' : 'regular')}
                className={`p-2.5 rounded-lg transition-all ${viewMode === 'heatmap'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300'
                    }`}
                title={viewMode === 'heatmap' ? 'Switch to Regular View' : 'Switch to Heatmap View'}
            >
                <Settings size={18} />
            </button>

            {/* Clear All */}
            <button
                onClick={clearAll}
                disabled={isScanning}
                className="p-2.5 rounded-lg bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Clear All Data"
            >
                <Trash2 size={18} />
            </button>

            {/* Main Start/Stop Button */}
            <button
                onClick={onToggle}
                className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 border ${isScanning
                    ? 'bg-red-500/20 text-red-400 border-red-500/30 shadow-lg shadow-red-500/20'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/20'
                    }`}
            >
                {isScanning ? (
                    <Square size={22} fill="currentColor" />
                ) : (
                    <Play size={24} fill="currentColor" className="ml-0.5" />
                )}
            </button>

            {/* Generate Report */}
            <button
                onClick={handleGenerateReport}
                disabled={defects.length === 0}
                className={`p-2.5 rounded-lg transition-all border ${defects.length > 0
                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30'
                    : 'bg-zinc-800/50 text-zinc-600 border-zinc-700/30 cursor-not-allowed'
                    }`}
                title="Generate Report"
            >
                <FileText size={18} />
            </button>

            {/* Inspection Timer */}
            {inspectionStartTime && (
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 border border-zinc-700/30 rounded-lg">
                    <RotateCcw size={14} className={`text-cyan-400 ${isScanning ? 'animate-spin' : ''}`} />
                    <span className="text-[11px] font-mono text-cyan-400">
                        {Math.floor((Date.now() - inspectionStartTime) / 1000)}s
                    </span>
                </div>
            )}
        </div>
    );
};
