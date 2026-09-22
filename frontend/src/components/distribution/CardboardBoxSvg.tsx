export default function CardboardBoxSvg({
  width = 96,
  height = 80,
  style,
}: {
  width?: number | string
  height?: number | string
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 160 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Soft drop shadow */}
      <ellipse cx="80" cy="124" rx="66" ry="12" fill="rgba(0, 0, 0, 0.18)" />

      {/* Main box group */}
      <g>
        {/* Left / Front-Left Face */}
        <polygon
          points="20,54 80,82 80,122 20,94"
          fill="#C89762"
          stroke="#9E6B3A"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Right / Front-Right Face (darker shade) */}
        <polygon
          points="80,82 140,54 140,94 80,122"
          fill="#A87443"
          stroke="#7D5126"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Top-Left Flap / Face */}
        <polygon
          points="80,18 20,54 80,82 140,54"
          fill="#DEAA76"
          stroke="#9E6B3A"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Center Crease / Seam on Top */}
        <line
          x1="80"
          y1="18"
          x2="80"
          y2="82"
          stroke="#8C5C2E"
          strokeWidth="1.8"
          strokeDasharray="2 1"
        />

        {/* Packaging Tape (running horizontally across top seam) */}
        <polygon
          points="46,38 74,24 86,30 58,44"
          fill="#BA864E"
          opacity="0.85"
        />
        <polygon
          points="74,56 102,42 114,48 86,62"
          fill="#BA864E"
          opacity="0.85"
        />
        {/* Longitudinal Tape */}
        <polygon
          points="74,21 86,26 86,79 74,74"
          fill="#BF8F58"
          opacity="0.9"
        />

        {/* Vertical center edge highlight between front-left and front-right */}
        <line
          x1="80"
          y1="82"
          x2="80"
          y2="122"
          stroke="#5E3816"
          strokeWidth="1.5"
        />

        {/* Box side markings (Fragile / Arrows / Barcode symbols) on right face */}
        {/* Fragile glass or arrows symbol */}
        <g opacity="0.45" stroke="#4A2609" strokeWidth="1.4" fill="none">
          {/* Arrow 1 */}
          <line x1="112" y1="84" x2="112" y2="72" />
          <polyline points="109,75 112,71 115,75" />
          {/* Arrow 2 */}
          <line x1="120" y1="80" x2="120" y2="68" />
          <polyline points="117,71 120,67 123,71" />
          {/* Mini barcode lines */}
          <line x1="108" y1="92" x2="126" y2="83" strokeWidth="1" strokeDasharray="2 1.5 1 2" />
        </g>

        {/* Left face subtle tape overlap */}
        <polygon
          points="74,74 80,77 80,90 74,87"
          fill="#9E6F3A"
          opacity="0.6"
        />
      </g>
    </svg>
  )
}

