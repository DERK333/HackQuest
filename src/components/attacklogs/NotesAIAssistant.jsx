import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, Loader2 } from 'lucide-react';

// AI knowledge base: answers questions grounded ONLY in the user's saved notes.
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
    if (!question.trim() || notes.length === 0) return;
    setLoading(true);
    setAnswer('');
    try {
      const context = notes
        .map(
          (n) =>
            `### ${n.title}\nScenario: ${n.scenario_name || '-'} | Severity: ${n.severity || '-'} | Tags: ${(n.tags || []).join(',')}\n${n.content}`
        )
        .join('\n\n---\n\n');

      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          `You are a security knowledge-base assistant for an analyst. Answer the question using ONLY the analyst's notes below. ` +
          `Cite which note title(s) you used. If the answer is not contained in the notes, say "Not found in notes".\n\n` +
          `NOTES:\n${context}\n\nQUESTION: ${question.trim()}`,
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
        <span className="text-xs font-normal text-muted-foreground">· {notes.length} notes indexed</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Ask questions about your findings — answers are grounded in your saved notes only.
      </p>
      {notes.length === 0 && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Save at least one note to enable the knowledge base.
        </div>
      )}
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
          disabled={loading || !question.trim() || notes.length === 0}
          size="icon"
          className="h-9 w-9 self-end"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Querying your knowledge base…
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