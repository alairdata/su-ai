import React from "react";

export const BoltLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
    <defs>
      <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E8A04C" />
        <stop offset="100%" stopColor="#E8624C" />
      </linearGradient>
    </defs>
    <path d="M35 4L12 34h14l-4 22L48 26H34l4-22z" fill="url(#boltGrad)" />
  </svg>
);
