// "Pidge", the app's mascot: a New York pigeon with the classic green-purple neck sheen.
export function Pigeon({
  size = 120,
  flapping = false,
  bobbing = true,
  className = "",
}: {
  size?: number;
  flapping?: boolean;
  bobbing?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Pidge the pigeon"
      className={`${bobbing ? "animate-bob" : ""} ${className}`}
    >
      <defs>
        <linearGradient id="pidge-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00933C" />
          <stop offset="1" stopColor="#0039A6" />
        </linearGradient>
      </defs>

      <ellipse cx="104" cy="186" rx="52" ry="7" fill="#000" opacity="0.1" />

      <path d="M148 118 L196 104 L190 142 L150 142 Z" fill="#6f7b90" />

      <g stroke="#FF6319" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M86 150 L86 174 M86 174 L73 177 M86 174 L99 177" />
        <path d="M118 150 L118 174 M118 174 L105 177 M118 174 L131 177" />
      </g>

      <ellipse cx="108" cy="115" rx="57" ry="42" fill="#98a3b5" />
      <ellipse cx="96" cy="128" rx="38" ry="26" fill="#c3cbd9" />

      <g
        className={flapping ? "animate-flap" : undefined}
        style={{ transformOrigin: "132px 100px" }}
      >
        <path
          d="M92 96 C122 78 164 96 168 128 C142 144 102 134 92 96 Z"
          fill="#6f7b90"
        />
        <path
          d="M110 110 C130 104 148 112 156 126"
          stroke="#56627a"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      <ellipse cx="70" cy="92" rx="27" ry="21" fill="url(#pidge-sheen)" opacity="0.92" />
      <circle cx="56" cy="66" r="30" fill="#98a3b5" />

      <path d="M29 61 L8 70 L29 79 Z" fill="#FCCC0A" />
      <path d="M29 70 L12 70" stroke="#d4a800" strokeWidth="2" strokeLinecap="round" />

      <g
        className="animate-blink"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <circle cx="47" cy="58" r="9" fill="#fff" />
        <circle cx="45" cy="58.5" r="5" fill="#172033" />
        <circle cx="43.3" cy="56.3" r="1.9" fill="#fff" />
      </g>

      <circle cx="63" cy="77" r="5" fill="#ff8aa1" opacity="0.55" />
    </svg>
  );
}
