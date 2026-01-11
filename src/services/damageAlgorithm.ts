/**
 * DAMAGE DETECTION ALGORITHM
 * Based on Utilitarian Moral Reasoning & Categorical Prioritization
 *
 * Philosophy Applied:
 * - Consequentialist: Maximize overall property value/safety (greatest good)
 * - Categorical: Some damages are ALWAYS critical regardless of size (structural, safety)
 * - Trolley Problem: When resources limited, prioritize by impact severity
 */

import type { Defect, Severity } from './store';

// ============================================
// CATEGORICAL RULES (Always Critical - No Exceptions)
// ============================================
const CATEGORICAL_CRITICAL = [
    'structural crack',
    'foundation damage',
    'load-bearing',
    'water infiltration',
    'mold',
    'electrical hazard',
    'gas leak',
    'asbestos',
    'fire damage',
    'roof breach',
    'sewage',
    'collapse risk',
];

// ============================================
// DAMAGE CLASSIFICATION MATRIX
// ============================================
interface DamageCategory {
    type: string;
    keywords: string[];
    baseSeverity: Severity;
    impactMultiplier: number;      // How much it affects property value
    safetyRisk: number;            // 0-1 scale of safety concern
    spreadRisk: number;            // 0-1 scale of damage spreading
    repairUrgency: number;         // Days before damage worsens
    costPerUnit: { min: number; max: number };
}

const DAMAGE_CATEGORIES: DamageCategory[] = [
    // STRUCTURAL (Categorical Critical)
    {
        type: 'structural_crack',
        keywords: ['structural', 'foundation', 'load-bearing', 'beam', 'column', 'support'],
        baseSeverity: 'critical',
        impactMultiplier: 3.0,
        safetyRisk: 0.9,
        spreadRisk: 0.8,
        repairUrgency: 1,
        costPerUnit: { min: 500, max: 5000 },
    },
    // WATER DAMAGE (High Priority - Spreads)
    {
        type: 'water_damage',
        keywords: ['water', 'leak', 'moisture', 'damp', 'wet', 'stain', 'seepage'],
        baseSeverity: 'critical',
        impactMultiplier: 2.5,
        safetyRisk: 0.6,
        spreadRisk: 0.95,
        repairUrgency: 2,
        costPerUnit: { min: 200, max: 2000 },
    },
    // MOLD (Health Hazard - Categorical)
    {
        type: 'mold',
        keywords: ['mold', 'mildew', 'fungus', 'black spot', 'growth'],
        baseSeverity: 'critical',
        impactMultiplier: 2.0,
        safetyRisk: 0.85,
        spreadRisk: 0.9,
        repairUrgency: 3,
        costPerUnit: { min: 300, max: 3000 },
    },
    // CRACKS (Variable - Size Matters)
    {
        type: 'crack',
        keywords: ['crack', 'fracture', 'split', 'fissure', 'hairline'],
        baseSeverity: 'medium',
        impactMultiplier: 1.5,
        safetyRisk: 0.3,
        spreadRisk: 0.5,
        repairUrgency: 14,
        costPerUnit: { min: 100, max: 500 },
    },
    // PAINT DAMAGE (Cosmetic - Lower Priority)
    {
        type: 'paint',
        keywords: ['paint', 'peel', 'bubble', 'flake', 'chip', 'discolor'],
        baseSeverity: 'minor',
        impactMultiplier: 0.8,
        safetyRisk: 0.1,
        spreadRisk: 0.3,
        repairUrgency: 30,
        costPerUnit: { min: 50, max: 200 },
    },
    // TILE DAMAGE
    {
        type: 'tile',
        keywords: ['tile', 'grout', 'chip', 'loose', 'broken tile', 'misaligned'],
        baseSeverity: 'minor',
        impactMultiplier: 1.0,
        safetyRisk: 0.2,
        spreadRisk: 0.2,
        repairUrgency: 30,
        costPerUnit: { min: 75, max: 300 },
    },
    // GAPS & SEALS
    {
        type: 'gap',
        keywords: ['gap', 'seal', 'caulk', 'joint', 'separation', 'opening'],
        baseSeverity: 'medium',
        impactMultiplier: 1.2,
        safetyRisk: 0.2,
        spreadRisk: 0.6,
        repairUrgency: 14,
        costPerUnit: { min: 50, max: 200 },
    },
    // FIXTURE DAMAGE
    {
        type: 'fixture',
        keywords: ['fixture', 'handle', 'knob', 'hinge', 'door', 'window', 'cabinet'],
        baseSeverity: 'minor',
        impactMultiplier: 0.7,
        safetyRisk: 0.15,
        spreadRisk: 0.1,
        repairUrgency: 60,
        costPerUnit: { min: 30, max: 150 },
    },
];

// ============================================
// UTILITARIAN SCORING ALGORITHM
// ============================================

export interface DamageScore {
    defectId: string;
    utilityScore: number;          // Overall impact score (higher = more urgent)
    priorityRank: number;          // 1 = highest priority
    category: DamageCategory;
    adjustedSeverity: Severity;
    estimatedCost: { min: number; max: number };
    repairDeadline: Date;
    riskAssessment: {
        safetyRisk: string;
        spreadRisk: string;
        valueImpact: string;
    };
    recommendation: string;
}

/**
 * UTILITY CALCULATION
 * Like Bentham's felicific calculus - weighs all factors
 *
 * Formula: U = (S × I × R × T) + C
 * Where:
 *   S = Safety risk (0-1)
 *   I = Impact multiplier (property value effect)
 *   R = Spread risk (will it get worse?)
 *   T = Time urgency (1/days until worse)
 *   C = Categorical bonus (if categorical critical, +100)
 */
export function calculateUtilityScore(defect: Defect): DamageScore {
    // Find matching category
    const category = findDamageCategory(defect);

    // Check for categorical critical (like murder is always wrong)
    const isCategoricalCritical = CATEGORICAL_CRITICAL.some(term =>
        defect.type.toLowerCase().includes(term) ||
        defect.description.toLowerCase().includes(term)
    );

    // Base severity adjustment
    let adjustedSeverity = category.baseSeverity;
    if (isCategoricalCritical) {
        adjustedSeverity = 'critical';
    } else if (defect.severity === 'critical') {
        adjustedSeverity = 'critical';
    }

    // Severity multiplier
    const severityMultiplier =
        adjustedSeverity === 'critical' ? 3.0 :
        adjustedSeverity === 'medium' ? 2.0 : 1.0;

    // Calculate utility score (higher = more urgent)
    const safetyComponent = category.safetyRisk * 40;
    const impactComponent = category.impactMultiplier * 20;
    const spreadComponent = category.spreadRisk * 25;
    const urgencyComponent = (1 / category.repairUrgency) * 100;
    const categoricalBonus = isCategoricalCritical ? 100 : 0;

    const utilityScore = (
        (safetyComponent + impactComponent + spreadComponent + urgencyComponent) *
        severityMultiplier +
        categoricalBonus
    );

    // Calculate cost estimate
    const sizeFactor = defect.boundingBox ?
        (defect.boundingBox.xmax - defect.boundingBox.xmin) *
        (defect.boundingBox.ymax - defect.boundingBox.ymin) * 10 : 1;

    const estimatedCost = {
        min: Math.round(category.costPerUnit.min * severityMultiplier * Math.max(1, sizeFactor)),
        max: Math.round(category.costPerUnit.max * severityMultiplier * Math.max(1, sizeFactor)),
    };

    // Calculate repair deadline
    const repairDeadline = new Date();
    repairDeadline.setDate(repairDeadline.getDate() + Math.ceil(category.repairUrgency / severityMultiplier));

    // Risk assessment labels
    const riskAssessment = {
        safetyRisk: category.safetyRisk > 0.7 ? 'HIGH' : category.safetyRisk > 0.3 ? 'MEDIUM' : 'LOW',
        spreadRisk: category.spreadRisk > 0.7 ? 'HIGH' : category.spreadRisk > 0.3 ? 'MEDIUM' : 'LOW',
        valueImpact: category.impactMultiplier > 2 ? 'SEVERE' : category.impactMultiplier > 1 ? 'MODERATE' : 'MINOR',
    };

    // Generate recommendation based on utilitarian analysis
    const recommendation = generateRecommendation(category, adjustedSeverity, isCategoricalCritical);

    return {
        defectId: defect.id,
        utilityScore: Math.round(utilityScore * 100) / 100,
        priorityRank: 0, // Set later when ranking all defects
        category,
        adjustedSeverity,
        estimatedCost,
        repairDeadline,
        riskAssessment,
        recommendation,
    };
}

function findDamageCategory(defect: Defect): DamageCategory {
    const searchText = `${defect.type} ${defect.description}`.toLowerCase();

    for (const category of DAMAGE_CATEGORIES) {
        if (category.keywords.some(keyword => searchText.includes(keyword))) {
            return category;
        }
    }

    // Default category for unknown damage types
    return {
        type: 'unknown',
        keywords: [],
        baseSeverity: 'medium',
        impactMultiplier: 1.0,
        safetyRisk: 0.3,
        spreadRisk: 0.3,
        repairUrgency: 14,
        costPerUnit: { min: 100, max: 500 },
    };
}

function generateRecommendation(
    category: DamageCategory,
    severity: Severity,
    isCategorical: boolean
): string {
    if (isCategorical) {
        return `IMMEDIATE ACTION REQUIRED: This is a categorical safety concern. ` +
               `Contact a licensed ${category.type.replace('_', ' ')} specialist immediately. ` +
               `Do not delay - this type of damage poses significant risk.`;
    }

    if (severity === 'critical') {
        return `URGENT: Schedule professional inspection within ${category.repairUrgency} days. ` +
               `This damage has high spread risk and may worsen significantly if untreated. ` +
               `Recommended specialist: ${getSpecialistType(category.type)}`;
    }

    if (severity === 'medium') {
        return `ATTENTION NEEDED: Address within ${category.repairUrgency} days to prevent escalation. ` +
               `Consider getting 2-3 quotes from ${getSpecialistType(category.type)} professionals.`;
    }

    return `MONITOR: Low priority cosmetic issue. Can be addressed during routine maintenance. ` +
           `Estimated repair window: ${category.repairUrgency} days.`;
}

function getSpecialistType(damageType: string): string {
    const specialists: Record<string, string> = {
        'structural_crack': 'structural engineer',
        'water_damage': 'water damage restoration',
        'mold': 'mold remediation specialist',
        'crack': 'general contractor',
        'paint': 'painter',
        'tile': 'tile contractor',
        'gap': 'handyman or contractor',
        'fixture': 'handyman',
        'unknown': 'general contractor',
    };
    return specialists[damageType] || 'general contractor';
}

// ============================================
// TROLLEY PROBLEM: PRIORITIZATION
// ============================================

/**
 * Like the trolley problem - when you can't fix everything,
 * prioritize by maximizing overall benefit (utilitarian approach)
 */
export function prioritizeDefects(defects: Defect[]): DamageScore[] {
    // Calculate utility scores for all defects
    const scores = defects.map(defect => calculateUtilityScore(defect));

    // Sort by utility score (highest first - most urgent)
    scores.sort((a, b) => b.utilityScore - a.utilityScore);

    // Assign priority ranks
    scores.forEach((score, index) => {
        score.priorityRank = index + 1;
    });

    return scores;
}

// ============================================
// GREATEST GOOD CALCULATION
// ============================================

export interface InspectionAnalysis {
    totalDefects: number;
    criticalCount: number;
    mediumCount: number;
    minorCount: number;
    prioritizedDefects: DamageScore[];
    totalEstimatedCost: { min: number; max: number };
    overallRiskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    urgentActions: string[];
    timeToAction: string;
    propertyValueImpact: string;
}

export function analyzeInspection(defects: Defect[]): InspectionAnalysis {
    const prioritized = prioritizeDefects(defects);

    const criticalCount = prioritized.filter(d => d.adjustedSeverity === 'critical').length;
    const mediumCount = prioritized.filter(d => d.adjustedSeverity === 'medium').length;
    const minorCount = prioritized.filter(d => d.adjustedSeverity === 'minor').length;

    // Sum costs
    const totalMin = prioritized.reduce((sum, d) => sum + d.estimatedCost.min, 0);
    const totalMax = prioritized.reduce((sum, d) => sum + d.estimatedCost.max, 0);

    // Determine overall risk (categorical logic - any critical = overall critical)
    let overallRiskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (criticalCount > 0) {
        overallRiskLevel = 'CRITICAL';
    } else if (mediumCount > 2) {
        overallRiskLevel = 'HIGH';
    } else if (mediumCount > 0) {
        overallRiskLevel = 'MEDIUM';
    }

    // Generate urgent actions (top 3 priorities)
    const urgentActions = prioritized
        .slice(0, 3)
        .map((d, i) => `${i + 1}. ${d.category.type.replace('_', ' ').toUpperCase()}: ${d.recommendation.split('.')[0]}`);

    // Time to action
    const mostUrgent = prioritized[0];
    const timeToAction = mostUrgent ?
        `Immediate action needed within ${Math.ceil(mostUrgent.category.repairUrgency /
            (mostUrgent.adjustedSeverity === 'critical' ? 3 :
             mostUrgent.adjustedSeverity === 'medium' ? 2 : 1))} days` :
        'No urgent actions required';

    // Property value impact (utilitarian calculation)
    const avgImpact = prioritized.reduce((sum, d) => sum + d.category.impactMultiplier, 0) /
                      Math.max(1, prioritized.length);
    const propertyValueImpact = avgImpact > 2 ?
        'SEVERE: Could reduce property value by 10-20%' :
        avgImpact > 1.5 ?
        'MODERATE: May affect property value by 5-10%' :
        avgImpact > 1 ?
        'MINOR: Minimal impact on property value' :
        'COSMETIC: No significant impact on property value';

    return {
        totalDefects: defects.length,
        criticalCount,
        mediumCount,
        minorCount,
        prioritizedDefects: prioritized,
        totalEstimatedCost: { min: totalMin, max: totalMax },
        overallRiskLevel,
        urgentActions,
        timeToAction,
        propertyValueImpact,
    };
}

// ============================================
// CONSENT & FAIRNESS (For Multi-Party Inspections)
// ============================================

/**
 * Like the consent discussion - when multiple parties involved
 * (buyer, seller, inspector), ensure fair process
 */
export interface FairnessReport {
    defectId: string;
    buyerPerspective: string;      // What buyer should know
    sellerResponsibility: string;  // What seller should fix
    negotiationLeverage: string;   // For price negotiation
    legalConsiderations: string;   // Disclosure requirements
}

export function generateFairnessReport(score: DamageScore): FairnessReport {
    const isCritical = score.adjustedSeverity === 'critical';
    const isMedium = score.adjustedSeverity === 'medium';

    return {
        defectId: score.defectId,
        buyerPerspective: isCritical ?
            `This defect requires immediate attention. Request repair before closing or significant price reduction ($${score.estimatedCost.min}-${score.estimatedCost.max}).` :
            isMedium ?
            `Note this issue for future maintenance. Consider requesting repair credit.` :
            `Minor cosmetic issue. May not warrant price negotiation.`,

        sellerResponsibility: isCritical ?
            `Disclosure required. Failure to disclose may result in legal liability. Recommend repairing before listing.` :
            isMedium ?
            `Should be disclosed. Consider repairing to improve sale prospects.` :
            `Optional disclosure. Cosmetic issues typically expected in used properties.`,

        negotiationLeverage: isCritical ?
            `STRONG: Justified asking for $${score.estimatedCost.min}-${score.estimatedCost.max} reduction or repair completion.` :
            isMedium ?
            `MODERATE: Can reasonably request $${score.estimatedCost.min}-${score.estimatedCost.max} credit.` :
            `WEAK: Minor issues rarely justify price reductions.`,

        legalConsiderations: score.riskAssessment.safetyRisk === 'HIGH' ?
            `MANDATORY DISCLOSURE: Safety-related defects must be disclosed in most jurisdictions.` :
            score.riskAssessment.spreadRisk === 'HIGH' ?
            `MATERIAL DEFECT: Likely requires disclosure as it may worsen.` :
            `STANDARD: Follow local disclosure requirements.`,
    };
}
