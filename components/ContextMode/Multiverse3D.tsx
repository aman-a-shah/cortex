"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { ContextEntry, Department } from "@/types";
import { DEPT_CONFIG } from "@/lib/dept-config";

// ─── Types ────────────────────────────────────────────────────────────────────
type Vec3 = [number, number, number];

interface Projected {
  x: number;
  y: number;
  scale: number;
  depth: number; // rotated z — higher = farther from camera
}

interface Star {
  pos: Vec3;
  size: number;
  brightness: number;
}

interface TrailParticle {
  fromDept: Department;
  toDept: Department;
  t: number;
  speed: number;
  size: number;
}

interface Camera {
  rotX: number;
  rotY: number;
  zoom: number;
  tRotX: number;
  tRotY: number;
  tZoom: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FOCAL = 900;

const WORLD_POS: Record<Department, Vec3> = {
  engineering:  [ 340, -160,  80],
  marketing:    [-360,  -60, -160],
  finance:      [-260,  210,  100],
  legal:        [ 300,  220, -160],
  product:      [  10,   10,  260],
  management:   [  30, -320,  -60],
};

const WORLD_BASE_R = 54;

const CONNECTIONS: [Department, Department][] = [
  ["management", "engineering"], ["management", "marketing"],
  ["management", "product"],     ["engineering", "product"],
  ["marketing",  "product"],     ["finance",     "product"],
  ["legal",      "product"],     ["finance",     "management"],
  ["legal",      "management"],
];

// ─── Math ─────────────────────────────────────────────────────────────────────
function rotY([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * x + s * z, y, -s * x + c * z];
}
function rotX([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, c * y - s * z, s * y + c * z];
}

function project(pos: Vec3, cam: Camera, w: number, h: number): Projected | null {
  let p = rotY(pos, cam.rotY);
  p = rotX(p, cam.rotX);
  const [rx, ry, rz] = p;
  const focalDist = FOCAL * cam.zoom;
  const cz = rz + focalDist;
  if (cz < 60) return null;
  const scale = focalDist / cz;
  return { x: w / 2 + rx * scale, y: h / 2 + ry * scale, scale, depth: rz };
}

function targetAnglesFor(pos: Vec3): [number, number] {
  const [x, y, z] = pos;
  const tRotY = Math.atan2(-x, z);
  const p2 = rotY(pos, tRotY);
  const tRotX = Math.atan2(p2[1], p2[2]);
  return [-tRotX, tRotY];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ─── Card orbit positions ──────────────────────────────────────────────────────
function cardPositions(entries: ContextEntry[], worldPos: Vec3): Map<string, Vec3> {
  const map = new Map<string, Vec3>();
  const n = entries.length;
  entries.forEach((e, i) => {
    const phi   = (i / Math.max(n, 1)) * Math.PI * 2 + i * 0.42;
    const ring  = i % 3;
    const r     = 200 + ring * 85;
    const tilt  = 0.35 + ring * 0.18;
    map.set(e.id, [
      worldPos[0] + r * Math.cos(phi),
      worldPos[1] + r * Math.sin(phi) * tilt,
      worldPos[2] + r * Math.sin(phi),
    ]);
  });
  return map;
}

// ─── Stars ────────────────────────────────────────────────────────────────────
function makeStars(n: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < n; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi   = Math.random() * Math.PI * 2;
    const r     = 1400 + Math.random() * 1400;
    stars.push({
      pos: [
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(theta),
      ],
      size:       0.4 + Math.random() * 1.8,
      brightness: 0.25 + Math.random() * 0.75,
    });
  }
  return stars;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  entries: ContextEntry[];
  onEntryClick: (entry: ContextEntry) => void;
}

export default function Multiverse3D({ entries, onEntryClick }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const rafRef        = useRef(0);
  const dimRef        = useRef({ w: 0, h: 0 });

  const camRef = useRef<Camera>({
    rotX: 0.18, rotY: 0.0,
    zoom: 1.0,
    tRotX: 0.18, tRotY: 0.0, tZoom: 1.0,
  });

  const dragRef       = useRef<{ mx: number; my: number; rX: number; rY: number } | null>(null);
  const starsRef      = useRef<Star[]>(makeStars(520));
  const trailsRef     = useRef<TrailParticle[]>([]);
  const autoRotRef    = useRef(true);
  const idleTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeRef       = useRef(0);
  const flashRef      = useRef(0); // 0-1 fade for warp flash

  // React state — only for structural changes
  const [focusedDept, setFocusedDept] = useState<Department | null>(null);
  const [hoveredDept, setHoveredDept] = useState<Department | null>(null);
  const focusedRef = useRef<Department | null>(null); // sync ref for RAF

  // World refs map
  const worldElsRef  = useRef<Map<Department, HTMLDivElement>>(new Map());
  const labelElsRef  = useRef<Map<Department, HTMLDivElement>>(new Map());
  const cardElsRef   = useRef<Map<string, HTMLDivElement>>(new Map());
  const cardPosRef   = useRef<Map<string, Vec3>>(new Map());

  // Keep focusedRef in sync
  useEffect(() => {
    focusedRef.current = focusedDept;
  }, [focusedDept]);

  // ─── Trail particles init ───────────────────────────────────────────────────
  useEffect(() => {
    const trails: TrailParticle[] = [];
    CONNECTIONS.forEach(([a, b]) => {
      const n = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        trails.push({
          fromDept: a, toDept: b,
          t: Math.random(),
          speed: 0.0015 + Math.random() * 0.001,
          size: 1.2 + Math.random() * 1.4,
        });
      }
    });
    trailsRef.current = trails;
  }, []);

  // ─── Resize ────────────────────────────────────────────────────────────────
  useEffect(() => {
    function resize() {
      const el = containerRef.current;
      const cv = canvasRef.current;
      if (!el || !cv) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      cv.width  = w;
      cv.height = h;
      dimRef.current = { w, h };
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ─── RAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function frame() {
      rafRef.current = requestAnimationFrame(frame);
      timeRef.current += 0.008;
      const t = timeRef.current;
      const cam = camRef.current;
      const { w, h } = dimRef.current;
      if (!w || !h) return;

      // Auto-rotate
      if (autoRotRef.current && !focusedRef.current) {
        cam.tRotY += 0.0004;
      }

      // Lerp camera
      const sp = focusedRef.current ? 0.055 : 0.04;
      cam.rotX = lerpAngle(cam.rotX, cam.tRotX, sp);
      cam.rotY = lerpAngle(cam.rotY, cam.tRotY, sp);
      cam.zoom = lerp(cam.zoom, cam.tZoom, 0.06);

      // Flash decay
      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.04);

      // ── Canvas ────────────────────────────────────────────────────────────
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);

      // Stars
      for (const star of starsRef.current) {
        const p = project(star.pos, cam, w, h);
        if (!p) continue;
        const a = star.brightness * Math.min(1, p.scale * 14) * 0.7;
        if (a < 0.03) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, star.size * p.scale * 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,216,208,${a.toFixed(3)})`;
        ctx.fill();
        // Bright star glow
        if (star.size > 1.5 && a > 0.4) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, star.size * p.scale * 22, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200,180,150,${(a * 0.08).toFixed(3)})`;
          ctx.fill();
        }
      }

      // Nebula halos at dept world positions
      for (const [dept, pos] of Object.entries(WORLD_POS) as [Department, Vec3][]) {
        const focused = focusedRef.current;
        if (focused && focused !== dept) continue;
        const p = project(pos, cam, w, h);
        if (!p) continue;
        const cfg = DEPT_CONFIG[dept];
        const [r, g, b] = hexToRgb(cfg.color);
        const entryCount = entries.filter(e => e.department === dept).length;
        const nebulaR = (180 + entryCount * 12) * p.scale;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, nebulaR);
        grad.addColorStop(0,   `rgba(${r},${g},${b},0.06)`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},0.03)`);
        grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, nebulaR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Connection lines + trail particles
      const focused = focusedRef.current;
      for (const [dA, dB] of CONNECTIONS) {
        if (focused && focused !== dA && focused !== dB) continue;
        const pA = project(WORLD_POS[dA], cam, w, h);
        const pB = project(WORLD_POS[dB], cam, w, h);
        if (!pA || !pB) continue;

        const [rA, gA, bA] = hexToRgb(DEPT_CONFIG[dA].color);
        const grad = ctx.createLinearGradient(pA.x, pA.y, pB.x, pB.y);
        grad.addColorStop(0,   `rgba(${rA},${gA},${bA},0.12)`);
        grad.addColorStop(0.5, `rgba(${rA},${gA},${bA},0.06)`);
        grad.addColorStop(1,   `rgba(${rA},${gA},${bA},0.12)`);

        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Trail particles
      for (const trail of trailsRef.current) {
        if (focused && focused !== trail.fromDept && focused !== trail.toDept) continue;
        trail.t = (trail.t + trail.speed) % 1;
        const pA = project(WORLD_POS[trail.fromDept], cam, w, h);
        const pB = project(WORLD_POS[trail.toDept],   cam, w, h);
        if (!pA || !pB) continue;
        const tx = lerp(pA.x, pB.x, trail.t);
        const ty = lerp(pA.y, pB.y, trail.t);
        const scl = lerp(pA.scale, pB.scale, trail.t);
        const [r, g, b] = hexToRgb(DEPT_CONFIG[trail.fromDept].color);
        const a = 0.55 + 0.35 * Math.sin(t * 3 + trail.t * 10);
        ctx.beginPath();
        ctx.arc(tx, ty, trail.size * scl * 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(2)})`;
        ctx.fill();
        // Trail glow
        ctx.beginPath();
        ctx.arc(tx, ty, trail.size * scl * 14, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${(a * 0.15).toFixed(2)})`;
        ctx.fill();
      }

      // Warp flash overlay
      if (flashRef.current > 0) {
        ctx.fillStyle = `rgba(255,255,255,${(flashRef.current * 0.18).toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── HTML elements ────────────────────────────────────────────────────
      // Collect projections for all worlds
      type WorldProj = {
        dept: Department;
        proj: Projected;
        entryCount: number;
        radius: number;
      };
      const worldProjs: WorldProj[] = [];

      for (const [dept, pos] of Object.entries(WORLD_POS) as [Department, Vec3][]) {
        const p = project(pos, cam, w, h);
        if (!p) continue;
        const entryCount = entries.filter(e => e.department === dept).length;
        const radius = WORLD_BASE_R + Math.sqrt(entryCount) * 7;
        worldProjs.push({ dept, proj: p, entryCount, radius });
      }

      // Sort far → near so near elements render on top
      worldProjs.sort((a, b) => b.proj.depth - a.proj.depth);

      for (const { dept, proj, entryCount, radius } of worldProjs) {
        const isFocused   = focusedRef.current === dept;
        const isOtherFocused = focusedRef.current !== null && !isFocused;
        const displayR    = radius * proj.scale * (isFocused ? 2.2 : 1);
        const opacity     = isOtherFocused
          ? 0.18
          : Math.min(1, Math.max(0.3, 1.1 - proj.depth / 800));
        const blur        = Math.max(0, (proj.depth - 200) / 600) * 2.5;

        const el = worldElsRef.current.get(dept);
        if (el) {
          el.style.left    = proj.x + "px";
          el.style.top     = proj.y + "px";
          el.style.width   = displayR * 2 + "px";
          el.style.height  = displayR * 2 + "px";
          el.style.opacity = String(opacity.toFixed(3));
          el.style.filter  = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : "";
          el.style.zIndex  = String(Math.floor(1000 - proj.depth));
          el.style.boxShadow = buildSphereGlow(DEPT_CONFIG[dept].color, displayR, isFocused);
        }

        const lEl = labelElsRef.current.get(dept);
        if (lEl) {
          const labelY = proj.y + displayR + 14;
          lEl.style.left    = proj.x + "px";
          lEl.style.top     = labelY + "px";
          lEl.style.opacity = String((opacity * (isOtherFocused ? 0.3 : 1)).toFixed(3));
          lEl.style.zIndex  = String(Math.floor(1000 - proj.depth));
          lEl.style.fontSize = Math.max(10, 13 * proj.scale * (isFocused ? 1.6 : 1)) + "px";
          lEl.innerHTML = `
            <div style="font-weight:600;color:${DEPT_CONFIG[dept].color};letter-spacing:0.08em">
              ${DEPT_CONFIG[dept].label.toUpperCase()}
            </div>
            <div style="opacity:0.5;font-size:0.85em;margin-top:2px">
              ${entryCount} entr${entryCount === 1 ? "y" : "ies"}
            </div>
          `;
        }
      }

      // Context entry cards (only when focused)
      if (focusedRef.current) {
        const deptEntries = entries.filter(e => e.department === focusedRef.current);

        // Orbit cards slowly
        const orbitOffset = t * 0.06;
        const base = cardPosRef.current;

        for (const entry of deptEntries) {
          const basePos = base.get(entry.id);
          if (!basePos) continue;

          // Gentle orbit
          const [bx, by, bz] = basePos;
          const orbitR = Math.sqrt(
            (bx - WORLD_POS[focusedRef.current!][0]) ** 2 +
            (bz - WORLD_POS[focusedRef.current!][2]) ** 2
          );
          const orbitAngle = Math.atan2(bz - WORLD_POS[focusedRef.current!][2], bx - WORLD_POS[focusedRef.current!][0]) + orbitOffset * (0.6 + entry.id.length % 3 * 0.2);
          const animPos: Vec3 = [
            WORLD_POS[focusedRef.current!][0] + orbitR * Math.cos(orbitAngle),
            by + Math.sin(t * 0.7 + entry.id.length) * 8,
            WORLD_POS[focusedRef.current!][2] + orbitR * Math.sin(orbitAngle),
          ];

          const p = project(animPos, cam, w, h);
          const cardEl = cardElsRef.current.get(entry.id);
          if (!cardEl || !p) continue;

          const cardOpacity = Math.min(1, Math.max(0.1, 1 - (p.depth - 50) / 600));
          const cardBlur = Math.max(0, (p.depth - 300) / 500) * 3;
          const cardScale = Math.max(0.55, Math.min(1.1, p.scale * 2.2));

          cardEl.style.left      = p.x + "px";
          cardEl.style.top       = p.y + "px";
          cardEl.style.transform = `translate(-50%, -50%) scale(${cardScale.toFixed(3)})`;
          cardEl.style.opacity   = String(cardOpacity.toFixed(3));
          cardEl.style.filter    = cardBlur > 0.2 ? `blur(${cardBlur.toFixed(1)}px)` : "";
          cardEl.style.zIndex    = String(Math.floor(1000 - p.depth));
          cardEl.style.display   = "block";
        }
      } else {
        // Hide all cards when not focused
        for (const [, el] of cardElsRef.current) {
          el.style.display = "none";
        }
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [entries]);

  // ─── Recompute card positions when focused dept changes ─────────────────────
  useEffect(() => {
    if (!focusedDept) {
      cardPosRef.current.clear();
      return;
    }
    const deptEntries = entries.filter(e => e.department === focusedDept);
    cardPosRef.current = cardPositions(deptEntries, WORLD_POS[focusedDept]);
  }, [focusedDept, entries]);

  // ─── Interaction ────────────────────────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    autoRotRef.current = false;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!focusedRef.current) autoRotRef.current = true;
    }, 3500);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-world]")) return;
    resetIdleTimer();
    dragRef.current = {
      mx: e.clientX, my: e.clientY,
      rX: camRef.current.rotX, rY: camRef.current.rotY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [resetIdleTimer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.mx;
    const dy = e.clientY - dragRef.current.my;
    camRef.current.tRotY = dragRef.current.rY + dx * 0.006;
    camRef.current.tRotX = Math.max(-1.1, Math.min(1.1,
      dragRef.current.rX + dy * 0.006
    ));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    resetIdleTimer();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    camRef.current.tZoom = Math.max(0.5, Math.min(3.0, camRef.current.tZoom + delta));
  }, [resetIdleTimer]);

  const focusOn = useCallback((dept: Department) => {
    resetIdleTimer();
    autoRotRef.current = false;
    flashRef.current = 1;
    setFocusedDept(dept);
    const [tRX, tRY] = targetAnglesFor(WORLD_POS[dept]);
    camRef.current.tRotX = tRX;
    camRef.current.tRotY = tRY;
    camRef.current.tZoom = 2.0;
  }, [resetIdleTimer]);

  const unfocus = useCallback(() => {
    setFocusedDept(null);
    flashRef.current = 0.6;
    camRef.current.tZoom = 1.0;
    setTimeout(() => { autoRotRef.current = true; }, 1200);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && focusedRef.current) unfocus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unfocus]);

  // ─── Ref callbacks for DOM elements ─────────────────────────────────────────
  const setWorldRef = useCallback((dept: Department) => (el: HTMLDivElement | null) => {
    if (el) worldElsRef.current.set(dept, el);
    else worldElsRef.current.delete(dept);
  }, []);

  const setLabelRef = useCallback((dept: Department) => (el: HTMLDivElement | null) => {
    if (el) labelElsRef.current.set(dept, el);
    else labelElsRef.current.delete(dept);
  }, []);

  const setCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) cardElsRef.current.set(id, el);
    else cardElsRef.current.delete(id);
  }, []);

  const depts = Object.keys(DEPT_CONFIG) as Department[];
  const focusedEntries = focusedDept
    ? entries.filter(e => e.department === focusedDept)
    : [];

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", cursor: dragRef.current ? "grabbing" : "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Canvas — stars + nebula + lines + trails */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      {/* Department worlds — positioned by RAF via direct DOM manipulation */}
      {depts.map(dept => {
        const cfg = DEPT_CONFIG[dept];
        return (
          <div key={dept}>
            {/* Sphere */}
            <div
              ref={setWorldRef(dept)}
              data-world={dept}
              onClick={() => {
                if (focusedDept === dept) return;
                focusOn(dept);
              }}
              onMouseEnter={() => setHoveredDept(dept)}
              onMouseLeave={() => setHoveredDept(null)}
              style={{
                position: "absolute",
                borderRadius: "50%",
                cursor: focusedDept === dept ? "default" : "pointer",
                background: buildSphereGradient(cfg.color),
                transition: "box-shadow 0.3s ease",
                willChange: "transform, opacity",
                pointerEvents: "auto",
              }}
            >
              {/* Emoji center */}
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "clamp(12px, 30%, 28px)",
                opacity: 0.85,
                userSelect: "none",
                pointerEvents: "none",
              }}>
                {cfg.emoji}
              </div>
              {/* Ring orbit decoration */}
              <div style={{
                position: "absolute",
                inset: "-18%",
                borderRadius: "50%",
                border: `1px solid ${cfg.color}35`,
                transform: "rotateX(72deg)",
                pointerEvents: "none",
              }} />
            </div>

            {/* Label */}
            <div
              ref={setLabelRef(dept)}
              style={{
                position: "absolute",
                transform: "translateX(-50%)",
                textAlign: "center",
                pointerEvents: "none",
                userSelect: "none",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                lineHeight: 1.4,
              }}
            />
          </div>
        );
      })}

      {/* Context entry cards — shown only when focused */}
      {focusedEntries.map(entry => {
        const cfg = DEPT_CONFIG[entry.department];
        const source = entry.source ?? "context";
        const sourceEmoji = source.startsWith("composio") ? "⚡" : source === "chat-extract" ? "✦" : "◎";
        return (
          <div
            key={entry.id}
            ref={setCardRef(entry.id)}
            onClick={(e) => { e.stopPropagation(); onEntryClick(entry); }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `rgba(45,45,43,0.97)`;
              (e.currentTarget as HTMLElement).style.borderColor = cfg.color + "80";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = `rgba(35,35,33,0.92)`;
              (e.currentTarget as HTMLElement).style.borderColor = cfg.color + "40";
            }}
            style={{
              display: "none",
              position: "absolute",
              width: 188,
              padding: "10px 13px",
              background: "rgba(35,35,33,0.92)",
              border: `1px solid ${cfg.color}40`,
              borderRadius: 12,
              cursor: "pointer",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              pointerEvents: "auto",
              transition: "background 0.15s, border-color 0.15s",
              willChange: "transform, opacity",
              boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 12px ${cfg.color}18`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600, letterSpacing: "0.06em" }}>
                {sourceEmoji} {source.replace("composio-", "").toUpperCase()}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
                {new Date(entry.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p style={{
              margin: 0, fontSize: 11.5, lineHeight: 1.55,
              color: "rgba(236,234,228,0.82)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {entry.summary}
            </p>
          </div>
        );
      })}

      {/* HUD — top left hint */}
      {!focusedDept && (
        <div style={{
          position: "absolute", bottom: 32, left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11, color: "rgba(155,152,145,0.5)",
          letterSpacing: "0.12em",
          pointerEvents: "none", userSelect: "none",
          animation: "mode-fade-in 1.5s ease forwards",
        }}>
          DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A WORLD TO EXPLORE
        </div>
      )}

      {/* Focused dept header */}
      {focusedDept && (
        <div
          style={{
            position: "absolute", top: 20, left: "50%",
            transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 12,
            padding: "8px 18px 8px 14px",
            background: "rgba(28,28,26,0.88)",
            border: `1px solid ${DEPT_CONFIG[focusedDept].color}30`,
            borderRadius: 999,
            backdropFilter: "blur(16px)",
            animation: "msg-in 0.3s ease forwards",
            pointerEvents: "auto",
            zIndex: 100,
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: DEPT_CONFIG[focusedDept].color,
            boxShadow: `0 0 8px ${DEPT_CONFIG[focusedDept].color}`,
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: DEPT_CONFIG[focusedDept].color, letterSpacing: "0.08em" }}>
            {DEPT_CONFIG[focusedDept].label.toUpperCase()}
          </span>
          <span style={{ fontSize: 12, color: "rgba(155,152,145,0.6)" }}>
            {focusedEntries.length} context {focusedEntries.length === 1 ? "entry" : "entries"}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); unfocus(); }}
            style={{
              marginLeft: 4,
              background: "transparent", border: "none",
              color: "rgba(155,152,145,0.6)", cursor: "pointer",
              fontSize: 16, lineHeight: 1, padding: "0 2px",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(155,152,145,0.6)")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Dept legend — top right */}
      {!focusedDept && (
        <div style={{
          position: "absolute", top: 16, right: 20,
          display: "flex", flexDirection: "column", gap: 4,
          pointerEvents: "none",
          animation: "mode-fade-in 1s ease forwards",
        }}>
          {depts.map(dept => {
            const count = entries.filter(e => e.department === dept).length;
            if (count === 0) return null;
            const cfg = DEPT_CONFIG[dept];
            return (
              <div key={dept} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, opacity: 0.8 }} />
                <span style={{ fontSize: 10.5, color: cfg.color, opacity: 0.7, letterSpacing: "0.05em" }}>
                  {cfg.label} <span style={{ opacity: 0.5 }}>({count})</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredDept && !focusedDept && (() => {
        const count = entries.filter(e => e.department === hoveredDept).length;
        const cfg = DEPT_CONFIG[hoveredDept];
        return (
          <div style={{
            position: "absolute", bottom: 60, left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 14px", borderRadius: 8,
            background: "rgba(28,28,26,0.9)",
            border: `1px solid ${cfg.color}40`,
            backdropFilter: "blur(10px)",
            fontSize: 12, color: cfg.color,
            pointerEvents: "none", whiteSpace: "nowrap",
            animation: "msg-in 0.15s ease forwards",
          }}>
            {cfg.emoji} {cfg.label} · {count} {count === 1 ? "entry" : "entries"} — click to enter
          </div>
        );
      })()}
    </div>
  );
}

// ─── Visual helpers ───────────────────────────────────────────────────────────

function buildSphereGradient(color: string): string {
  const [r, g, b] = hexToRgb(color);
  const light = `rgba(${Math.min(255, r + 80)},${Math.min(255, g + 70)},${Math.min(255, b + 60)},0.95)`;
  const mid   = color;
  const dark  = `rgba(${Math.max(0, r - 50)},${Math.max(0, g - 45)},${Math.max(0, b - 40)},1)`;
  return `radial-gradient(circle at 36% 32%, ${light} 0%, ${mid} 52%, ${dark} 100%)`;
}

function buildSphereGlow(color: string, radius: number, focused: boolean): string {
  const [r, g, b] = hexToRgb(color);
  const intensity = focused ? 1.8 : 1.0;
  return [
    `0 0 ${Math.round(radius * 0.6 * intensity)}px rgba(${r},${g},${b},0.55)`,
    `0 0 ${Math.round(radius * 1.4 * intensity)}px rgba(${r},${g},${b},0.25)`,
    `0 0 ${Math.round(radius * 2.8 * intensity)}px rgba(${r},${g},${b},0.10)`,
    `inset -${Math.round(radius * 0.12)}px ${Math.round(radius * 0.08)}px ${Math.round(radius * 0.28)}px rgba(0,0,0,0.45)`,
    `inset ${Math.round(radius * 0.06)}px -${Math.round(radius * 0.06)}px ${Math.round(radius * 0.15)}px rgba(255,255,255,0.08)`,
  ].join(", ");
}
