import type { ContextEntry, Department } from "@/types";

// Stop-words copied from BubbleUniverse to keep similarity tuning centralized.
const MERGE_STOP = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","by","as","is","it","its","was","be","been","are","were","that","this","with","from","have","has","had","not","all","we","our","their","they","them","there","which","when","what","who","how","also","into","will","would","could","should","some","any","each","than","then","just","more","most","over","very","only","if","do","did","so","up","out","after","before","during","such","both","he","she","his","her","him","you","your","my","me","us","no","yes","new","now","can","may","must","yet","even","already","about","other","many","much","few","per","via","next","last","same","since","while","still","too","well","back","own","off","got","get","set","let","put","run","use","need","seem","want","make","take","give","show","know","see","say","go","come","look","work","turn","keep","help","move","live","play","hold","lead","read","grow","open","walk","win","offer","point","start","end","call","ask","try","feel",
]);

export function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !MERGE_STOP.has(w))
  );
}

export function jaccardSim(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export type MergeStatus = "pending" | "approved" | "rejected";

export interface MergeCandidate {
  parentId: string;
  childId: string;
  similarity: number;
  parentSummary: string;
  childSummary: string;
  department: Department;
}

export const MERGE_THRESHOLD = 0.3;

// Returns proposed parent/child pairs without mutating the entries.
// Skips children that have already been resolved (approved/rejected/dismissed).
export function findMergeCandidates(entries: ContextEntry[]): MergeCandidate[] {
  const out: MergeCandidate[] = [];
  const claimedChildren = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    const aMeta = a.metadata ?? {};
    const aWords = significantWords(a.summary + " " + a.text.slice(0, 300));

    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (b.department !== a.department) continue;
      const bMeta = b.metadata ?? {};
      const bWords = significantWords(b.summary + " " + b.text.slice(0, 300));
      const sim = jaccardSim(aWords, bWords);
      if (sim < MERGE_THRESHOLD) continue;

      const parent = a.tokenCount >= b.tokenCount ? a : b;
      const child = parent === a ? b : a;
      const childMeta = child === a ? aMeta : bMeta;

      if (claimedChildren.has(child.id)) continue;
      const status = childMeta.mergeStatus as MergeStatus | undefined;
      if (status === "approved" || status === "rejected") continue;
      if (childMeta.mergeDismissedAt) continue;

      claimedChildren.add(child.id);
      out.push({
        parentId: parent.id,
        childId: child.id,
        similarity: sim,
        parentSummary: parent.summary,
        childSummary: child.summary,
        department: parent.department,
      });
    }
  }
  return out;
}
