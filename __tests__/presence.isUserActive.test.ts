import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { recordHeartbeat, isUserActive, removeUser } from "@/lib/presence";

describe("presence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeUser("user-1");
    removeUser("user-2");
  });

  it("reports active immediately after heartbeat", () => {
    recordHeartbeat("user-1", "test@test.com", "Test User");
    expect(isUserActive("user-1")).toBe(true);
  });

  it("reports inactive with no heartbeat", () => {
    expect(isUserActive("user-2")).toBe(false);
  });

  it("reports inactive after TTL expires (90s)", () => {
    recordHeartbeat("user-1", "test@test.com", "Test User");
    vi.advanceTimersByTime(90_001);
    expect(isUserActive("user-1")).toBe(false);
  });

  it("stays active if within TTL window", () => {
    recordHeartbeat("user-1", "test@test.com", "Test User");
    vi.advanceTimersByTime(89_999);
    expect(isUserActive("user-1")).toBe(true);
  });

  it("removes user correctly", () => {
    recordHeartbeat("user-1", "test@test.com", "Test User");
    removeUser("user-1");
    expect(isUserActive("user-1")).toBe(false);
  });

  it("refreshes TTL on repeated heartbeat", () => {
    recordHeartbeat("user-1", "test@test.com", "Test User");
    vi.advanceTimersByTime(80_000);
    recordHeartbeat("user-1", "test@test.com", "Test User");
    vi.advanceTimersByTime(80_000);
    expect(isUserActive("user-1")).toBe(true);
  });
});
