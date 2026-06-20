import { FONTS, CUSTOM_MIN_FONTS, CUSTOM_MAX_FONTS } from '$lib/data/fonts';

// Canonical set of allowed font names — the server never trusts the client.
export const ALLOWED_FONT_NAMES: ReadonlySet<string> = new Set(FONTS.map((f) => f.name));

export const MAX_CUSTOM_NAME_LENGTH = 32;
export const MAX_CUSTOM_EMAIL_LENGTH = 254;

// Basic, conservative email shape check (defense-in-depth, not full RFC 5322).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Token alphabet: base62, unambiguous enough and URL-safe.
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const TOKEN_LENGTH = 8;

/** Generate a random base62 token (default 8 chars). */
export function generateToken(length: number = TOKEN_LENGTH): string {
	let out = '';
	for (let i = 0; i < length; i++) {
		out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
	}
	return out;
}

/**
 * Validate and normalize a requested custom-game font list.
 * Returns the de-duplicated, canonical font-name array, or an error string.
 */
export function validateFonts(input: unknown): { fonts: string[] } | { error: string } {
	if (!Array.isArray(input)) return { error: 'fonts must be an array' };

	const cleaned: string[] = [];
	for (const f of input) {
		if (typeof f !== 'string') return { error: 'fonts must be strings' };
		if (!ALLOWED_FONT_NAMES.has(f)) return { error: `unknown font: ${f}` };
		if (!cleaned.includes(f)) cleaned.push(f);
	}

	if (cleaned.length < CUSTOM_MIN_FONTS || cleaned.length > CUSTOM_MAX_FONTS) {
		return { error: `pick between ${CUSTOM_MIN_FONTS} and ${CUSTOM_MAX_FONTS} different fonts` };
	}

	return { fonts: cleaned };
}

/** Validate an optional creator/player display name. Returns cleaned value or null. */
export function cleanOptionalName(input: unknown): string | null {
	if (input === undefined || input === null || input === '') return null;
	if (typeof input !== 'string') return null;
	const trimmed = input.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, MAX_CUSTOM_NAME_LENGTH);
}

/**
 * Validate an optional player email. Returns:
 *  - `{ email: string }`  for a valid address,
 *  - `{ email: null }`    when omitted/empty (email is optional), or
 *  - `{ error: string }`  when a value is present but malformed.
 */
export function cleanOptionalEmail(
	input: unknown
): { email: string | null } | { error: string } {
	if (input === undefined || input === null || input === '') return { email: null };
	if (typeof input !== 'string') return { error: 'email must be a string' };
	const trimmed = input.trim();
	if (!trimmed) return { email: null };
	if (trimmed.length > MAX_CUSTOM_EMAIL_LENGTH || !EMAIL_RE.test(trimmed)) {
		return { error: 'invalid email' };
	}
	return { email: trimmed };
}
