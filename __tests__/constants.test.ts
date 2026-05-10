import { describe, it, expect } from "vitest";
import { CROSS_DEPT_SLICE, COMPOSIO_TIMEOUT_MS, PRESENCE_TTL_MS, HEARTBEAT_INTERVAL_MS } from "@/lib/constants";

describe("constants", () => {
  it("CROSS_DEPT_SLICE is a positive integer", () => {
    expect(Number.isInteger(CROSS_DEPT_SLICE) && CROSS_DEPT_SLICE > 0).toBe(true);
  });

  it("COMPOSIO_TIMEOUT_MS is less than 10 seconds", () => {
    expect(COMPOSIO_TIMEOUT_MS).toBeLessThan(10_000);
  });

  it("PRESENCE_TTL_MS is longer than heartbeat interval", () => {
    expect(PRESENCE_TTL_MS).toBeGreaterThan(HEARTBEAT_INTERVAL_MS);
  });
});
