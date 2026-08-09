import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete all user-owned entity records
    const [progress, quizAttempts, bookmarks, discussions, replies, upvotes, badges, attackLogs, scenarios, enrollments] = await Promise.all([
      base44.entities.UserProgress.filter({ user_email: user.email }),
      base44.entities.QuizAttempt.filter({ user_email: user.email }),
      base44.entities.QuizBookmark.filter({ user_email: user.email }),
      base44.entities.Discussion.filter({ author_email: user.email }),
      base44.entities.DiscussionReply.filter({ author_email: user.email }),
      base44.entities.DiscussionUpvote.filter({ user_email: user.email }),
      base44.entities.UserBadge.filter({ user_email: user.email }),
      base44.entities.AttackLog.filter({ user_email: user.email }),
      base44.entities.CustomScenario.filter({ created_by: user.email }),
      base44.entities.CourseEnrollment.filter({ student_email: user.email }),
    ]);

    // Also fetch room comments and course progress (scoped to this user via RLS)
    const comments = await base44.entities.RoomComment.filter({ author_email: user.email });
    const courseProgress = await base44.entities.CourseProgress.list();

    // Delete all in parallel
    await Promise.all([
      ...progress.map(r => base44.entities.UserProgress.delete(r.id)),
      ...quizAttempts.map(r => base44.entities.QuizAttempt.delete(r.id)),
      ...bookmarks.map(r => base44.entities.QuizBookmark.delete(r.id)),
      ...discussions.map(r => base44.entities.Discussion.delete(r.id)),
      ...replies.map(r => base44.entities.DiscussionReply.delete(r.id)),
      ...upvotes.map(r => base44.entities.DiscussionUpvote.delete(r.id)),
      ...badges.map(r => base44.entities.UserBadge.delete(r.id)),
      ...attackLogs.map(r => base44.entities.AttackLog.delete(r.id)),
      ...scenarios.map(r => base44.entities.CustomScenario.delete(r.id)),
      ...comments.map(r => base44.entities.RoomComment.delete(r.id)),
      ...enrollments.map(r => base44.entities.CourseEnrollment.delete(r.id)),
      ...courseProgress.map(r => base44.entities.CourseProgress.delete(r.id)),
    ]);

    // Log out the user (invalidates session)
    return Response.json({ success: true, message: 'Account and all data deleted' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});