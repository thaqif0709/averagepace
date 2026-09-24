export default function RunningLoader({ label = 'Loading…' }) {
  return (
    <div className="running-loader" role="status" aria-live="polite">
      <svg
        className="running-loader-figure"
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <g className="runner-bob">
          <circle cx="36" cy="10" r="6" />
          <line x1="34" y1="16" x2="28" y2="36" />
          <g className="runner-arm-back">
            <line x1="33" y1="18" x2="24" y2="26" />
          </g>
          <g className="runner-arm-front">
            <line x1="33" y1="18" x2="44" y2="12" />
          </g>
          <g className="runner-leg-back">
            <polyline points="28,36 20,46 24,56" />
          </g>
          <g className="runner-leg-front">
            <polyline points="28,36 36,44 32,54" />
          </g>
        </g>
      </svg>
      {label && <p className="running-loader-label">{label}</p>}
    </div>
  )
}
