# DefectSpotter

AI-powered property damage detection and forensic evidence documentation system using Google Gemini Live API.

![DefectSpotter Terminal Interface](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

DefectSpotter is a real-time visual inspection system that uses Google's Gemini 2.0 Flash API to detect and document:

- **Property Defects**: Cracks, water damage, mold, structural issues, electrical hazards
- **Forensic Evidence**: Crime scene documentation, evidence cataloging, chain of custody

## Features

### Core Capabilities
- Real-time camera/screen capture analysis
- AI-powered defect detection with bounding boxes
- Confidence scoring and severity classification
- Multi-frame temporal consistency verification
- Non-Maximum Suppression (NMS) for accurate detections

### Detection Categories

#### Property Mode
| Category | Examples |
|----------|----------|
| Structural | Cracks, foundation issues, settling |
| Water Damage | Stains, leaks, moisture intrusion |
| Mold/Mildew | Growth patterns, discoloration |
| Electrical | Exposed wiring, burn marks, hazards |
| Surface Damage | Peeling paint, rot, deterioration |

#### Forensic Mode
| Category | Examples |
|----------|----------|
| Physical Evidence | Weapons, tools, objects |
| Biological | Stains, fluids, organic matter |
| Trace Evidence | Fibers, hair, particles |
| Documentation | Scene layout, measurements |

### Report Generation
- PDF export with evidence photos
- Severity assessments and recommendations
- NanoBanana AI evidence board generation
- Timestamped documentation

## Quick Start

### Prerequisites
- Node.js 18+
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

```bash
# Clone the repository
git clone https://github.com/karthiknagpuri/defect-spotter.git
cd defect-spotter

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

1. Click the **Settings** (gear icon) in the header
2. Enter your Gemini API key
3. The key is stored locally in your browser

Or set via environment variable:
```bash
# Create .env file
echo "VITE_GEMINI_API_KEY=your_api_key_here" > .env
```

## Usage

### Basic Workflow

1. **Select Input Source**
   - Camera: Use device camera for live inspection
   - Screen Capture: Analyze images on screen

2. **Choose Mode**
   - Property Defect Detection (default)
   - Forensic Investigation (crime scene mode)

3. **Start Scanning**
   - Click "Start Scan" to begin analysis
   - AI processes frames at 2 FPS
   - Detected issues appear in the gallery

4. **Generate Report**
   - Click "Generate Report" when done
   - Export as PDF with all findings

### Accuracy Testing

Visit `/?test` to access the accuracy test page with sample images from the Kaggle property damage dataset.

## Architecture

```
src/
├── components/
│   ├── CameraView.tsx      # Video/screen capture
│   ├── ControlPanel.tsx    # Scan controls
│   ├── ImageGallery.tsx    # Detection results
│   ├── ReportGenerator.tsx # PDF/report export
│   └── TestPage.tsx        # Accuracy testing
├── services/
│   ├── gemini.ts           # Gemini API client
│   ├── forensicService.ts  # Forensic mode
│   └── store.ts            # Zustand state
└── App.tsx                 # Main application
```

### Key Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **jsPDF** - PDF generation
- **Google Gemini 2.0 Flash** - AI detection

## API Reference

### GeminiLiveClient

```typescript
const client = new GeminiLiveClient(apiKey);

// Start streaming analysis
await client.startStreaming(videoElement);

// Stop analysis
client.stop();
```

### Detection Response

```typescript
interface Defect {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  description: string;
  recommendation: string;
  timestamp: Date;
  imageData: string;
}
```

## Detection Algorithm

### Pipeline
1. **Frame Capture** - Extract frames at 2 FPS
2. **Preprocessing** - Quality validation
3. **AI Analysis** - Gemini processes with chain-of-thought
4. **Bbox Validation** - Size/aspect ratio checks
5. **Temporal Consistency** - Multi-frame verification
6. **NMS** - Remove duplicate detections
7. **Output** - Confirmed defects with metadata

### Accuracy Improvements
- Chain-of-thought reasoning prompts
- Explicit false positive examples
- Temporal consistency (multi-frame verification)
- Strict bounding box validation
- Non-Maximum Suppression (IoU > 0.5)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Google Gemini API for AI capabilities
- Kaggle Property Damage Dataset for testing
- React and Vite communities

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/karthiknagpuri/defect-spotter/issues) page.
