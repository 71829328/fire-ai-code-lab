export type Severity = "high" | "medium" | "low";
export type Finding = { id: string; severity: Severity; line: number; message: string; suggestion: string };
export type Analysis = { score: number; lines: number; findings: Finding[] };

type Rule = { id: string; severity: Severity; pattern: RegExp; message: string; suggestion: string };
const rules: Rule[] = [
  { id: "eval", severity: "high", pattern: /\beval\s*\(/, message: "Dynamic code execution detected.", suggestion: "Use a parser or explicit dispatch instead of eval." },
  { id: "secret", severity: "high", pattern: /\b(?:apiKey|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/i, message: "Possible hard-coded credential.", suggestion: "Use environment variables or a secret manager; rotate exposed credentials." },
  { id: "debugger", severity: "medium", pattern: /\bdebugger\s*;/, message: "Debugger statement found.", suggestion: "Remove debugger statements before release." },
  { id: "console", severity: "low", pattern: /\bconsole\.log\s*\(/, message: "Console logging detected.", suggestion: "Prefer structured logging where appropriate." },
  { id: "todo", severity: "low", pattern: /\bTODO\b/i, message: "Unresolved TODO comment or marker.", suggestion: "Track the remaining work in an issue." }
];
export function analyzeCode(source: string): Analysis {
  const lines = source.split(/\r?\n/);
  const findings = lines.flatMap((line, index) => rules.filter(rule => rule.pattern.test(line)).map(rule => ({
    id: rule.id, severity: rule.severity, line: index + 1, message: rule.message, suggestion: rule.suggestion
  })));
  const penalties: Record<Severity, number> = { high: 25, medium: 10, low: 3 };
  const score = Math.max(0, 100 - findings.reduce((total, finding) => total + penalties[finding.severity], 0));
  return { score, lines: lines.length, findings };
}
