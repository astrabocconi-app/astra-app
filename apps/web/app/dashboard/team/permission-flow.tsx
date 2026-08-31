"use client";

// The permission editor: one horizontal band per section of the dashboard, with
// the pages of that section laid out along it as tappable nodes.
//
// Same division as the sidebar, turned on its side, so what you tick here maps
// onto what the person will actually see. Both come from DASHBOARD_SECTIONS, so
// they cannot drift apart.

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DASHBOARD_SECTIONS, ADMIN_ONLY_PAGES } from "@/lib/dashboard-pages";

// Layout constants. Bands are fixed-height rows; pages sit at fixed columns, so
// the graph is deterministic rather than force-directed — the same account
// always draws the same picture.
const BAND_H = 116;
const BAND_GAP = 12;
const LABEL_W = 168;
const PAGE_W = 196;
const PAGE_H = 76;
const PAGE_GAP = 18;
const PAD = 16;

/** Sections a staff account can be granted: Administration drops out entirely. */
export const GRANTABLE_SECTIONS = DASHBOARD_SECTIONS.map((s) => ({
  ...s,
  pages: s.pages.filter((p) => !ADMIN_ONLY_PAGES.has(p.key)),
})).filter((s) => s.pages.length > 0);

export const GRANTABLE_KEYS = GRANTABLE_SECTIONS.flatMap((s) => s.pages.map((p) => p.key));

type BandData = { label: string; count: number; total: number };
type PageData = { label: string; blurb: string; on: boolean; onToggle: () => void };

function BandNode({ data }: NodeProps) {
  const d = data as unknown as BandData;
  return (
    <div
      className="flex h-full flex-col justify-center rounded-2xl bg-gray-50 px-4"
      style={{ width: LABEL_W - PAD }}
    >
      <span className="text-sm font-semibold text-gray-800">{d.label}</span>
      <span className="text-xs text-gray-400">
        {d.count} of {d.total}
      </span>
      {/* Source only: the band is where the arrows to its pages start. */}
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

function PageNode({ data }: NodeProps) {
  const d = data as unknown as PageData;
  return (
    <button
      type="button"
      onClick={d.onToggle}
      aria-pressed={d.on}
      className={`flex h-full w-full flex-col justify-center gap-0.5 rounded-2xl border px-3.5 text-left transition-colors ${
        d.on
          ? "border-astra-primary bg-astra-light"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
      style={{ width: PAGE_W, height: PAGE_H }}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold leading-none ${
            d.on
              ? "border-astra-primary bg-astra-primary text-white"
              : "border-gray-300 bg-white text-transparent"
          }`}
        >
          ✓
        </span>
        <span
          className={`truncate text-sm font-semibold ${
            d.on ? "text-astra-primary" : "text-gray-700"
          }`}
        >
          {d.label}
        </span>
      </span>
      <span className="truncate text-xs text-gray-400">{d.blurb}</span>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
    </button>
  );
}

const NODE_TYPES = { band: BandNode, page: PageNode };

export function PermissionFlow({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const selected = useMemo(() => new Set(value), [value]);

  const { nodes, edges, height } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    GRANTABLE_SECTIONS.forEach((section, row) => {
      const y = row * (BAND_H + BAND_GAP);
      const bandId = `band:${section.key}`;
      const on = section.pages.filter((p) => selected.has(p.key)).length;

      nodes.push({
        id: bandId,
        type: "band",
        position: { x: 0, y },
        data: { label: section.label, count: on, total: section.pages.length },
        draggable: false,
        selectable: false,
        style: { width: LABEL_W - PAD, height: BAND_H - PAD },
      });

      section.pages.forEach((page, col) => {
        const id = `page:${page.key}`;
        nodes.push({
          id,
          type: "page",
          position: {
            x: LABEL_W + col * (PAGE_W + PAGE_GAP),
            y: y + (BAND_H - PAD - PAGE_H) / 2,
          },
          data: {
            label: page.label,
            blurb: page.blurb,
            on: selected.has(page.key),
            onToggle: () => {
              if (disabled) return;
              const next = new Set(selected);
              // A section is never granted as a unit: the band is a label, not
              // a control, so the only way to change anything is one page.
              if (next.has(page.key)) next.delete(page.key);
              else next.add(page.key);
              onChange(GRANTABLE_KEYS.filter((k) => next.has(k)));
            },
          },
          draggable: false,
          selectable: false,
          // React Flow turns pointer events OFF for a node that is neither
          // selectable, draggable nor connectable — all three of which are
          // switched off here — which would leave the button inside it dead.
          // The node's own style is merged last, so this puts them back.
          style: { pointerEvents: "all" },
        });

        edges.push({
          id: `${bandId}->${id}`,
          source: bandId,
          target: id,
          type: "smoothstep",
          style: {
            stroke: selected.has(page.key) ? "#003399" : "#e5e7eb",
            strokeWidth: 1.5,
          },
        });
      });
    });

    return {
      nodes,
      edges,
      height: GRANTABLE_SECTIONS.length * (BAND_H + BAND_GAP) + PAD,
    };
  }, [selected, onChange, disabled]);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-white ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        // A permissions grid, not a canvas: nothing to drag, connect, or
        // rearrange, and panning it would only lose people.
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.04, maxZoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#eef0f4" />
      </ReactFlow>
    </div>
  );
}
