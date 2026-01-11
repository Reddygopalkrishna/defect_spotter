/**
 * Detection Accuracy Test Script
 * Tests the Gemini detection against the concrete crack dataset
 *
 * Usage: npx ts-node scripts/test-detection.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const DATASET_PATH = '/Users/karthiknagapuri/.cache/kagglehub/datasets/aniruddhsharma/structural-defects-network-concrete-crack-images/versions/1';

// Get API key from environment or prompt
const API_KEY = process.env.GEMINI_API_KEY || '';

if (!API_KEY) {
    console.error('❌ Please set GEMINI_API_KEY environment variable');
    console.log('   export GEMINI_API_KEY="your-api-key"');
    process.exit(1);
}

const DETECTION_PROMPT = `You are a crack detection AI. Analyze this image and determine if there are any cracks visible.

OUTPUT FORMAT (JSON only):
If crack detected: {"detected": true, "confidence": 85, "type": "crack", "description": "visible crack pattern"}
If no crack: {"detected": false, "confidence": 90}

Be accurate. Look for any line patterns that indicate structural cracks.`;

interface DetectionResult {
    file: string;
    expected: boolean;
    detected: boolean;
    confidence: number;
    correct: boolean;
    responseTime: number;
}

async function analyzeImage(imagePath: string): Promise<{ detected: boolean; confidence: number }> {
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: DETECTION_PROMPT },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: base64
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 200,
                }
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const result = JSON.parse(jsonMatch[0]);
            return {
                detected: result.detected === true,
                confidence: result.confidence || 50
            };
        } catch {
            // If JSON parsing fails, look for keywords
        }
    }

    // Fallback: check for keywords
    const lowerText = text.toLowerCase();
    const detected = lowerText.includes('crack') && !lowerText.includes('no crack');
    return { detected, confidence: 50 };
}

function getRandomFiles(dir: string, count: number): string[] {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));
    const shuffled = files.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(f => path.join(dir, f));
}

async function runTest(sampleSize: number = 20) {
    console.log('🔬 Crack Detection Accuracy Test');
    console.log('================================\n');

    const categories = ['Walls', 'Pavements', 'Decks'];
    const results: DetectionResult[] = [];
    const samplesPerCategory = Math.ceil(sampleSize / categories.length / 2);

    for (const category of categories) {
        console.log(`\n📁 Testing ${category}...`);

        // Get cracked samples
        const crackedDir = path.join(DATASET_PATH, category, 'Cracked');
        const crackedFiles = getRandomFiles(crackedDir, samplesPerCategory);

        // Get non-cracked samples
        const nonCrackedDir = path.join(DATASET_PATH, category, 'Non-cracked');
        const nonCrackedFiles = getRandomFiles(nonCrackedDir, samplesPerCategory);

        // Test cracked images
        for (const file of crackedFiles) {
            process.stdout.write(`  Testing ${path.basename(file)} (cracked)... `);
            const start = Date.now();
            try {
                const result = await analyzeImage(file);
                const responseTime = Date.now() - start;
                const correct = result.detected === true;

                results.push({
                    file: path.basename(file),
                    expected: true,
                    detected: result.detected,
                    confidence: result.confidence,
                    correct,
                    responseTime
                });

                console.log(correct ? '✅' : '❌', `(${result.confidence}%, ${responseTime}ms)`);
            } catch (error) {
                console.log('⚠️ Error:', (error as Error).message);
            }

            // Rate limiting - wait between requests
            await new Promise(r => setTimeout(r, 500));
        }

        // Test non-cracked images
        for (const file of nonCrackedFiles) {
            process.stdout.write(`  Testing ${path.basename(file)} (clean)... `);
            const start = Date.now();
            try {
                const result = await analyzeImage(file);
                const responseTime = Date.now() - start;
                const correct = result.detected === false;

                results.push({
                    file: path.basename(file),
                    expected: false,
                    detected: result.detected,
                    confidence: result.confidence,
                    correct,
                    responseTime
                });

                console.log(correct ? '✅' : '❌', `(${result.confidence}%, ${responseTime}ms)`);
            } catch (error) {
                console.log('⚠️ Error:', (error as Error).message);
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Calculate metrics
    console.log('\n\n📊 RESULTS');
    console.log('==========\n');

    const total = results.length;
    const correct = results.filter(r => r.correct).length;
    const accuracy = (correct / total * 100).toFixed(1);

    const truePositives = results.filter(r => r.expected && r.detected).length;
    const falseNegatives = results.filter(r => r.expected && !r.detected).length;
    const trueNegatives = results.filter(r => !r.expected && !r.detected).length;
    const falsePositives = results.filter(r => !r.expected && r.detected).length;

    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1 = 2 * (precision * recall) / (precision + recall) || 0;

    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / total;

    console.log(`Total Samples:     ${total}`);
    console.log(`Correct:           ${correct}`);
    console.log(`Accuracy:          ${accuracy}%`);
    console.log('');
    console.log(`True Positives:    ${truePositives} (cracks correctly detected)`);
    console.log(`False Negatives:   ${falseNegatives} (cracks missed)`);
    console.log(`True Negatives:    ${trueNegatives} (clean correctly identified)`);
    console.log(`False Positives:   ${falsePositives} (false alarms)`);
    console.log('');
    console.log(`Precision:         ${(precision * 100).toFixed(1)}%`);
    console.log(`Recall:            ${(recall * 100).toFixed(1)}%`);
    console.log(`F1 Score:          ${(f1 * 100).toFixed(1)}%`);
    console.log(`Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);

    // Show failures
    const failures = results.filter(r => !r.correct);
    if (failures.length > 0) {
        console.log('\n\n❌ FAILED CASES');
        console.log('===============\n');
        failures.forEach(f => {
            console.log(`  ${f.file}: expected ${f.expected ? 'CRACK' : 'CLEAN'}, got ${f.detected ? 'CRACK' : 'CLEAN'} (${f.confidence}%)`);
        });
    }

    // Save results to JSON
    const outputPath = path.join(__dirname, 'test-results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        metrics: { total, correct, accuracy, precision, recall, f1, avgResponseTime },
        results
    }, null, 2));
    console.log(`\n📄 Results saved to: ${outputPath}`);
}

// Run with sample size from command line or default to 30
const sampleSize = parseInt(process.argv[2]) || 30;
runTest(sampleSize).catch(console.error);
