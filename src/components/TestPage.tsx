import React, { useState, useEffect } from 'react';
import { FlaskConical, Play, CheckCircle, XCircle, Loader2, BarChart3, ArrowLeft } from 'lucide-react';

const STORAGE_KEY = 'defectspotter_api_key';

interface TestResult {
    file: string;
    expected: 'cracked' | 'clean';
    detected: boolean;
    confidence: number;
    correct: boolean;
    responseTime: number;
}

interface Metrics {
    total: number;
    correct: number;
    accuracy: number;
    truePositives: number;
    falseNegatives: number;
    trueNegatives: number;
    falsePositives: number;
    precision: number;
    recall: number;
    f1: number;
}

const CRACKED_IMAGES = [
    'Decks_7014-196.jpg', 'Decks_7021-26.jpg', 'Decks_7026-184.jpg', 'Decks_7045-84.jpg', 'Decks_7049-64.jpg',
    'Pavements_037-103.jpg', 'Pavements_072-55.jpg', 'Pavements_081-101.jpg', 'Pavements_098-104.jpg', 'Pavements_102-113.jpg',
    'Walls_7089-212.jpg', 'Walls_7091-208.jpg', 'Walls_7110-24.jpg', 'Walls_7125-169.jpg', 'Walls_7131-238.jpg'
];

const CLEAN_IMAGES = [
    'Decks_7016-73.jpg', 'Decks_7031-46.jpg', 'Decks_7040-223.jpg', 'Decks_7049-66.jpg', 'Decks_7051-18.jpg',
    'Pavements_016-92.jpg', 'Pavements_031-63.jpg', 'Pavements_040-58.jpg', 'Pavements_083-18.jpg', 'Pavements_093-192.jpg',
    'Walls_7088-90.jpg', 'Walls_7104-105.jpg', 'Walls_7112-50.jpg', 'Walls_7121-6.jpg', 'Walls_7123-28.jpg'
];

const DETECTION_PROMPT = `Analyze this image for cracks. Look for any visible crack patterns, fractures, or structural damage.

OUTPUT FORMAT (JSON only):
If crack/damage detected: {"detected": true, "confidence": 85, "description": "crack pattern visible"}
If no damage: {"detected": false, "confidence": 90}`;

export const TestPage: React.FC = () => {
    const [apiKey, setApiKey] = useState<string>('');
    const [isRunning, setIsRunning] = useState(false);

    // Load API key from localStorage on mount
    useEffect(() => {
        const savedKey = localStorage.getItem(STORAGE_KEY);
        const envKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (savedKey) {
            setApiKey(savedKey);
        } else if (envKey) {
            setApiKey(envKey);
        }
    }, []);
    const [results, setResults] = useState<TestResult[]>([]);
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const analyzeImage = async (imagePath: string): Promise<{ detected: boolean; confidence: number }> => {
        // Fetch the image and convert to base64
        const response = await fetch(imagePath);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
            };
            reader.readAsDataURL(blob);
        });

        // Call Gemini API
        const apiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: DETECTION_PROMPT },
                            { inline_data: { mime_type: 'image/jpeg', data: base64 } }
                        ]
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
                })
            }
        );

        if (!apiResponse.ok) {
            throw new Error('API request failed');
        }

        const data = await apiResponse.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const result = JSON.parse(jsonMatch[0]);
                return { detected: result.detected === true, confidence: result.confidence || 50 };
            } catch { /* fallback below */ }
        }

        // Fallback: keyword check
        const detected = text.toLowerCase().includes('crack') && !text.toLowerCase().includes('no crack');
        return { detected, confidence: 50 };
    };

    const runTests = async () => {
        if (!apiKey) {
            alert('Please set your Gemini API key first');
            return;
        }

        setIsRunning(true);
        setResults([]);
        setMetrics(null);

        const allTests: { file: string; expected: 'cracked' | 'clean'; path: string }[] = [];

        // Check which images exist
        for (const file of CRACKED_IMAGES) {
            allTests.push({ file, expected: 'cracked', path: `/test-images/cracked/${file}` });
        }
        for (const file of CLEAN_IMAGES) {
            allTests.push({ file, expected: 'clean', path: `/test-images/clean/${file}` });
        }

        setProgress({ current: 0, total: allTests.length });
        const testResults: TestResult[] = [];

        for (let i = 0; i < allTests.length; i++) {
            const test = allTests[i];
            setCurrentImage(test.path);
            setProgress({ current: i + 1, total: allTests.length });

            try {
                const start = Date.now();
                const result = await analyzeImage(test.path);
                const responseTime = Date.now() - start;

                const expectedDetected = test.expected === 'cracked';
                const correct = result.detected === expectedDetected;

                const testResult: TestResult = {
                    file: test.file,
                    expected: test.expected,
                    detected: result.detected,
                    confidence: result.confidence,
                    correct,
                    responseTime
                };

                testResults.push(testResult);
                setResults([...testResults]);

                // Rate limiting
                await new Promise(r => setTimeout(r, 300));
            } catch (error) {
                console.error(`Error testing ${test.file}:`, error);
            }
        }

        // Calculate metrics
        const total = testResults.length;
        const correct = testResults.filter(r => r.correct).length;
        const truePositives = testResults.filter(r => r.expected === 'cracked' && r.detected).length;
        const falseNegatives = testResults.filter(r => r.expected === 'cracked' && !r.detected).length;
        const trueNegatives = testResults.filter(r => r.expected === 'clean' && !r.detected).length;
        const falsePositives = testResults.filter(r => r.expected === 'clean' && r.detected).length;

        const precision = truePositives / (truePositives + falsePositives) || 0;
        const recall = truePositives / (truePositives + falseNegatives) || 0;
        const f1 = 2 * (precision * recall) / (precision + recall) || 0;

        setMetrics({
            total,
            correct,
            accuracy: (correct / total) * 100,
            truePositives,
            falseNegatives,
            trueNegatives,
            falsePositives,
            precision: precision * 100,
            recall: recall * 100,
            f1: f1 * 100
        });

        setCurrentImage(null);
        setIsRunning(false);
    };

    const goBack = () => {
        window.location.href = window.location.origin + window.location.pathname;
    };

    return (
        <div className="min-h-screen bg-stone-100 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={goBack}
                            className="p-2 hover:bg-stone-200 rounded-lg transition-colors"
                            title="Back to main app"
                        >
                            <ArrowLeft className="w-5 h-5 text-stone-600" />
                        </button>
                        <FlaskConical className="w-8 h-8 text-blue-600" />
                        <h1 className="text-2xl font-semibold text-stone-800">Detection Accuracy Test</h1>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm ${apiKey ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {apiKey ? 'API Key Configured' : 'No API Key'}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <p className="text-stone-600 mb-4">
                        Test the crack detection system against {CRACKED_IMAGES.length + CLEAN_IMAGES.length} sample images
                        from the Structural Defects Network dataset.
                    </p>

                    <button
                        onClick={runTests}
                        disabled={isRunning || !apiKey}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Testing... ({progress.current}/{progress.total})
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                Run Accuracy Test
                            </>
                        )}
                    </button>

                    {!apiKey && (
                        <p className="text-amber-600 text-sm mt-2">Set your Gemini API key first</p>
                    )}
                </div>

                {/* Current Image Preview */}
                {currentImage && (
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <h3 className="text-sm font-medium text-stone-500 mb-3">Testing:</h3>
                        <img src={currentImage} alt="Current test" className="max-w-md rounded-lg border" />
                    </div>
                )}

                {/* Metrics */}
                {metrics && (
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-stone-800">Results</h2>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-blue-50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-blue-600">{metrics.accuracy.toFixed(1)}%</div>
                                <div className="text-sm text-stone-600">Accuracy</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-green-600">{metrics.precision.toFixed(1)}%</div>
                                <div className="text-sm text-stone-600">Precision</div>
                            </div>
                            <div className="bg-amber-50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-amber-600">{metrics.recall.toFixed(1)}%</div>
                                <div className="text-sm text-stone-600">Recall</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-purple-600">{metrics.f1.toFixed(1)}%</div>
                                <div className="text-sm text-stone-600">F1 Score</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="p-3 bg-stone-50 rounded-lg">
                                <span className="text-green-600 font-medium">True Positives:</span> {metrics.truePositives}
                            </div>
                            <div className="p-3 bg-stone-50 rounded-lg">
                                <span className="text-red-600 font-medium">False Negatives:</span> {metrics.falseNegatives}
                            </div>
                            <div className="p-3 bg-stone-50 rounded-lg">
                                <span className="text-green-600 font-medium">True Negatives:</span> {metrics.trueNegatives}
                            </div>
                            <div className="p-3 bg-stone-50 rounded-lg">
                                <span className="text-red-600 font-medium">False Positives:</span> {metrics.falsePositives}
                            </div>
                        </div>
                    </div>
                )}

                {/* Results Table */}
                {results.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b">
                            <h2 className="font-semibold text-stone-800">Test Results ({results.length})</h2>
                        </div>
                        <div className="divide-y max-h-96 overflow-y-auto">
                            {results.map((result, idx) => (
                                <div key={idx} className={`px-6 py-3 flex items-center gap-4 ${result.correct ? 'bg-white' : 'bg-red-50'}`}>
                                    {result.correct ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-500" />
                                    )}
                                    <div className="flex-1">
                                        <span className="text-sm text-stone-800">{result.file}</span>
                                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                                            result.expected === 'cracked' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                            {result.expected}
                                        </span>
                                    </div>
                                    <div className="text-sm text-stone-500">
                                        {result.detected ? 'Detected' : 'Clean'} ({result.confidence}%)
                                    </div>
                                    <div className="text-xs text-stone-400">
                                        {result.responseTime}ms
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
