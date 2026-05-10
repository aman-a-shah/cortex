"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ContextEntry, Department } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────
interface BubbleNode extends d3.SimulationNodeDatum {
  id: string;
  entry: ContextEntry;
  r: number;
  color: string;
  isNew: boolean;
  isSubBubble: boolean;
  parentId?: string;
  dept: Department;
  wavePhase: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  type: "walker" | "signal" | "plane" | "orbital" | "fog";
  pathIdx?: number; t?: number; speed?: number;
  bubbleId?: string; angle?: number; orbitR?: number;
  tx?: number; ty?: number;
  label?: string;
}

interface Viewport { x: number; y: number; scale: number; }

interface DragState {
  type: "pan" | "bubble";
  startMx: number; startMy: number;
  startVpX: number; startVpY: number;
  nodeId: string | null;
  startNx: number; startNy: number;
  moved: boolean;
}

interface VpAnim {
  start: Viewport; target: Viewport;
  startTime: number; duration: number;
}

interface Props {
  entries: ContextEntry[];
  onBubbleClick: (entry: ContextEntry) => void;
}

function polarityStatus(entry: ContextEntry): "pass" | "warning" | "fail" | "error" | null {
  const metaStatus = entry.metadata?.status;
  if (
    metaStatus === "pass" ||
    metaStatus === "warning" ||
    metaStatus === "fail" ||
    metaStatus === "error"
  ) {
    return metaStatus;
  }

  if (entry.source !== "ai-generated-code") return null;
  const match = entry.summary.match(/\b(pass|warning|fail|error)\b/i);
  return match ? (match[1].toLowerCase() as "pass" | "warning" | "fail" | "error") : "error";
}

const POLARITY_STATUS_COLOR = {
  pass: "#3ecf8e",
  warning: "#f2b84b",
  fail: "#ff6b6b",
  error: "#9ca3af",
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────
const MIN_R = 30;
const MAX_R = 78;

const DISTRICT_POS: Record<Department, [number, number]> = {
  engineering:  [0.70, 0.26],
  marketing:    [0.22, 0.30],
  finance:      [0.27, 0.72],
  legal:        [0.78, 0.70],
  product:      [0.50, 0.54],
  management:   [0.50, 0.16],
};

const CONNECTIONS: [Department, Department][] = [
  ["management", "engineering"], ["management", "marketing"], ["management", "product"],
  ["engineering", "product"], ["marketing", "product"],
  ["finance", "product"], ["legal", "product"],
  ["finance", "management"], ["legal", "management"],
];

const DEPT_LABELS: Record<Department, string[]> = {
  engineering:  ["debugging", "code review", "deploy", "PR open", "testing", "merge", "hotfix"],
  marketing:    ["A/B test", "campaign", "copy review", "analytics", "SEO", "launch"],
  finance:      ["forecast", "reconcile", "audit", "invoice", "budget", "close"],
  legal:        ["contract", "NDA review", "compliance", "IP filing", "risk"],
  product:      ["roadmap", "sprint", "OKR sync", "user story", "backlog", "retro"],
  management:   ["strategy", "1:1", "hiring", "OKR", "board prep", "sync"],
};


// ─── Entry similarity & merging ───────────────────────────────────────────────
const MERGE_STOP = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","by","as","is","it","its","was","be","been","are","were","that","this","with","from","have","has","had","not","all","we","our","their","they","them","there","which","when","what","who","how","also","into","will","would","could","should","some","any","each","than","then","just","more","most","over","very","only","if","do","did","so","up","out","after","before","during","been","been","such","both","he","she","his","her","him","you","your","my","me","us","no","yes","new","now","can","may","must","yet","even","already","about","other","many","much","few","per","via","next","last","same","since","while","still","too","well","back","own","off","got","get","set","let","put","run","use","need","seem","want","make","take","give","show","know","see","say","go","come","look","work","turn","keep","help","move","live","play","hold","lead","read","grow","open","walk","win","offer","point","start","end","call","ask","try","feel",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 3 && !MERGE_STOP.has(w))
  );
}

function jaccardSim(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function mergeSimilarEntries(entries: ContextEntry[]): ContextEntry[] {
  const THRESHOLD = 0.30;
  const absorbed = new Set<string>();
  const result: ContextEntry[] = [];

  for (let i = 0; i < entries.length; i++) {
    if (absorbed.has(entries[i].id)) continue;
    let current = entries[i];
    let currentWords = significantWords(current.summary + " " + current.text.slice(0, 300));

    for (let j = i + 1; j < entries.length; j++) {
      if (absorbed.has(entries[j].id)) continue;
      if (entries[j].department !== current.department) continue;
      const other = entries[j];
      const otherWords = significantWords(other.summary + " " + other.text.slice(0, 300));
      if (jaccardSim(currentWords, otherWords) >= THRESHOLD) {
        absorbed.add(other.id);
        const mergedId = [current.id, other.id].sort().join("+");
        current = {
          ...current,
          id: mergedId,
          text: current.text + "\n\n" + other.text,
          summary: current.summary + " · " + other.summary,
          tokenCount: current.tokenCount + other.tokenCount,
          createdAt: current.createdAt > other.createdAt ? current.createdAt : other.createdAt,
        };
        currentWords = significantWords(current.summary + " " + current.text.slice(0, 300));
      }
    }

    result.push(current);
  }

  return result;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function tokenToRadius(tokens: number, all: number[]): number {
  const lo = Math.min(...all), hi = Math.max(...all);
  if (hi === lo) return (MIN_R + MAX_R) / 2;
  return MIN_R + ((tokens - lo) / (hi - lo)) * (MAX_R - MIN_R);
}

function bezierPoint(t: number, p0: number, p1: number, p2: number, p3: number) {
  const mt = 1 - t;
  return mt ** 3 * p0 + 3 * mt ** 2 * t * p1 + 3 * mt * t ** 2 * p2 + t ** 3 * p3;
}

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

function wavyCirclePath(r: number, amplitude: number, phase: number, mouseAngle: number, prox: number): string {
  const N = 64;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * Math.PI * 2;
    const facing = Math.max(0, Math.cos(theta - mouseAngle));
    const localAmp = amplitude * (0.25 + 0.75 * facing * Math.sqrt(prox));
    const rr = r + Math.sin(theta * 5 + phase) * localAmp;
    pts.push([Math.cos(theta) * rr, Math.sin(theta) * rr]);
  }
  const parts: string[] = [];
  for (let i = 0; i < N; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % N];
    const mx = (curr[0] + next[0]) / 2, my = (curr[1] + next[1]) / 2;
    if (i === 0) {
      const prev = pts[N - 1];
      parts.push(`M ${(prev[0] + curr[0]) / 2} ${(prev[1] + curr[1]) / 2}`);
    }
    parts.push(`Q ${curr[0]} ${curr[1]} ${mx} ${my}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BubbleUniverse({ entries, onBubbleClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef       = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  const [dims, setDims]         = useState({ w: 0, h: 0 });
  const [nodes, setNodes]       = useState<BubbleNode[]>([]);
  const [mousePos, setMousePos] = useState({ x: -9999, y: -9999 });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [viewport, setViewport]   = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [focusedTags, setFocusedTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  const tagsCacheRef = useRef<Map<string, string[]>>(new Map());
  const nodeMapRef   = useRef<Map<string, BubbleNode>>(new Map());
  const simRef       = useRef<d3.Simulation<BubbleNode, undefined> | null>(null);
  const nodesRef     = useRef<BubbleNode[]>([]);
  const viewportRef  = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  const dimsRef      = useRef({ w: 0, h: 0 });
  const dragRef      = useRef<DragState | null>(null);
  const vpAnimRef    = useRef<VpAnim | null>(null);
  const orbitTimeRef = useRef<number>(0);
  // Temporarily override district center for a dept while dragging (makes same-dept nodes follow)
  const tempCentersRef = useRef<Partial<Record<Department, { x: number; y: number }>>>({});

  // Keep refs in sync with state
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { dimsRef.current = dims; }, [dims]);

  // ─── Resize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    obs.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // ─── D3 Simulation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (dims.w === 0 || entries.length === 0) return;
    const { w, h } = dims;
    const visibleEntries = mergeSimilarEntries(entries);
    const allTokens = visibleEntries.map(e => e.tokenCount);
    const existing  = nodeMapRef.current;

    const districtCenters: Record<Department, { x: number; y: number }> = {} as never;
    for (const [dept, [fx, fy]] of Object.entries(DISTRICT_POS)) {
      districtCenters[dept as Department] = { x: fx * w, y: fy * h };
    }

    const nextNodes: BubbleNode[] = visibleEntries.map(entry => {
      const isSubBubble = entry.source === "chat-extract";
      const baseR = tokenToRadius(entry.tokenCount, allTokens);
      const r = isSubBubble ? Math.max(MIN_R * 0.45, baseR * 0.55) : baseR;
      const cfg  = DEPT_CONFIG[entry.department];
      const prev = existing.get(entry.id);
      const ctr  = districtCenters[entry.department];
      return {
        id: entry.id, entry, r, isSubBubble,
        dept: entry.department, color: cfg.color,
        isNew: !prev,
        x: prev?.x ?? ctr.x + (Math.random() - 0.5) * 80,
        y: prev?.y ?? ctr.y + (Math.random() - 0.5) * 80,
        vx: prev?.vx ?? 0, vy: prev?.vy ?? 0,
        wavePhase: prev?.wavePhase ?? Math.random() * Math.PI * 2,
      };
    });

    // Assign parent IDs to sub-bubbles (largest main bubble of same dept)
    for (const node of nextNodes) {
      if (node.isSubBubble) {
        const parent = nextNodes
          .filter(n => !n.isSubBubble && n.dept === node.dept)
          .sort((a, b) => b.r - a.r)[0];
        if (parent) node.parentId = parent.id;
      }
    }

    nodeMapRef.current = new Map(nextNodes.map(n => [n.id, n]));
    nodesRef.current   = nextNodes;
    simRef.current?.stop();

    const sim = d3
      .forceSimulation(nextNodes)
      .force("charge", d3.forceManyBody<BubbleNode>().strength(-20))
      .force("collision", d3.forceCollide<BubbleNode>().radius(n => n.r + 10).strength(0.9))
      .alphaTarget(0.03)
      .alphaDecay(0.01)
      .on("tick", () => {
        for (const node of nextNodes) {
          // Use temp center if dragging this dept so same-dept bubbles drift to follow
          const target = tempCentersRef.current[node.dept] ?? districtCenters[node.dept];
          if (!node.fx) {
            node.vx = (node.vx ?? 0) + (target.x - (node.x ?? 0)) * 0.012;
            node.vy = (node.vy ?? 0) + (target.y - (node.y ?? 0)) * 0.012;
            if (node.isSubBubble && node.parentId) {
              const par = nodeMapRef.current.get(node.parentId);
              if (par) {
                node.vx = (node.vx ?? 0) + ((par.x ?? 0) - (node.x ?? 0)) * 0.028;
                node.vy = (node.vy ?? 0) + ((par.y ?? 0) - (node.y ?? 0)) * 0.028;
              }
            }
            node.vx = ((node.vx ?? 0) + (Math.random() - 0.5) * 0.10) * 0.94;
            node.vy = ((node.vy ?? 0) + (Math.random() - 0.5) * 0.10) * 0.94;
          }
          node.wavePhase = (node.wavePhase + 0.022) % (Math.PI * 2);
          node.x = Math.max(node.r + 16, Math.min(w - node.r - 16, node.x ?? w / 2));
          node.y = Math.max(node.r + 16, Math.min(h - node.r - 16, node.y ?? h / 2));
        }
        setNodes([...nextNodes]);
        nodesRef.current  = nextNodes;
        nodeMapRef.current = new Map(nextNodes.map(n => [n.id, n]));
      });

    simRef.current = sim;
    return () => { sim.stop(); };
  }, [entries, dims]);

  // ─── Canvas rAF loop ─────────────────────────────────────────────────────
  useEffect(() => {
    if (dims.w === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = dims;
    canvas.width  = w;
    canvas.height = h;
    if (particlesRef.current.length === 0) initParticles(particlesRef.current, w, h);

    function frame(ts: number) {
      if (!ctx) return;

      // Tick orbit time (drives SVG context label rotation)
      orbitTimeRef.current = ts;

      // Advance viewport animation
      const anim = vpAnimRef.current;
      if (anim) {
        if (anim.startTime < 0) anim.startTime = ts;
        const t    = Math.min(1, (ts - anim.startTime) / anim.duration);
        const ease = easeOutCubic(t);
        const newVp: Viewport = {
          x:     anim.start.x     + (anim.target.x     - anim.start.x)     * ease,
          y:     anim.start.y     + (anim.target.y     - anim.start.y)     * ease,
          scale: anim.start.scale + (anim.target.scale - anim.start.scale) * ease,
        };
        viewportRef.current = newVp;
        setViewport(newVp);
        if (t >= 1) { viewportRef.current = anim.target; setViewport(anim.target); vpAnimRef.current = null; }
      }

      const vp = viewportRef.current;
      ctx.fillStyle = "#242424";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(vp.x, vp.y);
      ctx.scale(vp.scale, vp.scale);

      const dc: Record<Department, { x: number; y: number }> = {} as never;
      for (const [dept, [fx, fy]] of Object.entries(DISTRICT_POS)) {
        dc[dept as Department] = { x: fx * w, y: fy * h };
      }
      const currentNodes = nodesRef.current;

      drawGrid(ctx, w, h);
      drawConnections(ctx, dc);
      drawIntraLinks(ctx, currentNodes);
      updateParticles(particlesRef.current, dc, currentNodes, w, h, ts);
      spawnParticles(particlesRef.current, dc, currentNodes, w, h);
      drawParticles(ctx, particlesRef.current);

      ctx.restore();

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dims]);

  // ─── Keyboard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusedId) {
        setFocusedId(null);
        vpAnimRef.current = { start: { ...viewportRef.current }, target: { x: 0, y: 0, scale: 1 }, startTime: -1, duration: 400 };
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedId]);

  // ─── Fetch tags for focused bubble ───────────────────────────────────────
  useEffect(() => {
    if (!focusedId) { setFocusedTags([]); setTagsLoading(false); return; }

    const cached = tagsCacheRef.current.get(focusedId);
    if (cached) { setFocusedTags(cached); setTagsLoading(false); return; }

    setFocusedTags([]);
    setTagsLoading(true);
    const node = nodesRef.current.find(n => n.id === focusedId);
    if (!node) return;

    let cancelled = false;
    fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: node.entry.summary,
        text: node.entry.text,
        department: node.entry.department,
      }),
    })
      .then(r => r.json())
      .then((tags: string[]) => {
        if (cancelled) return;
        tagsCacheRef.current.set(focusedId, tags);
        setFocusedTags(tags);
        setTagsLoading(false);
      })
      .catch(() => { if (!cancelled) setTagsLoading(false); });

    return () => { cancelled = true; };
  }, [focusedId]);

  // ─── Scroll zoom ─────────────────────────────────────────────────────────
  /*
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
      // Chain off current animation target so rapid scrolls accumulate smoothly
      const base = vpAnimRef.current?.target ?? viewportRef.current;
      const newScale = Math.max(0.8, Math.min(1.2, base.scale * factor));
      const pivotX = (mx - base.x) / base.scale;
      const pivotY = (my - base.y) / base.scale;
      const newX = mx - pivotX * newScale;
      const newY = my - pivotY * newScale;
      vpAnimRef.current = {
        start: { ...viewportRef.current },
        target: { x: newX, y: newY, scale: newScale },
        startTime: -1, duration: 130,
      };
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  */
  // ─── Pointer helpers ─────────────────────────────────────────────────────
  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const vp   = viewportRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: -9999, y: -9999 };
    return { x: (sx - rect.left - vp.x) / vp.scale, y: (sy - rect.top - vp.y) / vp.scale };
  }, []);

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const vp = viewportRef.current;
    dragRef.current = {
      type: "pan",
      startMx: e.clientX, startMy: e.clientY,
      startVpX: vp.x, startVpY: vp.y,
      nodeId: null, startNx: 0, startNy: 0,
      moved: false,
    };
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
  }, []);

  const handleBubblePointerDown = useCallback((e: React.PointerEvent, node: BubbleNode) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      type: "bubble",
      startMx: e.clientX, startMy: e.clientY,
      startVpX: 0, startVpY: 0,
      nodeId: node.id,
      startNx: node.x ?? 0, startNy: node.y ?? 0,
      moved: false,
    };
    node.fx = node.x;
    node.fy = node.y;
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvasPt = screenToCanvas(e.clientX, e.clientY);
    setMousePos(canvasPt);

    const ds = dragRef.current;
    if (!ds) return;

    const dx = e.clientX - ds.startMx;
    const dy = e.clientY - ds.startMy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ds.moved = true;
    if (!ds.moved) return;

    if (ds.type === "pan") {
      const { w, h } = dimsRef.current;
      const scale = viewportRef.current.scale;
      // Keep bounds symmetric around the natural center (canvas center at screen center)
      const centerX = (w / 2) * (1 - scale);
      const centerY = (h / 2) * (1 - scale);
      const halfRange = Math.max(w, h) * 0.45;
      const newX = Math.max(centerX - halfRange, Math.min(centerX + halfRange, ds.startVpX + dx));
      const newY = Math.max(centerY - halfRange, Math.min(centerY + halfRange, ds.startVpY + dy));
      const newVp = { ...viewportRef.current, x: newX, y: newY };
      viewportRef.current = newVp;
      setViewport(newVp);
    } else if (ds.type === "bubble" && ds.nodeId) {
      const vp  = viewportRef.current;
      const ddx = dx / vp.scale;
      const ddy = dy / vp.scale;
      const draggedNode = nodesRef.current.find(n => n.id === ds.nodeId);
      if (!draggedNode) return;
      const newNx = ds.startNx + ddx;
      const newNy = ds.startNy + ddy;
      draggedNode.x  = newNx;
      draggedNode.y  = newNy;
      draggedNode.fx = newNx;
      draggedNode.fy = newNy;
      // Shift district center so same-dept nodes drift toward the dragged position
      tempCentersRef.current[draggedNode.dept] = { x: newNx, y: newNy };
    }
  }, [screenToCanvas]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const ds = dragRef.current;
    if (!ds) return;

    if (!ds.moved) {
      if (ds.type === "bubble" && ds.nodeId) {
        // Click on bubble → toggle focus zoom
        const node = nodesRef.current.find(n => n.id === ds.nodeId);
        if (node) {
          if (focusedId === ds.nodeId) {
            setFocusedId(null);
            vpAnimRef.current = { start: { ...viewportRef.current }, target: { x: 0, y: 0, scale: 1 }, startTime: -1, duration: 420 };
          } else {
            const { w, h } = dimsRef.current;
            const scale = 1.45;
            const nx = node.x ?? w / 2;
            const ny = node.y ?? h / 2;
            setFocusedId(ds.nodeId);
            vpAnimRef.current = {
              start:  { ...viewportRef.current },
              target: { x: w / 2 - nx * scale, y: h / 2 - ny * scale, scale },
              startTime: -1, duration: 480,
            };
          }
        }
      } else {
        // Click on background → clear focus
        if (focusedId) {
          setFocusedId(null);
          vpAnimRef.current = { start: { ...viewportRef.current }, target: { x: 0, y: 0, scale: 1 }, startTime: -1, duration: 400 };
        }
      }
    }

    // Release pinned nodes and temp district overrides
    if (ds.type === "bubble" && ds.nodeId) {
      const node = nodesRef.current.find(n => n.id === ds.nodeId);
      if (node) {
        node.fx = undefined;
        node.fy = undefined;
        delete tempCentersRef.current[node.dept];
      }
    }

    dragRef.current = null;
    if (containerRef.current) containerRef.current.style.cursor = "";
  }, [focusedId, onBubbleClick]);

  // ─── Derived ─────────────────────────────────────────────────────────────
  const { w, h } = dims;
  const focusedNode = focusedId ? (nodesRef.current.find(n => n.id === focusedId) ?? null) : null;

  const districtLabels = Object.entries(DISTRICT_POS).map(([dept, [fx, fy]]) => ({
    dept: dept as Department,
    x: fx * w,
    y: fy * h - MAX_R - 20,
  }));

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Particle canvas — purely visual, no pointer events */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      {/* Bubble SVG — handles all interaction */}
      <svg
        width={w} height={h}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          {Object.entries(DEPT_CONFIG).map(([dept, cfg]) => (
            <radialGradient key={dept} id={`bg-${dept}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor={cfg.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={cfg.color} stopOpacity="0.04" />
            </radialGradient>
          ))}
        </defs>

        <g style={{
          transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: "0 0",
        }}>
          {/* Transparent background rect — captures background pan clicks */}
          <rect
            x={-w * 2} y={-h * 2} width={w * 5} height={h * 5}
            fill="transparent"
            style={{ cursor: "default" }}
            onPointerDown={handleBgPointerDown}
          />

          {/* District labels */}
          {districtLabels.map(({ dept, x, y }) => {
            if (!nodes.some(n => n.dept === dept) || y < 0) return null;
            const cfg = DEPT_CONFIG[dept];
            return (
              <text key={dept} x={x} y={y} textAnchor="middle" fill={cfg.color}
                opacity={focusedId ? 0.06 : 0.42}
                style={{ fontSize: 10, letterSpacing: "0.14em", pointerEvents: "none", userSelect: "none", transition: "opacity 0.4s" }}>
                {cfg.label.toUpperCase()}
              </text>
            );
          })}

          {/* Sub-bubble connector lines */}
          {nodes.filter(n => n.isSubBubble && n.parentId).map(node => {
            const parent = nodes.find(p => p.id === node.parentId);
            if (!parent) return null;
            const px = parent.x ?? 0, py = parent.y ?? 0;
            const cx = node.x ?? 0, cy = node.y ?? 0;
            const isUnfocused = focusedId !== null && node.id !== focusedId && parent.id !== focusedId;
            return (
              <line
                key={`conn-${node.id}`}
                x1={px} y1={py} x2={cx} y2={cy}
                stroke={node.color}
                strokeWidth={0.7}
                strokeOpacity={isUnfocused ? 0.03 : 0.22}
                strokeDasharray="3 6"
                style={{ pointerEvents: "none", transition: "stroke-opacity 0.35s ease" }}
              />
            );
          })}

          {/* Bubbles */}
          {nodes.map(node => {
            const nx = node.x ?? 0;
            const ny = node.y ?? 0;
            const dx = mousePos.x - nx;
            const dy = mousePos.y - ny;
            const dist  = Math.sqrt(dx * dx + dy * dy);
            const prox  = Math.max(0, 1 - dist / 240);
            const mouseAngle = Math.atan2(dy, dx);
            const amplitude  = 2 + prox * 9;
            const isFocused  = node.id === focusedId;
            const isUnfocused = focusedId !== null && !isFocused;

            return (
              <g
                key={node.id}
                transform={`translate(${nx},${ny})`}
                style={{
                  cursor: "grab",
                  opacity: isUnfocused ? 0.12 : 1,
                  transition: "opacity 0.35s ease",
                }}
                onPointerDown={e => handleBubblePointerDown(e, node)}
              >
                {/* New-entry ring pulse */}
                {node.isNew && (
                  <circle r={node.r * 1.08} fill="none" stroke={node.color} strokeWidth="0.6"
                    style={{ animation: "ring-pulse 2s cubic-bezier(0.33,1,0.68,1) forwards", pointerEvents: "none" }} />
                )}

                {/* Focus ring */}
                {isFocused && (
                  <circle r={node.r * 1.18} fill="none" stroke={node.color}
                    strokeWidth="0.5" strokeOpacity={0.22} strokeDasharray="4 7"
                    style={{ animation: "ring-pulse 3s cubic-bezier(0.33,1,0.68,1) infinite", pointerEvents: "none" }} />
                )}

                {/* Wavy main bubble */}
                <path
                  d={wavyCirclePath(node.r, amplitude, node.wavePhase, mouseAngle, prox)}
                  fill={`url(#bg-${node.dept})`}
                  stroke={node.color}
                  strokeWidth={isFocused ? 1.1 : 0.7 + prox * 0.8}
                  strokeOpacity={isFocused ? 0.55 : node.isSubBubble ? 0.18 + prox * 0.25 : 0.28 + prox * 0.35}
                  strokeDasharray={node.isSubBubble ? "4 3" : undefined}
                  style={{ animation: node.isNew ? "bubble-arrive 0.5s cubic-bezier(0.22,1,0.36,1) forwards" : undefined }}
                />

                {/* Dept emoji */}
                <text y={0} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: Math.max(node.isSubBubble ? 10 : 15, node.r * 0.36), pointerEvents: "none", userSelect: "none", fill: node.color, opacity: node.isSubBubble ? 0.65 : 0.9 }}>
                  {DEPT_CONFIG[node.entry.department].emoji}
                </text>

                {/* Sub-bubble indicator dot */}
                {node.isSubBubble && (
                  <circle r={2.5} cx={node.r * 0.55} cy={-node.r * 0.55}
                    fill={node.color} opacity={0.5}
                    style={{ pointerEvents: "none" }} />
                )}

                {polarityStatus(node.entry) && (
                  <g transform={`translate(${node.r * 0.58}, ${node.r * 0.58})`} style={{ pointerEvents: "none" }}>
                    <circle r={6} fill={POLARITY_STATUS_COLOR[polarityStatus(node.entry)!]} opacity={0.9} />
                    <text y={0.5} textAnchor="middle" dominantBaseline="middle" fill="#111"
                      style={{ fontSize: 7, fontWeight: 700, userSelect: "none" }}>
                      P
                    </text>
                  </g>
                )}

                {/* Solar system orbit — SMIL animateTransform, no CSS conflict */}
                {isFocused && (() => {
                  const isLoading = tagsLoading && focusedTags.length === 0;
                  const items = isLoading
                    ? ["analyzing…", "loading…", "context", "scanning", "tags…"]
                    : focusedTags;
                  if (items.length === 0) return null;

                  // Distribute items across 3 rings
                  const ring0 = items.filter((_, i) => i % 3 === 0);
                  const ring1 = items.filter((_, i) => i % 3 === 1);
                  const ring2 = items.filter((_, i) => i % 3 === 2);
                  const rings = [ring0, ring1, ring2];
                  // Radii from bubble center — clearly separated like planets
                  const radii    = [node.r + 60, node.r + 112, node.r + 172];
                  // Orbit durations (inner = fastest, outer = slowest)
                  const durations = [26, 42, 62];
                  // Alternating orbit directions (360=CW, -360=CCW)
                  const toAngles  = [360, -360, 360];

                  const out: React.ReactNode[] = [];

                  // Faint dashed orbital path circles
                  rings.forEach((ringItems, ri) => {
                    if (ringItems.length === 0) return;
                    out.push(
                      <circle key={`path-${ri}`} r={radii[ri]}
                        fill="none" stroke={node.color}
                        strokeOpacity={isLoading ? 0.05 : 0.11}
                        strokeWidth={0.4} strokeDasharray="4 10"
                        style={{ pointerEvents: "none" }} />
                    );
                  });

                  // Items on each ring
                  rings.forEach((ringItems, ri) => {
                    if (ringItems.length === 0) return;
                    const r        = radii[ri];
                    const dur      = durations[ri];
                    const toAngle  = toAngles[ri];
                    // Counter-rotation cancels parent rotation so text stays upright
                    const ctrAngle = -toAngle;

                    ringItems.forEach((item, ji) => {
                      const tw = Math.min(item.length * 6.5 + 18, 148);
                      // Negative begin spreads items around the ring at t=0
                      const fraction = ji / Math.max(ringItems.length, 1);
                      const begin    = `${(-(fraction * dur)).toFixed(2)}s`;
                      const fadeDelay = `${((ri * 3 + ji) * 0.07).toFixed(2)}s`;

                      out.push(
                        // Fade-in wrapper — pure opacity, no transform so it doesn't interfere
                        <g key={isLoading ? `l${ri}-${ji}` : `${ri}-${item}`}
                          style={{
                            animation: `orbit-fade-in 0.55s ease ${fadeDelay} both`,
                            pointerEvents: "none",
                          }}>
                          <g>
                            <animateTransform
                              attributeName="transform"
                              type="rotate"
                              from={`0 0 0`}
                              to={`${toAngle} 0 0`}
                              dur={`${dur}s`}
                              repeatCount="indefinite"
                              begin={begin}
                            />

                            {/* Spoke line from bubble edge outward (in orbit-rotated space) */}
                            <line
                              x1={node.r + 5} y1={0}
                              x2={r - tw / 2 - 6} y2={0}
                              stroke={node.color} strokeWidth={0.5}
                              strokeOpacity={isLoading ? 0.08 : 0.20} />

                            {/* Planet dot sitting on the orbital path */}
                            <circle cx={r} cy={0} r={2.5}
                              fill={node.color} opacity={0.38} />

                            <g transform={`translate(${r}, 0)`}>
                              <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from={`0 0 0`}
                                to={`${ctrAngle} 0 0`}
                                dur={`${dur}s`}
                                repeatCount="indefinite"
                                begin={begin}
                                additive="sum"
                              />
                              <rect x={-tw / 2} y={-10} width={tw} height={20} rx={6}
                                fill={node.color + (isLoading ? "0D" : "1C")}
                                stroke={node.color + (isLoading ? "38" : "66")}
                                strokeWidth={0.7} />
                              <text textAnchor="middle" dominantBaseline="middle"
                                fill={node.color}
                                opacity={isLoading ? 0.42 : 0.90}
                                style={{ fontSize: 9.5, userSelect: "none", fontWeight: 500,
                                  letterSpacing: "0.02em" }}>
                                {item}
                              </text>
                            </g>
                          </g>
                        </g>
                      );
                    });
                  });

                  return out;
                })()}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Focused bubble — bottom summary caption */}
      {focusedNode && (
        <div
          className="animate-detail-rise"
          style={{
            position: "absolute",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: 520,
            width: "calc(100% - 48px)",
            textAlign: "center",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <p style={{
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.7,
            color: "var(--text-secondary)",
            textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.6)",
          }}>
            {focusedNode.entry.summary}
          </p>
          <p style={{
            margin: "5px 0 0",
            fontSize: 11,
            color: "var(--text-muted)",
            opacity: 0.55,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}>
            {DEPT_CONFIG[focusedNode.dept].label} · {new Date(focusedNode.entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {focusedNode.isSubBubble ? " · extracted from chat" : focusedNode.entry.source ? ` · ${focusedNode.entry.source}` : ""} · esc to close
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Canvas drawing functions ─────────────────────────────────────────────────
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const spacing = 32;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.018)";
  for (let x = spacing; x < w; x += spacing)
    for (let y = spacing; y < h; y += spacing) {
      ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill();
    }
  ctx.restore();
}

function drawBubbleGlows(ctx: CanvasRenderingContext2D, nodes: BubbleNode[]) {
  for (const node of nodes) {
    const nx = node.x ?? 0;
    const ny = node.y ?? 0;
    const hex = node.color;
    const rv = parseInt(hex.slice(1, 3), 16);
    const gv = parseInt(hex.slice(3, 5), 16);
    const bv = parseInt(hex.slice(5, 7), 16);
    const glowR = node.r * (node.isSubBubble ? 2.4 : 3.2);
    const maxAlpha = node.isSubBubble ? 0.055 : 0.095;
    const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowR);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const alpha = maxAlpha * Math.pow(1 - t, 2.2);
      grad.addColorStop(t, `rgba(${rv},${gv},${bv},${alpha.toFixed(4)})`);
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(nx, ny, glowR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }
}

function drawConnections(ctx: CanvasRenderingContext2D, dc: Record<Department, { x: number; y: number }>) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 8]);
  for (const [a, b] of CONNECTIONS) {
    const pa = dc[a], pb = dc[b];
    if (!pa || !pb) continue;
    const mx = (pa.x + pb.x) / 2 + (Math.random() - 0.5) * 20;
    const my = (pa.y + pb.y) / 2 + (Math.random() - 0.5) * 20;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y);
    ctx.quadraticCurveTo(mx, my, pb.x, pb.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawIntraLinks(ctx: CanvasRenderingContext2D, nodes: BubbleNode[]) {
  const byDept: Record<string, BubbleNode[]> = {};
  for (const n of nodes) { (byDept[n.dept] ??= []).push(n); }
  ctx.save();
  for (const [dept, dNodes] of Object.entries(byDept)) {
    if (dNodes.length < 2) continue;
    const cfg = DEPT_CONFIG[dept as Department];
    ctx.strokeStyle = cfg.color + "25"; ctx.lineWidth = 0.6;
    for (let i = 0; i < dNodes.length - 1; i++) {
      const a = dNodes[i], b = dNodes[i + 1];
      ctx.beginPath(); ctx.moveTo(a.x ?? 0, a.y ?? 0);
      ctx.lineTo(b.x ?? 0, b.y ?? 0); ctx.stroke();
    }
  }
  ctx.restore();
}

function initParticles(particles: Particle[], w: number, h: number) {
  for (let i = 0; i < 45; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.12,
      life: Math.random(), maxLife: 1,
      size: Math.random() * 1.5 + 0.5,
      color: "rgba(255,255,255,0.04)", type: "fog",
    });
  }
}

function spawnParticles(particles: Particle[], dc: Record<Department, { x: number; y: number }>, nodes: BubbleNode[], w: number, h: number) {
  if (particles.length > 500) return;
  const target = { signal: CONNECTIONS.length * 5, walker: Math.min(nodes.length * 3, 60), orbital: Math.min(nodes.length * 2, 40) };
  const counts = { signal: 0, walker: 0, orbital: 0 };
  for (const p of particles) { if (p.type in counts) counts[p.type as keyof typeof counts]++; }

  if (counts.signal < target.signal && Math.random() < 0.15) {
    const connIdx = Math.floor(Math.random() * CONNECTIONS.length);
    const [a, b]  = CONNECTIONS[connIdx];
    const pa = dc[a], pb = dc[b];
    if (pa && pb) {
      const dept = Math.random() < 0.5 ? a : b;
      particles.push({
        x: pa.x, y: pa.y, vx: 0, vy: 0, life: 0, maxLife: 1,
        size: Math.random() < 0.3 ? 2.2 : 1.2,
        color: DEPT_CONFIG[dept].color, type: "signal",
        pathIdx: connIdx, t: 0, speed: 0.004 + Math.random() * 0.006,
      });
    }
  }

  if (counts.walker < target.walker && Math.random() < 0.08 && nodes.length > 0) {
    const node   = nodes[Math.floor(Math.random() * nodes.length)];
    const center = dc[node.dept];
    if (center) {
      const angle  = Math.random() * Math.PI * 2;
      const labels = DEPT_LABELS[node.dept];
      particles.push({
        x: center.x + Math.cos(angle) * (Math.random() * 90),
        y: center.y + Math.sin(angle) * (Math.random() * 90),
        vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
        life: 0, maxLife: 200 + Math.random() * 220,
        size: 1.5 + Math.random() * 0.8,
        color: DEPT_CONFIG[node.dept].color, type: "walker",
        label: Math.random() < 0.55 ? labels[Math.floor(Math.random() * labels.length)] : undefined,
      });
    }
  }

  if (counts.orbital < target.orbital && Math.random() < 0.06 && nodes.length > 0) {
    const node = nodes[Math.floor(Math.random() * nodes.length)];
    particles.push({
      x: node.x ?? 0, y: node.y ?? 0, vx: 0, vy: 0, life: 0,
      maxLife: 300 + Math.random() * 200, size: 1,
      color: DEPT_CONFIG[node.dept].color, type: "orbital",
      bubbleId: node.id, angle: Math.random() * Math.PI * 2,
      orbitR: node.r + 8 + Math.random() * 12,
    });
  }

  if (Math.random() < 0.001 && particles.filter(p => p.type === "plane").length < 3) {
    const fromLeft = Math.random() < 0.5;
    const sx = fromLeft ? -30 : w + 30, sy = Math.random() * h;
    const tx = fromLeft ? w + 30 : -30, ty = sy + (Math.random() - 0.5) * h * 0.4;
    particles.push({
      x: sx, y: sy, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1.8,
      color: "rgba(255,255,255,0.7)", type: "plane",
      tx, ty, t: 0, speed: 0.006 + Math.random() * 0.004,
    });
  }
}

function updateParticles(particles: Particle[], dc: Record<Department, { x: number; y: number }>, nodes: BubbleNode[], w: number, h: number, _ts: number) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === "fog") {
      p.x += p.vx; p.y += p.vy;
      p.life = (p.life + 0.001) % 1;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
    } else if (p.type === "signal") {
      p.t = (p.t ?? 0) + (p.speed ?? 0.005);
      if (p.t >= 1) { particles.splice(i, 1); continue; }
      const [a, b] = CONNECTIONS[p.pathIdx ?? 0] ?? [];
      const pa = dc[a], pb = dc[b];
      if (pa && pb) {
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        p.x = bezierPoint(p.t, pa.x, mx, mx, pb.x);
        p.y = bezierPoint(p.t, pa.y, my, my, pb.y);
      }
      p.life = p.t;
    } else if (p.type === "walker") {
      p.life++;
      if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
      p.vx += (Math.random() - 0.5) * 0.3; p.vy += (Math.random() - 0.5) * 0.3;
      p.vx *= 0.92; p.vy *= 0.92;
      p.x += p.vx; p.y += p.vy;
    } else if (p.type === "orbital") {
      p.life++;
      if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
      const node = nodeMap.get(p.bubbleId ?? "");
      if (!node) { particles.splice(i, 1); continue; }
      p.angle = (p.angle ?? 0) + 0.012;
      p.x = (node.x ?? 0) + Math.cos(p.angle) * (p.orbitR ?? 40);
      p.y = (node.y ?? 0) + Math.sin(p.angle) * (p.orbitR ?? 40);
    } else if (p.type === "plane") {
      p.t = (p.t ?? 0) + (p.speed ?? 0.005);
      if ((p.t ?? 0) >= 1) { particles.splice(i, 1); continue; }
      p.x += ((p.tx ?? w) - p.x) * (p.speed ?? 0.005);
      p.y += ((p.ty ?? h / 2) - p.y) * (p.speed ?? 0.005);
      p.life = p.t ?? 0;
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.save();
  for (const p of particles) {
    if (p.type === "fog") {
      ctx.globalAlpha = Math.sin(p.life * Math.PI) * 0.04;
      ctx.fillStyle = "white";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === "signal") {
      const pt   = p.t ?? 0;
      const fade = pt < 0.15 ? pt / 0.15 : pt > 0.8 ? (1 - pt) / 0.2 : 1;
      ctx.globalAlpha = fade * 0.55;
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = p.size > 1.8 ? 6 : 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (p.type === "walker") {
      const age  = p.life / p.maxLife;
      const fade = age < 0.1 ? age / 0.1 : age > 0.8 ? (1 - age) / 0.2 : 1;
      ctx.globalAlpha = fade * 0.32;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      if (p.label && fade > 0.2) {
        ctx.globalAlpha = fade * 0.3;
        ctx.font = "9px system-ui, sans-serif";
        ctx.fillText(p.label, p.x + p.size + 4, p.y + 3);
      }
    } else if (p.type === "orbital") {
      const age  = p.life / p.maxLife;
      const fade = age < 0.1 ? age / 0.1 : age > 0.85 ? (1 - age) / 0.15 : 1;
      ctx.globalAlpha = fade * 0.40;
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (p.type === "plane") {
      const t    = p.t ?? 0;
      const fade = t < 0.05 ? t / 0.05 : t > 0.9 ? (1 - t) / 0.1 : 1;
      ctx.globalAlpha = fade * 0.8;
      ctx.fillStyle = p.color; ctx.shadowColor = "white"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = fade * 0.15;
      ctx.fillStyle = "white";
      for (let tr = 1; tr <= 5; tr++) {
        const tp = Math.max(0, t - tr * 0.012);
        const trailX = bezierPoint(tp, p.x - 40, p.x, (p.tx ?? p.x + 40), (p.tx ?? p.x + 80));
        ctx.beginPath(); ctx.arc(trailX, p.y, p.size * (1 - tr * 0.15), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(36,36,36,0.38)");
  ctx.save(); ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h); ctx.restore();
}
