import { RES_COLOR } from "../game/constants.js";
import { shade } from "../game/helpers.js";

// Original, hand-built "low-poly" style glyphs (light comes from top-left,
// each shape is split into a light/mid/dark facet to fake volume without
// needing gradient <defs> — so they're safe to repeat many times on one board).

export function TreeGlyph({ x, y, scale = 1 }) {
  const dark = shade(RES_COLOR.wood, -0.35);
  const mid = RES_COLOR.wood;
  const light = shade(RES_COLOR.wood, 0.3);
  const trunk = "#4a3218";
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="10.5" rx="8" ry="1.6" fill="#000" opacity="0.18" />
      <rect x="-1.5" y="4" width="3" height="6" fill={trunk} />
      <polygon points="0,-12 0,3 -8,3" fill={light} />
      <polygon points="0,-12 0,3 8,3" fill={dark} />
      <polygon points="0,-7 0,6 -6.5,6" fill={mid} />
      <polygon points="0,-7 0,6 6.5,6" fill={dark} />
    </g>
  );
}

export function BrickGlyph({ x, y, scale = 1 }) {
  const top = shade(RES_COLOR.brick, 0.3);
  const left = RES_COLOR.brick;
  const right = shade(RES_COLOR.brick, -0.3);
  const outline = shade(RES_COLOR.brick, -0.5);
  function Cube({ cx, cy, s }) {
    return (
      <g stroke={outline} strokeWidth={0.5} strokeLinejoin="round">
        <polygon points={`${cx},${cy - s} ${cx + s},${cy - s * 0.5} ${cx},${cy} ${cx - s},${cy - s * 0.5}`} fill={top} />
        <polygon points={`${cx - s},${cy - s * 0.5} ${cx},${cy} ${cx},${cy + s} ${cx - s},${cy + s * 0.5}`} fill={left} />
        <polygon points={`${cx + s},${cy - s * 0.5} ${cx},${cy} ${cx},${cy + s} ${cx + s},${cy + s * 0.5}`} fill={right} />
      </g>
    );
  }
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="9" rx="9" ry="1.6" fill="#000" opacity="0.18" />
      <Cube cx={-3.2} cy={-1} s={4.6} />
      <Cube cx={3.4} cy={2.2} s={4.6} />
    </g>
  );
}

export function WheatGlyph({ x, y, scale = 1 }) {
  const light = shade(RES_COLOR.wheat, 0.25);
  const dark = shade(RES_COLOR.wheat, -0.25);
  const band = "#7a5a1e";
  const heads = [-8, -4.5, -1, 2.5, 6];
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="10" rx="6" ry="1.4" fill="#000" opacity="0.15" />
      <line x1="0" y1="-11" x2="0" y2="9" stroke={dark} strokeWidth={1} />
      {heads.map((dy, i) => (
        <g key={i}>
          <polygon points={`0,${dy} -4.5,${dy - 2.3} -3,${dy - 3.3}`} fill={i % 2 === 0 ? light : RES_COLOR.wheat} />
          <polygon points={`0,${dy} 4.5,${dy - 2.3} 3,${dy - 3.3}`} fill={i % 2 === 0 ? RES_COLOR.wheat : dark} />
        </g>
      ))}
      <rect x="-3.4" y="7.5" width="6.8" height="2.2" rx="1" fill={band} />
    </g>
  );
}

export function SheepGlyph({ x, y, scale = 1 }) {
  const light = "#faf6e8";
  const mid = "#eee4c6";
  const dark = "#4a4238";
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="8.5" rx="9" ry="1.6" fill="#000" opacity="0.18" />
      <rect x="-4.5" y="5" width="2" height="4" fill={dark} />
      <rect x="3" y="5" width="2" height="4" fill={dark} />
      <circle cx="-4.5" cy="1.5" r="5.4" fill={mid} />
      <circle cx="4.5" cy="1.5" r="5.4" fill={mid} />
      <circle cx="0" cy="-3.5" r="5.6" fill={light} />
      <circle cx="-2" cy="0.5" r="2.6" fill={light} />
      <circle cx="7.2" cy="-1.5" r="2.6" fill={dark} />
    </g>
  );
}

export function OreGlyph({ x, y, scale = 1 }) {
  const light = shade(RES_COLOR.ore, 0.3);
  const mid = RES_COLOR.ore;
  const dark = shade(RES_COLOR.ore, -0.3);
  const outline = shade(RES_COLOR.ore, -0.5);
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="8" rx="9.5" ry="1.6" fill="#000" opacity="0.2" />
      <g stroke={outline} strokeWidth={0.6} strokeLinejoin="round">
        <polygon points="0,-10 -8,7 0,7" fill={light} />
        <polygon points="0,-10 8,7 0,7" fill={dark} />
        <polygon points="0,-10 -3,-1 3,-1" fill={mid} />
      </g>
      <polygon points="-2,-6 -0.5,-6 -1.2,-3.5" fill="#fff" opacity="0.7" />
    </g>
  );
}

export function DesertGlyph({ x, y, scale = 1 }) {
  const duneLight = shade(RES_COLOR.desert, 0.15);
  const duneDark = shade(RES_COLOR.desert, -0.2);
  const cactusLight = "#7a9c5e";
  const cactusDark = "#557040";
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="8.5" rx="10" ry="1.6" fill="#000" opacity="0.15" />
      <path d="M-10,6 Q-4,-2 2,4 Q6,7 10,3 L10,9 L-10,9 Z" fill={duneDark} />
      <path d="M-10,6 Q-4,0 2,3 Q6,5 10,2" fill="none" />
      <path d="M-9,4 Q-4,-1 1,2" stroke={duneLight} strokeWidth="1.2" fill="none" opacity="0.6" />
      <g transform="translate(5,-2)">
        <rect x="-1.3" y="-8" width="2.6" height="10" rx="1.3" fill={cactusLight} />
        <rect x="-4.5" y="-4" width="2.2" height="5" rx="1.1" fill={cactusDark} />
        <rect x="2.3" y="-6" width="2.2" height="6" rx="1.1" fill={cactusDark} />
      </g>
    </g>
  );
}

export function AnchorGlyph({ x, y, scale = 1 }) {
  const c = "#5c6a75";
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <circle cx="0" cy="-7.5" r="2" fill="none" stroke={c} strokeWidth="1.4" />
      <line x1="0" y1="-5.5" x2="0" y2="7" stroke={c} strokeWidth="1.4" />
      <line x1="-5.5" y1="-2" x2="5.5" y2="-2" stroke={c} strokeWidth="1.4" />
      <path d="M-6,1 C-6,6 -2.5,8.5 0,9" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M6,1 C6,6 2.5,8.5 0,9" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" />
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

export function ResourceIcon({ resource, size = 18 }) {
  const Glyph = RESOURCE_GLYPHS[resource];
  if (!Glyph) return null;
  return (
    <svg width={size} height={size} viewBox="-12 -13 24 26" style={{ display: "block" }}>
      <Glyph x={0} y={0} scale={1} />
    </svg>
  );
}
