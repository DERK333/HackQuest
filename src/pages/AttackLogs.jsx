import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Shield, AlertTriangle, Flame, CheckCircle2, XCircle, Clock, Filter, RefreshCw, Activity, StickyNote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MobileSelect } from '@/components/ui/MobileSelect';
import AttackNotesSidebar from '@/components/attacklogs/AttackNotesSidebar';
import { format } from 'date-fns';

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', cls: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
  high:     { label: 'High',     cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
  medium:   { label: 'Medium',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  low:      { label: 'Low',      cls: 'bg-primary/10 text-primary border-primary/20', dot: 'bg-primary' },
};

const SEVERITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_CONFIG = {
  success: { label: 'Breached',  icon: XCircle,      cls: 'bg-destructive/10 text-destructive border-destructive/25' },
  blocked: { label: 'Blocked',   icon: CheckCircle2, cls: 'bg-primary/10 text-primary border-primary/20' },
  partial: { label: 'Partial',   icon: AlertTriangle,cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'success', label: 'Breached' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'partial', label: 'Partial' },
];

const DATE_OPTIONS = [
  { value: 'all',   label: 'All Time' },
  { value: '1',     label: 'Last 24h' },
  { value: '7',     label: 'Last 7 days' },
  { value: '30',    label: 'Last 30 days' },
];

function StatCard({ icon: Icon, label, value, colorCls }) {
  return (
    <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorCls}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-black text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function LogRow({ log, onNote }) {
  const sev = SEVERITY_CONFIG[log.scenario_severity] || SEVERITY_CONFIG.medium;
  const st  = STATUS_CONFIG[log.status] || STATUS_CONFIG.partial;
  const StatusIcon = st.icon;

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-3 border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors text-sm">
      {/* Source / attack type */}
      <div className="min-w-0">
        <p className="text-foreground font-semibold truncate flex items-center gap-1.5">
          <span>{log.scenario_icon || '⚡'}</span>
          <span className="truncate">{log.scenario_name}</span>
        </p>
        <p className="text-xs text-muted-foreground font-mono truncate">{log.scenario_category || '—'}</p>
      </div>

      {/* Target */}
      <div className="min-w-0">
        <p className="text-foreground truncate">{log.target_name || '—'}</p>
        <p className="text-xs text-muted-foreground font-mono">{log.target_ip || '—'}</p>
      </div>

      {/* OS */}
      <div className="min-w-0 hidden md:block">
        <p className="text-xs text-muted-foreground truncate">{log.target_os || '—'}</p>
        <p className="text-[10px] text-muted-foreground/60 font-mono">
          {log.connections_attempted || 0} attempts · {log.blocked_count || 0} blocked
        </p>
      </div>

      {/* Severity */}
      <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${sev.cls}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1 ${sev.dot}`} />
        {sev.label}
      </Badge>

      {/* Status + time */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge variant="outline" className={`text-[10px] font-bold flex items-center gap-1 ${st.cls}`}>
          <StatusIcon className="w-3 h-3" />
          {st.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : '—'}
        </span>
      </div>

      {/* Quick note for this incident */}
      <button
        onClick={() => onNote?.(log)}
        title="Save a note for this incident"
        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
      >
        <StickyNote className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function AttackLogs() {
  const queryClient = useQueryClient();
  const [severity, setSeverity] = useState('all');
  const [status,   setStatus]   = useState('all');
  const [days,     setDays]     = useState('all');
  const [live,     setLive]     = useState(true);
  const [sort,     setSort]     = useState('newest');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notePresetLog, setNotePresetLog] = useState(null);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['attack-logs'] });
  }, [queryClient]);

  const { containerRef, pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(handleRefresh);

  const { data: logs = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['attack-logs'],
    queryFn: () => base44.entities.AttackLog.list('-created_date', 200),
    refetchInterval: live ? 5000 : false,
  });

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.AttackLog.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['attack-logs'] });
    });
    return unsub;
  }, [queryClient]);

  // Filter + sort
  const filtered = logs.filter(log => {
    if (severity !== 'all' && log.scenario_severity !== severity) return false;
    if (status !== 'all' && log.status !== status) return false;
    if (days !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(days));
      if (new Date(log.created_date) < cutoff) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sort === 'severity') {
      const rankDiff = (SEVERITY_RANK[a.scenario_severity] ?? 99) - (SEVERITY_RANK[b.scenario_severity] ?? 99);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.created_date) - new Date(a.created_date);
    }
    return new Date(b.created_date) - new Date(a.created_date);
  });

  // Stats
  const total    = filtered.length;
  const blocked  = filtered.filter(l => l.status === 'blocked').length;
  const breached = filtered.filter(l => l.status === 'success').length;
  const critical = filtered.filter(l => l.scenario_severity === 'critical').length;

  return (
    <div
      ref={containerRef}
      className="space-y-6 max-w-6xl mx-auto overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center text-primary transition-all"
          style={{ height: refreshing ? 48 : pullDistance, overflow: 'hidden' }}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} style={{ opacity: Math.min(pullDistance / 72, 1) }} />
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Attack Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time security incident feed</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setNotePresetLog(null); setNotesOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors text-xs font-semibold"
          >
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </button>
          <button
            onClick={() => setLive(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              live ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary border-border text-muted-foreground'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${live ? 'animate-pulse' : ''}`} />
            {live ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['attack-logs'] })}
            className="p-2 rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Flame}        label="Total Incidents" value={total}    colorCls="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Blocked"         value={blocked}  colorCls="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={XCircle}      label="Breached"        value={breached} colorCls="bg-destructive/10 text-destructive" />
        <StatCard icon={AlertTriangle}label="Critical"        value={critical} colorCls="bg-red-500/10 text-red-400" />
      </div>

      {/* Quick severity filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { value: 'all', label: 'All', cls: 'bg-primary/10 text-primary border-primary/20', dot: 'bg-primary' },
          { value: 'critical', label: 'Critical', cls: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
          { value: 'high', label: 'High', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
          { value: 'medium', label: 'Medium', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
        ].map(opt => {
          const active = severity === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setSeverity(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                active ? `${opt.cls} shadow-sm` : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? opt.dot : 'bg-muted-foreground/40'}`} />
              {opt.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1 bg-secondary border border-border rounded-lg p-0.5">
          <button
            onClick={() => setSort('newest')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${sort === 'newest' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Newest
          </button>
          <button
            onClick={() => setSort('severity')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${sort === 'severity' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Severity
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <MobileSelect value={severity} onValueChange={setSeverity} placeholder="Severity" options={SEVERITY_OPTIONS} triggerClassName="w-40 bg-secondary border-border text-sm" />
        <MobileSelect value={status}   onValueChange={setStatus}   placeholder="Status"   options={STATUS_OPTIONS}   triggerClassName="w-40 bg-secondary border-border text-sm" />
        <MobileSelect value={days}     onValueChange={setDays}     placeholder="Date"     options={DATE_OPTIONS}     triggerClassName="w-40 bg-secondary border-border text-sm" />
        {dataUpdatedAt > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Updated {format(new Date(dataUpdatedAt), 'HH:mm:ss')}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-border bg-secondary/30">
          {['Attack / Type', 'Target', 'OS / Stats', 'Severity', 'Status', ''].map((h, i) => (
            <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${i === 2 ? 'hidden md:block' : ''}`}>{h}</span>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No incidents found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Run an attack simulation to generate logs</p>
          </div>
        ) : (
          <div>
            {filtered.map(log => <LogRow key={log.id} log={log} onNote={(l) => { setNotePresetLog(l); setNotesOpen(true); }} />)}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Showing {filtered.length} of {logs.length} total incidents
      </p>

      <AttackNotesSidebar
        open={notesOpen}
        onOpenChange={setNotesOpen}
        logs={logs}
        presetLogId={notePresetLog?.id}
      />
    </div>
  );
}