import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { escapeHtml } from "../../shared/escapeHtml.ts";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Require an authenticated admin session (scheduled automations run authenticated)
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const serviceBase44 = base44.asServiceRole;

  // Fetch all users
  const users = await serviceBase44.entities.User.list();

  // Fetch all quizzes (for "new labs" section)
  const allQuizzes = await serviceBase44.entities.Quiz.list();

  // Quizzes added in the last 7 days
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newQuizzes = allQuizzes.filter(q => new Date(q.created_date) >= oneWeekAgo);

  // Fetch all quiz attempts from the last 7 days
  const allAttempts = await serviceBase44.entities.QuizAttempt.list();
  const recentAttempts = allAttempts.filter(a => new Date(a.created_date) >= oneWeekAgo);

  let emailsSent = 0;

  for (const user of users) {
    if (!user.email) continue;

    // Get this user's recent attempts
    const userAttempts = recentAttempts.filter(a => a.user_email === user.email);

    // Also get all-time best scores per quiz
    const userAllAttempts = allAttempts.filter(a => a.user_email === user.email);
    const bestScoreMap = {};
    for (const attempt of userAllAttempts) {
      if (!bestScoreMap[attempt.quiz_id] || attempt.score > bestScoreMap[attempt.quiz_id].score) {
        bestScoreMap[attempt.quiz_id] = attempt;
      }
    }

    // Skip users with no activity at all
    if (userAllAttempts.length === 0 && newQuizzes.length === 0) continue;

    const totalPointsThisWeek = userAttempts.reduce((sum, a) => sum + (a.points_earned || 0), 0);
    const quizzesThisWeek = userAttempts.length;
    const passedThisWeek = userAttempts.filter(a => a.passed).length;

    // Build best scores list (top 5)
    const topBestScores = Object.values(bestScoreMap)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Build email HTML
    const weeklyActivitySection = quizzesThisWeek > 0
      ? `
        <div style="background:#1e2a3a;border-radius:8px;padding:20px;margin-bottom:20px;">
          <h2 style="color:#a3e635;margin:0 0 12px 0;font-size:16px;">📊 This Week's Activity</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px;text-align:center;background:#162030;border-radius:6px;">
                <div style="font-size:28px;font-weight:900;color:#a3e635;">${quizzesThisWeek}</div>
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">Quizzes Taken</div>
              </td>
              <td style="width:12px;"></td>
              <td style="padding:8px;text-align:center;background:#162030;border-radius:6px;">
                <div style="font-size:28px;font-weight:900;color:#60a5fa;">${passedThisWeek}</div>
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">Passed</div>
              </td>
              <td style="width:12px;"></td>
              <td style="padding:8px;text-align:center;background:#162030;border-radius:6px;">
                <div style="font-size:28px;font-weight:900;color:#f59e0b;">${totalPointsThisWeek}</div>
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">Points Earned</div>
              </td>
            </tr>
          </table>
        </div>`
      : `<div style="background:#1e2a3a;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center;color:#94a3b8;font-size:14px;">
          😴 No quiz activity this week — jump back in and keep your streak alive!
        </div>`;

    const bestScoresSection = topBestScores.length > 0
      ? `<div style="background:#1e2a3a;border-radius:8px;padding:20px;margin-bottom:20px;">
          <h2 style="color:#a3e635;margin:0 0 12px 0;font-size:16px;">🏆 Your Best Scores</h2>
          ${topBestScores.map(a => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2d3f55;">
              <span style="color:#e2e8f0;font-size:13px;">${escapeHtml(a.quiz_title || 'Quiz')}</span>
              <span style="color:${a.score >= 80 ? '#a3e635' : a.score >= 60 ? '#f59e0b' : '#ef4444'};font-weight:700;font-size:14px;">${Math.round(a.score)}%</span>
            </div>`).join('')}
        </div>`
      : '';

    const newQuizzesSection = newQuizzes.length > 0
      ? `<div style="background:#162a1e;border:1px solid #2d5a3a;border-radius:8px;padding:20px;margin-bottom:20px;">
          <h2 style="color:#a3e635;margin:0 0 12px 0;font-size:16px;">🆕 New This Week</h2>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 12px 0;">${newQuizzes.length} new quiz${newQuizzes.length > 1 ? 'zes have' : ' has'} been added — check them out!</p>
          ${newQuizzes.slice(0, 4).map(q => `
            <div style="padding:8px 12px;background:#1e3a28;border-radius:6px;margin-bottom:8px;">
              <span style="color:#e2e8f0;font-size:13px;font-weight:600;">${escapeHtml(q.title || '')}</span>
              ${q.difficulty ? `<span style="margin-left:8px;font-size:11px;color:#94a3b8;text-transform:capitalize;">${q.difficulty}</span>` : ''}
            </div>`).join('')}
        </div>`
      : '';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f1923;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#a3e635;border-radius:10px;padding:10px 18px;margin-bottom:12px;">
        <span style="font-size:20px;font-weight:900;color:#0f1923;">TryHack<span>Me</span></span>
      </div>
      <h1 style="color:#f1f5f9;font-size:22px;margin:0 0 6px 0;">Your Weekly Summary 📬</h1>
      <p style="color:#64748b;font-size:14px;margin:0;">Here's how you did this week, ${escapeHtml(user.full_name || 'Hacker')}</p>
    </div>

    ${weeklyActivitySection}
    ${bestScoresSection}
    ${newQuizzesSection}

    <!-- CTA -->
    <div style="text-align:center;margin-top:24px;">
      <a href="${Deno.env.get('APP_URL') || 'https://app.base44.com'}/QuizEngine"
         style="display:inline-block;background:#a3e635;color:#0f1923;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;">
        Go to Quiz Engine →
      </a>
    </div>

    <!-- Footer -->
    <p style="text-align:center;color:#334155;font-size:12px;margin-top:32px;">
      You're receiving this because you're a member of TryHackMe.<br/>Keep hacking, keep learning. 🛡️
    </p>
  </div>
</body>
</html>`;

    await serviceBase44.integrations.Core.SendEmail({
      to: user.email,
      subject: `🛡️ Your Weekly TryHackMe Quiz Summary`,
      body: htmlBody,
    });

    emailsSent++;
  }

  return Response.json({ success: true, emails_sent: emailsSent });
});