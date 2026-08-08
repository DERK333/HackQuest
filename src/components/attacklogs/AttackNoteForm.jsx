import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Save, X } from 'lucide-react';

// Create or edit a single AttackNote. `logs` populates the optional link dropdown.
export default function AttackNoteForm({ note, logs, defaultLogId, onSave, onCancel }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [logId, setLogId] = useState(note?.log_id || defaultLogId || '');
  const [tags, setTags] = useState((note?.tags || []).join(', '));
  const [saving, setSaving] = useState(false);

  const selectedLog = logs?.find((l) => l.id === logId);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const payload = {
        user_email: me.email,
        title: title.trim(),
        content: content.trim(),
        log_id: logId || '',
        scenario_name: selectedLog?.scenario_name || note?.scenario_name || '',
        severity: selectedLog?.scenario_severity || note?.severity || '',
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (note?.id) {
        await base44.entities.AttackNote.update(note.id, payload);
      } else {
        await base44.entities.AttackNote.create(payload);
      }
      onSave?.();
    } catch (e) {
      toast({ title: 'Failed to save note', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border border-border rounded-xl bg-secondary/30">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Finding title…"
        className="bg-card"
      />
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Document your findings, IOCs, remediation steps…"
        rows={5}
        className="bg-card resize-y"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={logId}
          onChange={(e) => setLogId(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">No linked log</option>
          {logs?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.scenario_name}
            </option>
          ))}
        </select>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tags, comma, separated"
          className="bg-card"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4" />
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}