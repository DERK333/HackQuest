import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, Loader2 } from 'lucide-react';

// AI knowledge base: answers questions from credible web sources (Gemini + Google
// Search), using the analyst's own notes as context — not as the sole source.
export default function NotesAIAssistant() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const { data: notes = [] } = useQuery({
    queryKey: ['attack-notes'],
    queryFn: () => base44.entities.AttackNote.list('-created_date', 200),
  });

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    try {
      const noteContext = notes.length
        ? notes
            .map(
              (n) =>
                `### ${n.title}\nScenario: ${n.scenario_name || '-'} | Severity: ${n.severity || '-'} | Tags: ${(n.tags || []).join(',')}\n${n.content}`
            )
            .join('\n\n---\n\n')
        : '(no notes saved yet)';

      const res = await base44.integrations.Core.InvokeLLM({
        // gemini_3_flash supports add_context_from_internet (Google Search) so
        // answers are sourced from credible, up-to-date public sources.
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        prompt:
          `You are an expert cybersecurity analyst assistant. Answer the analyst's question using credible, ` +
          `up-to-date sources from the web (vendor advisories, CVE/NVD, MITRE ATT&CK, OWASP, official docs, ` +
          `reputable security blogs). Always cite the source name and URL for every claim.\n\n` +
          `The analyst's own findings (for context, NOT the only source):\n${noteContext}\n\n` +
          `QUESTION: ${question.trim()}\n\n` +
          `Format: a concise answer, then a "Sources:" list with bullet points (title — url). ` +
          `If the web has nothing credible, say so explicitly.`,
      });

      const ans = typeof res === 'string' ? res : res?.response || JSON.stringify(res);
      setAnswer(ans);
      setHistory((h) => [{ q: question.trim(), a: ans }, ...h].slice(0, 5));
      setQuestion('');
    } catch (e) {
      setAnswer('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="w-4 h-4" /> AI Knowledge Base
        <span className="text-xs font-normal text-muted-foreground">· {notes.length} notes as context</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Ask anything — answers are sourced from credible web sources (CVE/NVD, MITRE, vendor advisories, OWASP) and grounded with your notes as context.
      </p>
      <div className="flex gap-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which attack scenarios breached the firewall?"
          rows={2}
          className="resize-none bg-card"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask();
          }}
        />
        <Button
          onClick={ask}
          disabled={loading || !question.trim()}
          size="icon"
          className="h-9 w-9 self-end"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Searching credible sources…
        </div>
      )}
      {answer && !loading && (
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-3 text-sm text-foreground whitespace-pre-wrap">
          {answer}
        </div>
      )}
      {history.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Recent questions</p>
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => setQuestion(h.q)}
              className="block w-full text-left text-xs text-muted-foreground hover:text-foreground truncate"
            >
              ↳ {h.q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}