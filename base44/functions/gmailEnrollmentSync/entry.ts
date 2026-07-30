import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Helpers ──────────────────────────────────────────────────────────────────

function decodeBase64(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function getEmailBody(message) {
  const payload = message.payload;
  if (!payload) return '';

  const findPart = (parts, mimeType) => {
    if (!parts) return null;
    for (const part of parts) {
      if (part.mimeType === mimeType && part.body?.data) return part.body.data;
      if (part.parts) {
        const found = findPart(part.parts, mimeType);
        if (found) return found;
      }
    }
    return null;
  };

  const textData = findPart(payload.parts, 'text/plain') ||
    (payload.mimeType === 'text/plain' ? payload.body?.data : null);
  if (textData) return decodeBase64(textData);

  const htmlData = findPart(payload.parts, 'text/html') ||
    (payload.mimeType === 'text/html' ? payload.body?.data : null);
  if (htmlData) return decodeBase64(htmlData).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  return '';
}

function getHeader(message, name) {
  const headers = message.payload?.headers || [];
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

// ── Filtering ─────────────────────────────────────────────────────────────────

// Only accept emails that are genuinely enrollment-related by checking both
// the subject AND the email body for strong enrollment signals.
const ENROLLMENT_SUBJECT_PATTERN = /\b(enroll(ment|ed|ing)?|registered|registration|sign[- ]?up|joined|course access|welcome to (the )?course|you('ve| have) been (added|enrolled|registered))\b/i;
const ENROLLMENT_BODY_PATTERN = /\b(enroll(ment|ed|ing)?|course (title|name|access)|student (name|id)|registration (confirm|success|complet))\b/i;

// Reject emails whose From address or domain looks like marketing/spam/unrelated
// This prevents hack-quest.com appearing in From addresses of unrelated senders
const BLOCKED_SENDER_PATTERNS = [
  /noreply@(?!hack-?quest)/i,           // generic noreplies not from hackquest
  /newsletter/i,
  /marketing/i,
  /promotions?@/i,
  /no-reply@(?!hack-?quest)/i,
];

function isEnrollmentEmail(subject, body, from) {
  // Must match subject OR strong body signal
  const subjectMatch = ENROLLMENT_SUBJECT_PATTERN.test(subject);
  const bodyMatch = ENROLLMENT_BODY_PATTERN.test(body.slice(0, 2000));

  if (!subjectMatch && !bodyMatch) return { valid: false, reason: 'No enrollment signals in subject or body' };

  // Reject blocked sender patterns
  for (const pattern of BLOCKED_SENDER_PATTERNS) {
    if (pattern.test(from)) return { valid: false, reason: `Sender blocked by pattern: ${pattern}` };
  }

  return { valid: true };
}

// ── AI Extraction ─────────────────────────────────────────────────────────────

async function extractEnrollmentData(base44, subject, from, date, body) {
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an expert at parsing course enrollment notification emails.

Analyze the email below and extract ONLY concrete enrollment data. 
Do NOT infer or guess — if a field is not clearly stated, return null.

Email Subject: ${subject}
Email From: ${from}
Email Date: ${date}
Email Body (truncated to 3000 chars):
${body.slice(0, 3000)}

Extract these fields:
- student_name: The full name of the student who enrolled. Look for patterns like "Dear [Name]", "[Name] has enrolled", "Welcome [Name]", student/user name fields. Return null if not found.
- course_title: The exact title of the course or learning path. Look for course name, program title, class name. Return null if not found.
- enrollment_date: The enrollment date in YYYY-MM-DD format. Use the email date as fallback only if the body implies the enrollment is happening now. Return null if truly unknown.
- student_email: The student's email address if explicitly present in the body (not the sender). Return null if not found.
- confidence: A number 0-1 indicating how confident you are this is a genuine enrollment notification email.
- extraction_notes: Brief note on what signals you used or why fields are null (max 100 chars).

IMPORTANT: If this does not appear to be a real enrollment notification (e.g. it is a marketing email, unsubscribe confirmation, or unrelated notification), set confidence below 0.4.

Return ONLY valid JSON with exactly these six fields.`,
    response_json_schema: {
      type: 'object',
      properties: {
        student_name: { type: 'string' },
        course_title: { type: 'string' },
        enrollment_date: { type: 'string' },
        student_email: { type: 'string' },
        confidence: { type: 'number' },
        extraction_notes: { type: 'string' },
      }
    }
  });
  return result;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    const messageIds = body.data?.new_message_ids ?? [];
    if (messageIds.length === 0) {
      return Response.json({ message: 'No new messages to process' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const results = [];

    for (const messageId of messageIds) {
      let subject = '', from = '', date = '', emailBody = '', snippet = '';

      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          { headers: authHeader }
        );

        if (!res.ok) {
          console.warn(`[SKIP] Failed to fetch message ${messageId}: HTTP ${res.status}`);
          results.push({ messageId, status: 'fetch_error', httpStatus: res.status });
          continue;
        }

        const message = await res.json();
        subject = getHeader(message, 'subject');
        from = getHeader(message, 'from');
        date = getHeader(message, 'date');
        emailBody = getEmailBody(message);
        snippet = (message.snippet || '').slice(0, 300);

      } catch (fetchErr) {
        console.error(`[ERROR] Fetching message ${messageId}:`, fetchErr.message);
        results.push({ messageId, status: 'fetch_error', error: fetchErr.message });
        continue;
      }

      // ── Pre-filter: rule-based check before spending AI credits ──
      const filterResult = isEnrollmentEmail(subject, emailBody, from);
      if (!filterResult.valid) {
        console.log(`[SKIP] ${messageId} | Subject: "${subject}" | Reason: ${filterResult.reason}`);
        results.push({ messageId, status: 'skipped', subject, from, reason: filterResult.reason });
        continue;
      }

      // ── AI Extraction ──
      let parsed;
      try {
        parsed = await extractEnrollmentData(base44, subject, from, date, emailBody);
      } catch (aiErr) {
        console.error(`[ERROR] AI extraction failed for ${messageId}:`, aiErr.message);
        results.push({ messageId, status: 'ai_error', subject, from, error: aiErr.message });
        continue;
      }

      // ── Confidence gate: reject low-confidence results ──
      const confidence = parsed?.confidence ?? 0;
      if (confidence < 0.5) {
        console.log(`[SKIP] Low confidence (${confidence}) for message ${messageId}. Notes: ${parsed?.extraction_notes}`);
        results.push({
          messageId,
          status: 'low_confidence',
          subject,
          from,
          confidence,
          notes: parsed?.extraction_notes,
        });
        continue;
      }

      // ── Require at minimum one of: student name or course title ──
      if (!parsed.student_name && !parsed.course_title) {
        console.log(`[SKIP] No student_name or course_title extracted for ${messageId}. Notes: ${parsed?.extraction_notes}`);
        results.push({
          messageId,
          status: 'extraction_failed',
          subject,
          from,
          notes: parsed?.extraction_notes,
        });
        continue;
      }

      // ── Save enrollment record ──
      try {
        const enrollment = await base44.asServiceRole.entities.CourseEnrollment.create({
          student_name: parsed.student_name || 'Unknown Student',
          course_title: parsed.course_title || 'Unknown Course',
          enrollment_date: parsed.enrollment_date || new Date().toISOString().split('T')[0],
          student_email: parsed.student_email || null,
          source_email_id: messageId,
          raw_snippet: snippet,
        });

        console.log(`[SAVED] Enrollment ${enrollment.id} | Student: ${parsed.student_name} | Course: ${parsed.course_title} | Confidence: ${confidence}`);
        results.push({
          messageId,
          status: 'saved',
          enrollmentId: enrollment.id,
          student_name: parsed.student_name,
          course_title: parsed.course_title,
          confidence,
        });

      } catch (saveErr) {
        console.error(`[ERROR] Saving enrollment for ${messageId}:`, saveErr.message);
        results.push({ messageId, status: 'save_error', subject, error: saveErr.message });
      }
    }

    const summary = {
      total: results.length,
      saved: results.filter(r => r.status === 'saved').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      low_confidence: results.filter(r => r.status === 'low_confidence').length,
      extraction_failed: results.filter(r => r.status === 'extraction_failed').length,
      errors: results.filter(r => r.status.includes('error')).length,
    };

    console.log('[SUMMARY]', JSON.stringify(summary));
    return Response.json({ summary, results });

  } catch (error) {
    console.error('[FATAL]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});