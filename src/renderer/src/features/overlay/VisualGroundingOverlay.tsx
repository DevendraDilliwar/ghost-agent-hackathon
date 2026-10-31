import { useState } from 'react';
import { Eye, EyeOff, Crosshair, Tag } from 'lucide-react';
import type { GroundedElement } from '../../../../shared/contracts/grounding';

interface VisualGroundingOverlayProps {
  screenshot: string | null;
  elements?: GroundedElement[] | undefined;
  targetCoordinates?: { x: number; y: number } | null | undefined;
  actionType?: string | null | undefined;
}

export function VisualGroundingOverlay({
  screenshot,
  elements = [],
  targetCoordinates,
  actionType,
}: VisualGroundingOverlayProps) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [selectedTag, setSelectedTag] = useState<number | null>(null);

  if (!screenshot) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-slate-500">
        <Eye className="mb-2 h-8 w-8 opacity-30" />
        <span className="text-xs">No desktop screenshot captured yet.</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl">
      {/* Top Overlay Controls Bar */}
      <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0e1424] px-2.5 py-1.5">
        <span className="flex items-center gap-1 text-[11px] font-mono text-sky-300">
          <Tag className="h-3 w-3 text-sky-400" />
          <span>{elements.length} Grounded UI Tags</span>
        </span>
        <button
          type="button"
          onClick={() => setShowBoxes(!showBoxes)}
          className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          {showBoxes ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          <span>{showBoxes ? 'Hide Bounding Boxes' : 'Show Boxes'}</span>
        </button>
      </div>

      {/* Screen Frame Container */}
      <div className="relative max-h-[460px] w-full overflow-auto bg-black">
        <img
          src={screenshot}
          alt="Desktop observation"
          className="w-full object-contain select-none"
        />

        {/* Grounded Bounding Boxes SVG Overlay */}
        {showBoxes && elements.length > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none h-full w-full"
            viewBox="0 0 1920 1080"
            preserveAspectRatio="none"
          >
            {elements.map(el => {
              const isSelected = selectedTag === el.id;
              const color =
                el.type === 'button'
                  ? '#38bdf8' // Sky
                  : el.type === 'input'
                  ? '#818cf8' // Indigo
                  : el.type === 'table'
                  ? '#34d399' // Emerald
                  : '#c084fc'; // Purple

              return (
                <g
                  key={el.id}
                  onClick={() => setSelectedTag(prev => prev === el.id ? null : el.id)}
                  className="pointer-events-auto cursor-pointer transition-all duration-150"
                >
                  {/* Bounding Box Rect */}
                  <rect
                    x={el.bounds.x}
                    y={el.bounds.y}
                    width={el.bounds.width}
                    height={el.bounds.height}
                    fill={isSelected ? `${color}44` : `${color}18`}
                    stroke={color}
                    strokeWidth={isSelected ? '3' : '1.5'}
                    strokeDasharray={el.type === 'interactive' ? '4 2' : 'none'}
                    rx="4"
                  />

                  {/* Numbered Tag Badge */}
                  <rect
                    x={el.bounds.x}
                    y={Math.max(0, el.bounds.y - 18)}
                    width={el.label ? String(el.id).length * 8 + 36 : 24}
                    height="18"
                    fill={color}
                    rx="3"
                  />
                  <text
                    x={el.bounds.x + 3}
                    y={Math.max(12, el.bounds.y - 5)}
                    fill="#020617"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    #{el.id} {el.type.slice(0, 3).toUpperCase()}
                  </text>

                  {/* Center Crosshair Dot */}
                  <circle
                    cx={el.center.x}
                    cy={el.center.y}
                    r="3"
                    fill={color}
                  />
                </g>
              );
            })}

            {/* Target Reticle if an action is pending or executed */}
            {targetCoordinates && (
              <g className="animate-pulse">
                <circle
                  cx={targetCoordinates.x}
                  cy={targetCoordinates.y}
                  r="14"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                />
                <circle
                  cx={targetCoordinates.x}
                  cy={targetCoordinates.y}
                  r="4"
                  fill="#f43f5e"
                />
                <line
                  x1={targetCoordinates.x - 20}
                  y1={targetCoordinates.y}
                  x2={targetCoordinates.x + 20}
                  y2={targetCoordinates.y}
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                />
                <line
                  x1={targetCoordinates.x}
                  y1={targetCoordinates.y - 20}
                  x2={targetCoordinates.x}
                  y2={targetCoordinates.y + 20}
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                />
                <text
                  x={targetCoordinates.x + 18}
                  y={targetCoordinates.y - 10}
                  fill="#f43f5e"
                  fontSize="12"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {actionType ? `${actionType.toUpperCase()} TARGET` : 'TARGET'} ({targetCoordinates.x}, {targetCoordinates.y})
                </text>
              </g>
            )}
          </svg>
        )}
      </div>

      {/* Footer Info Strip */}
      <div className="flex items-center justify-between border-t border-white/5 bg-slate-950/90 px-4 py-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-slate-300">
          <Crosshair className="h-3.5 w-3.5 text-sky-400" />
          <span>
            {selectedTag
              ? `Selected Tag #${selectedTag}: ${elements.find(e => e.id === selectedTag)?.label ?? 'Interactive element'}`
              : elements.length > 0
                ? 'Grounded tags active (Click any box to inspect)'
                : 'No grounded tags - acting on model coordinates'}
          </span>
        </span>
        {targetCoordinates && (
          <span className="font-mono text-rose-300">
            Target: ({targetCoordinates.x}, {targetCoordinates.y})
          </span>
        )}
      </div>
    </div>
  );
}
