import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DEFAULT_SITE_URL = 'https://hack-quest.com/';
const DEFAULT_URL_PREFIX = 'https://hack-quest.com/HackQuest/PathDetail?id=';
const GSC_INSPECT_ENDPOINT = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled automation via platform token; otherwise require an admin session
    const platformToken = req.headers.get('x-base44-automation') || req.headers.get('x-platform-token');
    const appId = Deno.env.get('BASE44_APP_ID');
    if (!platformToken || platformToken !== appId) {
      let user = null;
      try {
        user = await base44.auth.me();
      } catch {
        // No user session present
      }
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const siteUrl = body.siteUrl || DEFAULT_SITE_URL;
    const urlPrefix = body.urlPrefix || DEFAULT_URL_PREFIX;

    // Get GSC OAuth access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('google_search_console');

    // Fetch all learning paths (courses)
    const paths = await base44.asServiceRole.entities.LearningPath.list();

    if (!paths || paths.length === 0) {
      return Response.json({ total: 0, indexed: 0, failed: 0, neutral: 0, errors: 0, results: [], message: 'No course pages found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const results = [];

    for (const path of paths) {
      const inspectionUrl = `${urlPrefix}${path.id}`;

      let statusData = {
        path_id: path.id,
        path_title: path.title || '',
        url: inspectionUrl,
        verdict: 'NOT_CHECKED',
        coverage_state: '',
        indexing_state: '',
        last_crawl_time: '',
        page_fetch_state: '',
        google_canonical: '',
        user_canonical: '',
        in_sitemap: false,
        robots_txt_state: '',
        checked_date: today,
        error_message: '',
      };

      try {
        const response = await fetch(GSC_INSPECT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inspectionUrl,
            siteUrl,
            languageCode: 'en-US',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || `HTTP ${response.status}`);
        }

        const ir = data.inspectionResult?.indexStatusResult || {};
        statusData.verdict = ir.verdict || 'NEUTRAL';
        statusData.coverage_state = ir.coverageState || '';
        statusData.indexing_state = ir.indexingState || '';
        statusData.last_crawl_time = ir.lastCrawlTime || '';
        statusData.page_fetch_state = ir.pageFetchState || '';
        statusData.google_canonical = ir.googleCanonical || '';
        statusData.user_canonical = ir.userCanonical || '';
        statusData.in_sitemap = (ir.sitemap || []).length > 0;
        statusData.robots_txt_state = ir.robotsTxtState || '';
      } catch (err) {
        statusData.error_message = err.message;
      }

      // Upsert: update existing record or create new
      const existing = await base44.asServiceRole.entities.IndexingStatus.filter({ path_id: path.id });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.IndexingStatus.update(existing[0].id, statusData);
      } else {
        await base44.asServiceRole.entities.IndexingStatus.create(statusData);
      }

      results.push({
        path_title: path.title,
        verdict: statusData.verdict,
        coverage_state: statusData.coverage_state,
        error: statusData.error_message || null,
      });

      // Rate limit: 200ms between calls (stays within 600/min quota)
      await new Promise(r => setTimeout(r, 200));
    }

    return Response.json({
      total: paths.length,
      indexed: results.filter(r => r.verdict === 'PASS').length,
      failed: results.filter(r => r.verdict === 'FAIL').length,
      neutral: results.filter(r => r.verdict === 'NEUTRAL').length,
      errors: results.filter(r => r.error).length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}