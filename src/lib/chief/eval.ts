import { executeAgentSource } from "./runtime";
import { assertNoSelfGrant, sanitizeToolsForAgent, type ToolRequest } from "./permissions";

export type EvalCase = { name: string; assert: string };
export type EvalResult = {
  name: string;
  passed: boolean;
  detail?: string;
};

export async function runEvalHarness(params: {
  sourceCode: string;
  tools: ToolRequest[];
  suite: EvalCase[];
  input?: Record<string, unknown>;
}): Promise<{ passed: number; failed: number; score: number; results: EvalResult[]; status: "PASSED" | "FAILED" }> {
  const results: EvalResult[] = [];

  const sanitized = sanitizeToolsForAgent(params.tools);
  const selfGrant = assertNoSelfGrant({ requestedBy: "CHIEF", tools: params.tools });

  const exec = await executeAgentSource(params.sourceCode, params.input || {});

  for (const test of params.suite) {
    let passed = false;
    let detail = "";
    switch (test.assert) {
      case "output.hasStatus":
        passed = Boolean(exec.output?.hasStatus || (exec.output?.brief as { status?: string })?.status);
        detail = passed ? "status present" : "missing status";
        break;
      case "output.hasBrief":
        passed = Boolean(exec.output?.hasBrief || exec.output?.brief);
        detail = passed ? "brief present" : "missing brief";
        break;
      case "tools.sanitized":
        passed = selfGrant.blocked.length === 0 && sanitized.length === params.tools.filter((t) => !t.scope.match(/ADMIN|UNRESTRICTED/i)).length;
        // Also pass if blocked were stripped and remaining match sanitize
        passed = selfGrant.blocked.length === 0 || sanitized.every((t) => !t.scope.match(/ADMIN|UNRESTRICTED/i));
        passed = selfGrant.blocked.length === 0;
        detail = passed ? "no unrestricted self-grants" : `blocked: ${selfGrant.blocked.map((b) => b.toolId).join(",")}`;
        break;
      case "output.rejectsEmpty":
        {
          const emptyRun = await executeAgentSource(params.sourceCode, {});
          passed = Boolean(emptyRun.output?.rejectsEmpty) || emptyRun.output?.ok === false;
          detail = passed ? "empty rejected" : "empty accepted incorrectly";
        }
        break;
      default:
        passed = exec.ok;
        detail = `unknown assert ${test.assert}; runtime ok=${exec.ok}`;
    }
    results.push({ name: test.name, passed, detail });
  }

  // Always fail harness if runtime hard-errored on primary run (except rejectsEmpty suites)
  if (exec.error && !params.suite.every((s) => s.assert === "output.rejectsEmpty")) {
    results.push({ name: "runtime_ok", passed: false, detail: exec.error });
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const score = results.length ? Math.round((passed / results.length) * 100) : 0;
  return {
    passed,
    failed,
    score,
    results,
    status: failed === 0 ? "PASSED" : "FAILED",
  };
}
