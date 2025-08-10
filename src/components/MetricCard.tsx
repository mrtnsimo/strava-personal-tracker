"use client";
import { ReactNode } from 'react';
import Sparkline from './Sparkline';

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function MetricCard({
  title,
  icon,
  distance,
  time_s,
  units,
  gradient,
  caption,
  sparkline,
  compareSparkline,
  sparkColor,
  compareSparkColor,
  deltaLabel,
  deltaPositive,
}: {
  title: string;
  icon: ReactNode;
  distance?: number;
  time_s: number;
  units: 'km' | 'mi';
  gradient: string;
  caption?: string;
  sparkline?: number[];
  compareSparkline?: number[];
  sparkColor?: string;
  compareSparkColor?: string;
  deltaLabel?: string;
  deltaPositive?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 shadow-lg transition-[transform,opacity] duration-300" style={{ background: gradient, border: '1px solid rgba(255,255,255,0.07)', color: 'inherit' }}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div className="text-sm opacity-80">{title}</div>
        {deltaLabel && (
          <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full ${deltaPositive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{deltaLabel}</span>
        )}
      </div>
      {typeof distance === 'number' && (
        <div className="text-3xl font-semibold tracking-tight">
          {distance}
          <span className="text-base ml-1 opacity-80">{units}</span>
        </div>
      )}
      <div className="mt-1 text-sm opacity-80">{formatTime(time_s)}</div>
      {caption && <div className="mt-2 text-xs opacity-70">{caption}</div>}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3">
          <Sparkline values={sparkline} color={sparkColor} compareValues={compareSparkline} compareColor={compareSparkColor} />
        </div>
      )}
    </div>
  );
}


