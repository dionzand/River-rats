/* Plays whole games with a bot that answers every prompt at random, to prove the
   engine never wedges, never loses a card and always reaches a result. */
const test = require('node:test');
const assert = require('node:assert');

require('../js/cards.js');
require('../js/poker.js');
const G = require('../js/game.js');

function seeded(seed) {
  let x = seed >>> 0;
  return function () {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

function makeBot(rnd) {
  const pickOne = arr => arr[Math.floor(rnd() * arr.length)];
  return {
    choose: spec => Promise.resolve(pickOne(spec.options).value),
    pick: spec => {
      const zones = Object.keys(spec.zones).filter(z => spec.zones[z].length);
      if (!zones.length) return Promise.resolve(null);
      if (spec.optional && rnd() < 0.4) return Promise.resolve(null);
      const zone = pickOne(zones);
      return Promise.resolve({ zone, id: pickOne(spec.zones[zone]) });
    },
    passTo: () => Promise.resolve(),
    showResolution: () => Promise.resolve(),
    ratDefeated: () => Promise.resolve(),
    gameOver: () => Promise.resolve()
  };
}

/* Every one of the 52 cards must always be somewhere on the table. */
function census(s) {
  const ids = [];
  const add = c => { if (c && !c.joker) ids.push(c.id); };
  s.deck.forEach(add);
  s.discard.forEach(add);
  s.market.forEach(add);
  s.players.forEach(p => { p.hand.forEach(add); add(p.ace); });
  s.collective.forEach(e => add(e.card));
  s.ratHand.forEach(e => add(e.card));
  s.debtPile.forEach(add);
  s.playerDebt.forEach(add);
  s.rats.forEach(r => r.debt.forEach(add));
  return ids;
}

async function playOne({ seed, players, difficulty }) {
  const rnd = seeded(seed);
  const realRandom = Math.random;
  Math.random = rnd;
  try {
    G.io = makeBot(rnd);
    G.newGame({
      players: ['S', 'H', 'D', 'C'].slice(0, players).map((suit, i) => ({ name: 'P' + i, suit })),
      difficulty
    });
    let turns = 0;
    while (!G.state.over) {
      assert.ok(turns++ < 4000, 'game should finish in a sane number of turns');
      await G.runTurn();
      const ids = census(G.state);
      assert.equal(new Set(ids).size, ids.length, 'no card is in two places at once');
      assert.equal(ids.length, 52, 'all 52 cards are accounted for');
      assert.ok(G.state.collective.length <= G.collectiveTarget() + 12, 'Collective Hand stays sane');
      if (G.shouldResolve()) await G.resolveHand();
      if (G.state.over) break;
      G.nextPlayer();
    }
    assert.ok(G.state.over === 'win' || G.state.over === 'lose');
    if (G.state.over === 'lose') {
      assert.ok(G.state.playerDebt.length >= 5, 'you only lose once you hold five Debt');
    } else {
      assert.ok(G.state.rats.every(r => r.defeated), 'you only win once both Rats are defeated');
    }
    return { result: G.state.over, rounds: G.state.round, turns };
  } finally {
    Math.random = realRandom;
  }
}

test('random play always reaches a result, in every mode', async () => {
  const results = { win: 0, lose: 0 };
  for (const difficulty of ['normal', 'advanced', 'expert']) {
    for (let players = 1; players <= 4; players++) {
      for (let seed = 1; seed <= 12; seed++) {
        const r = await playOne({ seed: seed * 7919 + players * 31 + difficulty.length, players, difficulty });
        results[r.result] += 1;
      }
    }
  }
  assert.equal(results.win + results.lose, 144, 'every game reached an ending');
});

/* Stacks the table so a single call to resolveHand has a known outcome.
   The two Rats are pinned to fixed suits so no staged card can collide with a King. */
function stage({ ours, theirs, ratSuit = 'C', ratDebt = 0, playerDebt = 0, pot = 1 }) {
  const C = globalThis.RRCards;
  G.io = makeBot(seeded(9));
  G.newGame({ players: [{ name: 'You', suit: 'S' }], difficulty: 'normal' });
  const s = G.state;
  const other = ['C', 'D', 'H', 'S'].filter(x => x !== ratSuit)[0];
  const grab = code => {
    const ranks = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
    const r = ranks[code.slice(0, -1)] || parseInt(code, 10);
    return C.card(r, code.slice(-1));
  };
  s.rats = [
    { card: C.card(13, ratSuit), debt: [], defeated: false },
    { card: C.card(13, other), debt: [], defeated: false }
  ];
  s.activeRat = 0;
  s.collective = ours.map(c => ({ card: grab(c), faceDown: false }));
  s.ratHand = [{ card: s.rats[0].card, faceDown: false, isRat: true, counts: true }]
    .concat(theirs.map(c => ({ card: grab(c), faceDown: false, counts: true })));
  s.rats[0].debt = new Array(ratDebt).fill(0).map((_, i) => C.card(2 + i, 'C'));
  s.playerDebt = new Array(playerDebt).fill(0).map((_, i) => C.card(2 + i, 'D'));
  s.debtPile = new Array(pot).fill(0).map((_, i) => C.card(2 + i, 'H'));
  s.prediction = 'straight-flush';
  return s;
}

const STRONG = ['AS', 'KS', 'QS', 'JS', 'TS'];   // straight flush
const WEAK = ['2D', '4C', '7H', '9S', 'JD'];     // high card at best

test('the players win a hand and the Debt lands on the River Rat', async () => {
  const s = stage({ ours: STRONG, theirs: WEAK, pot: 3 });
  await G.resolveHand();
  assert.equal(s.rats[0].debt.length, 3);
  assert.equal(s.playerDebt.length, 0);
  assert.equal(s.collective.length, 0, 'a fresh round was dealt');
  assert.equal(s.round, 2);
});

test('the River Rat wins a True Tie', async () => {
  // Two King-high flushes: the rulebook stops at the highest card, so this is a True Tie.
  const s = stage({
    ours: ['KH', 'TH', '8H', '5H', '3H'],
    theirs: ['KS', 'TS', '8S', '5S', '2S'],
    ratSuit: 'C', pot: 2
  });
  await G.resolveHand();
  assert.equal(s.playerDebt.length, 2, 'a True Tie goes to the River Rats');
  assert.equal(s.rats[0].debt.length, 0);
});

test('the Hearts Rat squeezes one extra Debt out of a win', async () => {
  const s = stage({ ours: WEAK, theirs: STRONG, ratSuit: 'H', pot: 1 });
  await G.resolveHand();
  assert.equal(s.playerDebt.length, 2, 'one Debt at stake plus the Rat’s extra');
});

test('five Debt on the players ends the game', async () => {
  const s = stage({ ours: WEAK, theirs: STRONG, playerDebt: 3, pot: 2 });
  await G.resolveHand();
  assert.equal(s.over, 'lose');
});

test('a defeated Rat hands over its bonus and the second Rat steps up', async () => {
  for (const ratSuit of ['S', 'H', 'D', 'C']) {
    const s = stage({ ours: STRONG, theirs: WEAK, ratSuit, ratDebt: 4, playerDebt: 2, pot: 1 });
    const first = s.rats[0];
    await G.resolveHand();
    assert.ok(first.defeated, ratSuit + ': the Rat took its fifth Debt');
    assert.equal(first.debt.length, 0, ratSuit + ': its Debt is discarded');
    assert.equal(s.activeRat, 1, ratSuit + ': the second Rat is now active');
    assert.ok(s.ratHand.some(e => e.card.id === first.card.id), ratSuit + ': the beaten Rat stays in the Rat’s Hand');
    if (ratSuit === 'S') assert.equal(s.marketCapacity, 4);
    if (ratSuit === 'C') assert.equal(s.bonuses.oneLessFaceDown, 1);
    if (ratSuit === 'D') assert.equal(s.bonuses.resolveAtSix, true);
    if (ratSuit === 'H') assert.equal(s.playerDebt.length, 1, 'one Debt card is wiped');
  }
});

test('beating both Rats wins the game', async () => {
  const s = stage({ ours: STRONG, theirs: WEAK, ratDebt: 4 });
  s.rats[1].defeated = true;
  await G.resolveHand();
  assert.equal(s.over, 'win');
});

test('matching the Joker’s Prediction turns a Joker face up', async () => {
  const s = stage({ ours: STRONG, theirs: WEAK });
  await G.resolveHand();
  assert.equal(s.jokers.filter(j => j.faceUp).length, 1);
});

test('a missed prediction leaves the Jokers face down', async () => {
  const s = stage({ ours: ['2D', '4C', '7H', '9S', 'JD'], theirs: WEAK });
  await G.resolveHand();
  assert.equal(s.jokers.filter(j => j.faceUp).length, 0);
});

test('the Diamonds Rat seeds the Collective Hand at Round Setup', async () => {
  const s = stage({ ours: WEAK, theirs: STRONG, ratSuit: 'D' });
  await G.resolveHand();
  assert.equal(s.collective.length, 1);
  assert.equal(s.collective[0].seeded, true);
});

test('the Clubs Rat deals itself two extra face-down cards', async () => {
  const s = stage({ ours: WEAK, theirs: STRONG, ratSuit: 'C' });
  await G.resolveHand();
  assert.equal(s.ratHand.filter(e => e.faceDown && !e.inactive).length, 4);
});

test('a saved game survives a round trip through JSON', async () => {
  const rnd = seeded(4242);
  const realRandom = Math.random;
  Math.random = rnd;
  try {
    G.io = makeBot(rnd);
    G.newGame({ players: [{ name: 'You', suit: 'S' }], difficulty: 'normal' });
    for (let i = 0; i < 6; i++) {
      await G.runTurn();
      if (G.shouldResolve()) await G.resolveHand();
      if (G.state.over) break;
      G.nextPlayer();
    }
    const before = census(G.state).sort().join(',');
    G.state = JSON.parse(JSON.stringify(G.state));
    assert.equal(census(G.state).sort().join(','), before);
    await G.runTurn();
    assert.equal(census(G.state).length, 52);
  } finally {
    Math.random = realRandom;
  }
});

test('an eager player cannot loop forever on the Spades power', async () => {
  // Answers every prompt with the first option and the first card - the greediest
  // possible player. The Market refills as it is emptied, so the discard action has
  // to be bounded to the cards that were there when it started.
  let calls = 0;
  const realRandom = Math.random;
  Math.random = seeded(31337);
  try {
    G.io = {
      choose: spec => { calls++; return Promise.resolve(spec.options[0].value); },
      pick: spec => {
        calls++;
        const zones = Object.keys(spec.zones).filter(z => spec.zones[z].length);
        return Promise.resolve(zones.length ? { zone: zones[0], id: spec.zones[zones[0]][0] } : null);
      },
      passTo: () => Promise.resolve(),
      showResolution: () => Promise.resolve(),
      ratDefeated: () => Promise.resolve(),
      gameOver: () => Promise.resolve()
    };
    G.newGame({ players: [{ name: 'You', suit: 'S' }], difficulty: 'normal' });
    for (let i = 0; i < 12; i++) {
      await G.runTurn();
      if (G.state.over) break;
      if (G.shouldResolve()) await G.resolveHand();
      if (G.state.over) break;
    }
    assert.ok(calls < 400, 'the turn loop stays bounded, got ' + calls + ' prompts');
    assert.equal(census(G.state).length, 52);
  } finally {
    Math.random = realRandom;
  }
});

test('the waiting River Rat leads the Rat’s Hand, ahead of the active one', async () => {
  const s = stage({ ours: WEAK, theirs: STRONG, ratSuit: 'C' });
  await G.resolveHand();
  const rats = s.ratHand.filter(e => e.isRat);
  assert.equal(rats.length, 2);
  assert.equal(s.ratHand[0], rats[0], 'the waiting Rat is the first card of the hand');
  assert.equal(rats[0].inactive, true);
  assert.equal(rats[0].faceDown, true);
  assert.equal(rats[1].card.id, s.rats[s.activeRat].card.id, 'the active Rat comes next');
  assert.equal(rats[1].faceDown, false);
});

test('a beaten Rat keeps its place in the hand once the second Rat is active', async () => {
  const s = stage({ ours: STRONG, theirs: WEAK, ratSuit: 'C', ratDebt: 4 });
  const beaten = s.rats[0].card.id;
  await G.resolveHand();
  const rats = s.ratHand.filter(e => e.isRat);
  assert.equal(rats.length, 2, 'both Rats are on the table, none waiting');
  assert.ok(rats.every(e => !e.faceDown), 'nothing is hidden any more');
  assert.equal(rats[0].card.id, s.rats[s.activeRat].card.id, 'the active Rat leads');
  assert.equal(rats[1].card.id, beaten);
});
