/* The phone rebuilds the table from what the room sends it. These check that the
   rebuilt table is the same table - the bug this exists for put a second copy of
   the River Rat's own card on the board. */
const test = require('node:test');
const assert = require('node:assert');

require('../js/cards.js');
require('../js/poker.js');
require('../js/game.js');
require('../js/bot.js');
const Net = require('../js/net.js');
const { Room } = require('../server/room.js');

function seeded(seed) {
  let x = (seed >>> 0) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/* A room mid-game, and what one seat is sent. */
function tableFor(seatIndex, options) {
  options = options || {};
  const room = new Room({ random: seeded(options.seed || 21) });
  const seats = ['A', 'B', 'C'].slice(0, options.players || 3).map(n => room.join(n).seat);
  if (options.rats === 2) {
    // beat the first Rat so both are on the table at once
    room.engine.io = room.makeIo();
  }
  room.start(seats[0].token, options.difficulty || 'normal');
  if (options.beatARat) {
    const s = room.engine.state;
    s.rats[s.activeRat].defeated = true;
    s.activeRat = 1 - s.activeRat;
    s.collective = [];
    room.engine.roundSetup();
  }
  const payload = room.viewFor(seats[seatIndex].token);
  return { room, seats, payload, table: Net.tableFrom(payload) };
}

test('the Rat’s Hand rebuilds card for card, with no card twice', () => {
  const { room, table, payload } = tableFor(0);
  const ids = table.ratHand.filter(e => e.counts !== false).map(e => e.card.id);
  assert.equal(new Set(ids).size, ids.length, 'no card appears twice: ' + ids.join(','));

  // Same number of cards the room says are in play, and the same face-up ones.
  const real = room.engine.state.ratHand.filter(e => e.counts !== false);
  assert.equal(ids.length, real.length, 'the hand is the size the room dealt');
  const faceUpDrawn = table.ratHand.filter(e => !e.faceDown).map(e => e.card.id).sort();
  assert.deepEqual(faceUpDrawn, payload.view.ratFaceUp.map(c => c.id).sort());
  assert.equal(table.ratHand.filter(e => e.faceDown && !e.inactive).length,
    payload.view.ratFaceDownCount, 'the hidden cards are hidden, and counted');
});

test('the waiting River Rat sits at the front, face down, and is not counted', () => {
  const { table } = tableFor(0);
  assert.equal(table.ratHand[0].inactive, true);
  assert.equal(table.ratHand[0].faceDown, true);
  assert.equal(table.ratHand[0].counts, false);
  assert.equal(table.ratHand.filter(e => e.inactive).length, 1);
});

test('a beaten Rat stays in the hand without being duplicated', () => {
  const { room, table } = tableFor(0, { beatARat: true, seed: 31 });
  // By card, not by rank: the other two Kings are ordinary cards and one may
  // well have been dealt into the Rat's hand.
  const ratCards = room.engine.state.rats.map(r => r.card.id);
  const drawn = table.ratHand.filter(e => ratCards.indexOf(e.card.id) >= 0).map(e => e.card.id);
  assert.equal(new Set(drawn).size, drawn.length, 'neither Rat is on the table twice: ' + drawn.join(','));
  assert.equal(drawn.length, 2, 'both Rats are on the table');
  assert.equal(table.ratHand.filter(e => e.inactive).length, 0, 'none of them is waiting now');
});

test('the phone draws its own hand and nobody else’s', () => {
  const { room, seats, payload, table } = tableFor(1, { players: 3 });
  const me = payload.you.id;
  assert.deepEqual(table.players[me].hand.map(c => c.id), payload.view.myHand.map(c => c.id));
  table.players.forEach(p => {
    if (p.i === me) return;
    assert.ok(p.hand.every(c => c.id.startsWith('~')), 'another seat is drawn as blanks');
    const real = room.engine.state.players[p.i].hand.length;
    assert.equal(p.hand.length, real, 'with the right number of cards');
  });
});

test('the rest of the table matches what the room has', () => {
  const { room, table, payload } = tableFor(0);
  const s = room.engine.state;
  assert.equal(table.round, s.round);
  assert.equal(table.market.map(c => c.id).join(), s.market.map(c => c.id).join());
  assert.equal(table.marketCapacity, s.marketCapacity);
  assert.equal(table.deck.length, s.deck.length);
  assert.equal(table.debtPile.length, s.debtPile.length);
  assert.equal(table.prediction, s.prediction);
  assert.equal(table.current, s.current);
  assert.equal(table.collective.length, s.collective.length);
  assert.equal(table.activeRat, s.activeRat);
  assert.equal(table.rats[table.activeRat].card.s, s.rats[s.activeRat].card.s);
  assert.equal(table.jokers.length, 2);
});

test('the waiting Rat is drawn without giving away which King it is', () => {
  const { room, table } = tableFor(0);
  const waiting = table.ratHand.find(e => e.inactive);
  const realWaiting = room.engine.state.rats.find((r, i) => i !== room.engine.state.activeRat);
  assert.notEqual(waiting.card.id, realWaiting.card.id, 'the phone was not told which King it is');
  assert.equal(waiting.card.s, null);
});
