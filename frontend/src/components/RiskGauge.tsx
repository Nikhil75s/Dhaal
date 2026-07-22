import { useMemo } from 'react';

/**
 * RiskGauge — Semi-circle SVG gauge for predictive risk scores.
 * Color-coded aggressively per the spec:
 *   Green (0–40) → Yellow (40–60) → Orange (60–80) → Red (80–100)
 * Features animated arc fill, glow effect on high scores, and severity label.
 */

interface RiskGaugeProps {
  /** Risk score 0–100 */
  score: number;
  /** Optional label below the score */
  label?: string;
  /** Size in px (width = size, height ≈ size * 0.65) */
  size?: number;
}

// ── Color bands ──
function getScoreColor(score: number): string {
  if (score >= 80) return '#EF4444'; // critical red
  if (score >= 60) return '#F97316'; // orange
  if (score >= 40) return '#F59E0B'; // warning yellow
  return '#10B981';                  // clear green
}

function getSeverityLabel(score: number): string {
  if (score >= 90) return 'CRITICAL';
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  if (score >= 25) return 'LOW';
  return 'MINIMAL';
}

export default function RiskGauge({ score, label, size = 220 }: RiskGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = getScoreColor(clampedScore);
  const severity = getSeverityLabel(clampedScore);

  // Arc geometry: semi-circle from 180° to 0° (left to right)
  const cx = size / 2;
  const cy = size * 0.52;
  const radius = size * 0.38;
  const strokeWidth = size * 0.08;

  // Arc path computation
  const { bgPath, fillPath } = useMemo(() => {
    const startAngle = Math.PI;     // 180° (left)
    const endAngle = 0;             // 0° (right)
    const sweepAngle = startAngle - endAngle; // π

    // Background arc (full semi-circle)
    const bgStartX = cx + radius * Math.cos(startAngle);
    const bgStartY = cy - radius * Math.sin(startAngle);
    const bgEndX = cx + radius * Math.cos(endAngle);
    const bgEndY = cy - radius * Math.sin(endAngle);
    const bg = `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 0 1 ${bgEndX} ${bgEndY}`;

    // Fill arc (proportional to score)
    const fillAngle = startAngle - (clampedScore / 100) * sweepAngle;
    const fillEndX = cx + radius * Math.cos(fillAngle);
    const fillEndY = cy - radius * Math.sin(fillAngle);
    const largeArc = clampedScore > 50 ? 1 : 0;
    const fill = `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 ${largeArc} 1 ${fillEndX} ${fillEndY}`;

    return { bgPath: bg, fillPath: fill };
  }, [cx, cy, radius, clampedScore]);

  const isHighRisk = clampedScore >= 70;

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg
        width={size}
        height={size * 0.6}
        viewBox={`0 0 ${size} ${size * 0.6}`}
        className="overflow-visible"
      >
        {/* Glow filter for high-risk scores */}
        <defs>
          <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient for the arc */}
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="40%" stopColor="#F59E0B" />
            <stop offset="70%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>

        {/* Background arc (track) */}
        <path
          d={bgPath}
          fill="none"
          stroke="#1F2937"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored fill arc */}
        <path
          d={fillPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter={isHighRisk ? 'url(#gauge-glow)' : undefined}
          style={{
            transition: 'stroke 0.5s ease, d 0.8s ease',
          }}
        />

        {/* Tick marks at 0, 25, 50, 75, 100 */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = Math.PI - (tick / 100) * Math.PI;
          const innerR = radius - strokeWidth / 2 - 4;
          const outerR = radius - strokeWidth / 2 - 10;
          const x1 = cx + innerR * Math.cos(angle);
          const y1 = cy - innerR * Math.sin(angle);
          const x2 = cx + outerR * Math.cos(angle);
          const y2 = cy - outerR * Math.sin(angle);
          const labelR = outerR - 10;
          const lx = cx + labelR * Math.cos(angle);
          const ly = cy - labelR * Math.sin(angle);
          return (
            <g key={tick}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#374151"
                strokeWidth={1.5}
              />
              <text
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#6B7280"
                fontSize={size * 0.045}
                fontFamily="Inter, sans-serif"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Score number */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={size * 0.2}
          fontWeight="700"
          fontFamily="Inter, sans-serif"
          style={{ transition: 'fill 0.5s ease' }}
        >
          {clampedScore}
        </text>

        {/* Severity badge */}
        <text
          x={cx}
          y={cy + size * 0.1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={size * 0.055}
          fontWeight="600"
          fontFamily="Inter, sans-serif"
          letterSpacing="2"
          opacity="0.85"
        >
          {severity}
        </text>
      </svg>

      {/* Label */}
      {label && (
        <p className="text-xs text-text-secondary mt-1 text-center">{label}</p>
      )}
    </div>
  );
}
