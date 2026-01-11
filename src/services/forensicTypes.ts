/**
 * Forensic Types - Shared types for forensic investigation mode
 * Separated to avoid circular dependencies
 */

export type EvidenceCategory = 'weapon' | 'biological' | 'trace' | 'document' | 'scene_indicator' | 'fraud_indicator' | 'unclassified';
export type EvidencePriority = 'critical' | 'high' | 'medium' | 'low';
export type AuthenticityStatus = 'verified' | 'suspicious' | 'manipulated' | 'pending';

export interface ForensicEvidence {
    id: string;
    caseId: string;
    evidenceType: string;
    category: EvidenceCategory;
    priority: EvidencePriority;
    description: string;
    location: string;
    clockPosition?: number;
    confidence: number;
    boundingBox?: { ymin: number; xmin: number; ymax: number; xmax: number };
    suggestedActions: string[];
    imageUrl?: string;
    frameHash: string;
    timestamp: number;
    capturedBy: string;
    chainOfCustodyNotes: string[];
    isManualCapture: boolean;
}

export interface AuthenticityAlert {
    id: string;
    concern: string;
    severity: 'critical' | 'high' | 'medium';
    description: string;
    location: string;
    recommendation: string;
    frameHash: string;
    timestamp: number;
}

export interface ChainOfCustodyEntry {
    id: string;
    timestamp: number;
    action: string;
    evidenceId: string | null;
    officerId: string;
    sessionId: string;
    notes: string | null;
}

export interface ForensicSession {
    sessionId: string;
    caseId: string;
    officerId: string;
    sceneType: string;
    location: string;
    startTime: number;
    endTime?: number;
    evidence: ForensicEvidence[];
    authenticityAlerts: AuthenticityAlert[];
    chainOfCustody: ChainOfCustodyEntry[];
    frameCount: number;
}
