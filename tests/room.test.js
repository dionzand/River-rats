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

    // A finished hand waits to be looked at before the next one is dealt.
    let looked = false;
    Object.keys(tokens).forEach(id => {
      const seen = room.viewFor(tokens[id]);
      if (seen.mustSee) { room.seen(tokens[id], seen.resolution.seq); looked = true; }
    });
    if (looked) continue;

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

/* A room with a clock we control, so "their phone has gone quiet" is testable. */
function roomWithClock(seed) {
  let clock = 1000000;
  const room = new Room({ random: seeded(seed || 40), now: () => clock });
  return { room, tick: ms => { clock += ms; } };
}

test('leaving the lobby gives up the seat', () => {
  const { room } = roomWithClock(41);
  const host = room.join('A').seat;
  const guest = room.join('B').seat;
  assert.equal(room.leave(guest.token).left, true);
  assert.equal(room.seats.length, 1);
  assert.equal(room.seats[0].id, 0, 'the seats renumber');
  assert.ok(room.viewFor(guest.token).error, 'their token no longer works');
});

test('the last person leaving the lobby closes the table', () => {
  const { room } = roomWithClock(42);
  const host = room.join('A').seat;
  room.leave(host.token);
  assert.equal(room.status, 'abandoned');
  assert.equal(room.seats.length, 0);
});

test('leaving mid-game hands the seat to a bot rather than stranding the table', async () => {
  const { room } = roomWithClock(43);
  const a = room.join('A').seat, b = room.join('B').seat;
  room.start(a.token, 'normal');
  await new Promise(r => setImmediate(r));

  // whoever is being asked walks off
  const asking = room.prompt;
  assert.ok(asking, 'somebody is being asked something');
  const walker = asking.seat === 0 ? a : b;
  const stayer = asking.seat === 0 ? b : a;
  room.leave(walker.token);
  await new Promise(r => setImmediate(r));

  assert.ok(!room.error, room.error);
  assert.notEqual(room.status, 'abandoned', 'someone is still playing');
  assert.ok(room.viewFor(stayer.token).seats.some(s => s.away), 'the table can see they went');

  // the game keeps moving: play on as the one who stayed
  for (let i = 0; i < 60 && room.status === 'playing'; i++) {
    await new Promise(r => setImmediate(r));
    const now = room.prompt;
    if (!now) continue;
    if (now.seat !== stayer.id) { room.sweep(); continue; }
    const seen = room.viewFor(stayer.token);
    room.answer(stayer.token, now.id, tap(seen.prompt.spec));
  }
  assert.ok(room.engine.state.round >= 1);
  assert.ok(!room.error, room.error);
});

test('a phone that goes quiet does not hold up the table', async () => {
  const { room, tick } = roomWithClock(44);
  const a = room.join('A').seat, b = room.join('B').seat;
  room.start(a.token, 'normal');
  await new Promise(r => setImmediate(r));

  const asking = room.prompt;
  const quiet = asking.seat === 0 ? a : b;
  const awake = asking.seat === 0 ? b : a;
  const promptId = asking.id;

  tick(20000);                    // one long-poll cycle: still fine
  room.sweep();
  assert.equal(room.prompt && room.prompt.id, promptId, 'a lull is not a departure');

  tick(80000);                    // three cycles missed: they are gone
  room.markSeen(room.seats[awake.id]);
  room.sweep();
  await new Promise(r => setImmediate(r));
  assert.notEqual(room.prompt && room.prompt.id, promptId,
    'the question was answered for them so the table moves on');
  assert.ok(!room.error, room.error);
});

test('a table everyone has walked away from closes itself', async () => {
  const { room, tick } = roomWithClock(45);
  const a = room.join('A').seat, b = room.join('B').seat;
  room.start(a.token, 'normal');
  await new Promise(r => setImmediate(r));

  tick(11 * 60 * 1000);           // both phones gone, and a long time passing
  room.sweep();
  await new Promise(r => setImmediate(r));
  assert.equal(room.status, 'abandoned');
  assert.equal(room.prompt, null, 'nothing is left waiting for an answer');
});

test('a closed table leaves no promise parked', async () => {
  const { room } = roomWithClock(46);
  const a = room.join('A').seat;
  room.start(a.token, 'normal');
  await new Promise(r => setImmediate(r));
  assert.ok(room.prompt);

  let unwound = false;
  const wasPlaying = room.play().then(() => { unwound = true; });
  room.close('abandoned');
  await wasPlaying;
  await new Promise(r => setImmediate(r));
  assert.equal(room.prompt, null);
  assert.ok(unwound, 'the game the room was holding finished rather than hanging');
});

test('a finished hand waits for everyone before the next is dealt', async () => {
  const { room } = roomWithClock(50);
  const a = room.join('A').seat, b = room.join('B').seat;
  room.start(a.token, 'normal');

  // play until a hand resolves
  let resolved = null;
  for (let i = 0; i < 400 && !resolved; i++) {
    await new Promise(r => setImmediate(r));
    const seenA = room.viewFor(a.token);
    if (seenA.resolution) { resolved = seenA; break; }
    const asking = room.prompt;
    if (!asking) continue;
    const tok = asking.seat === 0 ? a.token : b.token;
    room.answer(tok, asking.id, tap(room.viewFor(tok).prompt.spec));
  }
  assert.ok(resolved, 'a hand was played out');
  assert.ok(resolved.resolution.seq >= 1, 'the hand is numbered so a phone knows it is new');

  // the table is holding: no new question while people are still looking
  const roundAtRest = room.engine.state.round;
  assert.equal(room.viewFor(a.token).mustSee, true);
  assert.equal(room.viewFor(b.token).mustSee, true);
  assert.equal(room.prompt, null, 'nobody is asked anything mid-look');
  await new Promise(r => setImmediate(r));
  assert.equal(room.engine.state.round, roundAtRest, 'and no new round is dealt');

  // one person looks; the other has not, so it still holds
  room.seen(a.token, resolved.resolution.seq);
  await new Promise(r => setImmediate(r));
  assert.equal(room.engine.state.round, roundAtRest, 'still waiting on the other phone');
  assert.equal(room.viewFor(a.token).mustSee, false, 'but this one is done looking');

  // when the last one looks, play resumes
  room.seen(b.token, resolved.resolution.seq);
  for (let i = 0; i < 20 && !room.prompt; i++) await new Promise(r => setImmediate(r));
  assert.ok(room.prompt || room.status !== 'playing', 'the table moves on');
  assert.equal(room.viewFor(a.token).resolution, null, 'the finished hand is cleared away');
});

test('a phone that leaves while everyone is looking does not hold the table', async () => {
  const { room } = roomWithClock(51);
  const a = room.join('A').seat, b = room.join('B').seat;
  room.start(a.token, 'normal');

  let resolution = null;
  for (let i = 0; i < 400 && !resolution; i++) {
    await new Promise(r => setImmediate(r));
    const seen = room.viewFor(a.token);
    if (seen.resolution) { resolution = seen.resolution; break; }
    const asking = room.prompt;
    if (!asking) continue;
    const tok = asking.seat === 0 ? a.token : b.token;
    room.answer(tok, asking.id, tap(room.viewFor(tok).prompt.spec));
  }
  assert.ok(resolution);

  room.seen(a.token, resolution.seq);        // one looks
  room.leave(b.token);                       // the other walks off
  for (let i = 0; i < 20 && !room.prompt; i++) await new Promise(r => setImmediate(r));
  assert.ok(room.prompt || room.status !== 'playing', 'the table did not stay stuck on the walker');
});
