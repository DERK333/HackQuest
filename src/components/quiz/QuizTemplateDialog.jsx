import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Sparkles, Server } from 'lucide-react';
import { QUIZ_TEMPLATES } from '@/lib/quizTemplates';

const DIFF_STYLE = {
  easy:   { color: 'text-primary',   bg: 'bg-primary/10 border-primary/20' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  hard:   { color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20' },
};

export default function QuizTemplateDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedKey, setSelectedKey] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [pathId, setPathId] = useState('');
  const [saving, setSaving] = useState(false);

  // Rooms + paths for optional linking
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms-all'],
    queryFn: () => base44.entities.Room.list(),
    enabled: open,
  });
  const { data: paths = [] } = useQuery({
    queryKey: ['paths-all'],
    queryFn: () => base44.entities.LearningPath.list(),
    enabled: open,
  });

  const selected = QUIZ_TEMPLATES.find(t => t.key === selectedKey) || null;
  // Default the room filter to rooms matching the template's category
  const candidateRooms = selected
    ? rooms.filter(r => r.category === selected.category)
    : rooms;

  const handleCreate = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const linkedRoom = rooms.find(r => r.id === roomId);
      const payload = {
        title: selected.title,
        description: selected.description,
        category: selected.category,
        difficulty: selected.difficulty,
        time_limit_minutes: selected.time_limit_minutes,
        pass_threshold: selected.pass_threshold,
        questions: selected.questions,
        path_id: pathId || '',
        room_id: roomId || '',
        linked_room_id: linkedRoom?.id || '',
        linked_room_name: linkedRoom?.title || '',
      };
      await base44.entities.Quiz.create(payload);
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast({ title: 'Quiz created', description: `${selected.title} added to the engine.` });
      onOpenChange(false);
      setSelectedKey(null);
      setRoomId('');
      setPathId('');
    } catch (e) {
      toast({ title: 'Create failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setSelectedKey(null); setRoomId(''); setPathId(''); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> New Quiz from Template
          </DialogTitle>
          <DialogDescription>
            Pick a starter template to scaffold a graded quiz. Optionally attach it to a learning room.
          </DialogDescription>
        </DialogHeader>

        {/* Template grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUIZ_TEMPLATES.map((t) => {
            const diff = DIFF_STYLE[t.difficulty] || DIFF_STYLE.medium;
            const active = selectedKey === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setSelectedKey(t.key); setRoomId(''); setPathId(''); }}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${diff.bg} ${diff.color}`}>
                    {t.difficulty}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{t.description}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {t.questions.length} questions · {t.time_limit_minutes} min · pass {t.pass_threshold}%
                </p>
              </button>
            );
          })}
        </div>

        {/* Linking options once a template is picked */}
        {selected && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="text-sm font-semibold text-foreground">Attach to a learning room (optional)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Server className="w-3 h-3" /> Room</span>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— None —</option>
                  <optgroup label={`Matches ${selected.category}`}>
                    {candidateRooms.map(r => (
                      <option key={r.id} value={r.id}>{r.title} ({r.difficulty})</option>
                    ))}
                  </optgroup>
                  <optgroup label="All rooms">
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.title}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Learning path</span>
                <select
                  value={pathId}
                  onChange={(e) => setPathId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— None —</option>
                  {paths.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              The linked room will be suggested to learners if they fail this quiz.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!selected || saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Create Quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}