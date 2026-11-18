# Team Melli Manager

A personal, Football-Manager-style game played as the head of Iran's football federation: every men's national team from U15 to senior, a simulated club world that drives form, values and transfers, real competition formats, and a watchable 2D match engine with live ratings and xG.

## Run it

```bash
npm install
npm run dev
```

Other commands: `npm test` (unit and career tests), `npm run calibrate` (match-engine statistics against real-football ranges), `npm run sim` (headless multi-season run), `npm run build`.

## How it is put together

- `src/sim` — the simulation, pure TypeScript with a seeded RNG and a fully serialisable world. `match/engine.ts` is the match engine, `comps/` the competition formats, `intl/` selection, calendar and the FIFA ranking formula, `clubs/` league seasons and transfers, `career/` development and regens.
- `src/worker` — runs the simulation off the main thread.
- `src/ui` — React interface. Saves live in the browser (IndexedDB).
- `pipeline/` — scripts that rebuild `public/data/world.json` from Wikipedia and Wikidata. See `data/REPORT.md` for coverage and gaps.
- `data/overrides/ratings.json` — hand-set ratings for well-known players. Everything else is estimated from club, league, age and caps.

## Data notes

Player attributes are modelled estimates, not official ratings. Formats or draws that have not been published are generated and marked "Format assumed" in the game.
