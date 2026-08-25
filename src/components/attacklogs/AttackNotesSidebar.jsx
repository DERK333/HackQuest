import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { StickyNote, Plus, FileText, FileJson, Loader2 } from 'lucide-react';
import AttackNoteForm from './AttackNoteForm';
import AttackNoteItem from './AttackNoteItem';
import NotesAIAssistant from './NotesAIAssistant';
import { downloadNotes } from '@/lib/notesExport';

// Controlled slide-over: parent owns `open` and `presetLogId` (from a row click).
export default function AttackNotesSidebar({ open, onOpenChange, logs, presetLogId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formLogId, setFormLogId] = useState('');
  const [driveSaving, setDriveSaving] = useState(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['attack-notes'],
    queryFn: () => base44.entities.AttackNote.list('-created_date', 200),
    enabled: open,
  });

  useEffect(() => {
    if (open && presetLogId) {
      setFormLogId(presetLogId);
      setShowForm(true);
      setEditing(null);
    }
    if (!open) {
      setShowForm(false);
      setEditing(null);
      setFormLogId('');
    }
  }, [open, presetLogId]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['attack-notes'] });

  const openNew = () => {
    setEditing(null);
    setFormLogId(presetLogId || '');
    setShowForm(true);
  };

  const openEdit = (note) => {
    setEditing(note);
    setFormLogId(note.log_id || '');
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditing(null);
    refresh();
  };

  const handleExport = async (format) => {
    downloadNotes(notes, format);
    setDriveSaving(format);
    try {
      const res = await base44.functions.invoke('exportNotesToDrive', { format });
      toast({
        title: 'Saved to Google Drive',
        description: `${res.data?.file_name || 'Export'} uploaded to "${res.data?.folder || 'HackQuest Attack Notes'}".`,
      });
    } catch (e) {
      toast({ title: 'Drive save failed', description: e.message, variant: 'destructive' });
    } finally {
      setDriveSaving(null);
    }
  };

  const handleDelete = async (note) => {
    if (!confirm('Delete this note?')) return;
    try {
      await base44.entities.AttackNote.delete(note.id);
      refresh();
      toast({ title: 'Note deleted' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-primary" /> Quick Notes
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="notes" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="ai">AI Knowledge Base</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-3 mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={openNew} className="gap-1.5">
                <Plus className="w-4 h-4" /> New Note
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport('markdown')}
                disabled={notes.length === 0 || driveSaving !== null}
                className="gap-1.5"
              >
                {driveSaving === 'markdown'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileText className="w-4 h-4" />}
                Markdown
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport('json')}
                disabled={notes.length === 0 || driveSaving !== null}
                className="gap-1.5"
              >
                {driveSaving === 'json'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileJson className="w-4 h-4" />}
                JSON
              </Button>
            </div>

            {showForm && (
              <AttackNoteForm
                key={editing ? editing.id : 'new-' + formLogId}
                note={editing}
                logs={logs}
                defaultLogId={formLogId}
                onSave={handleSaved}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            )}

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : notes.length === 0 && !showForm ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notes yet. Document your findings while reviewing incidents.
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <AttackNoteItem key={n.id} note={n} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ai" className="mt-3">
            <NotesAIAssistant />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}