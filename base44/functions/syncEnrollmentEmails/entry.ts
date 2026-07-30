import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  const messageIds = body.data?.new_message_ids ?? [];
  if (messageIds.length === 0) {
    return Response.json({ skipped: true, reason: 'no new messages' });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const results = [];

  for (const messageId of messageIds) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: authHeader }
    );
    if (!res.ok) continue;

    const message = await res.json();
    const headers = message.payload?.headers ?? [];

    const getHeader = (name) =>
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const date = getHeader('Date');

    // Only process emails that look like enrollment alerts
    const isEnrollment = /enroll|registered|joined|course|sign.?up/i.test(subject);
    if (!isEnrollment) {
      results.push({ messageId, skipped: true, subject });
      continue;
    }

    // Extract user email from the "From" or body
    const emailMatch = from.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const userEmail = emailMatch ? emailMatch[0] : from;

    // Try to match an existing learning path from subject
    const paths = await base44.asServiceRole.entities.LearningPath.list();
    const matchedPath = paths.find(p =>
      subject.toLowerCase().includes(p.title.toLowerCase())
    );

    // Record the enrollment
    await base44.asServiceRole.entities.EnrollmentSync.create({
      message_id: messageId,
      subject,
      from_email: userEmail,
      received_date: date,
      path_id: matchedPath?.id ?? null,
      path_title: matchedPath?.title ?? null,
      raw_from: from,
      status: 'synced',
    });

    results.push({ messageId, subject, userEmail, matchedPath: matchedPath?.title });
  }

  return Response.json({ processed: results.length, results });
});