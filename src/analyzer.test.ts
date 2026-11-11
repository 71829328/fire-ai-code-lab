import { describe, expect, it } from "vitest";
import { analyzeCode } from "./analyzer";
describe("analyzeCode", () => {
  it("scores safe input at 100", () => { expect(analyzeCode("const add = (a: number, b: number) => a + b;").score).toBe(100); });
  it("finds eval on the correct line", () => { const result = analyzeCode("const x = 1;\neval(userInput);"); expect(result.findings).toEqual([expect.objectContaining({ id: "eval", line: 2, severity: "high" })]); });
  it("detects potential credentials", () => { expect(analyzeCode('const apiKey = "123456789";').findings.some(f => f.id === "secret")).toBe(true); });
  it("detects multiple issues", () => { const result = analyzeCode("debugger;\nconsole.log('test');\n// TODO fix"); expect(result.findings).toHaveLength(3); expect(result.score).toBe(84); });
  it("never returns a negative score", () => { expect(analyzeCode(Array(10).fill("eval(x)").join("\n")).score).toBe(0); });
  it("does not execute the submitted code", () => { expect(analyzeCode("eval('throw new Error()')").findings[0].id).toBe("eval"); });
});
