# Plan — Shareable Custom Games with Per-Token Leaderboard

## Goal
Let a player create a custom font-guessing game (pick fonts + how many to guess from), get a
**unique shareable URL**, and have that URL carry its **own leaderboard**. Friends open the link,
play the same *settings* (fonts + count), and try to beat each other.

## Decision (confirmed)
**Settings-only token.** The token stores only the font pool + font count. Each player gets a
freshly randomised set of phrases/order via the existing
[`generateCustomQuestions()`](src/lib/utils/generateQuestions.ts:117). The per-token leaderboard
ranks by **score descending, then time ascending**. No deterministic seed is stored.

> Trade-off: games are not pixel-identical between players (different phrases), but the build is far
> simpler and the competition (who scored highest / fastest) is still meaningful.

---

## Architecture Overview

```mermaid
flowchart TD
    A[CustomConfigSelector] -->|POST /api/custom-game| B[custom_games row + token]
    B --> C[Share URL /play/token]
    C -->|open link| D[/play/token route load fn]
    D -->|fetch settings| E[gameStore hydrated as custom + shareToken]
    E --> F[Countdown then Playing]
    F --> G[ResultScreen shared variant]
    G -->|POST score| H[custom_game_scores row]
    G --> I[CustomLeaderboard token]
    H --> I
    G -->|copy link| C
```

---

## 1. Database (Supabase)

New migration file: `supabase/migrations/2026XXXXXXXXXX_add_custom_games.sql`
(also reflect in [`supabase/schema.sql`](supabase/schema.sql:1)).

### Table: custom_games
| column        | type          | notes                                            |
|---------------|---------------|--------------------------------------------------|
| token         | text PK       | short unique id (e.g. 8 chars, base62)           |
| fonts         | jsonb         | array of font names, length 2..4                 |
| font_count    | integer       | redundant but handy; check 2..4                  |
| creator_name  | text null     | optional display name of the creator            |
| created_at    | timestamptz   | default now()                                    |

### Table: custom_game_scores
| column      | type        | notes                                          |
|-------------|-------------|------------------------------------------------|
| id          | uuid PK     | default gen_random_uuid()                      |
| token       | text        | FK-ish reference to custom_games.token; indexed|
| name        | text        | player name, max 32                            |
| score       | integer     | 0..CUSTOM_QUESTION_COUNT                        |
| time_ms     | integer     | tiebreaker                                      |
| created_at  | timestamptz | default now()                                  |

Index: `create index on custom_game_scores (token, score desc, time_ms asc);`

### RLS (mirror existing public pattern)
- `custom_games`: public **select**; **insert** allowed (creation happens client-initiated via API).
- `custom_game_scores`: public **select** + **insert**; no update/delete.

> Note: inserts in the current app go through SvelteKit API routes using the anon key, so the
> policies stay permissive like the existing `leaderboard` table.

---

## 2. Backend (SvelteKit API routes)

Reuse the server Supabase client pattern from
[`/api/submit-score`](src/routes/api/submit-score/+server.ts:8).

### a) `POST /api/custom-game/+server.ts`
- Body: `{ fonts: string[], creatorName?: string }`.
- Validate: every font ∈ [`FONTS`](src/lib/data/fonts.ts:8), length 2..4, no duplicates,
  `creatorName` ≤ 32 chars.
- Generate a unique token (retry on collision).
- Insert into `custom_games`; return `{ token }`.

### b) `GET /api/custom-game/[token]/+server.ts` (or a `+page.server.ts` load — see §3)
- Look up token → `{ fonts, font_count, creator_name }` or 404.

### c) `POST /api/custom-game/[token]/score/+server.ts`
- Body: `{ name, score, time_ms }`.
- Validate token exists; `name` ≤ 32, `score` 0..10, `time_ms` ≥ 0.
- Insert into `custom_game_scores`; return `{ ok: true, rank }` (rank by score desc, time asc).

---

## 3. Routing — `/play/[token]`

New route `src/routes/play/[token]/+page.svelte` (+ `+page.server.ts` load).
- `+page.server.ts` `load`: fetch the custom game by token (settings-only). 404 → friendly
  "game not found" state.
- `+page.svelte`: on mount, hydrate the game store into custom mode using the stored fonts,
  set `shareToken`, build questions via
  [`generateCustomQuestions()`](src/lib/utils/generateQuestions.ts:117), and enter the countdown.
  Renders the same phase components as the home page (Countdown / GameScreen / AnswerButtons /
  ResultScreen) — likely by reusing the same phase-switch markup as
  [`+page.svelte`](src/routes/+page.svelte:62). Consider extracting the phase switch into a shared
  component to avoid duplication.

---

## 4. Store changes — [`gameStore.ts`](src/lib/stores/gameStore.ts:1)
- Extend `GameState` with `shareToken: string | null` and `creatorName: string | null`.
- Add to `initialState` and to `startGameWithDifficulty` (accept optional token/creator, default null).
- Keep `score` / per-question `correct` as already present.

---

## 5. UI changes

### CustomConfigSelector ([existing](src/lib/components/CustomConfigSelector.svelte:1))
- After fonts chosen, add an optional **"Your name (for the leaderboard)"** input.
- Replace the local-only `start()` with: `POST /api/custom-game` → receive token → navigate to
  `/play/[token]` (so the creator plays the shared game too and the URL is shareable immediately).
- Show the **share link with a Copy button** once the token exists.

### ResultScreen ([existing](src/lib/components/ResultScreen.svelte:1))
Add a third variant for **shared custom games** (`isCustom && shareToken`):
- Score + time (already there).
- **Name entry → submit to the per-token leaderboard** via `/api/custom-game/[token]/score`.
- **Share link + Copy** button.
- Buttons: *Play again* (same token), *View this game's leaderboard*, *Create your own game*.
- The existing local-only custom variant (no token) stays as a fallback.

### CustomLeaderboard (new `src/lib/components/CustomLeaderboard.svelte`)
- Fetch `custom_game_scores` for the token, ordered score desc, time asc.
- Show creator name + the font set as a header ("Guess between: Roboto, Lato, …").
- Highlight the just-submitted player (reuse pattern from
  [`Leaderboard.svelte`](src/lib/components/Leaderboard.svelte:107)).
- Prominent **Copy share link** + **Play this game** CTA.

---

## 6. i18n
Add keys (all 7 locales) for: creator-name label, share heading, copy / copied, "Game not found",
custom-leaderboard title, "Guess between {fonts}", submit-to-custom-leaderboard, "Create your own
game", "Play this game". Non-`en` may use concise translations; `en` is the fallback.

---

## 7. Security / validation notes
- Server re-validates fonts against the canonical [`FONTS`](src/lib/data/fonts.ts:8) list on both
  game creation and score submission (never trust client).
- Score capped at `CUSTOM_QUESTION_COUNT`; `time_ms` sanity-checked.
- Tokens are random and unguessable-ish (8+ base62 chars); no PII stored beyond optional names.
- This is best-effort anti-cheat only (same model as the existing public leaderboard).

---

## 8. Out of scope (explicitly)
- Deterministic identical questions per token (seeded mode) — deferred; would need a seed column +
  seeded RNG in `generateCustomQuestions`.
- Email notifications for custom games.
- Editing/deleting a custom game after creation.

---

## Suggested implementation order
1. DB migration + `schema.sql` + `supabase.ts` types.
2. `POST /api/custom-game` (create) and `/play/[token]` load + route (creator can play & share).
3. gameStore `shareToken`/`creatorName` plumbing.
4. CustomConfigSelector → create game + share link.
5. Score submission API + ResultScreen shared variant.
6. CustomLeaderboard component.
7. i18n keys.
8. `npm run check`.
