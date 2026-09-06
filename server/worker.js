/* River Rats - the room server, for Cloudflare Workers.

   One room is one Durable Object: a single-threaded actor that owns that
   table's game and nothing else. The game itself runs here rather than on the
   phones, so each phone can be told its own hand and nothing more.

   Everything below is plumbing. The rules are in js/game.js, the table is in
   server/room.js, and the request shapes are in server/api.js - all three run
   unchanged in node, which is where they are tested. */

import '../js/cards.js';
import '../js/poker.js';
import '../js/game.js';
import '../js/bot.js';
import './room.js';
import './api.js';

const { Room, makeCode } = globalThis.RRRoom;
const Api = globalThis.RRApi;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, CORS)
  });
}

/* One table. The Durable Object keeps it in memory while people are playing and
   writes the game to storage after every change, so a room that gets evicted
   between turns can pick the game up again at the start of the turn - the same
   way the phone resumes a game you closed. */
export class RiverRatsRoom {
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
    this.room = null;
    this.ready = state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get('room');
      if (saved) this.restore(saved);
    });
  }

  restore(saved) {
    const room = new Room({ code: saved.code });
    room.seats = saved.seats;
    room.status = saved.status;
    room.result = saved.result || null;
    if (saved.game) {
      room.engine.state = saved.game;
      room.engine.io = room.makeIo();
      // The turn that was in flight is gone with the promise that held it, so
      // play resumes at the start of the current player's turn.
      if (room.status === 'playing') room.play();
    }
    this.room = room;
  }

  async persist() {
    if (!this.room) return;
    // A table nobody is at leaves nothing behind.
    if (this.room.status === 'abandoned') {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.put('room', {
      code: this.room.code,
      seats: this.room.seats,
      status: this.room.status,
      result: this.room.result,
      game: this.room.engine.state
    });
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const code = url.searchParams.get('code');
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    if (action === 'create') {
      if (this.room) return json({ error: 'that code is taken' }, 409);
      this.room = new Room({ code });
      const joined = this.room.join(body.name);
      await this.persist();
      return json({
        code: this.room.code,
        token: joined.seat.token,
        seat: { id: joined.seat.id, name: joined.seat.name, suit: joined.seat.suit }
      });
    }

    if (!this.room) return json({ error: 'no table with that code' }, 404);

    if (action === 'view') {
      const token = url.searchParams.get('token');
      const since = url.searchParams.get('since');
      const result = await Api.waitThenView(this.room, token, since, 25000,
        (fire, ms) => setTimeout(fire, ms));
      return json(result.data, result.status);
    }

    const result = Api.handle(this.room, action, body, Object.fromEntries(url.searchParams));
    await this.persist();
    return json(result.data, result.status);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);   // ['api','rooms',CODE?,action?]

    // Somebody has opened the address in a browser. Tell them what this is,
    // rather than handing them a bare error - and let it double as the
    // "is it up?" check.
    if (!parts.length) {
      return new Response(
        '<!doctype html><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>River Rats rooms</title>' +
        '<style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;background:#0c171a;' +
        'color:#eef5f4;margin:0;display:grid;place-items:center;min-height:100vh;padding:24px}' +
        'main{max-width:30em}a{color:#e8b64c}code{color:#9db0b3}</style>' +
        '<main><h1>River Rats rooms</h1>' +
        '<p>This is the server that holds the tables when people play on separate ' +
        'phones. It deals the cards, so that nobody\u2019s hand sits on anybody ' +
        'else\u2019s device. It is running.</p>' +
        '<p>The game is at <a href="https://dionzand.github.io/River-rats/">' +
        'dionzand.github.io/River-rats</a> \u2014 choose <em>Separate phones</em> there ' +
        'to start a table.</p>' +
        '<p><code>POST /api/rooms</code> to make one.</p></main>',
        { status: 200, headers: Object.assign({ 'content-type': 'text/html; charset=utf-8' }, CORS) }
      );
    }

    if (parts[0] !== 'api' || parts[1] !== 'rooms') {
      return json({ error: 'not found' }, 404);
    }

    // POST /api/rooms -> a new table with a code nobody is using
    if (parts.length === 2 && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = makeCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const made = await stub.fetch(new Request(
          'https://room/?action=create&code=' + code,
          { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
        ));
        if (made.status !== 409) {
          return json(await made.json(), made.status);
        }
      }
      return json({ error: 'could not find a free code, try again' }, 503);
    }

    // /api/rooms/CODE/action
    const code = (parts[2] || '').toUpperCase();
    const action = parts[3];
    if (!/^[A-Z]{4}$/.test(code) || !action) return json({ error: 'not found' }, 404);

    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const forward = new URL('https://room/');
    forward.searchParams.set('action', action);
    for (const [k, v] of url.searchParams) forward.searchParams.set(k, v);
    return stub.fetch(new Request(forward, {
      method: request.method,
      body: request.method === 'POST' ? await request.text() : undefined,
      headers: { 'content-type': 'application/json' }
    }));
  }
};
