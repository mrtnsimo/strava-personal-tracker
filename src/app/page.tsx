"use client";
import { useEffect, useMemo, useState } from "react";
import D3Bars from "@/components/D3Bars";
import MetricCard from "@/components/MetricCard";
import { Bike, Waves, RefreshCw, Activity, CalendarClock, CalendarRange, CalendarDays, Dumbbell } from "lucide-react";

type StatsResponse = {
  last7: Record<string, number>;
  month: Record<string, number>;
  ytd: Record<string, number>;
};

const SPORT_LABELS: Record<string, string> = {
  Run: "Run",
  Ride: "Bike",
  Swim: "Swim",
};

export default function Home() {
  const [athleteId, setAthleteId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: 'connected'|'degraded'|'disconnected'|'error'; athleteId?: number; name?: string; lastSync?: string | null } | null>(null);

  async function sync(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: athleteId ? Number(athleteId) : undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      const resp = (await r.json()) as { athleteId?: number; lastSync?: string };
      if (resp.athleteId && !athleteId) setAthleteId(String(resp.athleteId));
      if (resp.lastSync) setStatus((s) => (s ? { ...s, lastSync: resp.lastSync! } : s));
      await loadStats();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Sync failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(): Promise<void> {
    if (!athleteId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/stats?athleteId=${athleteId}`);
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as StatsResponse;
      setStats(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load stats";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const [units, setUnits] = useState<'km' | 'mi'>('km');
  const [includeEbikes, setIncludeEbikes] = useState<boolean>(false);
  const toKm = (m: number) => Math.round((m / 1000) * 10) / 10;
  const [activePeriod, setActivePeriod] = useState<'7d' | 'prev_m' | 'mtd' | 'ytd'>('7d');
  const last7 = useMemo(() => [
    { label: 'Run', value: toKm(stats?.last7?.['Run'] ?? 0) },
    { label: 'Bike', value: toKm(stats?.last7?.['Ride'] ?? 0) },
    { label: 'Swim', value: toKm(stats?.last7?.['Swim'] ?? 0) },
  ], [stats]);
  const month = useMemo(() => [
    { label: 'Run', value: toKm(stats?.month?.['Run'] ?? 0) },
    { label: 'Bike', value: toKm(stats?.month?.['Ride'] ?? 0) },
    { label: 'Swim', value: toKm(stats?.month?.['Swim'] ?? 0) },
  ], [stats]);
  const ytd = useMemo(() => [
    { label: 'Run', value: toKm(stats?.ytd?.['Run'] ?? 0) },
    { label: 'Bike', value: toKm(stats?.ytd?.['Ride'] ?? 0) },
    { label: 'Swim', value: toKm(stats?.ytd?.['Swim'] ?? 0) },
  ], [stats]);

  useEffect(() => {
    // attempt auto-load if athleteId persisted
    const saved = localStorage.getItem("athleteId");
    if (saved) setAthleteId(saved);
  }, []);

  useEffect(() => {
    if (athleteId) {
      localStorage.setItem("athleteId", athleteId);
      void loadStats();
    }
  }, [athleteId, loadStats]);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const r = await fetch('/api/strava/status', { cache: 'no-store' });
        const data = await r.json();
        if (data.status === 'connected') {
          setStatus({ state: 'connected', athleteId: data.athleteId, name: data.name, lastSync: data.lastSync ?? null });
          if (!athleteId && data.athleteId) setAthleteId(String(data.athleteId));
        } else if (data.status === 'degraded') {
          setStatus({ state: 'degraded', athleteId: data.athleteId, lastSync: data.lastSync ?? null });
        } else if (data.status === 'disconnected') {
          setStatus({ state: 'disconnected' });
        } else {
          setStatus({ state: 'error' });
        }
      } catch {
        setStatus({ state: 'error' });
      }
    }
    void fetchStatus();
  }, []);

  // Fetch totals for cards according to spec
  const [totals, setTotals] = useState<any | null>(null);
  const prevKeyForCompare = (key: '7d'|'prev_m'|'mtd'|'ytd') => (key === 'mtd' ? 'prev_m' : key === '7d' ? '7d' : key);
  useEffect(() => {
    async function loadTotals() {
      const r = await fetch(`/api/totals?units=${units}&include_ebike=${includeEbikes}`);
      if (r.ok) setTotals(await r.json());
    }
    void loadTotals();
  }, [units, includeEbikes, stats]);

  const authUrl = "/api/strava/auth";
  const palette = {
    primary: '#FF4D00', // fiery orange-red
    primaryDark: '#CC3E00',
    accent: '#FF7A33',
    surface: '#111113',
    card: '#18181b',
    text: '#f5f5f6',
    run: '#ff7043',
    ride: '#ff9f1c',
    swim: '#36a2eb',
  } as const;

  function getPrev() {
    if (!totals) return { run: { distance: 0 }, ride: { distance: 0 }, swim: { distance: 0 }, total_time_s: 0 } as any;
    if (activePeriod === 'mtd') return totals.prev_m;
    if (activePeriod === 'ytd') return totals.prev_m; // simple placeholder; could be previous year-to-date window
    if (activePeriod === 'prev_m') return totals.prev_m; // compare to itself (shows 0)
    return totals['7d'];
  }

  function diffLabel(curr: number, prev: number, minutes = false) {
    const diff = curr - prev;
    const sign = diff >= 0 ? '+' : '';
    const val = minutes ? Math.round(diff) : Math.round(diff * 10) / 10;
    return `${sign}${val}${minutes ? 'm' : (units ?? 'km')}`;
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0b0b0c 0%, #1a1b1e 100%)', color: palette.text }}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: palette.primary }}>
              <Activity className="h-5 w-5 text-white" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold">Strava Personal Tracker</h1>
          </div>
          <div className="flex items-center gap-3">
            {status?.state === 'connected' && (
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#22c55e' }} aria-label="connected" />
                <span className="text-sm opacity-90">{status.name} (ID {status.athleteId})</span>
                <a href={authUrl} className="text-xs underline opacity-70 hover:opacity-100">Re-connect</a>
              </div>
            )}
            {status?.state === 'degraded' && (
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#eab308' }} aria-label="degraded" />
                <span className="text-sm">Athlete {status.athleteId}</span>
                <a href={authUrl} className="text-xs underline opacity-70 hover:opacity-100">Re-connect</a>
              </div>
            )}
            {(!status || status.state === 'disconnected' || status.state === 'error') && (
              <a
                href={authUrl}
                className="inline-flex items-center rounded-md bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-medium"
              >
                Connect Strava
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:flex sm:items-center">
          <div className="text-sm opacity-70">{status?.lastSync ? `Last sync: ${new Date(status.lastSync).toLocaleString()}` : 'Not synced yet'}</div>
          <button
            onClick={sync}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: palette.primary, color: 'white' }}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
            {loading ? "Syncing" : "Sync now"}
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-sm">Units</div>
            <div className="flex rounded-full overflow-hidden border border-white/10">
              {(['km', 'mi'] as const).map((u) => (
                <button key={u} onClick={() => setUnits(u)} className={`px-3 py-1 text-sm ${units === u ? 'bg-white/10' : ''}`}>{u}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeEbikes} onChange={(e) => setIncludeEbikes(e.target.checked)} />
              Include E-bike
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 text-sm" style={{ color: '#fca5a5' }}>{error}</div>
        )}

        {/* Tabs & Cards per spec */}
        <div className="mt-6 flex gap-2">
          {([
            { key: '7d', label: 'Last 7 Days', Icon: CalendarClock },
            { key: 'prev_m', label: 'Last Month', Icon: CalendarRange },
            { key: 'mtd', label: 'This Month', Icon: CalendarRange },
            { key: 'ytd', label: 'YTD', Icon: CalendarDays },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActivePeriod(key)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border border-white/10 ${
                activePeriod === key ? 'bg-white/10' : 'bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Swim */}
          <MetricCard
            title="Swim"
            icon={<Waves className="h-5 w-5 opacity-80" />}
            distance={totals ? totals[activePeriod].swim.distance : 0}
            time_s={totals ? totals[activePeriod].swim.time_s : 0}
            units={units}
            gradient="linear-gradient(180deg, rgba(0,145,255,0.18) 0%, rgba(0,145,255,0.05) 100%)"
            sparkline={totals ? totals[activePeriod].series?.swim ?? [] : []}
            compareSparkline={totals ? (activePeriod === '7d' ? totals['7d_prev']?.series?.swim : activePeriod === 'mtd' ? totals['prev_m']?.series?.swim : activePeriod === 'prev_m' ? totals['prev2_m']?.series?.swim : activePeriod === 'ytd' ? totals['ytd_prev']?.series?.swim : []) : []}
            sparkColor="#36a2eb"
            compareSparkColor="#36a2eb55"
            deltaLabel={totals && activePeriod !== '7d' ? diffLabel(totals[activePeriod].swim.distance, getPrev().swim.distance) : undefined}
            deltaPositive={totals && activePeriod !== '7d' ? totals[activePeriod].swim.distance >= getPrev().swim.distance : undefined}
          />
          {/* Bike */}
          <MetricCard
            title="Bike"
            icon={<Bike className="h-5 w-5 opacity-80" />}
            distance={totals ? totals[activePeriod].ride.distance : 0}
            time_s={totals ? totals[activePeriod].ride.time_s : 0}
            units={units}
            gradient="linear-gradient(180deg, rgba(255,159,28,0.18) 0%, rgba(255,159,28,0.05) 100%)"
            sparkline={totals ? totals[activePeriod].series?.ride ?? [] : []}
            compareSparkline={totals ? (activePeriod === '7d' ? totals['7d_prev']?.series?.ride : activePeriod === 'mtd' ? totals['prev_m']?.series?.ride : activePeriod === 'prev_m' ? totals['prev2_m']?.series?.ride : activePeriod === 'ytd' ? totals['ytd_prev']?.series?.ride : []) : []}
            sparkColor="#ff9f1c"
            compareSparkColor="#ff9f1c55"
            deltaLabel={totals && activePeriod !== '7d' ? diffLabel(totals[activePeriod].ride.distance, getPrev().ride.distance) : undefined}
            deltaPositive={totals && activePeriod !== '7d' ? totals[activePeriod].ride.distance >= getPrev().ride.distance : undefined}
          />
          {/* Run */}
          <MetricCard
            title="Run"
            icon={<Dumbbell className="h-5 w-5 opacity-80" />}
            distance={totals ? totals[activePeriod].run.distance : 0}
            time_s={totals ? totals[activePeriod].run.time_s : 0}
            units={units}
            gradient="linear-gradient(180deg, rgba(0,200,150,0.18) 0%, rgba(0,200,150,0.05) 100%)"
            sparkline={totals ? totals[activePeriod].series?.run ?? [] : []}
            compareSparkline={totals ? (activePeriod === '7d' ? totals['7d_prev']?.series?.run : activePeriod === 'mtd' ? totals['prev_m']?.series?.run : activePeriod === 'prev_m' ? totals['prev2_m']?.series?.run : activePeriod === 'ytd' ? totals['ytd_prev']?.series?.run : []) : []}
            sparkColor="#00c896"
            compareSparkColor="#00c89655"
            deltaLabel={totals && activePeriod !== '7d' ? diffLabel(totals[activePeriod].run.distance, getPrev().run.distance) : undefined}
            deltaPositive={totals && activePeriod !== '7d' ? totals[activePeriod].run.distance >= getPrev().run.distance : undefined}
          />
          {/* Total Time */}
          <MetricCard
            title="Total Time"
            icon={<Activity className="h-5 w-5 opacity-80" />}
            time_s={totals ? totals[activePeriod].total_time_s : 0}
            units={units}
            gradient="linear-gradient(180deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.05) 100%)"
            caption="Sum of Swim, Bike, Run"
            sparkline={totals ? totals[activePeriod].series?.totalMin ?? [] : []}
            compareSparkline={totals ? (activePeriod === '7d' ? totals['7d_prev']?.series?.totalMin : activePeriod === 'mtd' ? totals['prev_m']?.series?.totalMin : activePeriod === 'prev_m' ? totals['prev2_m']?.series?.totalMin : activePeriod === 'ytd' ? totals['ytd_prev']?.series?.totalMin : []) : []}
            sparkColor="#8b5cf6"
            compareSparkColor="#8b5cf655"
            deltaLabel={totals && activePeriod !== '7d' ? diffLabel(totals[activePeriod].total_time_s/60, getPrev().total_time_s/60, true) : undefined}
            deltaPositive={totals && activePeriod !== '7d' ? totals[activePeriod].total_time_s >= getPrev().total_time_s : undefined}
          />
        </div>
      </div>
    </div>
  );
}
