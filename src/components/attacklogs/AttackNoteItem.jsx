import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Link2 } from 'lucide-react';
import { format } from 'date-fns';

const SEV = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export default function AttackNoteItem({ note, onEdit, onDelete }) {
  return (
    <div className="border border-border rounded-xl p-3 bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-foreground text-sm leading-tight">{note.title}</h4>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(note)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(note)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1.5 line-clamp-4">{note.content}</p>
      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        {note.severity && (
          <Badge variant="outline" className={`text-[10px] ${SEV[note.severity] || ''}`}>
            {note.severity}
          </Badge>
        )}
        {note.scenario_name && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Link2 className="w-2.5 h-2.5" />
            {note.scenario_name}
          </Badge>
        )}
        {(note.tags || []).map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">
            #{t}
          </Badge>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {note.created_date ? format(new Date(note.created_date), 'MMM d') : ''}
        </span>
      </div>
    </div>
  );
}