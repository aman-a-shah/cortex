"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ContextEntry } from "@/types";

interface BubbleNode extends d3.SimulationNodeDatum {
  id: string;
  entry: ContextEntry;
  r: number;
  color: string;
  isNew: boolean;
}

interface Props {
  entries: ContextEntry[];
  onBubbleClick: (entry: ContextEntry) => void;
}

const MIN_R = 34;
const MAX_R = 88;

function tokenToRadius(tokens: number, allTokens: number[]): number {
  const min = Math.min(...allTokens);
  const max = Math.max(...allTokens);
  if (max === min) return (MIN_R + MAX_R) / 2;
  const t = (tokens - min) / (max - min);
  return MIN_R + t * (MAX_R - MIN_R);
}

export default function BubbleUniverse({ entries, onBubbleClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  const [nodes, setNodes] = useState<BubbleNode[]>([]);
  const simulationRef = useRef<d3.Simulation<BubbleNode, undefined> | null>(null);
  const nodeMapRef = useRef<Map<string, BubbleNode>>(new Map());
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [mousePos, setMousePos] = useState({ x: -9999, y: -9999 });

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setDimensions({ w: el.clientWidth, h: el.clientHeight });
    });
    obs.observe(el);
    setDimensions({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // Mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mouseRef.current = pos;
    setMousePos(pos);
  }, []);

  // Build/update simulation when entries or dimensions change
  useEffect(() => {
    if (dimensions.w === 0 || entries.length === 0) return;
    const { w, h } = dimensions;
    const allTokens = entries.map((e) => e.tokenCount);
    const existing = nodeMapRef.current;

    const nextNodes: BubbleNode[] = entries.map((entry) => {
      const r = tokenToRadius(entry.tokenCount, allTokens);
      const cfg = DEPT_CONFIG[entry.department];
      const prev = existing.get(entry.id);
      return {
        id: entry.id,
        entry,
        r,
        color: cfg.color,
        isNew: !prev,
        x: prev?.x ?? w / 2 + (Math.random() - 0.5) * w * 0.4,
        y: prev?.y ?? h / 2 + (Math.random() - 0.5) * h * 0.4,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      };
    });

    // Update ref map
    nodeMapRef.current = new Map(nextNodes.map((n) => [n.id, n]));

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = d3
      .forceSimulation(nextNodes)
      .force("charge", d3.forceManyBody<BubbleNode>().strength(8))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(0.05))
      .force(
        "collision",
        d3.forceCollide<BubbleNode>().radius((n) => n.r + 12).strength(0.85)
      )
      .alphaTarget(0.02)
      .on("tick", () => {
        // Clamp to container bounds and add organic random movement
        for (const node of nextNodes) {
          node.vx = (node.vx ?? 0) + (Math.random() - 0.5) * 0.4;
          node.vy = (node.vy ?? 0) + (Math.random() - 0.5) * 0.4;
          node.x = Math.max(node.r + 20, Math.min(w - node.r - 20, node.x ?? w / 2));
          node.y = Math.max(node.r + 20, Math.min(h - node.r - 60, node.y ?? h / 2));
        }
        // Trigger re-render with current positions
        setNodes([...nextNodes]);
        nodeMapRef.current = new Map(nextNodes.map((n) => [n.id, n]));
      });

    simulationRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [entries, dimensions]);

  const { w, h } = dimensions;

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        mouseRef.current = { x: -9999, y: -9999 };
        setMousePos({ x: -9999, y: -9999 });
      }}
    >
      <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {Object.entries(DEPT_CONFIG).map(([dept, cfg]) => (
            <radialGradient key={dept} id={`grad-${dept}`} cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor={cfg.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={cfg.color} stopOpacity="0.05" />
            </radialGradient>
          ))}
        </defs>

        {nodes.map((node) => {
          const nx = node.x ?? 0;
          const ny = node.y ?? 0;
          const dx = nx - mousePos.x;
          const dy = ny - mousePos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximity = Math.max(0, 1 - dist / 240);
          const glowSize = node.r * 0.45 * proximity;

          return (
            <g
              key={node.id}
              style={{ cursor: "pointer" }}
              transform={`translate(${nx}, ${ny})`}
              onClick={() => onBubbleClick(node.entry)}
            >
              {/* New bubble ring pulse */}
              {node.isNew && (
                <circle
                  cx={0}
                  cy={0}
                  r={node.r * 1.1}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="1.5"
                  style={{
                    animation: "ring-pulse 1.4s ease-out forwards",
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Main bubble */}
              <circle
                cx={0}
                cy={0}
                r={node.r}
                fill={`url(#grad-${node.entry.department})`}
                stroke={node.color}
                strokeWidth={0.8 + proximity * 1.2}
                strokeOpacity={0.25 + proximity * 0.4}
                style={{
                  filter:
                    glowSize > 1
                      ? `drop-shadow(0 4px ${glowSize}px rgba(0,0,0,0.5))`
                      : undefined,
                  transition: "filter 0.1s ease, stroke-width 0.1s ease",
                  animation: `bubble-wobble ${3 + (node.entry.tokenCount % 3)}s ease-in-out infinite alternate${node.isNew ? ", bubble-arrive 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards" : ""}`,
                }}
              />

              {/* Department emoji */}
              <text
                x={0}
                y={-7}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontSize: Math.max(16, node.r * 0.35),
                  pointerEvents: "none",
                  userSelect: "none",
                  fill: node.color,
                }}
              >
                {DEPT_CONFIG[node.entry.department].emoji}
              </text>

              {/* Token label */}
              <text
                x={0}
                y={13}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={`rgba(255,255,255,${0.25 + proximity * 0.3})`}
                style={{
                  fontSize: 10,
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                ~{node.entry.tokenCount}t
              </text>

              {/* Department label below */}
              <text
                x={0}
                y={node.r + 16}
                textAnchor="middle"
                fill={`rgba(255,255,255,${0.2 + proximity * 0.25})`}
                style={{
                  fontSize: 11,
                  pointerEvents: "none",
                  userSelect: "none",
                  letterSpacing: "0.04em",
                }}
              >
                {DEPT_CONFIG[node.entry.department].label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
