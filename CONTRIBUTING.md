# Contributing to DefectSpotter

Thank you for your interest in contributing to DefectSpotter! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check existing [issues](https://github.com/karthiknagpuri/defect-spotter/issues) to avoid duplicates
2. Use the bug report template
3. Include:
   - Clear description of the issue
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/OS information
   - Screenshots if applicable

### Suggesting Features

1. Open an issue with the "enhancement" label
2. Describe the feature and its use case
3. Explain why it would benefit users

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Write/update tests if applicable
5. Ensure code passes linting
6. Submit a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/defect-spotter.git
cd defect-spotter

# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build
```

## Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Use meaningful variable/function names
- Add comments for complex logic
- Keep functions small and focused

## Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(detection): add mold detection category
fix(camera): resolve permission error on Safari
docs(readme): update installation instructions
```

## Project Structure

```
src/
├── components/     # React components
├── services/       # API clients and business logic
├── types/          # TypeScript type definitions
└── utils/          # Helper functions
```

## Testing

- Test with multiple browsers (Chrome, Firefox, Safari)
- Test both camera and screen capture modes
- Verify detection accuracy with sample images
- Check PDF export functionality

## Questions?

Feel free to open an issue for any questions about contributing.
