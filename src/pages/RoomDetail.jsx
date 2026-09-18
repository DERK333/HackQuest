import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, HelpCircle, Zap, Send, Terminal, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNotification } from '@/lib/NotificationContext';
import TerminalEmulator from '@/components/terminal/TerminalEmulator';
import RoomComments from '@/components/room/RoomComments';
import TaskLearningMaterial from '@/components/room/TaskLearningMaterial';

const diffColors = {
  easy: 'bg-primary/10 text-primary border-primary/20',
  medium: 'bg-accent/10 text-accent border-accent/20',
  hard: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function RoomDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('id');
  const queryClient = useQueryClient();
  const { notify } = useNotification();
  const [answers, setAnswers] = useState({});
  const [showHints, setShowHints] = useState({});
  const [showTerminal, setShowTerminal] = useState(false);
  const [localRoom, setLocalRoom] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: room, isLoading } = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => {
      const rooms = await base44.entities.Room.filter({ id: roomId });
      return rooms[0];
    },
    enabled: !!roomId,
  });

  const { data: myProgress } = useQuery({
    queryKey: ['room-progress', roomId, user?.email],
    queryFn: async () => {
      const list = await base44.entities.UserProgress.filter({ user_email: user.email, room_id: roomId });
      return list[0] || null;
    },
    enabled: !!user?.email && !!roomId,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ taskIdx, qIdx, answer }) => {
      const task = room.tasks[taskIdx];
      const question = task.questions[qIdx];
      if (answer.toLowerCase().trim() !== question.answer.toLowerCase().trim()) {
        throw new Error('Incorrect answer');
      }

      const globalIdx = room.tasks.slice(0, taskIdx).reduce((s, t) => s + (t.questions?.length || 0), 0) + qIdx;
      const currentCompleted = myProgress?.completed_questions || [];
      if (currentCompleted.includes(globalIdx)) return;

      const newCompleted = [...currentCompleted, globalIdx];
      const totalQuestions = room.tasks.reduce((s, t) => s + (t.questions?.length || 0), 0);
      const allDone = newCompleted.length >= totalQuestions;
      const pointsEarned = (myProgress?.points_earned || 0) + (question.points || 10);

      if (myProgress) {
        await base44.entities.UserProgress.update(myProgress.id, {
          completed_questions: newCompleted,
          completed: allDone,
          points_earned: pointsEarned,
        });
      } else {
        await base44.entities.UserProgress.create({
          user_email: user.email,
          room_id: roomId,
          completed_questions: newCompleted,
          completed: allDone,
          points_earned: question.points || 10,
        });
      }
    },
    onMutate: async ({ taskIdx, qIdx, answer }) => {
      const task = room.tasks[taskIdx];
      const question = task.questions[qIdx];
      // Only apply optimistic update if the answer looks correct (client-side pre-check)
      if (answer.toLowerCase().trim() !== question.answer.toLowerCase().trim()) return;

      await queryClient.cancelQueries({ queryKey: ['room-progress', roomId, user?.email] });
      const previousProgress = queryClient.getQueryData(['room-progress', roomId, user?.email]);

      const globalIdx = room.tasks.slice(0, taskIdx).reduce((s, t) => s + (t.questions?.length || 0), 0) + qIdx;
      const currentCompleted = myProgress?.completed_questions || [];
      if (!currentCompleted.includes(globalIdx)) {
        const newCompleted = [...currentCompleted, globalIdx];
        const totalQuestions = room.tasks.reduce((s, t) => s + (t.questions?.length || 0), 0);
        queryClient.setQueryData(['room-progress', roomId, user?.email], (old) => {
          const base = old || { user_email: user?.email, room_id: roomId, completed_questions: [], points_earned: 0 };
          return [{
            ...base,
            completed_questions: newCompleted,
            completed: newCompleted.length >= totalQuestions,
            points_earned: (base.points_earned || 0) + (question.points || 10),
          }];
        });
        // Clear the answer input optimistically
        setAnswers(prev => {
          const next = { ...prev };
          delete next[`${taskIdx}-${qIdx}`];
          return next;
        });
      }
      return { previousProgress };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProgress !== undefined) {
        queryClient.setQueryData(['room-progress', roomId, user?.email], context.previousProgress);
      }
    },
    onSuccess: (_, variables) => {
      const question = room.tasks[variables.taskIdx].questions[variables.qIdx];
      const points = question.points || 10;
      
      queryClient.invalidateQueries({ queryKey: ['room-progress'] });
      queryClient.invalidateQueries({ queryKey: ['my-progress'] });
      queryClient.invalidateQueries({ queryKey: ['all-progress'] });
      
      // Check if room is now completed
      const newCompleted = [...(myProgress?.completed_questions || [])];
      const globalIdx = room.tasks.slice(0, variables.taskIdx).reduce((s, t) => s + (t.questions?.length || 0), 0) + variables.qIdx;
      if (!newCompleted.includes(globalIdx)) {
        newCompleted.push(globalIdx);
      }
      
      const totalQuestions = room.tasks.reduce((s, t) => s + (t.questions?.length || 0), 0);
      if (newCompleted.length >= totalQuestions) {
        base44.analytics.track({ eventName: 'room_completed', properties: { room_id: roomId, room_title: room.title } });
        notify.roomComplete(room.title, room.points || 100);
      } else {
        toast.success('Correct! 🎉');
      }
    },
    onError: () => {
      toast.error('Incorrect answer. Try again!');
    },
  });

  const activeRoom = localRoom || room;
  const isAdmin = user?.role === 'admin';

  const handleMaterialGenerated = (material, taskIdx) => {
    setLocalRoom(prev => {
      const base = prev || room;
      const updatedTasks = [...(base.tasks || [])];
      updatedTasks[taskIdx] = { ...updatedTasks[taskIdx], learning_material: material };
      return { ...base, tasks: updatedTasks };
    });
  };

  if (isLoading || !room) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const completedSet = new Set(myProgress?.completed_questions || []);
  let globalQIdx = 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to="/Rooms" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Rooms
      </Link>

      <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold text-foreground">{activeRoom.title}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className={diffColors[activeRoom.difficulty] || diffColors.easy}>{activeRoom.difficulty}</Badge>
            <div className="flex items-center gap-1 text-primary">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-bold">{activeRoom.points} pts</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{activeRoom.description}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTerminal(v => !v)}
            className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Terminal className="w-4 h-4" />
            {showTerminal ? 'Hide Terminal' : 'Open Practice Terminal'}
          </Button>
          <Link to="/Sandbox">
            <Button variant="outline" size="sm" className="flex items-center gap-2 border-amber-400/30 text-amber-400 hover:bg-amber-400/10">
              <FlaskConical className="w-4 h-4" />
              Attack Sandbox
            </Button>
          </Link>
        </div>
        {myProgress?.completed && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Room Completed!</span>
          </div>
        )}
      </div>

      {showTerminal && (
        <TerminalEmulator roomContext={{ title: activeRoom.title, category: activeRoom.category, difficulty: activeRoom.difficulty }} />
      )}

      <div className="space-y-4">
        {activeRoom.tasks?.map((task, taskIdx) => (
          <div key={taskIdx} className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Task {taskIdx + 1}: {task.title}</h3>
            <p className="text-sm text-muted-foreground mb-3">{task.description}</p>

            <TaskLearningMaterial
              task={task}
              room={activeRoom}
              taskIdx={taskIdx}
              isAdmin={isAdmin}
              onMaterialGenerated={handleMaterialGenerated}
            />
            <div className="space-y-3">
              {task.questions?.map((q, qIdx) => {
                const gIdx = globalQIdx++;
                const isDone = completedSet.has(gIdx);
                const key = `${taskIdx}-${qIdx}`;
                return (
                  <div key={qIdx} className={`p-4 rounded-xl border ${isDone ? 'bg-primary/5 border-primary/20' : 'bg-secondary/50 border-border'}`}>
                    <div className="flex items-start gap-3">
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                          {qIdx + 1}
                        </span>
                      )}
                      <div className="flex-1 space-y-2">
                        <p className="text-sm text-foreground font-medium">{q.question}</p>
                        {!isDone && (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Your answer..."
                              value={answers[key] || ''}
                              onChange={(e) => setAnswers(prev => ({ ...prev, [key]: e.target.value }))}
                              className="h-9 bg-background text-sm"
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="none"
                              spellCheck={false}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && answers[key]) {
                                  submitMutation.mutate({ taskIdx, qIdx, answer: answers[key] });
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => submitMutation.mutate({ taskIdx, qIdx, answer: answers[key] || '' })}
                              disabled={!answers[key]}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                            {q.hint && (
                              <Button size="sm" variant="ghost" onClick={() => setShowHints(prev => ({ ...prev, [key]: !prev[key] }))}>
                                <HelpCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )}
                        {showHints[key] && q.hint && !isDone && (
                          <p className="text-xs text-accent bg-accent/10 p-2 rounded-lg">{q.hint}</p>
                        )}
                        {isDone && <p className="text-xs text-primary">+{q.points || 10} points</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {(!activeRoom.tasks || activeRoom.tasks.length === 0) && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">No tasks available for this room yet.</p>
          </div>
        )}
      </div>

      {/* Comments section */}
      <RoomComments roomId={roomId} />
    </div>
  );
}