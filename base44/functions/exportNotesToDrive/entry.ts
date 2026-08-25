import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const FOLDER_NAME = 'HackQuest Attack Notes';

function buildContent(notes, format) {
  if (format === 'json') {
    const payload = notes.map((n) => ({
      title: n.title,
      content: n.content,
      scenario: n.scenario_name || '',
      severity: n.severity || '',
      tags: n.tags || [],
      linked_log_id: n.log_id || '',
      created_date: n.created_date || '',
    }));
    return { content: JSON.stringify(payload, null, 2), mime: 'application/json', ext: 'json' };
  }
  const header = `# Attack Log Notes — Exported ${new Date().toLocaleString()}\n\n`;
  const body = notes
    .map((n) => {
      const meta = [
        `- **Scenario:** ${n.scenario_name || '—'}`,
        `- **Severity:** ${n.severity || '—'}`,
        `- **Tags:** ${(n.tags || []).join(', ') || '—'}`,
        `- **Created:** ${n.created_date || '—'}`,
      ].join('\n');
      return `## ${n.title}\n${meta}\n\n${n.content || ''}\n`;
    })
    .join('\n---\n\n');
  return { content: header + body, mime: 'text/markdown', ext: 'md' };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const format = body.format === 'json' ? 'json' : 'markdown';

    const notes = await base44.entities.AttackNote.list('-created_date', 500);
    if (!notes || notes.length === 0) {
      return Response.json({ error: 'No notes to export' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Find or create the dedicated folder (drive.file lets the app see folders it created)
    const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
      headers: authHeader,
    });
    let folderId;
    if (listRes.ok) {
      const listData = await listRes.json();
      folderId = listData.files && listData.files[0] ? listData.files[0].id : null;
    }
    if (!folderId) {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
      });
      if (!createRes.ok) return Response.json({ error: 'Failed to create Drive folder' }, { status: 502 });
      const created = await createRes.json();
      folderId = created.id;
    }

    const { content, mime, ext } = buildContent(notes, format);
    const fileName = `attack-notes-${new Date().toISOString().split('T')[0]}.${ext}`;

    // Multipart upload into the folder
    const boundary = 'hackquest-' + Math.random().toString(36).slice(2);
    const metadata = JSON.stringify({ name: fileName, parents: [folderId], mimeType: mime });
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mime}\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return Response.json({ error: 'Drive upload failed', details: errText }, { status: 502 });
    }
    const file = await uploadRes.json();

    return Response.json({
      success: true,
      file_name: fileName,
      file_id: file.id,
      web_view_link: file.webViewLink,
      note_count: notes.length,
      folder: FOLDER_NAME,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}