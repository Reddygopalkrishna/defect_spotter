import { create } from 'zustand';
import { analyzeInspection, type InspectionAnalysis, type DamageScore } from './damageAlgorithm';
import { playDefectNotification } from './audio';
import type { ForensicSession } from './forensicTypes';

export type Severity = 'minor' | 'medium' | 'critical';
export type ViewMode = 'regular' | 'heatmap';
export type ServiceStatus = 'online' | 'offline' | 'connecting' | 'error';
export type InvestigationMode = 'property_defect' | 'crime_scene';

export interface BoundingBox {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
}

export type DefectCategory = 'structural' | 'water' | 'finish' | 'mechanical';

export interface Defect {
    id: string;
    type: string;
    severity: Severity;
    description: string;
    location: string;
    imageUrl?: string;
    timestamp: number;
    boundingBox?: BoundingBox;
    // Enhanced properties for accurate detection
    category?: DefectCategory;
    confidence?: number;        // AI confidence score 0-100
    recommendation?: string;    // Remediation recommendation
    estimatedCost?: string;     // Cost estimate range
}

export interface Screenshot {
    id: string;
    imageUrl: string;
    timestamp: number;
    defects: Defect[];
    analyzed: boolean;
}

export interface ServiceState {
    geminiLive: ServiceStatus;
    nanoBanana: ServiceStatus;
    speechTools: ServiceStatus;
    camera: ServiceStatus;
    audioOutput: ServiceStatus;
}

export interface ProcessLog {
    id: string;
    timestamp: number;
    type: 'info' | 'success' | 'warning' | 'error' | 'detection' | 'system';
    message: string;
    details?: string;
}

export interface InspectionReport {
    id: string;
    startTime: number;
    endTime: number;
    totalDefects: number;
    criticalCount: number;
    mediumCount: number;
    minorCount: number;
    screenshots: Screenshot[];
    defects: Defect[];
    estimatedCost: {
        min: number;
        max: number;
        currency: string;
    };
    nearbyServices: {
        name: string;
        type: string;
        distance: string;
        rating: number;
        phone?: string;
    }[];
    // Utilitarian Analysis (from Justice philosophy)
    analysis?: InspectionAnalysis;
    prioritizedDefects?: DamageScore[];
    overallRiskLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    urgentActions?: string[];
    timeToAction?: string;
    propertyValueImpact?: string;
}

interface DefectState {
    // Core state
    isScanning: boolean;
    currentRoom: string;
    viewMode: ViewMode;
    investigationMode: InvestigationMode;
    defects: Defect[];
    logs: string[];

    // New terminal dashboard state
    services: ServiceState;
    processLogs: ProcessLog[];
    consoleLogs: string[];
    screenshots: Screenshot[];
    currentReport: InspectionReport | null;
    currentForensicSession: ForensicSession | null;
    isGeneratingReport: boolean;
    inspectionStartTime: number | null;

    // Core actions
    setScanning: (isScanning: boolean) => void;
    setRoom: (room: string) => void;
    setViewMode: (mode: ViewMode) => void;
    setInvestigationMode: (mode: InvestigationMode) => void;
    addDefect: (defect: Defect) => void;
    updateDefect: (id: string, updates: Partial<Defect>) => void;
    addLog: (message: string) => void;
    clearLogs: () => void;

    // New actions
    setServiceStatus: (service: keyof ServiceState, status: ServiceStatus) => void;
    addProcessLog: (log: Omit<ProcessLog, 'id' | 'timestamp'>) => void;
    addConsoleLog: (message: string) => void;
    clearConsoleLogs: () => void;
    addScreenshot: (screenshot: Screenshot) => void;
    updateScreenshot: (id: string, updates: Partial<Screenshot>) => void;
    startInspection: () => void;
    endInspection: () => void;
    generateReport: () => void;
    clearReport: () => void;
    setForensicSession: (session: ForensicSession | null) => void;
    clearAll: () => void;
}

const NEARBY_SERVICES = [
    { name: "QuickFix Contractors", type: "General Contractor", distance: "0.8 mi", rating: 4.7, phone: "(555) 123-4567" },
    { name: "Pro Paint Solutions", type: "Painting Service", distance: "1.2 mi", rating: 4.5, phone: "(555) 234-5678" },
    { name: "Elite Tile & Flooring", type: "Tile Specialist", distance: "1.5 mi", rating: 4.8, phone: "(555) 345-6789" },
    { name: "Handyman Hub", type: "General Repairs", distance: "2.1 mi", rating: 4.3, phone: "(555) 456-7890" },
    { name: "Structural Solutions", type: "Structural Engineer", distance: "3.2 mi", rating: 4.9, phone: "(555) 567-8901" },
];

export const useDefectStore = create<DefectState>((set, get) => ({
    // Core state
    isScanning: false,
    currentRoom: 'Living Room',
    viewMode: 'regular',
    investigationMode: 'property_defect',
    defects: [],
    logs: [],

    // New terminal dashboard state
    services: {
        geminiLive: 'offline',
        nanoBanana: 'offline',
        speechTools: 'offline',
        camera: 'offline',
        audioOutput: 'offline',
    },
    processLogs: [],
    consoleLogs: [],
    screenshots: [],
    currentReport: null,
    currentForensicSession: null,
    isGeneratingReport: false,
    inspectionStartTime: null,

    // Core actions
    setScanning: (isScanning) => set({ isScanning }),
    setRoom: (currentRoom) => set({ currentRoom }),
    setViewMode: (viewMode) => set({ viewMode }),
    setInvestigationMode: (investigationMode) => set({ investigationMode }),

    addDefect: (defect) => set((state) => {
        // Play notification sound based on severity
        playDefectNotification(defect.severity);

        // Also add to process logs
        const processLog: ProcessLog = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'detection',
            message: `${defect.severity.toUpperCase()}: ${defect.type} detected`,
            details: defect.description,
        };
        return {
            defects: [defect, ...state.defects],
            processLogs: [processLog, ...state.processLogs].slice(0, 100),
        };
    }),

    updateDefect: (id, updates) => set((state) => ({
        defects: state.defects.map((d) => (d.id === id ? { ...d, ...updates } : d))
    })),

    addLog: (message) => set((state) => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        const formattedLog = `[${timestamp}] ${message}`;
        return {
            logs: [formattedLog, ...state.logs].slice(0, 50),
            consoleLogs: [formattedLog, ...state.consoleLogs].slice(0, 200),
        };
    }),

    clearLogs: () => set({ logs: [] }),

    // New actions
    setServiceStatus: (service, status) => set((state) => ({
        services: { ...state.services, [service]: status }
    })),

    addProcessLog: (log) => set((state) => {
        const newLog: ProcessLog = {
            ...log,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };
        return {
            processLogs: [newLog, ...state.processLogs].slice(0, 100),
        };
    }),

    addConsoleLog: (message) => set((state) => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return {
            consoleLogs: [`[${timestamp}] ${message}`, ...state.consoleLogs].slice(0, 200),
        };
    }),

    clearConsoleLogs: () => set({ consoleLogs: [] }),

    addScreenshot: (screenshot) => set((state) => ({
        screenshots: [screenshot, ...state.screenshots].slice(0, 50),
    })),

    updateScreenshot: (id, updates) => set((state) => ({
        screenshots: state.screenshots.map((s) => (s.id === id ? { ...s, ...updates } : s))
    })),

    startInspection: () => set({
        inspectionStartTime: Date.now(),
        defects: [],
        screenshots: [],
        processLogs: [],
        currentReport: null,
    }),

    endInspection: () => set((state) => {
        if (!state.inspectionStartTime) return {};
        return { isScanning: false };
    }),

    generateReport: () => {
        const state = get();
        set({ isGeneratingReport: true });

        // Use Utilitarian Analysis Algorithm
        const analysis = analyzeInspection(state.defects);

        const report: InspectionReport = {
            id: crypto.randomUUID(),
            startTime: state.inspectionStartTime || Date.now(),
            endTime: Date.now(),
            totalDefects: analysis.totalDefects,
            criticalCount: analysis.criticalCount,
            mediumCount: analysis.mediumCount,
            minorCount: analysis.minorCount,
            screenshots: state.screenshots,
            defects: state.defects,
            estimatedCost: {
                min: analysis.totalEstimatedCost.min,
                max: analysis.totalEstimatedCost.max,
                currency: 'USD',
            },
            nearbyServices: NEARBY_SERVICES.filter((_, i) => {
                if (analysis.criticalCount > 0 && i === 4) return true;
                if (state.defects.some(d => d.type.toLowerCase().includes('paint')) && i === 1) return true;
                if (state.defects.some(d => d.type.toLowerCase().includes('tile')) && i === 2) return true;
                if (state.defects.some(d => d.type.toLowerCase().includes('water')) && i === 0) return true;
                return i < 3;
            }).slice(0, 5),
            // Utilitarian Analysis Results
            analysis,
            prioritizedDefects: analysis.prioritizedDefects,
            overallRiskLevel: analysis.overallRiskLevel,
            urgentActions: analysis.urgentActions,
            timeToAction: analysis.timeToAction,
            propertyValueImpact: analysis.propertyValueImpact,
        };

        set({ currentReport: report, isGeneratingReport: false });
    },

    clearReport: () => set({ currentReport: null, currentForensicSession: null }),

    setForensicSession: (session) => set({ currentForensicSession: session }),

    clearAll: () => set({
        defects: [],
        logs: [],
        processLogs: [],
        consoleLogs: [],
        screenshots: [],
        currentReport: null,
        currentForensicSession: null,
        inspectionStartTime: null,
    }),
}));
