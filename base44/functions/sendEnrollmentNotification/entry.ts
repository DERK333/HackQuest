import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[c]);

Deno.serve(async (req) => {
  try {
    // Verify this is an internal platform automation — reject direct invocations
    const platformToken = req.headers.get('x-base44-automation') || req.headers.get('x-platform-token');
    const appId = Deno.env.get('BASE44_APP_ID');
    if (!platformToken || platformToken !== appId) {
      const base44Check = createClientFromRequest(req);
      const user = await base44Check.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await req.json();
    const base44 = createClientFromRequest(req);

    const { data, event } = body;

    if (!data?.student_email) {
      return Response.json({ skipped: true, reason: 'No student email on record' });
    }

    const isNew = event?.type === 'create';
    const studentName = escapeHtml(data.student_name || 'Student');
    const courseTitle = escapeHtml(data.course_title || 'your course');
    const enrollmentDate = escapeHtml(data.enrollment_date || 'N/A');

    const subject = isNew
      ? `You're enrolled in ${data.course_title || 'a new course'}!`
      : `Your enrollment in ${data.course_title || 'your course'} has been updated`;

    const body_html = isNew
      ? `
        <h2>Welcome, ${studentName}!</h2>
        <p>You have been successfully enrolled in <strong>${courseTitle}</strong>.</p>
        <p><strong>Enrollment Date:</strong> ${enrollmentDate}</p>
        <p>Log in to HackQuest to start learning. Good luck!</p>
        <br/>
        <p style="color:#888;font-size:12px;">This is an automated notification from HackQuest.</p>
      `
      : `
        <h2>Enrollment Update, ${studentName}!</h2>
        <p>Your enrollment record for <strong>${courseTitle}</strong> has been updated.</p>
        <p><strong>Enrollment Date:</strong> ${enrollmentDate}</p>
        <p>Log in to HackQuest to check your progress.</p>
        <br/>
        <p style="color:#888;font-size:12px;">This is an automated notification from HackQuest.</p>
      `;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: data.student_email,
      subject,
      body: body_html,
      from_name: 'HackQuest',
    });

    return Response.json({ sent: true, to: data.student_email, subject });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});