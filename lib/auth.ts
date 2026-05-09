import { SignJWT, jwtVerify } from "jose";
import type { Department } from "@/types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "cortex-dev-secret-change-in-production"
);

const TOKEN_COOKIE = "cortex_session";
const TOKEN_EXPIRY = "8h";

// Department credentials — in production these would be in Cystack Locker
// and verified against your IdP. For the demo, each dept has a shared password.
const DEPT_PASSWORDS: Record<Department, string> = {
  engineering: "eng2026",
  marketing: "mkt2026",
  finance: "fin2026",
  legal: "leg2026",
  product: "prd2026",
  management: "mgmt2026",
};

// Master demo password that works for any department
const DEMO_PASSWORD = "cortex2026";

export interface SessionPayload {
  userId: string;
  department: Department;
  name: string;
  email?: string;
  iat: number;
  exp: number;
}

export async function signToken(
  userId: string,
  department: Department,
  name: string,
  email?: string
): Promise<string> {
  return new SignJWT({ userId, department, name, ...(email ? { email } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function validatePassword(department: Department, password: string): boolean {
  return password === DEMO_PASSWORD || password === DEPT_PASSWORDS[department];
}

export { TOKEN_COOKIE };
