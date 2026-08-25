import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Globe, RefreshCw, CheckCircle2, XCircle, AlertCircle, ExternalLink, Loader2, HelpCircle, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

function VerdictBadge({ verdict }) {
  const config = {
    PASS: { icon: CheckCircle2, label: 'Indexed', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    FAIL: { icon: XCircle, label: 'Excluded', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
    NEUTRAL: { icon: HelpCircle, label: 'Not Indexed', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    NOT_CHECKED: { icon: AlertCircle, label: 'Not Checked', className: 'bg-muted text-muted-foreground border-border' },
  };
  const c = config[verdict] || config.NOT_CHECKED;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${c.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {c.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function IndexingMonitor() {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [siteUrl, setSiteUrl] = useState('https://hack-quest.com/');
  const [urlPrefix, setUrlPrefix] = useState('https://hack-quest.com/HackQuest/PathDetail?id=');

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ['indexing-statuses'],
    queryFn: () => base44.entities.IndexingStatus.list('-checked_date', 200),
  });

  const runCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const response = await base44.functions.invoke('monitorCourseIndexing', { siteUrl, urlPrefix });
      setCheckResult(response.data);
      queryClient.invalidateQueries({ queryKey: ['indexing-statuses'] });
    } catch (err) {
      setCheckResult({ error: err.message });
    } finally {
      setChecking(false);
    }
  };

  const stats = {
    total: statuses.length,
    indexed: statuses.filter(s => s.verdict === 'PASS').length,
    failed: statuses.filter(s => s.verdict === 'FAIL').length,
    neutral: statuses.filter(s => s.verdict === 'NEUTRAL' || (!s.verdict && !s.error_message)).length,
    errors: statuses.filter(s => s.error_message).length,
  };

  const lastChecked = statuses.length > 0 ? statuses[0].checked_date : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/Dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" /> SEO Indexing Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track Google Search Console indexing status for all course pages
            {lastChecked && <span className="ml-2">· Last checked: {lastChecked}</span>}
          </p>
        </div>
        <Button onClick={runCheck} disabled={checking} className="gap-2 shrink-0">
          {checking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Run Check Now
            </>
          )}
        </Button>
      </div>

      {/* Settings panel */}
      <div className={`${showSettings ? 'block' : 'hidden lg:block'} space-y-3 p-4 rounded-xl border border-border bg-card`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Settings className="w-4 h-4" />
            GSC Configuration
          </div>
          <button
            onClick={() => setShowSettings(s => !s)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Match these to your Google Search Console property. Domain properties use <code className="text-primary">sc-domain:hack-quest.com</code>.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Site URL (GSC property)</label>
            <input
              type="text"
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/40"
              placeholder="https://hack-quest.com/ or sc-domain:hack-quest.com"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Course Page URL Prefix</label>
            <input
              type="text"
              value={urlPrefix}
              onChange={e => setUrlPrefix(e.target.value)}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/40"
              placeholder="https://hack-quest.com/HackQuest/PathDetail?id="
            />
          </div>
        </div>
      </div>

      {checkResult && (
        <div className={`p-4 rounded-xl border text-sm ${checkResult.error ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-primary/10 border-primary/30 text-foreground'}`}>
          {checkResult.error ? (
            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {checkResult.error}</span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Checked {checkResult.total} pages — {checkResult.indexed} indexed, {checkResult.failed} excluded, {checkResult.neutral} not indexed, {checkResult.errors} errors
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Globe} label="Total Pages" value={stats.total} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Indexed" value={stats.indexed} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={XCircle} label="Excluded" value={stats.failed} color="bg-red-500/10 text-red-400" />
        <StatCard icon={HelpCircle} label="Not Indexed" value={stats.neutral} color="bg-amber-500/10 text-amber-400" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : statuses.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Globe className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">No indexing data yet. Click "Run Check Now" to inspect all course pages.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Course</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Coverage State</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Last Crawl</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Checked</th>
                  <th className="text-left px-4 py-3 font-medium">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statuses.map(s => (
                  <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                      {s.path_title || s.path_id}
                    </td>
                    <td className="px-4 py-3">
                      <VerdictBadge verdict={s.verdict} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                      {s.coverage_state || (s.error_message ? <span className="text-destructive">{s.error_message}</span> : '—')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {s.last_crawl_time ? new Date(s.last_crawl_time).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {s.checked_date || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}