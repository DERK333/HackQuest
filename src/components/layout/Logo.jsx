import React from 'react';

// Inline SVG logo mark for HackQuest — no static asset dependency, always
// renders crisply on both root-domain and /HackQuest deployments.
export default function Logo({ className = 'h-9 w-auto' }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 48 48" className="h-8 w-8 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="hq-shield" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(84 80% 56%)" />
            <stop offset="100%" stopColor="hsl(150 65% 40%)" />
          </linearGradient>
        </defs>
        <path
          d="M24 3l17 6v11c0 11.2-7.2 19.7-17 25C14.2 39.7 7 31.2 7 20V9l17-6z"
          fill="url(#hq-shield)"
          stroke="hsl(150 65% 30%)"
          strokeWidth="1.5"
        />
        {/* circuit nodes */}
        <circle cx="24" cy="15" r="2.4" fill="#06281a" />
        <circle cx="15" cy="24" r="2.1" fill="#06281a" />
        <circle cx="33" cy="24" r="2.1" fill="#06281a" />
        <circle cx="24" cy="33" r="2.4" fill="#06281a" />
        <path d="M24 17.4v15.2M26.4 24h6.6M15 24h6.6" stroke="#06281a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* lightning bolt core */}
        <path d="M25.6 19l-4.6 6.2h3.1l-2 4.8 5-6.4h-3.2z" fill="#eafff0" stroke="#06281a" strokeWidth="0.6" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-extrabold tracking-tight text-foreground leading-none">
        Hack<span className="text-primary">Quest</span>
      </span>
    </span>
  );
}