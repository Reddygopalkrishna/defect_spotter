import React, { useState, useRef, useCallback } from 'react';
import { useDefectStore } from '../services/store';
import { generatePDFReport, generateForensicPDFReport } from '../services/pdfExport';
import type { InspectionReport } from '../services/store';
import type { DamageScore } from '../services/damageAlgorithm';
import type { ForensicSession } from '../services/forensicTypes';
import {
    X, Download, Clock, DollarSign, MapPin, Phone, Star,
    ChevronRight, ArrowRight, Camera, AlertCircle, CheckCircle,
    ExternalLink, FileText, Loader2, Shield, Link, Eye, Sparkles, Image as ImageIcon
} from 'lucide-react';

interface ReportModalProps {
    report: InspectionReport;
    onClose: () => void;
}

// Navigation sections
const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'priority', label: 'Priority Analysis' },
    { id: 'defects', label: 'Defect Details' },
    { id: 'costs', label: 'Cost Estimate' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'services', label: 'Repair Services' },
];

const SeverityDot: React.FC<{ severity: string }> = ({ severity }) => {
    const colors: Record<string, string> = {
        critical: 'bg-red-500',
        medium: 'bg-amber-500',
        minor: 'bg-emerald-500',
    };
    return <span className={`w-2 h-2 rounded-full ${colors[severity] || 'bg-gray-400'}`} />;
};

const PriorityItem: React.FC<{ score: DamageScore; rank: number }> = ({ score, rank }) => {
    const rankStyles: Record<number, string> = {
        1: 'bg-red-50 border-red-200 text-red-700',
        2: 'bg-amber-50 border-amber-200 text-amber-700',
        3: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    };

    const rankBg = rankStyles[rank] || 'bg-stone-50 border-stone-200 text-stone-600';

    return (
        <div className="group py-4 border-b border-stone-100 last:border-0">
            <div className="flex items-start gap-4">
                {/* Rank Badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border ${rankBg}`}>
                    {rank}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="font-serif text-lg text-stone-800 capitalize">
                            {score.category.type.replace('_', ' ')}
                        </h4>
                        <span className="text-sm font-medium text-stone-500">
                            Score: <span className="text-stone-800">{score.utilityScore}</span>
                        </span>
                    </div>

                    <p className="text-sm text-stone-600 mb-3 leading-relaxed">
                        {score.recommendation}
                    </p>

                    <div className="flex items-center gap-6 text-xs text-stone-500">
                        <span className="flex items-center gap-1.5">
                            <DollarSign size={12} />
                            ${score.estimatedCost.min} - ${score.estimatedCost.max}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Clock size={12} />
                            Due {score.repairDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            score.riskAssessment.safetyRisk === 'HIGH' || score.riskAssessment.safetyRisk === 'SEVERE'
                                ? 'bg-red-100 text-red-700'
                                : score.riskAssessment.safetyRisk === 'MODERATE'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                        }`}>
                            {score.riskAssessment.safetyRisk} Risk
                        </span>
                    </div>
                </div>

                <ChevronRight size={20} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
            </div>
        </div>
    );
};

const ReportModal: React.FC<ReportModalProps> = ({ report, onClose }) => {
    const [activeSection, setActiveSection] = useState('overview');
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const duration = Math.round((report.endTime - report.startTime) / 1000 / 60);

    const handlePDFExport = () => {
        setIsGeneratingPDF(true);
        // Use setTimeout to allow UI to update before generating
        setTimeout(() => {
            try {
                generatePDFReport(report);
            } catch (error) {
                console.error('PDF generation failed:', error);
            } finally {
                setIsGeneratingPDF(false);
            }
        }, 100);
    };

    const handleDownload = () => {
        const prioritySection = report.prioritizedDefects ?
            `\n\nPRIORITIZED DEFECTS\n${'-'.repeat(40)}\n${
                report.prioritizedDefects.map((d, i) => `
${i + 1}. ${d.category.type.toUpperCase()}
   Utility Score: ${d.utilityScore}
   Cost: $${d.estimatedCost.min} - $${d.estimatedCost.max}
   Deadline: ${d.repairDeadline.toLocaleDateString()}
   ${d.recommendation}
`).join('')}` : '';

        const reportText = `
PROPERTY INSPECTION REPORT
Generated: ${new Date().toLocaleString()}
Duration: ${duration} minutes

SUMMARY
${'-'.repeat(40)}
Overall Risk: ${report.overallRiskLevel || 'N/A'}
Total Issues: ${report.totalDefects}
  - Critical: ${report.criticalCount}
  - Medium: ${report.mediumCount}
  - Minor: ${report.minorCount}

${report.timeToAction ? `Time Sensitivity: ${report.timeToAction}` : ''}
${report.propertyValueImpact ? `Property Impact: ${report.propertyValueImpact}` : ''}

ESTIMATED COSTS
${'-'.repeat(40)}
$${report.estimatedCost.min.toLocaleString()} - $${report.estimatedCost.max.toLocaleString()} ${report.estimatedCost.currency}
${prioritySection}

RECOMMENDED ACTIONS
${'-'.repeat(40)}
${report.urgentActions?.map((a, i) => `${i + 1}. ${a}`).join('\n') || 'No urgent actions required'}

NEARBY SERVICES
${'-'.repeat(40)}
${report.nearbyServices.map(s => `${s.name}
   ${s.type} | ${s.distance} | Rating: ${s.rating}/5
   ${s.phone || ''}`).join('\n\n')}

---
Generated by DefectSpotter AI
        `.trim();

        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inspection-report-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="h-full flex items-center justify-center p-4">
                <div className="bg-[#FAF9F7] rounded-2xl max-w-6xl w-full h-[90vh] shadow-2xl overflow-hidden flex">

                    {/* Left Sidebar */}
                    <aside className="w-64 bg-[#F5F3F0] border-r border-stone-200 flex flex-col">
                        {/* Report Header */}
                        <div className="p-6 border-b border-stone-200">
                            <div className="w-16 h-16 bg-amber-100 rounded-xl mb-4 flex items-center justify-center">
                                <Camera size={28} className="text-amber-600" />
                            </div>
                            <h2 className="font-serif text-xl text-stone-800 mb-1">Inspection Report</h2>
                            <p className="text-xs text-stone-500">
                                {new Date(report.startTime).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </p>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 p-4 overflow-y-auto">
                            <div className="space-y-1">
                                {sections.map(section => (
                                    <button
                                        key={section.id}
                                        onClick={() => scrollToSection(section.id)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                                            activeSection === section.id
                                                ? 'bg-white text-stone-800 shadow-sm font-medium'
                                                : 'text-stone-600 hover:bg-white/50'
                                        }`}
                                    >
                                        {section.label}
                                    </button>
                                ))}
                            </div>
                        </nav>

                        {/* Quick Stats */}
                        <div className="p-4 border-t border-stone-200 bg-white/50">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <div className="text-2xl font-serif text-red-600">{report.criticalCount}</div>
                                    <div className="text-[10px] text-stone-500 uppercase tracking-wide">Critical</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-serif text-amber-600">{report.mediumCount}</div>
                                    <div className="text-[10px] text-stone-500 uppercase tracking-wide">Medium</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-serif text-emerald-600">{report.minorCount}</div>
                                    <div className="text-[10px] text-stone-500 uppercase tracking-wide">Minor</div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col overflow-hidden">
                        {/* Top Bar */}
                        <header className="flex items-center justify-between px-8 py-4 border-b border-stone-200 bg-white/80">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-stone-500">Duration: {duration} min</span>
                                <span className="text-stone-300">|</span>
                                <span className="text-sm text-stone-500">{report.totalDefects} issues found</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePDFExport}
                                    disabled={isGeneratingPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    {isGeneratingPDF ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <FileText size={16} />
                                            Export PDF
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Download size={16} />
                                    Export TXT
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                                >
                                    <X size={20} className="text-stone-500" />
                                </button>
                            </div>
                        </header>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="max-w-3xl mx-auto px-8 py-8">

                                {/* Overview Section */}
                                <section id="overview" className="mb-12">
                                    <h1 className="font-serif text-3xl text-stone-800 mb-2">
                                        Property Damage Assessment
                                    </h1>
                                    <p className="text-stone-500 mb-8">
                                        A comprehensive analysis of detected issues using utilitarian prioritization.
                                    </p>

                                    {/* Risk Level Card */}
                                    {report.overallRiskLevel && (
                                        <div className={`p-6 rounded-xl mb-6 ${
                                            report.overallRiskLevel === 'CRITICAL' ? 'bg-red-50 border border-red-100' :
                                            report.overallRiskLevel === 'HIGH' ? 'bg-amber-50 border border-amber-100' :
                                            report.overallRiskLevel === 'MEDIUM' ? 'bg-yellow-50 border border-yellow-100' :
                                            'bg-emerald-50 border border-emerald-100'
                                        }`}>
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-stone-500 mb-1">Overall Risk Level</p>
                                                    <h2 className={`font-serif text-2xl ${
                                                        report.overallRiskLevel === 'CRITICAL' ? 'text-red-700' :
                                                        report.overallRiskLevel === 'HIGH' ? 'text-amber-700' :
                                                        report.overallRiskLevel === 'MEDIUM' ? 'text-yellow-700' :
                                                        'text-emerald-700'
                                                    }`}>
                                                        {report.overallRiskLevel}
                                                    </h2>
                                                </div>
                                                <div className="text-right">
                                                    {report.timeToAction && (
                                                        <p className="text-sm text-stone-600">{report.timeToAction}</p>
                                                    )}
                                                    {report.propertyValueImpact && (
                                                        <p className="text-xs text-stone-500 mt-1">{report.propertyValueImpact}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Urgent Actions */}
                                    {report.urgentActions && report.urgentActions.length > 0 && (
                                        <div className="bg-white rounded-xl border border-stone-200 p-6">
                                            <h3 className="font-serif text-lg text-stone-800 mb-4 flex items-center gap-2">
                                                <AlertCircle size={18} className="text-amber-500" />
                                                Recommended Actions
                                            </h3>
                                            <div className="space-y-3">
                                                {report.urgentActions.map((action, i) => (
                                                    <div key={i} className="flex items-start gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                                            <span className="text-xs font-medium text-amber-700">{i + 1}</span>
                                                        </div>
                                                        <p className="text-stone-600 text-sm leading-relaxed">{action}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                {/* Priority Analysis Section */}
                                <section id="priority" className="mb-12">
                                    <h2 className="font-serif text-2xl text-stone-800 mb-2">Priority Analysis</h2>
                                    <p className="text-stone-500 text-sm mb-6">
                                        Issues ranked by utility score, balancing safety impact, repair urgency, and cost efficiency.
                                    </p>

                                    {report.prioritizedDefects && report.prioritizedDefects.length > 0 ? (
                                        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                                            <div className="divide-y divide-stone-100 px-6">
                                                {report.prioritizedDefects.slice(0, 5).map((score, index) => (
                                                    <PriorityItem key={score.defectId} score={score} rank={index + 1} />
                                                ))}
                                            </div>
                                            {report.prioritizedDefects.length > 5 && (
                                                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100">
                                                    <button className="text-sm text-stone-600 hover:text-stone-800 flex items-center gap-1">
                                                        View all {report.prioritizedDefects.length} issues
                                                        <ArrowRight size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-50 rounded-xl p-8 text-center border border-emerald-100">
                                            <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
                                            <p className="text-emerald-700 font-medium">No significant issues detected</p>
                                        </div>
                                    )}
                                </section>

                                {/* Defects Summary Section */}
                                <section id="defects" className="mb-12">
                                    <h2 className="font-serif text-2xl text-stone-800 mb-6">Defect Summary</h2>

                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="bg-white rounded-xl border border-stone-200 p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <SeverityDot severity="critical" />
                                                <span className="text-xs uppercase tracking-wide text-stone-500">Critical</span>
                                            </div>
                                            <div className="font-serif text-4xl text-stone-800">{report.criticalCount}</div>
                                            <p className="text-xs text-stone-500 mt-1">Require immediate attention</p>
                                        </div>
                                        <div className="bg-white rounded-xl border border-stone-200 p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <SeverityDot severity="medium" />
                                                <span className="text-xs uppercase tracking-wide text-stone-500">Medium</span>
                                            </div>
                                            <div className="font-serif text-4xl text-stone-800">{report.mediumCount}</div>
                                            <p className="text-xs text-stone-500 mt-1">Address within 30 days</p>
                                        </div>
                                        <div className="bg-white rounded-xl border border-stone-200 p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <SeverityDot severity="minor" />
                                                <span className="text-xs uppercase tracking-wide text-stone-500">Minor</span>
                                            </div>
                                            <div className="font-serif text-4xl text-stone-800">{report.minorCount}</div>
                                            <p className="text-xs text-stone-500 mt-1">Cosmetic issues</p>
                                        </div>
                                    </div>

                                    {/* Defect List */}
                                    {report.defects.length > 0 && (
                                        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                                            <div className="px-6 py-4 border-b border-stone-100">
                                                <h3 className="font-medium text-stone-800">All Detected Issues</h3>
                                            </div>
                                            <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto">
                                                {report.defects.map((defect) => (
                                                    <div key={defect.id} className="px-6 py-3 flex items-center gap-4">
                                                        <SeverityDot severity={defect.severity} />
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm text-stone-800 capitalize">{defect.type}</span>
                                                            {defect.location && (
                                                                <span className="text-xs text-stone-500 ml-2">• {defect.location}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-stone-400">
                                                            {new Date(defect.timestamp).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                {/* Cost Estimate Section */}
                                <section id="costs" className="mb-12">
                                    <h2 className="font-serif text-2xl text-stone-800 mb-6">Cost Estimate</h2>

                                    <div className="bg-white rounded-xl border border-stone-200 p-8">
                                        <div className="flex items-baseline gap-2 mb-2">
                                            <span className="font-serif text-4xl text-stone-800">
                                                ${report.estimatedCost.min.toLocaleString()}
                                            </span>
                                            <span className="text-stone-400 text-xl">—</span>
                                            <span className="font-serif text-4xl text-stone-800">
                                                ${report.estimatedCost.max.toLocaleString()}
                                            </span>
                                            <span className="text-stone-500 text-sm ml-2">{report.estimatedCost.currency}</span>
                                        </div>
                                        <p className="text-stone-500 text-sm">
                                            Estimated total repair cost based on detected issues and market rates.
                                        </p>

                                        <blockquote className="mt-6 pl-4 border-l-2 border-amber-400 text-stone-600 text-sm italic">
                                            "Cost estimates are calculated using utilitarian principles, prioritizing repairs
                                            that prevent the greatest potential harm and property value loss."
                                        </blockquote>
                                    </div>
                                </section>

                                {/* Evidence Section */}
                                <section id="evidence" className="mb-12">
                                    <h2 className="font-serif text-2xl text-stone-800 mb-6">
                                        Captured Evidence
                                        {report.screenshots.length > 0 && (
                                            <span className="text-stone-400 font-normal text-lg ml-2">
                                                ({report.screenshots.length})
                                            </span>
                                        )}
                                    </h2>

                                    {report.screenshots.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-4">
                                            {report.screenshots.slice(0, 6).map(screenshot => (
                                                <div
                                                    key={screenshot.id}
                                                    className="aspect-video bg-stone-100 rounded-xl overflow-hidden border border-stone-200 group cursor-pointer"
                                                >
                                                    <img
                                                        src={screenshot.imageUrl}
                                                        alt="Evidence"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-stone-100 rounded-xl p-8 text-center border border-stone-200">
                                            <Camera size={32} className="text-stone-400 mx-auto mb-3" />
                                            <p className="text-stone-500">No screenshots captured during inspection</p>
                                        </div>
                                    )}
                                </section>

                                {/* Services Section */}
                                <section id="services" className="mb-12">
                                    <h2 className="font-serif text-2xl text-stone-800 mb-2">Recommended Services</h2>
                                    <p className="text-stone-500 text-sm mb-6">
                                        Local contractors and specialists based on detected issues.
                                    </p>

                                    <div className="space-y-3">
                                        {report.nearbyServices.map((service, index) => (
                                            <div
                                                key={index}
                                                className="bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md transition-shadow group cursor-pointer"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h3 className="font-medium text-stone-800">{service.name}</h3>
                                                            <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full">
                                                                {service.type}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm text-stone-500">
                                                            <span className="flex items-center gap-1.5">
                                                                <MapPin size={14} />
                                                                {service.distance}
                                                            </span>
                                                            <span className="flex items-center gap-1.5">
                                                                <Star size={14} className="text-amber-400 fill-amber-400" />
                                                                {service.rating}
                                                            </span>
                                                            {service.phone && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <Phone size={14} />
                                                                    {service.phone}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ExternalLink size={18} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Footer */}
                                <footer className="pt-8 border-t border-stone-200 text-center">
                                    <p className="text-xs text-stone-400">
                                        Report ID: {report.id.slice(0, 8)} • Generated by DefectSpotter AI
                                    </p>
                                    <p className="text-xs text-stone-400 mt-1">
                                        Analysis powered by Utilitarian Prioritization Algorithm
                                    </p>
                                </footer>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

// ============================================
// FORENSIC REPORT MODAL
// ============================================
interface ForensicReportModalProps {
    session: ForensicSession;
    screenshots: Array<{ id: string; imageUrl: string; timestamp: number }>;
    onClose: () => void;
}

const ForensicReportModal: React.FC<ForensicReportModalProps> = ({ session, screenshots, onClose }) => {
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isGeneratingNanoBanana, setIsGeneratingNanoBanana] = useState(false);
    const [showNanoBanana, setShowNanoBanana] = useState(false);
    const nanoBananaRef = useRef<HTMLDivElement>(null);

    const durationSec = session.endTime ? Math.round((session.endTime - session.startTime) / 1000) : 0;
    const durationMin = Math.floor(durationSec / 60);
    const durationRemSec = durationSec % 60;

    const criticalCount = session.evidence.filter(e => e.priority === 'critical').length;
    const highCount = session.evidence.filter(e => e.priority === 'high').length;

    // Generate NanoBanana image using Gemini AI
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);

    const generateNanoBananaImage = useCallback(async () => {
        if (session.evidence.length === 0) return;

        // Get API key from localStorage
        const apiKey = localStorage.getItem('defectspotter_api_key');
        if (!apiKey) {
            setGenerationError('API key not found. Please configure your Gemini API key.');
            return;
        }

        setIsGeneratingNanoBanana(true);
        setGenerationError(null);

        try {
            // Build evidence summary for the prompt
            const evidenceSummary = session.evidence.map((e, i) =>
                `${i + 1}. ${e.evidenceType.replace(/_/g, ' ')} (${e.priority} priority, ${e.confidence}% confidence)${e.location ? ` - Location: ${e.location}` : ''}${e.description ? ` - ${e.description}` : ''}`
            ).join('\n');

            const prompt = `Create a professional forensic evidence board visualization image. This should look like a detective's evidence board with the following evidence items pinned to it:

CASE: ${session.caseId}
LOCATION: ${session.location}
SCENE TYPE: ${session.sceneType}
TOTAL EVIDENCE ITEMS: ${session.evidence.length}

EVIDENCE LIST:
${evidenceSummary}

Design requirements:
- Dark cork board or investigation board background
- Each evidence item as a card/note pinned to the board
- Color-coded by priority: RED for critical, ORANGE for high, BLUE for medium, GREEN for low
- Include red strings connecting related evidence
- Professional forensic investigation aesthetic
- Case number prominently displayed at top
- "CONFIDENTIAL" or "EVIDENCE" stamps
- Clean, organized layout with clear labels
- Polaroid-style frames for evidence cards

Generate a high-quality, photorealistic evidence board image.`;

            // Call Gemini API with image generation
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            responseModalities: ["TEXT", "IMAGE"]
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to generate image');
            }

            const data = await response.json();
            console.log('[NanoBanana] Gemini response:', data);

            // Extract image from response
            const parts = data.candidates?.[0]?.content?.parts || [];
            let imageData = null;

            for (const part of parts) {
                if (part.inlineData?.mimeType?.startsWith('image/')) {
                    imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }

            if (imageData) {
                setGeneratedImage(imageData);
            } else {
                // Fallback: Try alternative image generation endpoint
                console.log('[NanoBanana] No image in response, trying Imagen...');
                await generateWithImagen(apiKey, prompt);
            }
        } catch (error) {
            console.error('NanoBanana generation failed:', error);
            setGenerationError((error as Error).message || 'Failed to generate evidence board image');

            // Fallback to canvas-based generation
            await generateCanvasFallback();
        } finally {
            setIsGeneratingNanoBanana(false);
        }
    }, [session]);

    // Alternative: Use Imagen API
    const generateWithImagen = async (apiKey: string, prompt: string) => {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: [{ prompt }],
                        parameters: {
                            sampleCount: 1,
                            aspectRatio: "16:9",
                            safetyFilterLevel: "block_few"
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error('Imagen API failed');
            }

            const data = await response.json();
            const imageData = data.predictions?.[0]?.bytesBase64Encoded;

            if (imageData) {
                setGeneratedImage(`data:image/png;base64,${imageData}`);
            } else {
                throw new Error('No image generated');
            }
        } catch (error) {
            console.log('[NanoBanana] Imagen failed, using canvas fallback');
            await generateCanvasFallback();
        }
    };

    // Canvas fallback for when AI generation fails
    const generateCanvasFallback = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = 2;
        const width = 1200;
        const height = 800;
        canvas.width = width * scale;
        canvas.height = height * scale;
        ctx.scale(scale, scale);

        // Cork board background
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, 0, width, height);

        // Add texture pattern
        for (let i = 0; i < 5000; i++) {
            ctx.fillStyle = `rgba(${139 + Math.random() * 30}, ${69 + Math.random() * 20}, ${19 + Math.random() * 20}, 0.3)`;
            ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
        }

        // Header banner
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, width, 80);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 32px monospace';
        ctx.fillText('EVIDENCE BOARD', 40, 50);

        ctx.fillStyle = '#fbbf24';
        ctx.font = '16px monospace';
        ctx.fillText(`Case: ${session.caseId} | ${session.evidence.length} Evidence Items | ${session.location}`, 40, 70);

        // CONFIDENTIAL stamp
        ctx.save();
        ctx.translate(width - 150, 40);
        ctx.rotate(-0.2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.strokeRect(-60, -20, 120, 40);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('CONFIDENTIAL', -55, 5);
        ctx.restore();

        // Draw evidence cards
        const cardWidth = 200;
        const cardHeight = 140;
        const startX = 40;
        const startY = 100;
        const gap = 20;
        const cardsPerRow = 5;

        const priorityColors: Record<string, string> = {
            critical: '#ef4444',
            high: '#f59e0b',
            medium: '#3b82f6',
            low: '#22c55e'
        };

        session.evidence.forEach((evidence, index) => {
            const row = Math.floor(index / cardsPerRow);
            const col = index % cardsPerRow;
            const x = startX + col * (cardWidth + gap);
            const y = startY + row * (cardHeight + gap);

            // Pin
            ctx.beginPath();
            ctx.arc(x + cardWidth / 2, y - 5, 8, 0, Math.PI * 2);
            ctx.fillStyle = priorityColors[evidence.priority] || '#6b7280';
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Card shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x + 4, y + 4, cardWidth, cardHeight);

            // Card background
            ctx.fillStyle = '#fffef0';
            ctx.fillRect(x, y, cardWidth, cardHeight);

            // Priority stripe
            ctx.fillStyle = priorityColors[evidence.priority] || '#6b7280';
            ctx.fillRect(x, y, 6, cardHeight);

            // Evidence ID
            ctx.fillStyle = '#333';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(`E-${(index + 1).toString().padStart(3, '0')}`, x + 15, y + 25);

            // Priority badge
            ctx.fillStyle = priorityColors[evidence.priority] || '#6b7280';
            ctx.font = 'bold 10px monospace';
            const priorityText = evidence.priority.toUpperCase();
            ctx.fillText(priorityText, x + cardWidth - 60, y + 25);

            // Evidence type
            ctx.fillStyle = '#111';
            ctx.font = 'bold 12px monospace';
            const typeText = evidence.evidenceType.replace(/_/g, ' ').toUpperCase();
            ctx.fillText(typeText.substring(0, 20), x + 15, y + 50);

            // Category
            ctx.fillStyle = '#666';
            ctx.font = '10px monospace';
            ctx.fillText(`[${evidence.category.toUpperCase()}]`, x + 15, y + 70);

            // Confidence
            ctx.fillStyle = '#444';
            ctx.font = '11px monospace';
            ctx.fillText(`Confidence: ${evidence.confidence}%`, x + 15, y + 90);

            // Location
            if (evidence.location) {
                ctx.fillStyle = '#666';
                ctx.font = '10px monospace';
                ctx.fillText(`📍 ${evidence.location.substring(0, 22)}`, x + 15, y + 110);
            }

            // Time
            ctx.fillStyle = '#999';
            ctx.font = '9px monospace';
            ctx.fillText(new Date(evidence.timestamp).toLocaleTimeString(), x + 15, y + 130);
        });

        // Red strings connecting evidence (decorative)
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        if (session.evidence.length > 1) {
            for (let i = 0; i < Math.min(session.evidence.length - 1, 5); i++) {
                const row1 = Math.floor(i / cardsPerRow);
                const col1 = i % cardsPerRow;
                const row2 = Math.floor((i + 1) / cardsPerRow);
                const col2 = (i + 1) % cardsPerRow;

                const x1 = startX + col1 * (cardWidth + gap) + cardWidth / 2;
                const y1 = startY + row1 * (cardHeight + gap) - 5;
                const x2 = startX + col2 * (cardWidth + gap) + cardWidth / 2;
                const y2 = startY + row2 * (cardHeight + gap) - 5;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }

        // Footer
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, height - 40, width, 40);

        ctx.fillStyle = '#fbbf24';
        ctx.font = '12px monospace';
        ctx.fillText(`NanoBanana™ Evidence Board | Generated: ${new Date().toLocaleString()} | ForensicSpotter AI`, 40, height - 15);

        setGeneratedImage(canvas.toDataURL('image/png'));
    };

    // Download the generated image
    const downloadNanoBananaImage = () => {
        if (!generatedImage) return;

        const link = document.createElement('a');
        link.download = `NanoBanana-Evidence-${session.caseId}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = generatedImage;
        link.click();
    };

    const handleForensicPDFExport = () => {
        setIsGeneratingPDF(true);
        setTimeout(() => {
            try {
                generateForensicPDFReport(session, screenshots);
            } catch (error) {
                console.error('Forensic PDF generation failed:', error);
            } finally {
                setIsGeneratingPDF(false);
            }
        }, 100);
    };

    const priorityColors: Record<string, string> = {
        'critical': 'bg-red-500',
        'high': 'bg-amber-500',
        'medium': 'bg-blue-500',
        'low': 'bg-emerald-500',
    };

    const categoryLabels: Record<string, string> = {
        'weapon': 'WEAPON',
        'biological': 'BIOLOGICAL',
        'trace': 'TRACE',
        'document': 'DOCUMENT',
        'scene_indicator': 'SCENE',
        'fraud_indicator': 'FRAUD',
        'unclassified': 'OTHER',
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-hidden">
            <div className="h-full flex items-center justify-center p-4">
                <div className="bg-zinc-900 rounded-2xl max-w-6xl w-full h-[90vh] shadow-2xl overflow-hidden flex border border-red-900/30">

                    {/* Left Sidebar - Forensic Style */}
                    <aside className="w-64 bg-zinc-950 border-r border-red-900/30 flex flex-col">
                        {/* Report Header */}
                        <div className="p-6 border-b border-red-900/30 bg-red-950/30">
                            <div className="w-16 h-16 bg-red-900/50 rounded-xl mb-4 flex items-center justify-center">
                                <Shield size={28} className="text-red-400" />
                            </div>
                            <h2 className="font-mono text-xl text-red-400 mb-1">Forensic Report</h2>
                            <p className="text-xs text-zinc-500 font-mono">
                                {new Date(session.startTime).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </p>
                        </div>

                        {/* Session Info */}
                        <div className="flex-1 p-4 overflow-y-auto">
                            <div className="space-y-4">
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Case ID</p>
                                    <p className="text-sm text-zinc-300 font-mono">{session.caseId}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Officer</p>
                                    <p className="text-sm text-zinc-300 font-mono">{session.officerId}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Scene</p>
                                    <p className="text-sm text-zinc-300 font-mono">{session.sceneType}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Location</p>
                                    <p className="text-sm text-zinc-300 font-mono">{session.location}</p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="p-4 border-t border-red-900/30 bg-zinc-800/30">
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div>
                                    <div className="text-2xl font-mono text-red-400">{session.evidence.length}</div>
                                    <div className="text-[9px] text-zinc-500 uppercase tracking-wide">Evidence</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-mono text-amber-400">{session.authenticityAlerts.length}</div>
                                    <div className="text-[9px] text-zinc-500 uppercase tracking-wide">Alerts</div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col overflow-hidden bg-zinc-900">
                        {/* Top Bar */}
                        <header className="flex items-center justify-between px-8 py-4 border-b border-red-900/30 bg-zinc-950/50">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-zinc-500 font-mono">Duration: {durationMin}m {durationRemSec}s</span>
                                <span className="text-zinc-700">|</span>
                                <span className="text-sm text-zinc-500 font-mono">{session.frameCount} frames analyzed</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* NanoBanana Button */}
                                <button
                                    onClick={() => setShowNanoBanana(!showNanoBanana)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                                        showNanoBanana
                                            ? 'bg-yellow-500 text-black'
                                            : 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/50'
                                    }`}
                                >
                                    <Sparkles size={16} />
                                    NanoBanana
                                </button>
                                <button
                                    onClick={handleForensicPDFExport}
                                    disabled={isGeneratingPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-red-900 text-white rounded-lg text-sm font-mono transition-colors"
                                >
                                    {isGeneratingPDF ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <FileText size={16} />
                                            Export PDF
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    <X size={20} className="text-zinc-500" />
                                </button>
                            </div>
                        </header>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="max-w-4xl mx-auto px-8 py-8">

                                {/* Title */}
                                <div className="mb-8">
                                    <h1 className="font-mono text-3xl text-red-400 mb-2">
                                        FORENSIC INVESTIGATION REPORT
                                    </h1>
                                    <p className="text-zinc-500 font-mono text-sm">
                                        Crime scene evidence documentation and analysis
                                    </p>
                                </div>

                                {/* NanoBanana Evidence Flashcards Section */}
                                {showNanoBanana && (
                                    <div className="mb-8 bg-gradient-to-br from-yellow-950/30 to-zinc-900 border border-yellow-600/30 rounded-xl overflow-hidden">
                                        {/* NanoBanana Header */}
                                        <div className="px-6 py-4 bg-yellow-600/10 border-b border-yellow-600/30 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                                                    <Sparkles size={20} className="text-black" />
                                                </div>
                                                <div>
                                                    <h3 className="font-mono text-lg text-yellow-400 flex items-center gap-2">
                                                        NANOBANANA™ AI EVIDENCE BOARD
                                                    </h3>
                                                    <p className="text-xs text-zinc-500 font-mono">
                                                        Gemini AI-powered evidence visualization • {session.evidence.length} items
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={generateNanoBananaImage}
                                                    disabled={isGeneratingNanoBanana || session.evidence.length === 0}
                                                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-700 text-black rounded-lg text-sm font-mono font-bold transition-colors"
                                                >
                                                    {isGeneratingNanoBanana ? (
                                                        <>
                                                            <Loader2 size={16} className="animate-spin" />
                                                            Generating with AI...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles size={16} />
                                                            Generate Evidence Board
                                                        </>
                                                    )}
                                                </button>
                                                {generatedImage && (
                                                    <button
                                                        onClick={downloadNanoBananaImage}
                                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-mono font-bold transition-colors"
                                                    >
                                                        <Download size={16} />
                                                        Download
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Generated Image Display */}
                                        {generatedImage ? (
                                            <div className="p-6">
                                                <div className="relative rounded-lg overflow-hidden border-4 border-yellow-600/30 shadow-2xl">
                                                    <img
                                                        src={generatedImage}
                                                        alt="NanoBanana Evidence Board"
                                                        className="w-full h-auto"
                                                    />
                                                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-[10px] text-yellow-400 font-mono">
                                                        AI Generated
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Flashcards Grid Preview */
                                            <div ref={nanoBananaRef} className="p-6">
                                                {/* Error Message */}
                                                {generationError && (
                                                    <div className="mb-4 p-4 bg-red-950/50 border border-red-700/50 rounded-lg">
                                                        <p className="text-sm text-red-400 font-mono flex items-center gap-2">
                                                            <AlertCircle size={16} />
                                                            {generationError}
                                                        </p>
                                                    </div>
                                                )}

                                                {session.evidence.length > 0 ? (
                                                    <>
                                                        <p className="text-xs text-zinc-500 font-mono mb-4 text-center">
                                                            Click "Generate Evidence Board" to create an AI-generated visualization
                                                        </p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {session.evidence.map((evidence, index) => {
                                                                const priorityColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
                                                                    critical: { bg: 'bg-red-950/50', border: 'border-red-700/50', text: 'text-red-400', dot: 'bg-red-500' },
                                                                    high: { bg: 'bg-amber-950/50', border: 'border-amber-700/50', text: 'text-amber-400', dot: 'bg-amber-500' },
                                                                    medium: { bg: 'bg-blue-950/50', border: 'border-blue-700/50', text: 'text-blue-400', dot: 'bg-blue-500' },
                                                                    low: { bg: 'bg-emerald-950/50', border: 'border-emerald-700/50', text: 'text-emerald-400', dot: 'bg-emerald-500' }
                                                                };
                                                                const colors = priorityColors[evidence.priority] || priorityColors.low;

                                                                return (
                                                                    <div
                                                                        key={evidence.id}
                                                                        className={`${colors.bg} ${colors.border} border rounded-xl p-4 hover:scale-[1.02] transition-transform cursor-default`}
                                                                    >
                                                                        {/* Card Header */}
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
                                                                                <span className="text-xs font-mono text-zinc-500">
                                                                                    E-{(index + 1).toString().padStart(3, '0')}
                                                                                </span>
                                                                            </div>
                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${colors.text} ${colors.bg}`}>
                                                                                {evidence.priority}
                                                                            </span>
                                                                        </div>

                                                                        {/* Evidence Type */}
                                                                        <h4 className="font-mono text-sm text-zinc-200 uppercase font-bold mb-2 truncate">
                                                                            {evidence.evidenceType.replace(/_/g, ' ')}
                                                                        </h4>

                                                                        {/* Category Badge */}
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-mono rounded uppercase">
                                                                                {evidence.category}
                                                                            </span>
                                                                            <span className="text-xs text-zinc-500 font-mono">
                                                                                {evidence.confidence}% conf.
                                                                            </span>
                                                                        </div>

                                                                        {/* Description */}
                                                                        {evidence.description && (
                                                                            <p className="text-xs text-zinc-400 mb-2 line-clamp-2">
                                                                                {evidence.description}
                                                                            </p>
                                                                        )}

                                                                        {/* Footer */}
                                                                        <div className="flex items-center justify-between text-[10px] text-zinc-600 font-mono pt-2 border-t border-zinc-800">
                                                                            {evidence.location ? (
                                                                                <span className="truncate max-w-[60%]">📍 {evidence.location}</span>
                                                                            ) : (
                                                                                <span>-</span>
                                                                            )}
                                                                            <span>{new Date(evidence.timestamp).toLocaleTimeString()}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-center py-12">
                                                        <Sparkles size={48} className="text-zinc-700 mx-auto mb-4" />
                                                        <p className="text-zinc-500 font-mono">No evidence collected yet</p>
                                                        <p className="text-xs text-zinc-600 font-mono mt-1">
                                                            Evidence items will appear here as flashcards
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* NanoBanana Footer */}
                                        <div className="px-6 py-3 bg-zinc-900/50 border-t border-yellow-600/20 flex items-center justify-between">
                                            <span className="text-[10px] text-zinc-600 font-mono">
                                                Case: {session.caseId} • Officer: {session.officerId} • Powered by Gemini AI
                                            </span>
                                            <span className="text-[10px] text-yellow-600 font-mono">
                                                NanoBanana™ by ForensicSpotter AI
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Authenticity Alerts */}
                                {session.authenticityAlerts.length > 0 && (
                                    <div className="mb-8 bg-red-950/30 border border-red-700/50 rounded-xl p-6">
                                        <h3 className="font-mono text-lg text-red-400 mb-4 flex items-center gap-2">
                                            <AlertCircle size={18} />
                                            AUTHENTICITY CONCERNS ({session.authenticityAlerts.length})
                                        </h3>
                                        <div className="space-y-3">
                                            {session.authenticityAlerts.map((alert, i) => (
                                                <div key={alert.id} className="bg-zinc-900/50 rounded-lg p-4 border border-red-900/30">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-mono text-red-300 uppercase">
                                                            {alert.concern.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                                                            alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                            alert.severity === 'high' ? 'bg-amber-500/20 text-amber-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                            {alert.severity}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-zinc-400">{alert.description}</p>
                                                    <p className="text-xs text-zinc-500 mt-2">
                                                        Recommendation: {alert.recommendation}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Evidence Summary */}
                                <div className="grid grid-cols-4 gap-4 mb-8">
                                    <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700/50">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-2 h-2 rounded-full bg-red-500" />
                                            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Critical</span>
                                        </div>
                                        <div className="font-mono text-4xl text-red-400">{criticalCount}</div>
                                    </div>
                                    <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700/50">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                            <span className="text-[10px] uppercase tracking-wide text-zinc-500">High</span>
                                        </div>
                                        <div className="font-mono text-4xl text-amber-400">{highCount}</div>
                                    </div>
                                    <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700/50">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Medium</span>
                                        </div>
                                        <div className="font-mono text-4xl text-blue-400">
                                            {session.evidence.filter(e => e.priority === 'medium').length}
                                        </div>
                                    </div>
                                    <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700/50">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Low</span>
                                        </div>
                                        <div className="font-mono text-4xl text-emerald-400">
                                            {session.evidence.filter(e => e.priority === 'low').length}
                                        </div>
                                    </div>
                                </div>

                                {/* Evidence List */}
                                <div className="mb-8">
                                    <h3 className="font-mono text-lg text-zinc-300 mb-4">EVIDENCE CATALOG</h3>
                                    {session.evidence.length > 0 ? (
                                        <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/50 overflow-hidden">
                                            <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
                                                {session.evidence.map((evidence, index) => (
                                                    <div key={evidence.id} className="px-6 py-4 flex items-center gap-4 hover:bg-zinc-800/50">
                                                        <span className={`w-2 h-2 rounded-full ${priorityColors[evidence.priority]}`} />
                                                        <div className="w-16 text-xs font-mono text-zinc-500">
                                                            E-{(index + 1).toString().padStart(3, '0')}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm text-zinc-300 font-mono uppercase">
                                                                {evidence.evidenceType.replace(/_/g, ' ')}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded">
                                                                    {categoryLabels[evidence.category]}
                                                                </span>
                                                                {evidence.location && (
                                                                    <span className="text-xs text-zinc-500">• {evidence.location}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-mono text-zinc-400">{evidence.confidence}%</div>
                                                            <div className="text-[10px] text-zinc-600">
                                                                {new Date(evidence.timestamp).toLocaleTimeString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-zinc-800/30 rounded-xl p-8 text-center border border-zinc-700/50">
                                            <Eye size={32} className="text-zinc-600 mx-auto mb-3" />
                                            <p className="text-zinc-500 font-mono">No evidence captured</p>
                                        </div>
                                    )}
                                </div>

                                {/* Chain of Custody */}
                                <div className="mb-8">
                                    <h3 className="font-mono text-lg text-zinc-300 mb-4 flex items-center gap-2">
                                        <Link size={16} />
                                        CHAIN OF CUSTODY ({session.chainOfCustody.length} entries)
                                    </h3>
                                    <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/50 overflow-hidden">
                                        <div className="max-h-48 overflow-y-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-zinc-900 sticky top-0">
                                                    <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500">
                                                        <th className="px-4 py-2">Time</th>
                                                        <th className="px-4 py-2">Action</th>
                                                        <th className="px-4 py-2">Evidence ID</th>
                                                        <th className="px-4 py-2">Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800">
                                                    {session.chainOfCustody.slice(0, 15).map((entry) => (
                                                        <tr key={entry.id} className="text-zinc-400 hover:bg-zinc-800/50">
                                                            <td className="px-4 py-2 font-mono text-xs">
                                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                                            </td>
                                                            <td className="px-4 py-2 text-xs">
                                                                {entry.action.replace(/_/g, ' ')}
                                                            </td>
                                                            <td className="px-4 py-2 font-mono text-xs text-zinc-500">
                                                                {entry.evidenceId ? entry.evidenceId.slice(0, 8) + '...' : '-'}
                                                            </td>
                                                            <td className="px-4 py-2 text-xs text-zinc-500">
                                                                {entry.notes || '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {session.chainOfCustody.length > 15 && (
                                                <div className="px-4 py-2 bg-zinc-900 text-center">
                                                    <span className="text-xs text-zinc-500">
                                                        + {session.chainOfCustody.length - 15} more entries
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Evidence Screenshots */}
                                {screenshots.length > 0 && (
                                    <div className="mb-8">
                                        <h3 className="font-mono text-lg text-zinc-300 mb-4">
                                            EVIDENCE IMAGES ({screenshots.length})
                                        </h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {screenshots.slice(0, 6).map((screenshot, index) => (
                                                <div
                                                    key={screenshot.id}
                                                    className="aspect-video bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700/50 group cursor-pointer"
                                                >
                                                    <img
                                                        src={screenshot.imageUrl}
                                                        alt={`Evidence ${index + 1}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Footer */}
                                <footer className="pt-8 border-t border-zinc-800 text-center">
                                    <p className="text-xs text-zinc-600 font-mono">
                                        Session: {session.sessionId.slice(0, 8).toUpperCase()} • Case: {session.caseId}
                                    </p>
                                    <p className="text-xs text-zinc-600 font-mono mt-1">
                                        Generated by ForensicSpotter AI • CONFIDENTIAL
                                    </p>
                                </footer>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export const ReportGenerator: React.FC = () => {
    const currentReport = useDefectStore(state => state.currentReport);
    const clearReport = useDefectStore(state => state.clearReport);
    const investigationMode = useDefectStore(state => state.investigationMode);
    const currentForensicSession = useDefectStore(state => state.currentForensicSession);
    const screenshots = useDefectStore(state => state.screenshots);

    // For forensic mode, show forensic report if there's a session
    if (investigationMode === 'crime_scene' && currentForensicSession) {
        return <ForensicReportModal session={currentForensicSession} screenshots={screenshots} onClose={clearReport} />;
    }

    // For property mode, show regular report
    if (!currentReport) return null;

    return <ReportModal report={currentReport} onClose={clearReport} />;
};
