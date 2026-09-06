/* The request shapes a phone uses, tested without any HTTP. */
const test = require('node:test');
const assert = require('node:assert');

require('../js/cards.js');
require('../js/poker.js');
require('../js/game.js');
require('../js/bot.js');
const { Room } = require('../server/room.js');
const Api = require('../server/api.js');

function seeded(seed) {
  let x = (seed >>> 0) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
const call = (room, action, body, query) => Api.handle(room, action, body, query);

test('joining hands back a token and a seat', () => {
  const room = new Room({ random: seeded(11) });
  const res = call(room, 'join', { name: 'Dion' });
  assert.equal(res.status, 200);
  assert.ok(res.data.token);
  assert.equal(res.data.seat.name, 'Dion');
  assert.equal(res.data.code, room.code);
});

test('every other action needs a token from this table', () => {
  const room = new Room({ random: seeded(12) });
  call(room, 'join', { name: 'Dion' });
  assert.equal(call(room, 'view', {}).status, 401);
  assert.equal(call(room, 'view', { token: 'made-up' }).status, 403);
  assert.equal(call(room, 'start', { token: 'made-up' }).status, 403);
});

test('the lobby can be arranged from a phone', () => {
  const room = new Room({ random: seeded(13) });
  const host = call(room, 'join', { name: 'Dion' }).data;
  const guest = call(room, 'join', { name: 'Marit' }).data;

  // pick a suit; if someone holds it, the two seats swap rather than collide
  const wanted = guest.seat.suit;
  const after = call(room, 'seat', { token: host.token, suit: wanted }).data;
  assert.equal(after.you.suit, wanted);
  assert.equal(after.seats.filter(s => s.suit === wanted).length, 1, 'no two seats share a suit');

  assert.equal(call(room, 'seat', { token: host.token, name: 'Dion Z' }).data.you.name, 'Dion Z');
  assert.equal(call(room, 'bot', { token: host.token }).status, 200);
  assert.equal(room.seats.length, 3);
  assert.equal(call(room, 'bot', { token: guest.token }).status, 400, 'guests cannot add bots');
  assert.equal(call(room, 'remove', { token: host.token, seat: 2 }).status, 200);
  assert.equal(room.seats.length, 2);
});

test('starting deals the game and hands each phone its own view', () => {
  const room = new Room({ random: seeded(14) });
  const host = call(room, 'join', { name: 'A' }).data;
  const guest = call(room, 'join', { name: 'B' }).data;
  assert.equal(call(room, 'start', { token: guest.token }).status, 400, 'only the host starts');

  const started = call(room, 'start', { token: host.token, difficulty: 'first' });
  assert.equal(started.status, 200);
  assert.equal(started.data.status, 'playing');
  assert.ok(started.data.view, 'the host is given a view of the table');
  assert.equal(started.data.view.myHand.length, 2);
  assert.ok(!started.data.view.unseen, 'the pool of unseen cards stays on the server');

  const theirs = call(room, 'view', { token: guest.token }).data;
  assert.notDeepEqual(theirs.view.myHand.map(c => c.id), started.data.view.myHand.map(c => c.id));
});

test('an answer that arrives twice is not an error', async () => {
  const room = new Room({ random: seeded(15) });
  const host = call(room, 'join', { name: 'A' }).data;
  call(room, 'start', { token: host.token, difficulty: 'normal' });
  await new Promise(r => setImmediate(r));

  const asking = room.prompt;
  assert.ok(asking);
  const spec = call(room, 'view', { token: host.token }).data.prompt.spec;
  const answer = spec.options ? spec.options[0].value : null;
  assert.equal(call(room, 'answer', { token: host.token, promptId: asking.id, answer }).status, 200);
  // the same tap again, or a retry after a dropped connection
  const again = call(room, 'answer', { token: host.token, promptId: asking.id, answer });
  assert.equal(again.status, 200, 'a repeated answer just gets the current table back');
});

test('a phone waiting on the long poll is answered when the table changes', async () => {
  const room = new Room({ random: seeded(16) });
  const host = call(room, 'join', { name: 'A' }).data;
  const at = room.version;
  let done = false;
  const waiting = Api.waitThenView(room, host.token, at, 50, (fire, ms) => setTimeout(fire, ms))
    .then(res => { done = true; return res; });
  assert.equal(done, false);
  call(room, 'join', { name: 'B' });
  const res = await waiting;
  assert.equal(res.status, 200);
  assert.ok(res.data.seats.length === 2);
});

test('the long poll gives up quietly rather than hanging forever', async () => {
  const room = new Room({ random: seeded(17) });
  const host = call(room, 'join', { name: 'A' }).data;
  const res = await Api.waitThenView(room, host.token, room.version, 20,
    (fire, ms) => setTimeout(fire, ms));
  assert.equal(res.status, 200, 'it returns the table as it stands');
  assert.equal(res.data.version, room.version);
});
