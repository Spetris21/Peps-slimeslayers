# Putting Slime Slayers on a website

Owners: Parker & Wolfie. School project — remember to only play at home!

The game is one Node.js server (`server.js`) that serves the pages and runs every multiplayer dungeon. To have accounts,
parties, trading and leaderboards online you need a host that **runs Node.js 18 or newer** and **keeps WebSocket connections open**
(for example Render, Railway, Fly.io, or your own server / VPS).

A host that only serves files (GitHub Pages, a plain static site) can't run the server. There you can only put
`SlimeSlayers-offline.html`, which plays as a guest (solo, saved in the browser).

## Steps

1. Put the project on the host (connect the git repository, or upload the folder without `node_modules` and `data`).
2. Build command: `npm install`. Start command: `npm start`.
3. The host gives the server its port through the `PORT` setting automatically.
4. Open the address the host gives you. On `https://` the game connects with secure WebSockets (`wss://`) by itself.
5. Health check (if the host asks for one): `/health` answers `ok` and the number of players online.

Host the game at the root of a domain or subdomain (`https://slimeslayers.example`), not in a sub-folder: the game connects back
to the same address it was loaded from.

## Keep the accounts safe: a disk that stays

Accounts and progress are saved in `data/db.json` (a backup `db.json.bak` is kept next to it). **Many hosts wipe their files
every time you deploy or restart.** Give the server a persistent disk / volume and point `DATA_DIR` at it, for example
`DATA_DIR=/var/data/slimeslayers`. Copy `db.json` somewhere safe now and then.

Run **one** copy of the server. Runs, parties and the World Boss live in that one process, so don't scale it to several copies.

## Settings (environment variables)

| Setting | Default | What it does |
|---|---|---|
| `PORT` | 3000 | The port to listen on (hosts set this for you) |
| `DATA_DIR` | `./data` | Where accounts are saved: put it on a disk that stays |
| `MAX_PLAYERS` | 300 | Most connections at once; the next player is told "The server is full, try again soon" |
| `MAX_PER_IP` | 12 | Most connections from one address (a family on one Wi-Fi shares an address) |
| `ALLOWED_ORIGINS` | (only this server's own pages) | Only if the game page is served from a different address than the server, e.g. `https://slimeslayers.example` (comma-separated) |
| `TRUST_PROXY` | off | `1` only if the server can be reached through the host's proxy and nothing else (then the login limits see each player's real address) |

Never set `SS_TEST_HOOKS` or `SS_TEST_RAID` on a real server: they are for the tests only.

## Your own server behind nginx or Caddy

Caddy (HTTPS and WebSockets by itself):

```
slimeslayers.example {
    reverse_proxy localhost:3000
}
```

nginx (inside your `server { ... }` with HTTPS):

```
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
}
```

Keep the server running with a process manager (for example `pm2 start server.js --name slimeslayers`) so it comes back after a reboot.

## What the server already does for you online

- Every hit, reward, price, gate and position is checked by the server, so a modified game can't cheat its way to gear or gold.
- Passwords are stored as salted scrypt hashes, never as text; sessions expire; logins and sign-ups are rate limited.
- Pages are sent gzipped with version tags, so they load fast and browsers only download what changed.
- One broken run or a bad message can't take the server down: the error is logged, that run ends, everyone else keeps playing.
- It saves every 10 seconds and when the host stops it.
- Up to 4 players per dungeon, raid, Pit, Tower or Wilds run; enemies get x1.5 health for every player who joins.
