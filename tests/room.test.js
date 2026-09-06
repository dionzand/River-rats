/* A room hosts the game for several phones. The rule these tests exist for: a
   phone is told its own hand and the question addressed to it, and nothing
   else - so a hand is private because the other phones were never sent it. */
const test = require('node:test');
const assert = require('node:assert');

require('../js/cards.js');
require('../js/poker.js');
require('../js/game.js');
require('../js/bot.js');
const { Room } = require('../server/room.js');

function seeded(seed) {
  let x = (seed >>> 0) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/* A person at the table: they see the question and tap the first thing offered.
   Deliberately not the bot brain - a phone is not sent what a bot needs. */
function tap(spec) {
  if (spec.options) return spec.options[0].value;
  const zones = Object.keys(spec.zones || {}).filter(z => spec.zones[z].length);
  if (!zones.length) return null;
  return { zone: zones[0], id: spec.zones[zones[0]][0] };
}

async function playAsPeople(room, tokens, limit) {
  for (let i = 0; i < (limit || 400); i++) {
    await new Promise(r => setImmediate(r));
    if (room.status === 'finished' || room.error) break;
    const asking = room.prompt;
    if (!asking) continue;
    const tok = tokens[asking.seat];
    const seen = room.viewFor(tok);
    assert.ok(seen.prompt, 'the seat being asked is told the question');
    const res = room.answer(tok, asking.id, tap(seen.prompt.spec));
    assert.ok(!res.error, 'answering should be accepted: ' + res.error);
  }
}

test('two phones join by code and get their own seat', () => {
  const room = new Room({ random: seeded(1) });
  assert.match(room.code, /^[A-Z]{4}$/);

  const host = room.join('Dion');
  const guest = room.join('Marit');
  assert.equal(host.seat.id, 0);
  assert.equal(guest.seat.id, 1);
  assert.notEqual(host.seat.token, guest.seat.token);
  assert.notEqual(host.seat.suit, guest.seat.suit, 'each seat takes a different Ace');

  const view = room.viewFor(guest.seat.token);
  assert.equal(view.you.id, 1);
  assert.equal(view.you.host, false);
  assert.equal(view.seats.length, 2);
  assert.ok(!JSON.stringify(view.seats).includes('token'), 'seat tokens are never sent out');
});

test('a stranger with no token is told nothing', () => {
  const room = new Room({ random: seeded(2) });
  room.join('Dion');
  assert.ok(room.viewFor('not-a-token').error);
  assert.ok(room.answer('not-a-token', 'p1', 'x').error);
});

test('only the host can add a bot or start', () => {
  const room = new Room({ random: seeded(3) });
  const host = room.join('Dion');
  const guest = room.join('Marit');
  assert.ok(room.addBot(guest.seat.token).error, 'a guest cannot add bots');
  assert.ok(room.start(guest.seat.token).error, 'a guest cannot start');
  assert.ok(!room.addBot(host.seat.token).error);
  assert.equal(room.seats.length, 3);
  assert.equal(room.seats[2].bot, true);
  assert.ok(!room.start(host.seat.token, 'normal').error);
  assert.equal(room.status, 'playing');
});

test('a phone is never sent another phone’s hand', async () => {
  const room = new Room({ random: seeded(4) });
  const a = room.join('A').seat, b = room.join('B').seat, c = room.join('C').seat;
  room.start(a.token, 'normal');
  await new Promise(r => setImmediate(r));

  for (let step = 0; step < 40 && !room.error; step++) {
    const asking = room.prompt;
    if (asking) {
      // Every other seat's cards must be absent from this seat's view.
      [a, b, c].forEach(seat => {
        const view = room.viewFor(seat.token);
        const mine = view.view.myHand.map(x => x.id);
        const text = JSON.stringify(view);
        room.engine.state.players.forEach(p => {
          if (p.i === seat.id) return;
          p.hand.forEach(card => {
            assert.ok(!mine.includes(card.id), 'another hand leaked into myHand');
            assert.ok(!text.includes('"' + card.id + '"'),
              'seat ' + seat.id + ' was sent ' + card.id + ', which belongs to seat ' + p.i);
          });
        });
        room.engine.state.deck.forEach(card => {
          assert.ok(!text.includes('"' + card.id + '"'), 'a Deck card reached a phone');
        });
        // Only the seat being asked is told the question.
        if (seat.id !== asking.seat) assert.ok(!view.prompt, 'a prompt reached the wrong phone');
        else assert.ok(view.prompt, 'the asked seat was not told the question');
      });
      const tok = [a, b, c][asking.seat].token;
      room.answer(tok, asking.id, tap(room.viewFor(tok).prompt.spec));
    }
    await new Promise(r => setImmediate(r));
  }
  assert.ok(!room.error, room.error);
});

test('answers are refused from the wrong seat or a stale question', async () => {
  const room = new Room({ random: seeded(5) });
  const a = room.join('A').seat, b = room.join('B').seat;
  room.start(a.token, 'normal');
  await new Promise(r => setImmediate(r));
  const asking = room.prompt;
  assert.ok(asking);
  const other = asking.seat === 0 ? b : a;
  assert.ok(room.answer(other.token, asking.id, 'whatever').error, 'not your turn');
  const seat = asking.seat === 0 ? a : b;
  assert.ok(room.answer(seat.token, 'stale-id', 'whatever').error, 'that question has moved on');
});

test('a room plays a whole game through to a result', async () => {
  const room = new Room({ random: seeded(6) });
  const a = room.join('A').seat, b = room.join('B').seat;
  room.addBot(a.token);
  room.start(a.token, 'normal');
  await playAsPeople(room, { 0: a.token, 1: b.token }, 3000);
  assert.ok(!room.error, room.error);
  assert.equal(room.status, 'finished');
  assert.ok(room.result === 'win' || room.result === 'lose');
  assert.ok(room.viewFor(a.token).result);
});

test('two rooms at once do not touch each other', async () => {
  const one = new Room({ random: seeded(7) });
  const two = new Room({ random: seeded(8) });
  const p1 = one.join('One').seat;
  const p2 = two.join('Two').seat;
  one.start(p1.token, 'normal');
  two.start(p2.token, 'expert');
  await new Promise(r => setImmediate(r));

  assert.notEqual(one.code, two.code);
  assert.equal(one.engine.state.players[0].name, 'One');
  assert.equal(two.engine.state.players[0].name, 'Two');
  assert.equal(one.engine.state.difficulty, 'normal');
  assert.equal(two.engine.state.difficulty, 'expert');

  // Answer them alternately, as two tables in the same server would run.
  for (let i = 0; i < 30; i++) {
    for (const [room, seat] of [[one, p1], [two, p2]]) {
      const asking = room.prompt;
      if (asking) room.answer(seat.token, asking.id, tap(room.viewFor(seat.token).prompt.spec));
      await new Promise(r => setImmediate(r));
    }
    assert.equal(one.engine.state.players[0].name, 'One');
    assert.equal(two.engine.state.players[0].name, 'Two');
    assert.equal(one.engine.state.difficulty, 'normal');
    assert.equal(two.engine.state.difficulty, 'expert');
  }
  assert.ok(!one.error && !two.error);
});

test('phones waiting for a change are woken when something happens', async () => {
  const room = new Room({ random: seeded(9) });
  const a = room.join('A').seat;
  let woke = false;
  const waiting = room.waitForChange(room.version).then(() => { woke = true; });
  assert.equal(woke, false);
  room.join('B');
  await waiting;
  assert.equal(woke, true, 'a new arrival wakes the phones already looking at the lobby');
});
