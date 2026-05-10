import { describe, it, expect } from "vitest";
import { detectToolFromMessage } from "@/lib/composio";

describe("detectToolFromMessage", () => {
  it("detects github from PR reference", () => {
    expect(detectToolFromMessage("Can you check the open PR #42?")).toBe("github");
  });

  it("detects github from commit mention", () => {
    expect(detectToolFromMessage("I pushed a commit to the main branch")).toBe("github");
  });

  it("detects slack from channel mention", () => {
    expect(detectToolFromMessage("I saw this posted in slack channel #engineering")).toBe("slack");
  });

  it("detects notion from wiki mention", () => {
    expect(detectToolFromMessage("Update the wiki runbook please")).toBe("notion");
  });

  it("returns null for drive mention (drive tool removed)", () => {
    expect(detectToolFromMessage("The shared doc in Google Drive has the spec")).toBeNull();
  });

  it("returns null for unrelated message", () => {
    expect(detectToolFromMessage("What is the weather today?")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectToolFromMessage("DEPLOY PIPELINE is failing")).toBe("github");
  });
});
