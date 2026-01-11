import React from 'react';
import { useDefectStore } from '../services/store';
import type { ProcessLog } from '../services/store';
import { Activity, AlertTriangle, AlertCircle, CheckCircle, Info, Zap, Settings, Loader2 } from 'lucide-react';

const ProcessLogItem: React.FC<{ log: ProcessLog; isLatest: boolean }> = ({ log, isLatest }) => {
    const getConfig = () => {
        switch (log.type) {
            case 'detection':
                return {
                    icon: <Zap size={10} />,
                    color: 'text-yellow-400',
                    bg: 'bg-yellow-400/10',
                    border: 'border-yellow-400/20'
                };
            case 'error':
                return {
                    icon: <AlertCircle size={10} />,
                    color: 'text-red-400',
                    bg: 'bg-red-400/10',
                    border: 'border-red-400/20'
                };
            case 'warning':
                return {
                    icon: <AlertTriangle size={10} />,
                    color: 'text-amber-400',
                    bg: 'bg-amber-400/10',
                    border: 'border-amber-400/20'
                };
            case 'success':
                return {
                    icon: <CheckCircle size={10} />,
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-400/10',
                    border: 'border-emerald-400/20'
                };
            case 'system':
                return {
                    icon: <Settings size={10} />,
                    color: 'text-cyan-400',
                    bg: 'bg-cyan-400/10',
                    border: 'border-cyan-400/20'
                };
            default:
                return {
                    icon: <Info size={10} />,
                    color: 'text-zinc-400',
                    bg: 'bg-zinc-400/10',
                    border: 'border-zinc-400/20'
                };
        }
    };

    const config = getConfig();
    const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return (
        <div
            className={`flex items-start gap-2 p-2 rounded border ${config.border} ${config.bg} ${
                isLatest ? 'animate-pulse-once' : ''
            } transition-all duration-300`}
        >
            <div className={`mt-0.5 ${config.color}`}>
                {config.icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-mono font-medium ${config.color} truncate`}>
                        {log.message}
                    </span>
                    <span className="text-[8px] font-mono text-zinc-600 shrink-0">
                        {time}
                    </span>
                </div>
                {log.details && (
                    <p className="text-[9px] text-zinc-500 mt-0.5 truncate">
                        {log.details}
                    </p>
                )}
            </div>
            {isLatest && log.type === 'detection' && (
                <div className="shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
                </div>
            )}
        </div>
    );
};

export const ProcessLogPanel: React.FC = () => {
    const processLogs = useDefectStore(state => state.processLogs);
    const isScanning = useDefectStore(state => state.isScanning);

    return (
        <div className="h-full flex flex-col bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <Activity size={12} className="text-purple-400" />
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                        Process Log
                    </span>
                </div>
                {isScanning && (
                    <div className="flex items-center gap-1.5">
                        <Loader2 size={10} className="text-purple-400 animate-spin" />
                        <span className="text-[9px] font-mono text-purple-400">PROCESSING</span>
                    </div>
                )}
            </div>

            {/* Log Content */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
                {processLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                        <Activity size={24} className="opacity-30 mb-2" />
                        <p className="text-[10px] text-center">
                            {isScanning ? 'Waiting for detections...' : 'Start scanning to see process logs'}
                        </p>
                    </div>
                ) : (
                    processLogs.slice(0, 20).map((log, index) => (
                        <ProcessLogItem
                            key={log.id}
                            log={log}
                            isLatest={index === 0}
                        />
                    ))
                )}
            </div>

            {/* Stats Footer */}
            <div className="px-3 py-1.5 border-t border-zinc-800/50 bg-black/20">
                <div className="flex items-center justify-between text-[9px] font-mono">
                    <span className="text-zinc-600">EVENTS</span>
                    <div className="flex items-center gap-3">
                        <span className="text-yellow-400">
                            DET: {processLogs.filter(l => l.type === 'detection').length}
                        </span>
                        <span className="text-red-400">
                            ERR: {processLogs.filter(l => l.type === 'error').length}
                        </span>
                        <span className="text-zinc-500">
                            ALL: {processLogs.length}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
