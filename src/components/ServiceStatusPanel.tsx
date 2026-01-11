import React from 'react';
import { useDefectStore } from '../services/store';
import type { ServiceStatus } from '../services/store';
import { Wifi, Camera, Volume2, Cpu, Banana, Mic } from 'lucide-react';

interface ServiceIndicatorProps {
    name: string;
    status: ServiceStatus;
    icon: React.ReactNode;
}

const ServiceIndicator: React.FC<ServiceIndicatorProps> = ({ name, status, icon }) => {
    const statusConfig = {
        online: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', pulse: 'bg-emerald-400', label: 'ONLINE' },
        offline: { color: 'text-zinc-500', bg: 'bg-zinc-500/10', pulse: '', label: 'OFFLINE' },
        connecting: { color: 'text-amber-400', bg: 'bg-amber-400/10', pulse: 'bg-amber-400 animate-pulse', label: 'SYNC' },
        error: { color: 'text-red-400', bg: 'bg-red-400/10', pulse: 'bg-red-400', label: 'ERROR' },
    };

    const config = statusConfig[status];

    return (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded ${config.bg} border border-white/5`}>
            <div className="relative">
                <div className={`w-1.5 h-1.5 rounded-full ${config.pulse || 'bg-zinc-600'}`} />
                {status === 'connecting' && (
                    <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                )}
            </div>
            <span className={`${config.color} opacity-70`}>{icon}</span>
            <span className={`text-[10px] font-mono uppercase tracking-wider ${config.color}`}>
                {name}
            </span>
            <span className={`text-[8px] font-mono ml-auto ${config.color} opacity-60`}>
                {config.label}
            </span>
        </div>
    );
};

export const ServiceStatusPanel: React.FC = () => {
    const services = useDefectStore(state => state.services);
    const isScanning = useDefectStore(state => state.isScanning);

    return (
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <Cpu size={12} className="text-cyan-400" />
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                        Services
                    </span>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono uppercase ${
                    isScanning
                        ? 'bg-emerald-400/10 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-500'
                }`}>
                    {isScanning ? (
                        <>
                            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                        </>
                    ) : (
                        <>
                            <span className="w-1 h-1 rounded-full bg-zinc-600" />
                            Idle
                        </>
                    )}
                </div>
            </div>

            {/* Service List */}
            <div className="p-2 space-y-1">
                <ServiceIndicator
                    name="Gemini Live"
                    status={services.geminiLive}
                    icon={<Wifi size={10} />}
                />
                <ServiceIndicator
                    name="NanoBanana"
                    status={services.nanoBanana}
                    icon={<Banana size={10} />}
                />
                <ServiceIndicator
                    name="Speech"
                    status={services.speechTools}
                    icon={<Mic size={10} />}
                />
                <ServiceIndicator
                    name="Camera"
                    status={services.camera}
                    icon={<Camera size={10} />}
                />
                <ServiceIndicator
                    name="Audio Out"
                    status={services.audioOutput}
                    icon={<Volume2 size={10} />}
                />
            </div>

            {/* System Status Bar */}
            <div className="px-3 py-1.5 border-t border-zinc-800/50 bg-black/20">
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-600">
                    <span>SYS</span>
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500">MEM</span>
                        <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="w-1/3 h-full bg-cyan-500/50 rounded-full" />
                        </div>
                        <span className="text-zinc-500">CPU</span>
                        <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    isScanning ? 'w-2/3 bg-amber-500/50' : 'w-1/4 bg-cyan-500/50'
                                }`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
