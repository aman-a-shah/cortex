import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PolarityStatus = "pass" | "warning" | "fail" | "error";
type Maintainability = "high" | "medium" | "low" | "unknown";

interface PolarityIssue {
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
}

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

const EXTENSIONS: Record<string, string> = {
  javascript: "scan.js",
  js: "scan.js",
  typescript: "scan.ts",
  ts: "scan.ts",
  tsx: "scan.tsx",
  python: "scan.py",
  py: "scan.py",
  java: "Scan.java",
};

const TIMEOUT_MS = 60_000;

function cliParts(): { command: string; args: string[] } {
  const configured = process.env.POLARITY_CLI_COMMAND || "ks";
  const parts = configured.trim().split(/\s+/).filter(Boolean);
  return { command: parts[0] ?? "ks", args: parts.slice(1) };
}

function languageFileName(language: unknown): string {
  const normalized = typeof language === "string" ? language.toLowerCase() : "";
  return EXTENSIONS[normalized] ?? "scan.txt";
}

function runCli(args: string[], cwd?: string): Promise<CliResult> {
  const { command, args: baseArgs } = cliParts();

  return new Promise((resolve) => {
    execFile(
      command,
      [...baseArgs, ...args],
      {
        cwd,
        timeout: TIMEOUT_MS,
        env: {
          ...process.env,
          ...(process.env.KEYSTONE_API_KEY
            ? { KEYSTONE_API_KEY: process.env.KEYSTONE_API_KEY }
            : {}),
        },
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 5,
      },
      (error, stdout, stderr) => {
        const execError = error as NodeJS.ErrnoException | null;
        const timedOut =
          Boolean(execError && "killed" in execError && execError.killed) ||
          Boolean(execError && "signal" in execError && execError.signal === "SIGTERM");
        resolve({
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          exitCode:
            typeof execError?.code === "number"
              ? execError.code
              : execError
                ? 1
                : 0,
          timedOut,
        });
      }
    );
  });
}

function statusFromExit(exitCode: number | null): PolarityStatus {
  if (exitCode === 0) return "pass";
  if (exitCode === 1) return "fail";
  return "error";
}

function severity(value: unknown): PolarityIssue["severity"] {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  if (normalized === "critical") return "high";
  return "medium";
}

function findArray(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  const obj = value as Record<string, unknown>;
  for (const key of ["issues", "findings", "results", "violations"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

function parseJsonOutput(stdout: string): unknown | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeJsonResult(
  parsed: unknown,
  fallback: { rawOutput: string; stderr: string; exitCode: number | null }
) {
  const obj = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  const issueItems = findArray(parsed);
  const issues: PolarityIssue[] = issueItems.slice(0, 20).map((item) => {
    const issue = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      severity: severity(issue.severity ?? issue.level ?? issue.priority),
      title: String(issue.title ?? issue.name ?? issue.rule ?? "Polarity issue"),
      description: String(issue.description ?? issue.message ?? issue.detail ?? ""),
    };
  });

  const score = typeof obj.score === "number" ? obj.score : null;
  const securityIssues =
    typeof obj.securityIssues === "number"
      ? obj.securityIssues
      : typeof obj.security_issues === "number"
        ? obj.security_issues
        : issues.length;
  const maintainability =
    obj.maintainability === "high" ||
    obj.maintainability === "medium" ||
    obj.maintainability === "low"
      ? obj.maintainability
      : "unknown";
  const jsonStatus = String(obj.status ?? "").toLowerCase();
  const status =
    jsonStatus === "pass" ||
    jsonStatus === "warning" ||
    jsonStatus === "fail" ||
    jsonStatus === "error"
      ? jsonStatus
      : issues.some((issue) => issue.severity === "high")
        ? "fail"
        : issues.length > 0
          ? "warning"
          : statusFromExit(fallback.exitCode);

  return {
    score,
    status,
    securityIssues,
    maintainability,
    issues,
    rawOutput: fallback.rawOutput,
    stderr: fallback.stderr,
  };
}

function textResult(result: CliResult) {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
  const notAuthed =
    output.includes("not authenticated") ||
    output.includes("unauthorized") ||
    output.includes("api key") ||
    output.includes("run ks setup");

  return {
    score: null,
    status: notAuthed ? "error" : statusFromExit(result.exitCode),
    securityIssues: null,
    maintainability: "unknown" as Maintainability,
    issues: notAuthed
      ? [{
          severity: "high" as const,
          title: "Keystone is not authenticated",
          description: "Run `ks setup` locally or set KEYSTONE_API_KEY on the server.",
        }]
      : [],
    rawOutput: result.stdout,
    stderr: result.stderr,
  };
}

function missingCliResponse(command: string) {
  return NextResponse.json(
    {
      score: null,
      status: "error",
      securityIssues: null,
      maintainability: "unknown",
      issues: [{
        severity: "high",
        title: "Keystone CLI is not installed",
        description: `Install Keystone with: curl -fsSL https://ks.polarity.so/install.sh | bash, then run ${command} --version and ${command} setup.`,
      }],
      rawOutput: "",
      stderr: `${command} was not found. Install Keystone and set POLARITY_CLI_COMMAND if needed.`,
    },
    { status: 500 }
  );
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    return NextResponse.json(
      {
        score: null,
        status: "error",
        securityIssues: null,
        maintainability: "unknown",
        issues: [{
          severity: "high",
          title: "Unauthorized",
          description: "Sign in to Cortex before scanning generated code.",
        }],
        rawOutput: "",
        stderr: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const body = await req.json();
  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json(
      {
        score: null,
        status: "error",
        securityIssues: null,
        maintainability: "unknown",
        issues: [{
          severity: "high",
          title: "No code provided",
          description: "Polarity needs generated code to scan.",
        }],
        rawOutput: "",
        stderr: "code is required",
      },
      { status: 400 }
    );
  }

  const { command } = cliParts();
  const version = await runCli(["--version"]);
  if (version.exitCode !== 0) return missingCliResponse(command);

  const tempDir = await mkdtemp(path.join(tmpdir(), "cortex-polarity-"));
  try {
    const fileName = languageFileName(body.language);
    const filePath = path.join(tempDir, fileName);
    await writeFile(filePath, code, "utf8");

    console.log(
      `[polarity] scan start department=${body.department ?? session.department} messageId=${body.messageId ?? "unknown"} file=${fileName}`
    );

    const result = await runCli(["scan", tempDir], tempDir);
    const parsed = parseJsonOutput(result.stdout);
    const response = parsed
      ? normalizeJsonResult(parsed, {
          rawOutput: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        })
      : textResult(result);

    if (result.timedOut) {
      response.status = "error";
      response.issues = [
        ...response.issues,
        {
          severity: "high",
          title: "Keystone scan timed out",
          description: `The scan exceeded ${TIMEOUT_MS / 1000} seconds.`,
        },
      ];
    }

    console.log(
      `[polarity] scan complete status=${response.status} exitCode=${result.exitCode} messageId=${body.messageId ?? "unknown"}`
    );

    return NextResponse.json(response);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
