// Named constants — avoids magic numbers scattered across the codebase

export const CROSS_DEPT_SLICE = 8;          // entries pulled from other depts for context enrichment
export const TITLE_TRUNCATE_LEN = 52;       // characters before "…" in message titles
export const COMPOSIO_TIMEOUT_MS = 2500;    // max wait for live tool fetch
export const PRESENCE_TTL_MS = 90_000;      // heartbeat TTL for active-user check
export const HEARTBEAT_INTERVAL_MS = 30_000; // how often the client sends a heartbeat
