import { useRef, useState, useEffect, useCallback } from 'react';
import { CameraView } from './components/CameraView';
import { ControlPanel } from './components/ControlPanel';
import { ServiceStatusPanel } from './components/ServiceStatusPanel';
import { ConsolePanel } from './components/ConsolePanel';
import { ProcessLogPanel } from './components/ProcessLogPanel';
import { ImageGallery } from './components/ImageGallery';
import { ReportGenerator } from './components/ReportGenerator';
import { ApiKeyModal } from './components/ApiKeyModal';
import { TestPage } from './components/TestPage';
import { useDefectStore } from './services/store';
import { GeminiLiveClient } from './services/gemini';
import { ForensicLiveClient } from './services/forensicService';
import { Terminal, Cpu, Activity, Zap, Settings, Shield } from 'lucide-react';

const STORAGE_KEY = 'defectspotter_api_key';

function App() {
    const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
    const [apiKey, setApiKey] = useState<string>('');
    const [showApiModal, setShowApiModal] = useState(false);

    // Check if we're on the test page
    const isTestPage = window.location.search.includes('test');

    // Render TestPage if URL has ?test parameter
    if (isTestPage) {
        return <TestPage />;
    }
    const geminiRef = useRef<GeminiLiveClient | null>(null);
    const forensicRef = useRef<ForensicLiveClient | null>(null);

    const isScanning = useDefectStore(state => state.isScanning);
    const setScanning = useDefectStore(state => state.setScanning);
    const defects = useDefectStore(state => state.defects);
    const investigationMode = useDefectStore(state => state.investigationMode);
    const setServiceStatus = useDefectStore(state => state.setServiceStatus);
    const addProcessLog = useDefectStore(state => state.addProcessLog);
    const addConsoleLog = useDefectStore(state => state.addConsoleLog);
    const startInspection = useDefectStore(state => state.startInspection);
    const setForensicSession = useDefectStore(state => state.setForensicSession);

    const isForensicMode = investigationMode === 'crime_scene';

    // Load API key from localStorage on mount
    useEffect(() => {
        const savedKey = localStorage.getItem(STORAGE_KEY);
        const envKey = import.meta.env.VITE_GEMINI_API_KEY;

        if (savedKey) {
            setApiKey(savedKey);
            addProcessLog({ type: 'info', message: 'API key loaded from storage' });
        } else if (envKey) {
            setApiKey(envKey);
            localStorage.setItem(STORAGE_KEY, envKey);
            addProcessLog({ type: 'info', message: 'API key loaded from environment' });
        } else {
            addProcessLog({ type: 'warning', message: 'No API key found - click Settings to configure' });
            addConsoleLog('>>> No API key configured. Click the gear icon to add your Gemini API key.');
        }

        // Initialize other services
        addProcessLog({ type: 'system', message: 'DefectSpotter Terminal initialized' });
        setServiceStatus('nanoBanana', 'online');
        setServiceStatus('speechTools', 'online');
        setServiceStatus('audioOutput', 'online');
    }, []);

    // Initialize clients when API key changes
    useEffect(() => {
        if (apiKey) {
            // Initialize property defect client
            geminiRef.current = new GeminiLiveClient(apiKey);
            // Initialize forensic client
            forensicRef.current = new ForensicLiveClient(apiKey);
            setServiceStatus('geminiLive', 'offline');
            addProcessLog({ type: 'success', message: 'AI clients initialized' });
        } else {
            geminiRef.current = null;
            forensicRef.current = null;
            setServiceStatus('geminiLive', 'offline');
        }

        return () => {
            geminiRef.current?.stop();
            forensicRef.current?.stop();
        };
    }, [apiKey]);

    // Stop scanning when switching modes
    useEffect(() => {
        if (isScanning) {
            // Stop current scan when mode changes
            geminiRef.current?.stop();
            forensicRef.current?.stop();
            setScanning(false);
            setServiceStatus('geminiLive', 'offline');
            addProcessLog({ type: 'info', message: `Switched to ${isForensicMode ? 'Forensic' : 'Property'} mode` });
            addConsoleLog(`>>> Mode changed to: ${isForensicMode ? 'FORENSIC INVESTIGATION' : 'PROPERTY DEFECT DETECTION'}`);
        }
    }, [investigationMode]);

    const handleSaveApiKey = useCallback((newKey: string) => {
        setApiKey(newKey);
        localStorage.setItem(STORAGE_KEY, newKey);
        addProcessLog({ type: 'success', message: 'API key saved successfully' });
        addConsoleLog('>>> API key configured. Ready to start scanning!');
    }, []);

    const handleToggleScan = async () => {
        const activeClient = isForensicMode ? forensicRef.current : geminiRef.current;

        if (!activeClient || !apiKey) {
            addProcessLog({ type: 'error', message: 'API key required - click Settings to configure' });
            addConsoleLog('>>> ERROR: No API key configured. Click the gear icon to add your key.');
            setShowApiModal(true);
            return;
        }

        if (isScanning) {
            activeClient.stop();
            // Also end forensic session if in forensic mode
            if (isForensicMode && forensicRef.current) {
                const session = forensicRef.current.endSession();
                if (session) {
                    addConsoleLog(`>>> FORENSIC SESSION COMPLETE: ${session.evidence.length} evidence items`);
                    // Save session to store for report generation
                    setForensicSession(session);
                }
            }
            setScanning(false);
            setServiceStatus('geminiLive', 'offline');
            addProcessLog({ type: 'system', message: isForensicMode ? 'Forensic analysis stopped' : 'Scanning stopped' });
        } else if (videoElement) {
            startInspection();
            setScanning(true);
            setServiceStatus('geminiLive', 'connecting');

            if (isForensicMode) {
                // Start forensic session
                forensicRef.current?.startSession({
                    sceneType: 'crime_scene',
                    location: 'Investigation Site'
                });
                addProcessLog({ type: 'info', message: 'Starting forensic analysis...' });
                addConsoleLog('>>> [FORENSIC] Initiating crime scene documentation...');
            } else {
                addProcessLog({ type: 'info', message: 'Connecting to Gemini Live...' });
                addConsoleLog('>>> Initiating connection to Gemini Live API...');
            }

            try {
                await activeClient.startStreaming(videoElement);
            } catch (error) {
                addProcessLog({ type: 'error', message: 'Failed to start streaming' });
                addConsoleLog('>>> ERROR: Connection failed. Check console for details.');
                setScanning(false);
                setServiceStatus('geminiLive', 'error');
            }
        }
    };

    return (
        <div className="h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden flex flex-col">
            {/* Terminal Header */}
            <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3">
                    {/* Window Controls */}
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <div className="w-px h-4 bg-zinc-700" />
                    <div className="flex items-center gap-2">
                        {isForensicMode ? (
                            <Shield size={14} className="text-red-400" />
                        ) : (
                            <Terminal size={14} className="text-cyan-400" />
                        )}
                        <span className={`text-[11px] font-mono ${isForensicMode ? 'text-red-400' : 'text-zinc-400'}`}>
                            {isForensicMode ? 'forensic-spotter@investigation' : 'defect-spotter@terminal'}
                        </span>
                        {isForensicMode && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-mono rounded uppercase">
                                Crime Scene
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* System Stats */}
                    <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-zinc-500">
                        <div className="flex items-center gap-1.5">
                            <Cpu size={10} className="text-cyan-500" />
                            <span>SYS OK</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Activity size={10} className={isScanning ? (isForensicMode ? 'text-red-500 animate-pulse' : 'text-emerald-500 animate-pulse') : 'text-zinc-600'} />
                            <span>{isScanning ? (isForensicMode ? 'DOCUMENTING' : 'SCANNING') : 'IDLE'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Zap size={10} className={defects.length > 0 ? (isForensicMode ? 'text-red-400' : 'text-yellow-400') : 'text-zinc-600'} />
                            <span>{defects.length} {isForensicMode ? 'EVIDENCE' : 'DETECTIONS'}</span>
                        </div>
                    </div>

                    {/* Settings Button */}
                    <button
                        onClick={() => setShowApiModal(true)}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors group"
                        title="API Settings"
                    >
                        <Settings size={16} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    </button>

                    {/* API Status */}
                    <button
                        onClick={() => setShowApiModal(true)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono uppercase cursor-pointer transition-all hover:scale-105 ${
                            apiKey
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                        {apiKey ? 'AI READY' : 'ADD KEY'}
                    </button>
                </div>
            </header>

            {/* Main Dashboard Grid */}
            <main className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden">
                {/* Left Panel - Camera + Process Logs */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-3 overflow-hidden">
                    {/* Service Status */}
                    <ServiceStatusPanel />

                    {/* Camera View */}
                    <div className="flex-1 min-h-0">
                        <div className="h-full bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/50">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
                                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                                        Live Feed
                                    </span>
                                </div>
                                <span className="text-[9px] font-mono text-zinc-600">
                                    {isScanning ? '2 FPS' : 'READY'}
                                </span>
                            </div>
                            <div className="p-2 h-[calc(100%-36px)]">
                                <CameraView onReady={setVideoElement} />
                            </div>
                        </div>
                    </div>

                    {/* Process Logs */}
                    <div className="h-48 shrink-0">
                        <ProcessLogPanel />
                    </div>
                </div>

                {/* Center Panel - Image Gallery */}
                <div className="col-span-12 lg:col-span-6 flex flex-col gap-3 overflow-hidden">
                    {/* Controls */}
                    <div className="shrink-0">
                        <ControlPanel onToggle={handleToggleScan} />
                    </div>

                    {/* Image Gallery */}
                    <div className="flex-1 min-h-0">
                        <ImageGallery />
                    </div>
                </div>

                {/* Right Panel - Console */}
                <div className="col-span-12 lg:col-span-3 overflow-hidden">
                    <ConsolePanel />
                </div>
            </main>

            {/* Bottom Status Bar */}
            <footer className={`flex items-center justify-between px-4 py-1.5 border-t backdrop-blur-sm shrink-0 ${
                isForensicMode ? 'border-red-900/50 bg-red-950/30' : 'border-zinc-800/50 bg-zinc-900/80'
            }`}>
                <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-600">
                    <span>{isForensicMode ? 'ForensicSpotter v1.0.0' : 'DefectSpotter v1.0.0'}</span>
                    <span className="text-zinc-700">|</span>
                    <span>{isForensicMode ? 'Crime Scene Documentation System' : 'Powered by Gemini Live + NanoBanana'}</span>
                    <span className="text-zinc-700">|</span>
                    <a
                        href="?test"
                        className="text-cyan-500 hover:text-cyan-400 transition-colors"
                        title="Run accuracy tests"
                    >
                        Accuracy Test
                    </a>
                </div>
                <div className="flex items-center gap-4 text-[9px] font-mono">
                    <span className="text-zinc-600">
                        {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${
                        isScanning
                            ? isForensicMode
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-500'
                    }`}>
                        {isScanning ? (isForensicMode ? 'RECORDING' : 'ACTIVE') : 'STANDBY'}
                    </span>
                </div>
            </footer>

            {/* API Key Modal */}
            <ApiKeyModal
                isOpen={showApiModal}
                onClose={() => setShowApiModal(false)}
                onSave={handleSaveApiKey}
                currentKey={apiKey}
            />

            {/* Report Modal */}
            <ReportGenerator />
        </div>
    );
}

export default App;
