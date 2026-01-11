import { jsPDF } from 'jspdf';
import type { InspectionReport } from './store';
import type { ForensicSession } from './forensicTypes';

// Format currency
const formatCurrency = (amount: number): string => {
    return '$' + amount.toLocaleString();
};

// Format date
const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

// Format time
const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const generatePDFReport = (report: InspectionReport): void => {
    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const pageWidth = 210;
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;

        // ============================================
        // COVER PAGE
        // ============================================

        // Header bar
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, pageWidth, 70, 'F');

        // Title
        doc.setFontSize(28);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('Property Inspection', margin, 35);
        doc.text('Report', margin, 48);

        // Date
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(report.startTime), margin, 60);

        // Risk level badge
        if (report.overallRiskLevel) {
            const riskColors: Record<string, [number, number, number]> = {
                'CRITICAL': [239, 68, 68],
                'HIGH': [245, 158, 11],
                'MEDIUM': [234, 179, 8],
                'LOW': [34, 197, 94],
            };
            const color = riskColors[report.overallRiskLevel] || [100, 100, 100];

            doc.setFillColor(...color);
            doc.roundedRect(pageWidth - margin - 45, 30, 45, 25, 3, 3, 'F');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text('RISK LEVEL', pageWidth - margin - 22.5, 40, { align: 'center' });
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(report.overallRiskLevel, pageWidth - margin - 22.5, 50, { align: 'center' });
        }

        y = 85;

        // Executive Summary Box
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(margin, y, contentWidth, 55, 3, 3, 'FD');

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('EXECUTIVE SUMMARY', margin + 8, y + 12);

        // Stats row
        const statsY = y + 30;
        const statWidth = contentWidth / 4;

        // Total
        doc.setFontSize(24);
        doc.setTextColor(30, 41, 59);
        doc.text(report.totalDefects.toString(), margin + statWidth * 0.5, statsY, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('TOTAL', margin + statWidth * 0.5, statsY + 8, { align: 'center' });

        // Critical
        doc.setFontSize(24);
        doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        doc.text(report.criticalCount.toString(), margin + statWidth * 1.5, statsY, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('CRITICAL', margin + statWidth * 1.5, statsY + 8, { align: 'center' });

        // Medium
        doc.setFontSize(24);
        doc.setTextColor(245, 158, 11);
        doc.setFont('helvetica', 'bold');
        doc.text(report.mediumCount.toString(), margin + statWidth * 2.5, statsY, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('MEDIUM', margin + statWidth * 2.5, statsY + 8, { align: 'center' });

        // Minor
        doc.setFontSize(24);
        doc.setTextColor(34, 197, 94);
        doc.setFont('helvetica', 'bold');
        doc.text(report.minorCount.toString(), margin + statWidth * 3.5, statsY, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('MINOR', margin + statWidth * 3.5, statsY + 8, { align: 'center' });

        // Duration & Cost
        const duration = Math.round((report.endTime - report.startTime) / 1000 / 60);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Duration: ${duration} min`, margin + 8, y + 50);
        doc.text(
            `Est. Cost: ${formatCurrency(report.estimatedCost.min)} - ${formatCurrency(report.estimatedCost.max)}`,
            margin + contentWidth - 8,
            y + 50,
            { align: 'right' }
        );

        y += 65;

        // Time sensitivity warning
        if (report.timeToAction) {
            doc.setFillColor(254, 243, 199);
            doc.setDrawColor(253, 224, 71);
            doc.roundedRect(margin, y, contentWidth, 20, 3, 3, 'FD');
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text(report.timeToAction, margin + 8, y + 13);
            y += 28;
        }

        // Urgent Actions
        if (report.urgentActions && report.urgentActions.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text('RECOMMENDED ACTIONS', margin, y);
            y += 8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            report.urgentActions.slice(0, 5).forEach((action, index) => {
                doc.setFillColor(245, 158, 11);
                doc.circle(margin + 4, y + 2, 3, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(7);
                doc.text((index + 1).toString(), margin + 4, y + 3.5, { align: 'center' });

                doc.setTextColor(50, 50, 50);
                doc.setFontSize(9);
                const lines = doc.splitTextToSize(action, contentWidth - 15);
                doc.text(lines, margin + 12, y + 3);
                y += lines.length * 5 + 4;
            });
        }

        // ============================================
        // PAGE 2: DEFECT DETAILS
        // ============================================
        doc.addPage();
        y = margin;

        // Header
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, 15, pageWidth - margin, 15);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('PROPERTY INSPECTION REPORT', margin, 12);

        // Section title
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('Defect Analysis', margin, y + 5);
        y += 15;

        // Defect cards
        const severityColors: Record<string, [number, number, number]> = {
            'critical': [239, 68, 68],
            'medium': [245, 158, 11],
            'minor': [34, 197, 94],
        };

        report.defects.slice(0, 10).forEach((defect, index) => {
            if (y > 250) {
                doc.addPage();
                y = margin;
                doc.setDrawColor(200, 200, 200);
                doc.line(margin, 15, pageWidth - margin, 15);
            }

            const cardHeight = 28;
            const sevColor = severityColors[defect.severity] || [100, 100, 100];

            // Card background
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(220, 220, 220);
            doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

            // Severity bar
            doc.setFillColor(...sevColor);
            doc.rect(margin, y, 4, cardHeight, 'F');

            // Number
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.setFont('helvetica', 'normal');
            doc.text(`#${(index + 1).toString().padStart(2, '0')}`, margin + 8, y + 8);

            // Type
            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            const typeName = defect.type.charAt(0).toUpperCase() + defect.type.slice(1);
            doc.text(typeName, margin + 8, y + 16);

            // Severity badge
            doc.setFillColor(...sevColor);
            doc.roundedRect(margin + 8, y + 19, 18, 6, 1, 1, 'F');
            doc.setFontSize(6);
            doc.setTextColor(255, 255, 255);
            doc.text(defect.severity.toUpperCase(), margin + 17, y + 23.5, { align: 'center' });

            // Category
            if (defect.category) {
                doc.setFillColor(230, 230, 230);
                doc.roundedRect(margin + 28, y + 19, 20, 6, 1, 1, 'F');
                doc.setFontSize(6);
                doc.setTextColor(80, 80, 80);
                doc.text(defect.category.toUpperCase(), margin + 38, y + 23.5, { align: 'center' });
            }

            // Confidence
            if (defect.confidence) {
                doc.setFontSize(14);
                doc.setTextColor(30, 41, 59);
                doc.setFont('helvetica', 'bold');
                doc.text(`${defect.confidence}%`, pageWidth - margin - 8, y + 12, { align: 'right' });
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 100);
                doc.setFont('helvetica', 'normal');
                doc.text('CONFIDENCE', pageWidth - margin - 8, y + 17, { align: 'right' });
            }

            // Location
            if (defect.location) {
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(defect.location, pageWidth - margin - 8, y + 24, { align: 'right' });
            }

            y += cardHeight + 4;
        });

        if (report.defects.length > 10) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`+ ${report.defects.length - 10} more defects`, margin, y + 5);
        }

        // ============================================
        // PAGE 3: COST & SERVICES
        // ============================================
        doc.addPage();
        y = margin;

        // Header
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, 15, pageWidth - margin, 15);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('PROPERTY INSPECTION REPORT', margin, 12);

        // Cost Section
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('Cost Estimate', margin, y + 5);
        y += 15;

        // Big cost box
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(margin, y, contentWidth, 40, 3, 3, 'FD');

        doc.setFontSize(28);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        const costText = `${formatCurrency(report.estimatedCost.min)}  —  ${formatCurrency(report.estimatedCost.max)}`;
        doc.text(costText, margin + contentWidth / 2, y + 20, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('Estimated total repair cost based on detected issues', margin + contentWidth / 2, y + 32, { align: 'center' });

        y += 50;

        // Services Section
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended Services', margin, y);
        y += 10;

        report.nearbyServices.slice(0, 5).forEach((service) => {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(220, 220, 220);
            doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text(service.name, margin + 6, y + 8);

            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.setFont('helvetica', 'normal');
            doc.text(service.type, margin + 6, y + 14);

            // Rating
            doc.setTextColor(245, 158, 11);
            doc.text(`★ ${service.rating}`, pageWidth - margin - 30, y + 8);

            // Distance
            doc.setTextColor(100, 100, 100);
            doc.text(service.distance, pageWidth - margin - 6, y + 8, { align: 'right' });

            // Phone
            if (service.phone) {
                doc.text(service.phone, pageWidth - margin - 6, y + 14, { align: 'right' });
            }

            y += 22;
        });

        // ============================================
        // PAGE 4: EVIDENCE (if screenshots exist)
        // ============================================
        if (report.screenshots && report.screenshots.length > 0) {
            doc.addPage();
            y = margin;

            // Header
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, 15, pageWidth - margin, 15);
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text('PROPERTY INSPECTION REPORT', margin, 12);

            // Section title
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text(`Evidence (${report.screenshots.length} images)`, margin, y + 5);
            y += 15;

            // Image grid
            const imgWidth = (contentWidth - 10) / 2;
            const imgHeight = 50;
            let col = 0;

            report.screenshots.slice(0, 6).forEach((screenshot, idx) => {
                if (y + imgHeight > 270) {
                    doc.addPage();
                    y = margin;
                    col = 0;
                }

                const x = margin + (col * (imgWidth + 10));

                // Image border
                doc.setFillColor(245, 245, 245);
                doc.setDrawColor(200, 200, 200);
                doc.roundedRect(x, y, imgWidth, imgHeight, 2, 2, 'FD');

                // Try to add image
                try {
                    doc.addImage(
                        screenshot.imageUrl,
                        'JPEG',
                        x + 2,
                        y + 2,
                        imgWidth - 4,
                        imgHeight - 12
                    );
                } catch (e) {
                    doc.setFontSize(8);
                    doc.setTextColor(150, 150, 150);
                    doc.text('Image', x + imgWidth / 2, y + imgHeight / 2 - 3, { align: 'center' });
                }

                // Caption
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 100);
                doc.text(`#${idx + 1} - ${formatTime(screenshot.timestamp)}`, x + 4, y + imgHeight - 3);

                col++;
                if (col >= 2) {
                    col = 0;
                    y += imgHeight + 6;
                }
            });
        }

        // ============================================
        // FOOTER on last page
        // ============================================
        const lastPageHeight = 297;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Report ID: ${report.id.slice(0, 8).toUpperCase()}`, margin, lastPageHeight - 15);
        doc.text('Generated by DefectSpotter AI', margin, lastPageHeight - 10);
        doc.text(formatDate(Date.now()), pageWidth - margin, lastPageHeight - 10, { align: 'right' });

        // Save the PDF with proper blob handling
        const filename = `DefectSpotter-Report-${new Date().toISOString().split('T')[0]}.pdf`;

        // Get PDF as blob for more reliable download
        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);

        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename;
        downloadLink.type = 'application/pdf';

        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Cleanup blob URL after short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        console.log('PDF generated successfully:', filename);

    } catch (error) {
        console.error('PDF generation error:', error);
        alert('Failed to generate PDF. Please try again.');
        throw error;
    }
};

// ============================================
// FORENSIC REPORT PDF GENERATOR
// ============================================
export const generateForensicPDFReport = (session: ForensicSession, screenshots: Array<{ imageUrl: string; timestamp: number }> = []): void => {
    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const pageWidth = 210;
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;

        // ============================================
        // COVER PAGE - FORENSIC
        // ============================================

        // Header bar (dark red for forensic)
        doc.setFillColor(127, 29, 29);
        doc.rect(0, 0, pageWidth, 80, 'F');

        // Title
        doc.setFontSize(28);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('FORENSIC', margin, 30);
        doc.text('INVESTIGATION', margin, 44);
        doc.text('REPORT', margin, 58);

        // Case ID badge
        doc.setFillColor(185, 28, 28);
        doc.roundedRect(pageWidth - margin - 60, 20, 60, 35, 3, 3, 'F');
        doc.setFontSize(8);
        doc.text('CASE ID', pageWidth - margin - 30, 30, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const caseIdShort = session.caseId.length > 12 ? session.caseId.slice(0, 12) + '...' : session.caseId;
        doc.text(caseIdShort, pageWidth - margin - 30, 42, { align: 'center' });

        // Date/time
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(session.startTime), margin, 72);

        y = 95;

        // Session Info Box
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(185, 28, 28);
        doc.roundedRect(margin, y, contentWidth, 45, 3, 3, 'FD');

        doc.setFontSize(12);
        doc.setTextColor(127, 29, 29);
        doc.setFont('helvetica', 'bold');
        doc.text('SESSION DETAILS', margin + 8, y + 12);

        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.text(`Officer ID: ${session.officerId}`, margin + 8, y + 22);
        doc.text(`Scene Type: ${session.sceneType.toUpperCase()}`, margin + 8, y + 30);
        doc.text(`Location: ${session.location}`, margin + 8, y + 38);

        // Duration
        const durationSec = session.endTime ? Math.round((session.endTime - session.startTime) / 1000) : 0;
        const durationMin = Math.floor(durationSec / 60);
        const durationRemSec = durationSec % 60;
        doc.text(`Duration: ${durationMin}m ${durationRemSec}s`, pageWidth - margin - 8, y + 22, { align: 'right' });
        doc.text(`Frames Analyzed: ${session.frameCount}`, pageWidth - margin - 8, y + 30, { align: 'right' });
        doc.text(`Report Generated: ${formatTime(Date.now())}`, pageWidth - margin - 8, y + 38, { align: 'right' });

        y += 55;

        // Stats Summary
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(margin, y, contentWidth, 40, 3, 3, 'FD');

        const statsY = y + 25;
        const statWidth = contentWidth / 4;

        // Total Evidence
        doc.setFontSize(24);
        doc.setTextColor(127, 29, 29);
        doc.setFont('helvetica', 'bold');
        doc.text(session.evidence.length.toString(), margin + statWidth * 0.5, statsY, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('EVIDENCE', margin + statWidth * 0.5, statsY + 8, { align: 'center' });

        // Critical
        const criticalCount = session.evidence.filter(e => e.priority === 'critical').length;
        doc.setFontSize(24);
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'bold');
        doc.text(criticalCount.toString(), margin + statWidth * 1.5, statsY, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('CRITICAL', margin + statWidth * 1.5, statsY + 8, { align: 'center' });

        // Alerts
        doc.setFontSize(24);
        doc.setTextColor(245, 158, 11);
        doc.setFont('helvetica', 'bold');
        doc.text(session.authenticityAlerts.length.toString(), margin + statWidth * 2.5, statsY, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('ALERTS', margin + statWidth * 2.5, statsY + 8, { align: 'center' });

        // Custody Entries
        doc.setFontSize(24);
        doc.setTextColor(59, 130, 246);
        doc.setFont('helvetica', 'bold');
        doc.text(session.chainOfCustody.length.toString(), margin + statWidth * 3.5, statsY, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('CUSTODY LOG', margin + statWidth * 3.5, statsY + 8, { align: 'center' });

        y += 50;

        // Authenticity Alerts (if any)
        if (session.authenticityAlerts.length > 0) {
            doc.setFillColor(254, 226, 226);
            doc.setDrawColor(220, 38, 38);
            doc.roundedRect(margin, y, contentWidth, 25, 3, 3, 'FD');
            doc.setFontSize(10);
            doc.setTextColor(153, 27, 27);
            doc.setFont('helvetica', 'bold');
            doc.text('⚠ AUTHENTICITY CONCERNS DETECTED', margin + 8, y + 10);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`${session.authenticityAlerts.length} potential manipulation(s) flagged - review evidence carefully`, margin + 8, y + 18);
            y += 32;
        }

        // ============================================
        // PAGE 2: EVIDENCE CATALOG
        // ============================================
        doc.addPage();
        y = margin;

        // Header
        doc.setDrawColor(185, 28, 28);
        doc.line(margin, 15, pageWidth - margin, 15);
        doc.setFontSize(8);
        doc.setTextColor(127, 29, 29);
        doc.text(`FORENSIC REPORT - CASE: ${session.caseId}`, margin, 12);

        // Section title
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('Evidence Catalog', margin, y + 5);
        y += 15;

        // Evidence cards
        const priorityColors: Record<string, [number, number, number]> = {
            'critical': [220, 38, 38],
            'high': [245, 158, 11],
            'medium': [59, 130, 246],
            'low': [34, 197, 94],
        };

        const categoryLabels: Record<string, string> = {
            'weapon': 'WEAPON',
            'biological': 'BIOLOGICAL',
            'trace': 'TRACE',
            'document': 'DOCUMENT',
            'scene_indicator': 'SCENE',
            'fraud_indicator': 'FRAUD',
            'unclassified': 'UNCLASSIFIED',
        };

        session.evidence.slice(0, 12).forEach((evidence, index) => {
            if (y > 250) {
                doc.addPage();
                y = margin;
                doc.setDrawColor(185, 28, 28);
                doc.line(margin, 15, pageWidth - margin, 15);
                doc.setFontSize(8);
                doc.setTextColor(127, 29, 29);
                doc.text(`FORENSIC REPORT - CASE: ${session.caseId}`, margin, 12);
                y += 5;
            }

            const cardHeight = 32;
            const prioColor = priorityColors[evidence.priority] || [100, 100, 100];

            // Card background
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(220, 220, 220);
            doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

            // Priority bar
            doc.setFillColor(...prioColor);
            doc.rect(margin, y, 4, cardHeight, 'F');

            // Evidence number
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.setFont('helvetica', 'normal');
            doc.text(`E-${(index + 1).toString().padStart(3, '0')}`, margin + 8, y + 8);

            // Evidence type
            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            const typeName = evidence.evidenceType.replace(/_/g, ' ').toUpperCase();
            doc.text(typeName.substring(0, 30), margin + 8, y + 17);

            // Priority badge
            doc.setFillColor(...prioColor);
            doc.roundedRect(margin + 8, y + 21, 18, 6, 1, 1, 'F');
            doc.setFontSize(5);
            doc.setTextColor(255, 255, 255);
            doc.text(evidence.priority.toUpperCase(), margin + 17, y + 25, { align: 'center' });

            // Category badge
            doc.setFillColor(240, 240, 240);
            doc.roundedRect(margin + 28, y + 21, 22, 6, 1, 1, 'F');
            doc.setFontSize(5);
            doc.setTextColor(80, 80, 80);
            doc.text(categoryLabels[evidence.category] || 'OTHER', margin + 39, y + 25, { align: 'center' });

            // Confidence
            doc.setFontSize(14);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text(`${evidence.confidence}%`, pageWidth - margin - 8, y + 12, { align: 'right' });
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            doc.setFont('helvetica', 'normal');
            doc.text('CONFIDENCE', pageWidth - margin - 8, y + 17, { align: 'right' });

            // Location
            if (evidence.location) {
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 100);
                const locText = evidence.clockPosition ? `${evidence.location} (${evidence.clockPosition} o'clock)` : evidence.location;
                doc.text(locText.substring(0, 40), pageWidth - margin - 8, y + 24, { align: 'right' });
            }

            // Timestamp
            doc.setFontSize(6);
            doc.setTextColor(150, 150, 150);
            doc.text(formatTime(evidence.timestamp), pageWidth - margin - 8, y + 29, { align: 'right' });

            y += cardHeight + 4;
        });

        if (session.evidence.length > 12) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`+ ${session.evidence.length - 12} additional evidence items`, margin, y + 5);
        }

        // ============================================
        // PAGE 3: AUTHENTICITY ALERTS
        // ============================================
        if (session.authenticityAlerts.length > 0) {
            doc.addPage();
            y = margin;

            // Header
            doc.setDrawColor(185, 28, 28);
            doc.line(margin, 15, pageWidth - margin, 15);
            doc.setFontSize(8);
            doc.setTextColor(127, 29, 29);
            doc.text(`FORENSIC REPORT - CASE: ${session.caseId}`, margin, 12);

            // Section title
            doc.setFontSize(18);
            doc.setTextColor(220, 38, 38);
            doc.setFont('helvetica', 'bold');
            doc.text('Authenticity Alerts', margin, y + 5);
            y += 15;

            session.authenticityAlerts.forEach((alert, index) => {
                if (y > 250) {
                    doc.addPage();
                    y = margin + 5;
                }

                const cardHeight = 35;
                const sevColor: [number, number, number] = alert.severity === 'critical' ? [220, 38, 38] :
                    alert.severity === 'high' ? [245, 158, 11] : [59, 130, 246];

                // Card
                doc.setFillColor(254, 242, 242);
                doc.setDrawColor(...sevColor);
                doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

                // Severity bar
                doc.setFillColor(...sevColor);
                doc.rect(margin, y, 4, cardHeight, 'F');

                // Alert number
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.setFont('helvetica', 'normal');
                doc.text(`ALERT-${(index + 1).toString().padStart(2, '0')}`, margin + 8, y + 8);

                // Concern type
                doc.setFontSize(11);
                doc.setTextColor(153, 27, 27);
                doc.setFont('helvetica', 'bold');
                doc.text(alert.concern.replace(/_/g, ' ').toUpperCase(), margin + 8, y + 17);

                // Description
                doc.setFontSize(8);
                doc.setTextColor(50, 50, 50);
                doc.setFont('helvetica', 'normal');
                const descLines = doc.splitTextToSize(alert.description, contentWidth - 70);
                doc.text(descLines.slice(0, 2), margin + 8, y + 25);

                // Severity badge
                doc.setFillColor(...sevColor);
                doc.roundedRect(pageWidth - margin - 25, y + 5, 20, 8, 1, 1, 'F');
                doc.setFontSize(6);
                doc.setTextColor(255, 255, 255);
                doc.text(alert.severity.toUpperCase(), pageWidth - margin - 15, y + 10.5, { align: 'center' });

                y += cardHeight + 4;
            });
        }

        // ============================================
        // PAGE 4: CHAIN OF CUSTODY LOG
        // ============================================
        doc.addPage();
        y = margin;

        // Header
        doc.setDrawColor(185, 28, 28);
        doc.line(margin, 15, pageWidth - margin, 15);
        doc.setFontSize(8);
        doc.setTextColor(127, 29, 29);
        doc.text(`FORENSIC REPORT - CASE: ${session.caseId}`, margin, 12);

        // Section title
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('Chain of Custody Log', margin, y + 5);
        y += 12;

        // Table header
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y, contentWidth, 8, 'F');
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('TIME', margin + 4, y + 5.5);
        doc.text('ACTION', margin + 30, y + 5.5);
        doc.text('EVIDENCE ID', margin + 80, y + 5.5);
        doc.text('NOTES', margin + 115, y + 5.5);
        y += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);

        session.chainOfCustody.slice(0, 30).forEach((entry, index) => {
            if (y > 275) {
                doc.addPage();
                y = margin;
                // Re-draw header
                doc.setFillColor(240, 240, 240);
                doc.rect(margin, y, contentWidth, 8, 'F');
                doc.setFontSize(7);
                doc.setTextColor(80, 80, 80);
                doc.setFont('helvetica', 'bold');
                doc.text('TIME', margin + 4, y + 5.5);
                doc.text('ACTION', margin + 30, y + 5.5);
                doc.text('EVIDENCE ID', margin + 80, y + 5.5);
                doc.text('NOTES', margin + 115, y + 5.5);
                y += 10;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
            }

            // Alternating row colors
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, y - 2, contentWidth, 7, 'F');
            }

            doc.setTextColor(50, 50, 50);
            doc.text(formatTime(entry.timestamp), margin + 4, y + 2);
            doc.text(entry.action.replace(/_/g, ' ').substring(0, 20), margin + 30, y + 2);
            doc.text(entry.evidenceId ? entry.evidenceId.substring(0, 12) + '...' : '-', margin + 80, y + 2);
            doc.text(entry.notes ? entry.notes.substring(0, 35) : '-', margin + 115, y + 2);

            y += 7;
        });

        if (session.chainOfCustody.length > 30) {
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`+ ${session.chainOfCustody.length - 30} additional entries`, margin, y + 5);
        }

        // ============================================
        // PAGE 5: EVIDENCE SCREENSHOTS (if any)
        // ============================================
        if (screenshots.length > 0) {
            doc.addPage();
            y = margin;

            // Header
            doc.setDrawColor(185, 28, 28);
            doc.line(margin, 15, pageWidth - margin, 15);
            doc.setFontSize(8);
            doc.setTextColor(127, 29, 29);
            doc.text(`FORENSIC REPORT - CASE: ${session.caseId}`, margin, 12);

            // Section title
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text(`Evidence Images (${screenshots.length})`, margin, y + 5);
            y += 15;

            // Image grid
            const imgWidth = (contentWidth - 10) / 2;
            const imgHeight = 50;
            let col = 0;

            screenshots.slice(0, 8).forEach((screenshot, idx) => {
                if (y + imgHeight > 270) {
                    doc.addPage();
                    y = margin;
                    col = 0;
                }

                const x = margin + (col * (imgWidth + 10));

                // Image border
                doc.setFillColor(245, 245, 245);
                doc.setDrawColor(185, 28, 28);
                doc.roundedRect(x, y, imgWidth, imgHeight, 2, 2, 'FD');

                // Try to add image
                try {
                    doc.addImage(
                        screenshot.imageUrl,
                        'JPEG',
                        x + 2,
                        y + 2,
                        imgWidth - 4,
                        imgHeight - 12
                    );
                } catch (e) {
                    doc.setFontSize(8);
                    doc.setTextColor(150, 150, 150);
                    doc.text('Evidence Image', x + imgWidth / 2, y + imgHeight / 2 - 3, { align: 'center' });
                }

                // Caption
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 100);
                doc.text(`Evidence #${idx + 1} - ${formatTime(screenshot.timestamp)}`, x + 4, y + imgHeight - 3);

                col++;
                if (col >= 2) {
                    col = 0;
                    y += imgHeight + 6;
                }
            });
        }

        // ============================================
        // FOOTER on last page
        // ============================================
        const lastPageHeight = 297;
        doc.setFillColor(127, 29, 29);
        doc.rect(0, lastPageHeight - 25, pageWidth, 25, 'F');

        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`Case ID: ${session.caseId}`, margin, lastPageHeight - 15);
        doc.text(`Session: ${session.sessionId.substring(0, 8).toUpperCase()}`, margin, lastPageHeight - 8);
        doc.text('Generated by ForensicSpotter AI', pageWidth - margin, lastPageHeight - 15, { align: 'right' });
        doc.text(formatDate(Date.now()), pageWidth - margin, lastPageHeight - 8, { align: 'right' });

        // Confidential watermark
        doc.setFontSize(6);
        doc.text('CONFIDENTIAL - FOR LAW ENFORCEMENT USE ONLY', pageWidth / 2, lastPageHeight - 4, { align: 'center' });

        // Save the PDF with proper blob handling
        const filename = `ForensicSpotter-${session.caseId}-${new Date().toISOString().split('T')[0]}.pdf`;

        // Get PDF as blob for more reliable download
        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);

        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename;
        downloadLink.type = 'application/pdf';

        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Cleanup blob URL after short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        console.log('Forensic PDF generated successfully:', filename);

    } catch (error) {
        console.error('Forensic PDF generation error:', error);
        alert('Failed to generate forensic PDF report. Please try again.');
        throw error;
    }
};
