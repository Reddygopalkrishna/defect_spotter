import React, { useRef } from 'react';
import { useDefectStore } from '../services/store';
import { Terminal, Trash2 } from 'lucide-react';

export const ConsolePanel: React.FC = () => {
    const consoleLogs = useDefectStore(state => state.consoleLogs);
    const clearConsoleLogs = useDefectStore(state => state.clearConsoleLogs);
    const scrollRef = useRef<HTMLDivElement>(null);

    const getLogColor = (log: string): string => {
        if (log.includes('ERROR') || log.includes('error') || log.includes('Failed')) {
            return 'text-red-400';
        }
        if (log.includes('WARNING') || log.includes('warning') || log.includes('CRITICAL')) {
            return 'text-amber-400';
        }
        if (log.includes('DETECTED') || log.includes('Detection')) {
            return 'text-yellow-300';
        }
        if (log.includes('SUCCESS') || log.includes('Ready') || log.includes('Connected') || log.includes('ONLINE')) {
            return 'text-emerald-400';
        }
        if (log.includes('AI:')) {
            return 'text-cyan-400';
        }
        if (log.includes('>>>') || log.includes('$')) {
            return 'text-purple-400';
        }
        return 'text-zinc-400';
    };

    const getLogPrefix = (log: string): { prefix: string; color: string } => {
        if (log.includes('ERROR')) return { prefix: 'ERR', color: 'text-red-500' };
        if (log.includes('WARNING') || log.includes('CRITICAL')) return { prefix: 'WRN', color: 'text-amber-500' };
        if (log.includes('DETECTED')) return { prefix: 'DET', color: 'text-yellow-400' };
        if (log.includes('AI:')) return { prefix: 'AI', color: 'text-cyan-500' };
        if (log.includes('Connected') || log.includes('Ready')) return { prefix: 'SYS', color: 'text-emerald-500' };
        return { prefix: 'LOG', color: 'text-zinc-600' };
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 border border-zinc-800/50 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/80 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-emerald-400" />
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                        Console
                    </span>
                    <span className="text-[9px] font-mono text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                        {consoleLogs.length}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={clearConsoleLogs}
                        className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300"
                        title="Clear console"
                    >
                        <Trash2 size={10} />
                    </button>
                </div>
            </div>

            {/* Console Content */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-[11px] leading-relaxed p-2 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700"
            >
                {consoleLogs.length === 0 ? (
                    <div className="text-zinc-600 text-center py-8">
                        <Terminal size={24} className="mx-auto mb-2 opacity-30" />
                        <p className="text-[10px]">Console output will appear here</p>
                        <p className="text-[9px] text-zinc-700 mt-1">Start scanning to see logs</p>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {consoleLogs.map((log, index) => {
                            const { prefix, color } = getLogPrefix(log);
                            return (
                                <div
                                    key={index}
                                    className={`flex items-start gap-2 py-0.5 px-1 rounded hover:bg-zinc-900/50 transition-colors ${
                                        index === 0 ? 'bg-zinc-800/30' : ''
                                    }`}
                                >
                                    <span className={`${color} text-[9px] font-bold shrink-0 w-6`}>
                                        {prefix}
                                    </span>
                                    <span className={`${getLogColor(log)} break-all`}>
                                        {log}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-zinc-800/50 bg-black/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-600">
                    <span className="text-emerald-500">$</span>
                    <span className="text-zinc-500">defect-spotter</span>
                    <span className="animate-pulse">_</span>
                </div>
                <div className="text-[9px] font-mono text-zinc-600">
                    v1.0.0
                </div>
            </div>
        </div>
    );
};
