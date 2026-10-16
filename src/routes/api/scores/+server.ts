import { json } from '@sveltejs/kit';
import { GENERATOR_VERSION } from '#lib/game/pieces.js';
import { blockKey, validateSubmission } from '#lib/server/scores.js';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { TEST_SECRET, verifyTurnstile } from '#lib/server/turnstile.js';

// Live data: never built ahead of time.
export const prerender = false;

/** How many scores the table can show: the top 10, or the top 100. */
const LIMITS = [10, 100];

/** The top scores for the current version of the piece rules. */
export const GET: RequestHandler = async ({ url }) => {
	const db = env.DB;
	if (!db) return json({ error: 'Scores are unavailable.' }, { status: 503 });
	const requested = Number(url.searchParams.get('limit'));
	const limit = LIMITS.includes(requested) ? requested : 10;

	const { results } = await db
		.prepare(
			`SELECT initials, score, level, rows, chains, longest_chain AS longestChain,
				tips, offline, created_at AS createdAt
			FROM scores WHERE generator_version = ?
			ORDER BY score DESC, created_at ASC LIMIT ?`
		)
		.bind(GENERATOR_VERSION, limit)
		.all();

	return json({ scores: results }, { headers: { 'cache-control': 'no-store' } });
};

/** Submit a score: checked, then stored. Returns its position on the table. */
export const POST: RequestHandler = async ({ request }) => {
	const db = env.DB;
	if (!db) return json({ error: 'Scores are unavailable.' }, { status: 503 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid submission.' }, { status: 400 });
	}

	// Are you human? Locally, Cloudflare's always-pass test secret is used instead of the real one.
	const secret = env.TURNSTILE_SECRET_KEY ?? (import.meta.env.DEV ? TEST_SECRET : undefined);
	const token = (body as { turnstileToken?: unknown } | null)?.turnstileToken;
	if (!(await verifyTurnstile(token, secret))) {
		return json({ error: 'Please confirm you are human, then try again.' }, { status: 403 });
	}

	const result = validateSubmission(body);
	if (!result.ok) return json({ error: result.error }, { status: 422 });
	const s = result.submission;

	const blocked = await db
		.prepare('SELECT 1 FROM blocked_initials WHERE initials = ?')
		.bind(blockKey(s.initials))
		.first();
	if (blocked) return json({ error: 'Please choose different initials.' }, { status: 422 });

	await db
		.prepare(
			`INSERT INTO scores
				(initials, score, level, rows, chains, longest_chain, duration_ms, generator_version, tips, offline)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			s.initials,
			s.score,
			s.level,
			s.rows,
			s.chains,
			s.longestChain,
			s.durationMs,
			s.generatorVersion,
			s.tips ? 1 : 0,
			s.offline ? 1 : 0
		)
		.run();

	const higher = await db
		.prepare('SELECT COUNT(*) AS count FROM scores WHERE generator_version = ? AND score > ?')
		.bind(s.generatorVersion, s.score)
		.first<{ count: number }>();

	return json({ rank: (higher?.count ?? 0) + 1 }, { status: 201 });
};
