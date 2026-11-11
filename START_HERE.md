# Start here (for Claude Code)

This is **Slime Slayers**, a multiplayer browser dungeon crawler made by Parker & Wolfie.

1. Read `README.md` (what the game is and how to run it) and `PROGRESS.md` (how the code is built, phase by phase).
2. Read `BALANCE.md` (the current numbers and the `tests/balance.js` tool).
3. Open every photo in `reference/update7/` (01–19) and read `reference/update7/notes.txt`.
4. Update 7 (the brief in `reference/update7/PROMPT.md`) is finished, including the final version: the last two entries in `PROGRESS.md`
   say what the final rounds changed.

Run it: `npm install`, then `npm start`, then open http://localhost:3000. Or open `public/index.html` directly for offline guest mode.
Tests: `node tests/test-logic.js`, `node tests/test-server.js`, plus the browser tests in `tests/` (they need Playwright).
Build the single files: `node tools/build-offline.js`.
