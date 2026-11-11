import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { analyzeCode } from "./analyzer";
import "./style.css";

const example = `function greet(name: string) {
  // TODO: add input validation
  console.log("Hello " + name);
  return "Hello " + name;
}`;
function App() {
  const [source, setSource] = useState(example);
  const result = useMemo(() => analyzeCode(source), [source]);
  return <main>
    <header><span className="eyebrow">FIRE / INDEPENDENT DEMO</span><h1>AI Code Quality Lab</h1><p>A transparent, deterministic code review exercise for JavaScript and TypeScript.</p></header>
    <section className="workspace"><div className="editor"><div className="section-head"><h2>Code input</h2><button onClick={() => setSource(example)}>Load example</button></div><label htmlFor="source">Paste sample code (processed locally in your browser)</label><textarea id="source" spellCheck={false} value={source} onChange={event => setSource(event.target.value)} /></div>
    <div className="results"><h2>Analysis</h2><div className="score"><strong>{result.score}</strong><span>/ 100 quality score</span></div><p>{result.lines} lines · {result.findings.length} findings</p><div aria-live="polite">{result.findings.length === 0 ? <p className="clean">No heuristic issues detected.</p> : result.findings.map((f, i) => <article key={f.id + f.line + i}><div><b>{f.id.toUpperCase()}</b><span className={f.severity}>{f.severity} · line {f.line}</span></div><p>{f.message}</p><small>{f.suggestion}</small></article>)}</div></div></section>
    <footer>Educational demo only. Pattern-based checks are not a substitute for security audits, static analysis or human review. No external AI API is called.</footer>
  </main>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
