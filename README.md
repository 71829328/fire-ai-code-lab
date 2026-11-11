# AI Code Quality Lab

A small, independent **React + TypeScript** portfolio demonstration for code review and AI-assisted software quality workflows.

## Features
- Paste JavaScript or TypeScript snippets and receive immediate, deterministic feedback.
- Inspect rule IDs, line numbers, severity and remediation suggestions.
- Detect basic examples of `eval`, potential hard-coded credentials, `debugger`, console logging and TODO markers.
- Responsive dark-themed interface, no account required and no external API calls.
- Six automated unit tests using Vitest.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

## Project structure

- `src/analyzer.ts`: pure analysis function and rule definitions
- `src/analyzer.test.ts`: deterministic test cases
- `src/main.tsx`: React application
- `src/style.css`: responsive styling

## Scope and limitations

This is a **heuristic educational demo**, not an AI model, professional vulnerability scanner, or proof of employment. It never executes pasted code and performs analysis locally in the browser. Regular expressions can generate false positives or miss issues. Do not paste credentials, private source code or confidential data.

Created as a standalone public demonstration. It contains no private FIRE Intelligence source code or customer data.
