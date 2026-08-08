// Export attack notes as Markdown or JSON and trigger a browser download.
export function downloadNotes(notes, format = 'markdown') {
  if (!notes || notes.length === 0) return;

  let content;
  let mime;
  let ext;

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
    content = JSON.stringify(payload, null, 2);
    mime = 'application/json';
    ext = 'json';
  } else {
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
    content = header + body;
    mime = 'text/markdown';
    ext = 'md';
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attack-notes-${new Date().toISOString().split('T')[0]}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}