/**
 * One-shot test script for the daily game report email.
 * Reads secrets from .env and sends a real email for TODAY's data.
 *
 * Usage:
 *   node scripts/test-daily-report.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Load .env ────────────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env');
const env = Object.fromEntries(
	readFileSync(envPath, 'utf8')
		.split('\n')
		.filter((l) => l && !l.startsWith('#') && l.includes('='))
		.map((l) => {
			const idx = l.indexOf('=');
			return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
		})
);

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const RESEND_API_KEY = env['RESEND_API_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY) {
	console.error('❌  Missing one of: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY in .env');
	process.exit(1);
}

// ── Date range: yesterday JST ────────────────────────────────────────────────
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const nowJst = new Date(Date.now() + JST_OFFSET_MS);
const todayJstMidnightUtc = new Date(
	Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate()) - JST_OFFSET_MS
);
const yesterdayJstMidnightUtc = new Date(todayJstMidnightUtc.getTime() - 24 * 60 * 60 * 1000);

const rangeStart = yesterdayJstMidnightUtc.toISOString();
const rangeEnd   = todayJstMidnightUtc.toISOString();
const dateLabel  =
	new Date(yesterdayJstMidnightUtc.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10) + ' JST';

console.log(`📅  Reporting for: ${dateLabel}  (${rangeStart} → ${rangeEnd})`);

// ── Fetch game_plays ─────────────────────────────────────────────────────────
const supabaseUrl = SUPABASE_URL.replace(/\/$/, '');
const resp = await fetch(
	`${supabaseUrl}/rest/v1/game_plays?created_at=gte.${rangeStart}&created_at=lt.${rangeEnd}&select=difficulty,completed`,
	{
		headers: {
			apikey: SERVICE_ROLE_KEY,
			Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
			Accept: 'application/json',
		},
	}
);

if (!resp.ok) {
	console.error('❌  Supabase error:', resp.status, await resp.text());
	process.exit(1);
}

const rows = await resp.json();
console.log(`🎮  Rows fetched: ${rows.length}`);

// ── Aggregate ────────────────────────────────────────────────────────────────
const byDifficulty = {};
for (const row of rows) {
	if (!byDifficulty[row.difficulty]) byDifficulty[row.difficulty] = { total: 0, completed: 0 };
	byDifficulty[row.difficulty].total += 1;
	if (row.completed) byDifficulty[row.difficulty].completed += 1;
}

const totalGames     = rows.length;
const totalCompleted = rows.filter((r) => r.completed).length;

// ── Build HTML ───────────────────────────────────────────────────────────────
const difficultyOrder = ['easy', 'medium', 'hard', 'diabolical'];
const tableRows = difficultyOrder
	.filter((d) => byDifficulty[d])
	.map((d) => {
		const s   = byDifficulty[d];
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
  <h2 style="margin-bottom:4px">🎮 Daily Game Report <span style="font-size:14px;color:#999">[TEST]</span></h2>
  <p style="color:#666;margin-top:0">${dateLabel}</p>

  <p><strong>Total games played:</strong> ${totalGames}<br>
     <strong>Completed:</strong> ${totalCompleted} (${totalGames > 0 ? Math.round((totalCompleted / totalGames) * 100) : 0}%)</p>

  ${totalGames > 0
		? `<table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:8px 12px;text-align:left">Difficulty</th>
        <th style="padding:8px 12px;text-align:center">Played</th>
        <th style="padding:8px 12px;text-align:center">Completed</th>
        <th style="padding:8px 12px;text-align:center">Completion %</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>`
		: `<p style="color:#999">No games were played on this day.</p>`}

  <p style="font-size:12px;color:#aaa;margin-top:32px">Sent automatically by opensansorroboto · 9:00 AM JST</p>
</body>
</html>`;

// ── Send via Resend ──────────────────────────────────────────────────────────
console.log('📨  Sending email via Resend…');
const emailRes = await fetch('https://api.resend.com/emails', {
	method: 'POST',
	headers: {
		Authorization: `Bearer ${RESEND_API_KEY}`,
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		from: 'opensansorroboto <reports@opensansorroboto.com>',
		to: ['arktbks@gmail.com'],
		subject: `[TEST] Game Report — ${dateLabel} (${totalGames} games played)`,
		html,
	}),
});

if (!emailRes.ok) {
	console.error('❌  Resend error:', emailRes.status, await emailRes.text());
	process.exit(1);
}

const result = await emailRes.json();
console.log(`✅  Email sent! Resend ID: ${result.id}`);
