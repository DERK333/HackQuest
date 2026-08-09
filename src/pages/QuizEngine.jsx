import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock, Loader2, Play, Sparkles, Brain, Trophy, Filter, ChevronRight, Link2, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QuizQuestion from '@/components/quiz/QuizQuestion';
import QuizResults from '@/components/quiz/QuizResults';
import QuizLabLinker from '@/components/quiz/QuizLabLinker';
import QuizBookmarkButton from '@/components/quiz/QuizBookmarkButton';
import QuizTemplateDialog from '@/components/quiz/QuizTemplateDialog';

const DIFF_STYLE = {
  easy:   { color: 'text-primary',    bg: 'bg-primary/10 border-primary/20' },
  medium: { color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  hard:   { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizCard({ quiz, onStart, onLinkLab, bestScore, user = null, isBookmarked = false }) {
  const diff = DIFF_STYLE[quiz.difficulty] || DIFF_STYLE.medium;
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${diff.bg} ${diff.color}`}>
            {quiz.difficulty}
          </span>
          {user && <QuizBookmarkButton quiz={quiz} user={user} isBookmarked={isBookmarked} />}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{quiz.title}</h3>
        {quiz.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{quiz.description}</p>}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{quiz.questions?.length || 0} questions</span>
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{quiz.time_limit_minutes} min</span>
        <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />Pass: {quiz.pass_threshold}%</span>
      </div>

      {/* Linked lab badge */}
      {quiz.linked_room_id ? (
        <div className="flex items-center gap-1.5 text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg px-2.5 py-1.5 font-medium">
          <FlaskConical className="w-3 h-3 shrink-0" />
          <span className="truncate">Lab: {quiz.linked_room_name || quiz.linked_room_id}</span>
        </div>
      ) : (
        <button
          onClick={() => onLinkLab(quiz)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary/40 rounded-lg px-2.5 py-1.5 transition-colors w-full"
        >
          <Link2 className="w-3 h-3 shrink-0" /> Link a practice lab
        </button>
      )}

      {bestScore != null && (
        <div className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${
          bestScore >= quiz.pass_threshold
            ? 'bg-primary/10 border-primary/20 text-primary'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          Best score: {bestScore}% — {bestScore >= quiz.pass_threshold ? '✓ Passed' : 'Not passed yet'}
        </div>
      )}
      <div className="flex gap-2 mt-auto">
        <Button className="flex-1 gap-2" onClick={() => onStart(quiz)}>
          <Play className="w-4 h-4" />
          {bestScore != null ? 'Retake' : 'Start'}
        </Button>
        <Button variant="outline" size="icon" onClick={() => onLinkLab(quiz)} title="Link lab">
          <Link2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function Timer({ seconds, limit }) {
  const pct = Math.max(0, (seconds / (limit * 60)) * 100);
  const isLow = seconds <= 60;
  return (
    <div className={`flex items-center gap-2 text-sm font-mono font-bold ${isLow ? 'text-destructive' : 'text-foreground'}`}>
      <Clock className={`w-4 h-4 ${isLow ? 'animate-pulse' : ''}`} />
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isLow ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function QuizEngine() {
  const urlParams = new URLSearchParams(window.location.search);
  const pathIdFilter = urlParams.get('path_id');
  const quizIdParam = urlParams.get('quiz_id');

  const [activeQuiz, setActiveQuiz] = useState(null);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState('list'); // list | quiz | results
  const [attempt, setAttempt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [filterDiff, setFilterDiff] = useState('all');
  const [linkingQuiz, setLinkingQuiz] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['quizzes', pathIdFilter],
    queryFn: () => pathIdFilter
      ? base44.entities.Quiz.filter({ path_id: pathIdFilter })
      : base44.entities.Quiz.list('-created_date', 50),
  });

  // Auto-start a specific quiz when quiz_id param is present
  useEffect(() => {
    if (quizIdParam && quizzes.length > 0 && phase === 'list' && !activeQuiz) {
      const target = quizzes.find(q => q.id === quizIdParam);
      if (target) handleStart(target);
    }
  }, [quizIdParam, quizzes]);
  const { data: myAttempts = [] } = useQuery({
    queryKey: ['quiz_attempts', user?.email],
    queryFn: () => user ? base44.entities.QuizAttempt.filter({ user_email: user.email }) : [],
    enabled: !!user,
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['quizBookmarks', user?.email],
    queryFn: () => user ? base44.entities.QuizBookmark.filter({ user_email: user.email }) : [],
    enabled: !!user,
  });

  const bookmarkSet = React.useMemo(() => {
    return new Set(bookmarks.map(b => b.quiz_id));
  }, [bookmarks]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.QuizAttempt.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz_attempts'] }),
  });

  const bestScoreMap = React.useMemo(() => {
    const map = {};
    myAttempts.forEach(a => {
      if (map[a.quiz_id] == null || a.score > map[a.quiz_id]) map[a.quiz_id] = a.score;
    });
    return map;
  }, [myAttempts]);

  const stopTimer = () => clearInterval(timerRef.current);

  const handleStart = (quiz) => {
    const qs = shuffle(quiz.questions || []);
    setActiveQuiz(quiz);
    setShuffledQuestions(qs);
    setCurrentIndex(0);
    setAnswers({});
    setRevealed(false);
    setAttempt(null);
    setTimeLeft((quiz.time_limit_minutes || 10) * 60);
    setElapsed(0);
    startRef.current = Date.now();
    setPhase('quiz');
  };

  useEffect(() => {
    if (phase !== 'quiz') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); finishQuiz(); return 0; }
        return t - 1;
      });
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const finishQuiz = useCallback(() => {
    stopTimer();
    const qs = shuffledQuestions;
    const taken = Math.floor((Date.now() - startRef.current) / 1000);
    const answerArr = qs.map((q, i) => {
      const sel = answers[i] ?? -1;
      return { question_index: i, selected_index: sel, correct: sel === q.correct_index };
    });
    const pointsEarned = answerArr.reduce((sum, a, i) => sum + (a.correct ? (qs[i].points || 10) : 0), 0);
    const pointsPossible = qs.reduce((sum, q) => sum + (q.points || 10), 0);
    const score = pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 100) : 0;
    const passed = score >= (activeQuiz.pass_threshold || 70);

    const result = {
      quiz_id: activeQuiz.id,
      quiz_title: activeQuiz.title,
      user_email: user?.email || '',
      path_id: activeQuiz.path_id || '',
      score,
      points_earned: pointsEarned,
      points_possible: pointsPossible,
      passed,
      time_taken_seconds: taken,
      answers: answerArr,
    };
    setAttempt(result);
    saveMutation.mutate(result);
    setPhase('results');
  }, [shuffledQuestions, answers, activeQuiz, user]);

  const handleSelect = (idx) => {
    setAnswers(prev => ({ ...prev, [currentIndex]: idx }));
  };

  const handleRevealAndNext = () => {
    if (!revealed) { setRevealed(true); return; }
    if (currentIndex < shuffledQuestions.length - 1) {
      setCurrentIndex(i => i + 1);
      setRevealed(false);
    } else {
      finishQuiz();
    }
  };

  const handleRetry = () => { handleStart(activeQuiz); };
  const handleBack = () => { stopTimer(); setPhase('list'); setActiveQuiz(null); };

  const generateAIQuiz = async () => {
    const pathId = pathIdFilter || '';
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a 10-question multiple-choice quiz for a cybersecurity training platform. 
Topic: ${pathId ? 'a cybersecurity learning module' : 'general cybersecurity fundamentals'}.
Mix easy, medium, and hard questions. Each question must have exactly 4 options, one correct answer, and a clear explanation.
Make questions practical and exam-style (similar to CompTIA Security+ / CEH level).

Return JSON matching the schema exactly.`,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          difficulty: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
                correct_index: { type: 'number' },
                explanation: { type: 'string' },
                points: { type: 'number' },
              }
            }
          }
        }
      }
    });
    await base44.entities.Quiz.create({
      title: result.title || 'AI-Generated Quiz',
      description: result.description || '',
      difficulty: result.difficulty || 'medium',
      path_id: pathId,
      time_limit_minutes: 10,
      pass_threshold: 70,
      questions: result.questions || [],
    });
    queryClient.invalidateQueries({ queryKey: ['quizzes'] });
    setGenerating(false);
  };

  const filtered = quizzes.filter(q =>
    filterDiff === 'all' || q.difficulty === filterDiff
  );

  // ── QUIZ PHASE ────────────────────────────────────────────────────────────────
  if (phase === 'quiz' && activeQuiz && shuffledQuestions.length > 0) {
    const q = shuffledQuestions[currentIndex];
    const isLast = currentIndex === shuffledQuestions.length - 1;
    const hasSelected = answers[currentIndex] != null;

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-4">
          <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-foreground">{activeQuiz.title}</p>
          </div>
          <Timer seconds={timeLeft} limit={activeQuiz.time_limit_minutes} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <QuizQuestion
            question={q}
            questionNumber={currentIndex + 1}
            total={shuffledQuestions.length}
            selectedIndex={answers[currentIndex] ?? null}
            onSelect={handleSelect}
            revealed={revealed}
          />

          <div className="flex gap-3 mt-6">
            {!revealed ? (
              <Button className="w-full" disabled={!hasSelected} onClick={handleRevealAndNext}>
                Check Answer
              </Button>
            ) : (
              <Button className="w-full gap-2" onClick={handleRevealAndNext}>
                {isLast ? 'Finish Quiz' : 'Next Question'} <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS PHASE ─────────────────────────────────────────────────────────────
  if (phase === 'results' && attempt) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Quizzes
        </button>
        <div className="bg-card border border-border rounded-2xl p-6">
          <QuizResults
            quiz={activeQuiz}
            attempt={attempt}
            onRetry={handleRetry}
            onNext={handleBack}
          />
        </div>
      </div>
    );
  }

  // ── LIST PHASE ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/Dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" /> Quiz Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Test your knowledge with randomized, graded quizzes</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setTemplateOpen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" /> New from Template
          </Button>
          <Button onClick={generateAIQuiz} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Generating...' : 'AI Generate Quiz'}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {myAttempts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Quizzes Taken', value: myAttempts.length, color: 'text-primary' },
            { label: 'Passed', value: myAttempts.filter(a => a.passed).length, color: 'text-primary' },
            { label: 'Avg Score', value: `${Math.round(myAttempts.reduce((s, a) => s + a.score, 0) / myAttempts.length)}%`, color: 'text-amber-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {['all', 'easy', 'medium', 'hard'].map(d => (
          <button
            key={d}
            onClick={() => setFilterDiff(d)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors capitalize ${
              filterDiff === d
                ? 'bg-primary/15 border-primary/30 text-primary'
                : 'bg-secondary/30 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {d === 'all' ? 'All Difficulties' : d}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">No quizzes yet. Generate one with AI to get started!</p>
          <Button onClick={generateAIQuiz} disabled={generating} className="gap-2">
            <Sparkles className="w-4 h-4" /> Generate First Quiz
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(quiz => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              onStart={handleStart}
              onLinkLab={setLinkingQuiz}
              bestScore={bestScoreMap[quiz.id] ?? null}
              user={user}
              isBookmarked={bookmarkSet.has(quiz.id)}
            />
          ))}
        </div>
      )}

      {linkingQuiz && (
        <QuizLabLinker quiz={linkingQuiz} onClose={() => setLinkingQuiz(null)} />
      )}

      <QuizTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} />
    </div>
  );
}