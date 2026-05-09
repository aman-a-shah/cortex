import type { ContextEntry, Department } from "@/types";

// In-memory store for the hackathon demo — swap for a real DB in production
const store: ContextEntry[] = [
  {
    id: "seed-1",
    department: "marketing",
    text: "Q3 2025 Campaign: Focus on B2B SaaS verticals. Total budget $500K. Primary channel LinkedIn (60%), secondary Content Marketing (25%), Events (15%). Campaign theme: 'Build Faster Together'. Key messaging: speed-to-value, team collaboration, enterprise security. Target ICP: SaaS companies 50–500 employees, Series A–C.",
    summary: "Q3 campaign: B2B SaaS, $500K, LinkedIn-first, 'Build Faster Together'",
    source: "Marketing Planning Session",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    tokenCount: 312,
  },
  {
    id: "seed-2",
    department: "finance",
    text: "Q3 2025 Budget Approved: Total $2.1M. Breakdown — Engineering $840K (40%), Marketing $504K (24%), Operations $315K (15%), Sales $252K (12%), Legal & Compliance $189K (9%). No department can exceed allocation without CFO written sign-off. Headcount freeze in effect until Q4 review. Cloud infra budget capped at $180K.",
    summary: "Q3 budget $2.1M approved: Eng 40%, Mktg 24%, Ops 15%, Sales 12%, Legal 9%",
    source: "CFO Budget Review",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    tokenCount: 428,
  },
  {
    id: "seed-3",
    department: "legal",
    text: "Data Privacy Policy v2.1 effective July 1 2025. All user PII must be encrypted at rest (AES-256) and in transit (TLS 1.3+). Retention policy: user data max 24 months post-churn. GDPR & CCPA compliance mandatory for all new features. New data collection requires DPO sign-off. Cookie consent banner required on all web properties.",
    summary: "Privacy v2.1: AES-256 required, 24mo retention, GDPR/CCPA mandatory",
    source: "Legal Compliance Review",
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    tokenCount: 380,
  },
  {
    id: "seed-4",
    department: "engineering",
    text: "Architecture Decision: Migrating from REST to GraphQL. Target completion Q4 2025. All new APIs must be GraphQL-first. Auth service moving to JWT with 15-minute access tokens + 7-day refresh tokens. Avoid creating new REST endpoints. Current stack: Next.js, PostgreSQL, Redis for caching. Infra: AWS ECS, targeting zero-downtime deployments.",
    summary: "REST→GraphQL migration Q4, JWT auth, no new REST endpoints, AWS ECS",
    source: "Engineering Architecture Meeting",
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    tokenCount: 356,
  },
  {
    id: "seed-5",
    department: "management",
    text: "Q3 2025 OKRs: Company ARR target $4.2M (current $3.1M), NPS target >47 (current 41), churn target <2.8% (current 3.4%). All teams must align deliverables to ARR impact. Monthly all-hands first Friday. Board presentation August 15. Hiring: 3 senior engineers approved, 1 Head of Growth approved.",
    summary: "Q3 OKRs: $4.2M ARR, NPS >47, churn <2.8%; 4 hires approved",
    source: "Executive OKR Review",
    createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    tokenCount: 390,
  },
];

export function getContextEntries(): ContextEntry[] {
  return [...store].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getContextByDepartment(dept: Department): ContextEntry[] {
  return store.filter((e) => e.department === dept);
}

export function getCrossDepContext(activeDept: Department): ContextEntry[] {
  return store
    .filter((e) => e.department !== activeDept)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 8);
}

export function addContextEntry(
  entry: Omit<ContextEntry, "id" | "createdAt">
): ContextEntry {
  const newEntry: ContextEntry = {
    ...entry,
    id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  store.unshift(newEntry);
  return newEntry;
}
