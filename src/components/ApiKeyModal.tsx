import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string) => void;
    currentKey: string;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentKey }) => {
    const [apiKey, setApiKey] = useState(currentKey);
    const [isValidating, setIsValidating] = useState(false);
    const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        setApiKey(currentKey);
        setValidationStatus(currentKey ? 'valid' : 'idle');
    }, [currentKey, isOpen]);

    const validateKey = async (key: string) => {
        if (!key.trim()) {
            setValidationStatus('idle');
            return;
        }

        setIsValidating(true);
        setErrorMessage('');

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${key.trim()}`
            );

            if (response.ok) {
                const data = await response.json();
                // Check if the required model is available
                const hasLiveModel = data.models?.some((m: { name: string }) =>
                    m.name.includes('gemini-2.0-flash')
                );

                if (hasLiveModel) {
                    setValidationStatus('valid');
                } else {
                    setValidationStatus('invalid');
                    setErrorMessage('API key valid but Gemini 2.0 Flash not available');
                }
            } else {
                setValidationStatus('invalid');
                const error = await response.json();
                setErrorMessage(error.error?.message || 'Invalid API key');
            }
        } catch (e) {
            setValidationStatus('invalid');
            setErrorMessage('Network error - check your connection');
        } finally {
            setIsValidating(false);
        }
    };

    const handleSave = () => {
        if (apiKey.trim() && validationStatus === 'valid') {
            onSave(apiKey.trim());
            onClose();
        }
    };

    const handleKeyChange = (value: string) => {
        setApiKey(value);
        setValidationStatus('idle');
        setErrorMessage('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                            <Key size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">API Configuration</h2>
                            <p className="text-xs text-zinc-500">Configure Gemini Live API access</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Info Box */}
                    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
                        <p className="text-sm text-zinc-400 mb-3">
                            To use real-time AI defect detection, you need a Google AI Studio API key with access to Gemini 2.0 Flash.
                        </p>
                        <a
                            href="https://aistudio.google.com/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                            Get your API key from Google AI Studio
                            <ExternalLink size={14} />
                        </a>
                    </div>

                    {/* API Key Input */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-300">
                            Gemini API Key
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => handleKeyChange(e.target.value)}
                                placeholder="AIzaSy..."
                                className={`w-full px-4 py-3 bg-zinc-800 border rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 transition-all font-mono text-sm ${
                                    validationStatus === 'valid'
                                        ? 'border-emerald-500/50 focus:ring-emerald-500/30'
                                        : validationStatus === 'invalid'
                                            ? 'border-red-500/50 focus:ring-red-500/30'
                                            : 'border-zinc-700 focus:ring-cyan-500/30'
                                }`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {isValidating ? (
                                    <Loader2 size={18} className="text-zinc-500 animate-spin" />
                                ) : validationStatus === 'valid' ? (
                                    <CheckCircle size={18} className="text-emerald-400" />
                                ) : validationStatus === 'invalid' ? (
                                    <AlertCircle size={18} className="text-red-400" />
                                ) : null}
                            </div>
                        </div>

                        {/* Error Message */}
                        {errorMessage && (
                            <p className="text-xs text-red-400 mt-1">{errorMessage}</p>
                        )}

                        {/* Validation Status */}
                        {validationStatus === 'valid' && (
                            <p className="text-xs text-emerald-400 mt-1">
                                API key is valid and Gemini 2.0 Flash is available
                            </p>
                        )}
                    </div>

                    {/* Model Info */}
                    <div className="bg-zinc-800/30 rounded-lg p-4 space-y-2">
                        <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                            Required Model
                        </h4>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-300">gemini-2.0-flash-exp</span>
                            <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                                Live API
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                            Supports real-time video streaming and multimodal analysis
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-zinc-900/50">
                    <button
                        onClick={() => validateKey(apiKey)}
                        disabled={!apiKey.trim() || isValidating}
                        className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isValidating ? 'Validating...' : 'Test Key'}
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!apiKey.trim() || validationStatus !== 'valid'}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
                        >
                            Save & Connect
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
