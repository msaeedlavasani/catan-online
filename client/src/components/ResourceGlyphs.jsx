import React from "react";

// Small, original decorative SVG glyphs for each resource. Each is a <g>
// centered on its own origin so it can be placed anywhere with a transform.

export function TreeGlyph({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <rect x="-1.6" y="5" width="3.2" height="6" fill="#5c3a21" />
      <polygon points="0,-11 -7.5,4.5 7.5,4.5" fill="#33562f" />
      <polygon points="0,-5 -6.5,7 6.5,7" fill="#2a4826" />
    </g>
  );
}

export function BrickGlyph({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <rect x="-8.5" y="-3" width="7.5" height="5.2" rx="0.8" fill="#bf6a3f" stroke="#7a3f22" strokeWidth="0.6" />
      <rect x="0.8" y="-3" width="7.5" height="5.2" rx="0.8" fill="#a8532f" stroke="#7a3f22" strokeWidth="0.6" />
      <rect x="-4" y="2.6" width="7.5" height="5.2" rx="0.8" fill="#b25a34" stroke="#7a3f22" strokeWidth="0.6" />
    </g>
  );
}

export function WheatGlyph({ x, y, scale = 1 }) {
  const heads = [-6, -3, 0, 3, 6];
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <line x1="0" y1="-11" x2="0" y2="9" stroke="#9a7a24" strokeWidth="1.1" />
      {heads.map((dy, i) => (
        <g key={i}>
          <line x1="0" y1={dy} x2="-4.5" y2={dy - 3} stroke="#d3a336" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="0" y1={dy} x2="4.5" y2={dy - 3} stroke="#d3a336" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

export function SheepGlyph({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <circle cx="-4.5" cy="1" r="5.2" fill="#f2ecd8" stroke="#c9bd94" strokeWidth="0.6" />
      <circle cx="4.5" cy="1" r="5.2" fill="#f2ecd8" stroke="#c9bd94" strokeWidth="0.6" />
      <circle cx="0" cy="-3.5" r="5.4" fill="#f7f2e4" stroke="#c9bd94" strokeWidth="0.6" />
      <circle cx="6.5" cy="-2" r="2.4" fill="#4a4238" />
    </g>
  );
}

export function OreGlyph({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <polygon points="-7.5,6.5 -2,-8.5 4.5,-2 8.5,6.5" fill="#7b7f86" stroke="#4d5157" strokeWidth="0.6" />
      <polygon points="-2,-8.5 2.5,-4 -1,-0.5" fill="#a3a7ae" />
      <circle cx="3.5" cy="1.5" r="0.9" fill="#e7e9ec" />
    </g>
  );
}

export function DesertGlyph({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <path d="M-8,4 L-2.5,-2 L2,3 L8,-3.5" stroke="#a8935f" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </g>
  );
}

export const RESOURCE_GLYPHS = {
  wood: TreeGlyph,
  brick: BrickGlyph,
  wheat: WheatGlyph,
  sheep: SheepGlyph,
  ore: OreGlyph,
  desert: DesertGlyph,
};

// A single small icon in its own little viewBox, for use in resource chips / UI lists.
export function ResourceIcon({ resource, size = 18 }) {
  const Glyph = RESOURCE_GLYPHS[resource];
  if (!Glyph) return null;
  return (
    <svg width={size} height={size} viewBox="-11 -11 22 22" style={{ display: "block" }}>
      <Glyph x={0} y={0} scale={1} />
    </svg>
  );
}
