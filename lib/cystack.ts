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
