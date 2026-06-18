/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare Pages Cron Function — Daily Game Report
 *
 * Trigger: 0 0 * * *  (00:00 UTC = 09:00 JST)
 * Configure in Cloudflare dashboard → Pages project → Settings → Functions → Cron Triggers
 *
 * Queries the production `game_plays` table for rows created the previous
 * calendar day (JST), then sends a summary email via Resend.
 */

interface Env {
	VITE_SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	RESEND_API_KEY: string;
}

interface GamePlaysRow {
	difficulty: string;
	completed: boolean;
}

interface DifficultyStats {
	total: number;
	completed: number;
}

const scheduled: ExportedHandlerScheduledHandler<Env> = async (_event, env, _ctx) => {
	// ── 1. Determine yesterday's date range in JST (UTC+9) ──────────────────
	const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

	// Current moment expressed as JST wall-clock
	const nowJst = new Date(Date.now() + JST_OFFSET_MS);

	// Midnight of today (JST) and midnight of yesterday (JST), both as UTC instants
	const todayJstMidnightUtc = new Date(
		Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate()) - JST_OFFSET_MS
	);
	const yesterdayJstMidnightUtc = new Date(todayJstMidnightUtc.getTime() - 24 * 60 * 60 * 1000);

	const rangeStart = yesterdayJstMidnightUtc.toISOString();
	const rangeEnd = todayJstMidnightUtc.toISOString();

	// Human-readable label for the report (e.g. "2026-06-18")
	const dateLabel =
		new Date(yesterdayJstMidnightUtc.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10) +
		' JST';

	// ── 2. Fetch rows from Supabase using service-role key ───────────────────
	const supabaseUrl = env.VITE_SUPABASE_URL.replace(/\/$/, '');
	const response = await fetch(
		`${supabaseUrl}/rest/v1/game_plays?created_at=gte.${rangeStart}&created_at=lt.${rangeEnd}&select=difficulty,completed`,
		{
			headers: {
				apikey: env.SUPABASE_SERVICE_ROLE_KEY,
				Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
				Accept: 'application/json'
			}
		}
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Supabase query failed: ${response.status} ${body}`);
	}

	const rows: GamePlaysRow[] = await response.json();

	// ── 3. Aggregate stats ───────────────────────────────────────────────────
	const byDifficulty: Record<string, DifficultyStats> = {};
	for (const row of rows) {
		if (!byDifficulty[row.difficulty]) {
			byDifficulty[row.difficulty] = { total: 0, completed: 0 };
		}
		byDifficulty[row.difficulty].total += 1;
		if (row.completed) byDifficulty[row.difficulty].completed += 1;
	}

	const totalGames = rows.length;
	const totalCompleted = rows.filter((r) => r.completed).length;

	// ── 4. Build email HTML ──────────────────────────────────────────────────
	const difficultyOrder = ['easy', 'medium', 'hard', 'diabolical'];
	const tableRows = difficultyOrder
		.filter((d) => byDifficulty[d])
		.map((d) => {
			const s = byDifficulty[d];
			const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
			return `<tr>
        <td style="padding:6px 12px;text-transform:capitalize;border-bottom:1px solid #eee">${d}</td>
        <td style="padding:6px 12px;text-align:center;border-bottom:1px solid #eee">${s.total}</td>
        <td style="padding:6px 12px;text-align:center;border-bottom:1px solid #eee">${s.completed}</td>
        <td style="padding:6px 12px;text-align:center;border-bottom:1px solid #eee">${pct}%</td>
      </tr>`;
		})
		.join('\n');

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#222;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:4px">🎮 Daily Game Report</h2>
  <p style="color:#666;margin-top:0">${dateLabel}</p>

  <p><strong>Total games played:</strong> ${totalGames}<br>
     <strong>Completed:</strong> ${totalCompleted} (${totalGames > 0 ? Math.round((totalCompleted / totalGames) * 100) : 0}%)</p>

  ${
		totalGames > 0
			? `<table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:8px 12px;text-align:left">Difficulty</th>
        <th style="padding:8px 12px;text-align:center">Played</th>
        <th style="padding:8px 12px;text-align:center">Completed</th>
        <th style="padding:8px 12px;text-align:center">Completion %</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>`
			: `<p style="color:#999">No games were played on this day.</p>`
	}

  <p style="font-size:12px;color:#aaa;margin-top:32px">Sent automatically by opensansorroboto · 9:00 AM JST</p>
</body>
</html>`;

	// ── 5. Send via Resend ───────────────────────────────────────────────────
	const emailRes = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: 'opensansorroboto <reports@opensansorroboto.com>',
			to: ['arktbks@gmail.com'],
			subject: `Game Report — ${dateLabel} (${totalGames} games played)`,
			html
		})
	});

	if (!emailRes.ok) {
		const body = await emailRes.text();
		throw new Error(`Resend send failed: ${emailRes.status} ${body}`);
	}

	console.log(`[daily-report] Sent report for ${dateLabel}: ${totalGames} games`);
};

export default { scheduled };
