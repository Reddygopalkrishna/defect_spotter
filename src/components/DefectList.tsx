import React from 'react';
import { useDefectStore } from '../services/store';
import { AlertTriangle, AlertCircle, AlertOctagon } from 'lucide-react';
import { clsx } from 'clsx';

export const DefectList: React.FC = () => {
    const defects = useDefectStore(state => state.defects);

    if (defects.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                <p>No defects detected yet.</p>
                <p className="text-xs mt-2">Start scanning to find issues.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 p-4 pb-20 overflow-y-auto max-h-[40vh]">
            {defects.map((defect) => (
                <div key={defect.id} className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex items-start gap-3 shadow-sm">
                    <div className={clsx(
                        "p-2 rounded-full",
                        defect.severity === 'minor' && "bg-yellow-500/10 text-yellow-500",
                        defect.severity === 'medium' && "bg-orange-500/10 text-orange-500",
                        defect.severity === 'critical' && "bg-red-500/10 text-red-500",
                    )}>
                        {defect.severity === 'minor' && <AlertCircle size={20} />}
                        {defect.severity === 'medium' && <AlertTriangle size={20} />}
                        {defect.severity === 'critical' && <AlertOctagon size={20} />}
                    </div>

                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <h3 className="font-semibold text-slate-100 capitalize">{defect.type}</h3>
                            <span className="text-xs text-slate-400">
                                {new Date(defect.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <p className="text-sm text-slate-300 mt-1">{defect.description}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                            <span className="bg-slate-800 px-2 py-0.5 rounded capitalize">{defect.severity}</span>
                            <span>•</span>
                            <span>{defect.location}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
