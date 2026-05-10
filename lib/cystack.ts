// Cystack Locker Secrets Manager integration
// Fetches API credentials from the Locker vault at startup so secrets never
// live in plaintext env files in production. Falls back to process.env for local dev.

const LOCKER_ACCESS_KEY_ID = process.env.LOCKER_ACCESS_KEY_ID;
const LOCKER_SECRET_ACCESS_KEY = process.env.LOCKER_SECRET_ACCESS_KEY;
const LOCKER_API_URL =
  process.env.LOCKER_API_URL ?? "https://api.locker.io/v1/secrets";

// Secret IDs configured in your Locker vault
const SECRET_IDS = {
  ANTHROPIC_API_KEY: process.env.LOCKER_SECRET_ANTHROPIC_ID,
  BACKBOARD_API_KEY: process.env.LOCKER_SECRET_BACKBOARD_ID,
  PINGRAM_CLIENT_ID: process.env.LOCKER_SECRET_PINGRAM_ID_ID,
  PINGRAM_CLIENT_SECRET: process.env.LOCKER_SECRET_PINGRAM_SECRET_ID,
  CLOUDINARY_API_KEY: process.env.LOCKER_SECRET_CLOUDINARY_KEY_ID,
  CLOUDINARY_API_SECRET: process.env.LOCKER_SECRET_CLOUDINARY_SECRET_ID,
};

// In-memory cache so we only hit Locker once per process lifetime
const secretCache = new Map<string, string>();

async function fetchSecretFromLocker(secretId: string): Promise<string | null> {
  if (!LOCKER_ACCESS_KEY_ID || !LOCKER_SECRET_ACCESS_KEY) return null;

  try {
    const res = await fetch(`${LOCKER_API_URL}/${secretId}`, {
      headers: {
        Authorization: `Bearer ${LOCKER_ACCESS_KEY_ID}:${LOCKER_SECRET_ACCESS_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.value ?? null;
  } catch {
    return null;
  }
}

export async function getSecret(
  key: keyof typeof SECRET_IDS
): Promise<string> {
  // Return cached value if available
  const cached = secretCache.get(key);
  if (cached) return cached;

  // Try Locker vault first
  const secretId = SECRET_IDS[key];
  if (secretId) {
    const lockerValue = await fetchSecretFromLocker(secretId);
    if (lockerValue) {
      secretCache.set(key, lockerValue);
      return lockerValue;
    }
  }

  // Fall back to process.env (local dev / CI)
  const envValue = process.env[key] ?? "";
  if (envValue) secretCache.set(key, envValue);
  return envValue;
}

export async function warmSecretCache(): Promise<void> {
  await Promise.allSettled(
    (Object.keys(SECRET_IDS) as (keyof typeof SECRET_IDS)[]).map(getSecret)
  );
}

// ---------------------------------------------------------------------------
// Secret scanning (content)
// ---------------------------------------------------------------------------
// Cystack-powered secret scan for inbound context entries. If a remote scan
// endpoint is configured we delegate to it; otherwise we fall back to a local
// regex pack so the demo works offline. Always fail-open — never block writes.

const CYSTACK_SCAN_URL = process.env.CYSTACK_SCAN_URL ?? "";
const CYSTACK_SCAN_TOKEN = process.env.CYSTACK_SCAN_TOKEN ?? "";

interface SecretPattern {
  type: string;
  pattern: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { type: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: "github_token", pattern: /\bghp_[A-Za-z0-9]{30,}\b/g },
  { type: "github_oauth", pattern: /\bgho_[A-Za-z0-9]{30,}\b/g },
  { type: "stripe_live_key", pattern: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { type: "openai_key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { type: "anthropic_key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { type: "google_api_key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { type: "slack_token", pattern: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/g },
  { type: "bearer_token", pattern: /\bBearer\s+[A-Za-z0-9._\-]{20,}\b/g },
  { type: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { type: "private_key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----/g },
];

export interface SecretScanResult {
  cleaned: string;
  redactionsCount: number;
  redactionTypes: string[];
}

function localScan(text: string): SecretScanResult {
  let cleaned = text;
  const types = new Set<string>();
  let total = 0;
  for (const { type, pattern } of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, () => {
      total += 1;
      types.add(type);
      return `[REDACTED:${type}]`;
    });
  }
  return { cleaned, redactionsCount: total, redactionTypes: [...types] };
}

export async function scanForSecrets(text: string): Promise<SecretScanResult> {
  if (!text) return { cleaned: text, redactionsCount: 0, redactionTypes: [] };

  if (CYSTACK_SCAN_URL) {
    try {
      const res = await fetch(CYSTACK_SCAN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(CYSTACK_SCAN_TOKEN ? { Authorization: `Bearer ${CYSTACK_SCAN_TOKEN}` } : {}),
        },
        body: JSON.stringify({ text }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as Partial<SecretScanResult>;
        if (typeof data.cleaned === "string") {
          return {
            cleaned: data.cleaned,
            redactionsCount: data.redactionsCount ?? 0,
            redactionTypes: data.redactionTypes ?? [],
          };
        }
      }
    } catch (err) {
      console.warn("[cystack] remote scan failed, falling back to local", err);
    }
  }

  return localScan(text);
}
