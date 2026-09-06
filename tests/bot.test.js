/* The bots must play blind: everything they are given to decide with is the
   public view, and the public view must not contain a card they should not see. */
const test = require('node:test');
const assert = require('node:assert');

const C = require('../js/cards.js');
require('../js/poker.js');
const Bot = require('../js/bot.js');
const G = require('../js/game.js');

function botIo(spy) {
  let memo = {};
  const answer = spec => {
    const view = G.publicView(G.state.current);
    if (spy) spy(view, spec);
    if (spec.tag === 'turn-action') memo = {};
    return Promise.resolve(Bot.answer(spec, view, memo));
  };
  return {
    choose: answer,
    pick: answer,
    passTo: () => Promise.resolve(),
    showResolution: () => Promise.resolve(),
    ratDefeated: () => Promise.resolve(),
    gameOver: () => Promise.resolve()
  };
}

function newTable(players, difficulty) {
  G.newGame({
    players: ['S', 'H', 'D', 'C'].slice(0, players)
      .map((suit, i) => ({ name: 'Bot ' + suit, suit, bot: true })),
    difficulty: difficulty || 'normal'
  });
}

async function playGame(players, difficulty, spy) {
  G.io = botIo(spy);
  newTable(players, difficulty);
  let guard = 0;
  while (!G.state.over) {
    assert.ok(guard++ < 3000, 'the table should reach a result');
    await G.runTurn();
    if (G.shouldResolve()) await G.resolveHand();
    if (G.state.over) break;
    G.nextPlayer();
  }
  return G.state.over;
}

test('the public view hides what a player may not see', () => {
  G.io = botIo();
  newTable(4);
  const s = G.state;
  // Put a card face down in the Collective Hand, owned by player 1.
  s.collective.push({ card: s.players[1].hand[0], faceDown: true, owner: 1 });
  s.players[1].hand.splice(0, 1);

  const view = G.publicView(0);
  const visible = {};
  const mark = c => { visible[c.id] = true; };
  view.myHand.forEach(mark);
  view.market.forEach(mark);
  view.ratFaceUp.forEach(mark);
  view.collectiveKnown.forEach(mark);

  s.deck.forEach(c => assert.ok(!visible[c.id], 'the Deck is hidden: ' + c.id));
  s.players.slice(1).forEach(p => p.hand.forEach(c => {
    assert.ok(!visible[c.id], 'another player’s hand is hidden: ' + c.id);
  }));
  s.ratHand.filter(e => e.faceDown).forEach(e => {
    assert.ok(!visible[e.card.id], 'the Rat’s face-down cards are hidden: ' + e.card.id);
  });
  assert.equal(view.collectiveHidden, 1, 'the face-down play is counted but not shown');
  const hiddenPlay = s.collective.filter(e => e.faceDown && e.owner === 1)[0];
  assert.ok(!view.collectiveKnown.some(c => c.id === hiddenPlay.card.id),
    'someone else’s face-down card stays hidden');
  assert.ok(!view.unseen.every(c => c.id !== hiddenPlay.card.id),
    'and it is still in the pool of cards that could be anywhere');
});

test('a player can see the card they themselves played face down', () => {
  G.io = botIo();
  newTable(2);
  const s = G.state;
  const mine = s.players[0].hand[0];
  s.collective.push({ card: mine, faceDown: true, owner: 0 });
  s.players[0].hand.splice(0, 1);
  const view = G.publicView(0);
  assert.ok(view.collectiveKnown.some(c => c.id === mine.id), 'you know your own face-down card');
  assert.equal(view.collectiveHidden, 0);
  assert.equal(G.publicView(1).collectiveHidden, 1, 'the other player does not');
});

test('the unseen pool is exactly the cards nobody has shown', () => {
  G.io = botIo();
  newTable(3);
  const view = G.publicView(0);
  const seen = view.myHand.concat(view.market, view.ratFaceUp, view.collectiveKnown);
  const ids = {};
  seen.forEach(c => { ids[c.id] = true; });
  G.state.players.forEach(p => { ids[p.ace.id] = true; });
  ids[G.state.predictionCard.id] = true;
  view.unseen.forEach(c => assert.ok(!ids[c.id], c.id + ' is on the table, not unseen'));
  assert.equal(view.unseen.length + Object.keys(ids).length, 52);
});

test('bots play whole games in every mode without an illegal answer', async () => {
  for (const difficulty of ['normal', 'advanced', 'expert']) {
    for (const players of [1, 4]) {
      const seenViews = [];
      const result = await playGame(players, difficulty, view => {
        if (seenViews.length < 3) seenViews.push(view);
      });
      assert.ok(result === 'win' || result === 'lose');
      assert.ok(seenViews.length > 0, 'the bots were asked something');
      // every card in the game is still accounted for
      const ids = [];
      const add = c => { if (c && !c.joker) ids.push(c.id); };
      const s = G.state;
      s.deck.forEach(add); s.discard.forEach(add); s.market.forEach(add);
      s.players.forEach(p => { p.hand.forEach(add); add(p.ace); });
      s.collective.forEach(e => add(e.card));
      s.ratHand.forEach(e => add(e.card));
      s.debtPile.forEach(add); s.playerDebt.forEach(add);
      s.rats.forEach(r => r.debt.forEach(add));
      assert.equal(new Set(ids).size, 52, difficulty + ' ' + players + 'p: all 52 cards present');
    }
  }
});

test('bots raise the Debt as a bet, not on a whim', () => {
  G.io = botIo();
  newTable(1);
  const view = G.publicView(0);

  // Nothing to gain: the pot on the table already finishes the Rat.
  const finished = Object.assign({}, view, { ratDebt: 4, debtAtStake: 1, playerDebt: 0 });
  assert.equal(Bot.answer({ tag: 'hearts-debt' }, finished, {}), 'no');

  // One Debt from losing the game: never worth it.
  const desperate = Object.assign({}, view, { ratDebt: 0, debtAtStake: 1, playerDebt: 4 });
  assert.equal(Bot.answer({ tag: 'hearts-debt' }, desperate, {}), 'no');
});

test('an untagged prompt still gets a legal answer', () => {
  G.io = botIo();
  newTable(1);
  const view = G.publicView(0);
  assert.equal(Bot.answer({ options: [{ value: 'a' }, { value: 'b' }] }, view, {}), 'b');
  assert.equal(Bot.answer({ optional: true, zones: { hand: [] } }, view, {}), null);
  const pick = Bot.answer({ zones: { market: ['9D', '2C'] } }, view, {});
  assert.equal(pick.zone, 'market');
});

test('the unseen pool is card counting: discarded cards leave it', () => {
  G.io = botIo();
  newTable(2);
  const s = G.state;
  const before = G.publicView(0).unseen.length;

  // Discard five cards off the Deck, as ♠ actions and cleanups do.
  const dumped = s.deck.splice(0, 5);
  dumped.forEach(c => s.discard.push(c));

  const after = G.publicView(0);
  assert.equal(after.unseen.length, before - 5, 'the pool shrinks by what was discarded');
  dumped.forEach(c => {
    assert.ok(!after.unseen.some(u => u.id === c.id), c.id + ' is spent and out of the pool');
  });
});

test('a reshuffled Discard pile comes back into the pool', () => {
  G.io = botIo();
  newTable(2);
  const s = G.state;
  const dumped = s.deck.splice(0, 10);
  dumped.forEach(c => s.discard.push(c));
  const counted = G.publicView(0).unseen.length;

  // The rulebook: when the Deck runs out, the Discard pile is reshuffled into a
  // new one - so those cards are live again and the count has to follow.
  s.deck.length = 0;
  s.market.push(s.discard.pop());        // any draw triggers the reshuffle
  s.market.pop();
  G.roundSetup();

  assert.ok(G.publicView(0).unseen.length > counted - 10,
    'cards that were spent are in circulation again');
});

test('a River Rat waiting its turn is known to be out of circulation', async () => {
  G.io = botIo();
  newTable(2);
  assert.equal(G.publicView(0).waitingRat, true, 'one Rat is still face down');
  const s = G.state;
  s.rats[1 - s.activeRat].defeated = true;
  assert.equal(G.publicView(0).waitingRat, false, 'both Rats are on the table now');
});

test('the view counts how many Jokers are still there to be earned', () => {
  G.io = botIo();
  newTable(2);
  assert.equal(G.publicView(0).jokersUnearned, 2);
  G.state.jokers[0].faceUp = true;      // earned
  G.state.jokers[1].removed = true;     // spent
  assert.equal(G.publicView(0).jokersUnearned, 0);
});

test('a bot’s thinking can be made reproducible', () => {
  G.io = botIo();
  newTable(2);
  const view = G.publicView(0);
  const spec = { tag: 'play-card', zones: { hand: view.myHand.map(c => c.id) } };
  const seed = () => { let x = 12345; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };

  Bot.setRandom(seed());
  const first = Bot.answer(spec, view, {});
  Bot.setRandom(seed());
  const second = Bot.answer(spec, view, {});
  Bot.setRandom(null);
  assert.equal(first.id, second.id, 'same dice, same decision');
});

test('a hand is always the same size, so the turn order says who fills it', () => {
  // Five cards among four players is one each and two for whoever started the
  // hand - a bot can only count on the turns it will actually get.
  G.io = botIo();
  const seats = n => {
    newTable(n);
    G.state.collective = [];          // ignore anything the ♦ Rat seeded
    G.state.current = 0;
    const out = [];
    for (let i = 0; i < n; i++) out.push(G.publicView(i).mySlotsThisHand);
    return out;
  };
  assert.deepEqual(seats(1), [5], 'playing alone, every card is yours');
  assert.deepEqual(seats(2), [3, 2]);
  assert.deepEqual(seats(3), [2, 2, 1]);
  assert.deepEqual(seats(4), [2, 1, 1, 1], 'the starting player plays twice');

  newTable(4);
  G.state.collective = [];
  G.state.current = 2;                // part way round the table
  assert.deepEqual([0, 1, 2, 3].map(i => G.publicView(i).mySlotsThisHand), [1, 1, 2, 1]);

  // Once four cards are down only one play is left, and it belongs to one seat.
  newTable(4);
  G.state.collective = G.state.deck.splice(0, 4).map(card => ({ card, faceDown: false }));
  G.state.current = 1;
  assert.deepEqual([0, 1, 2, 3].map(i => G.publicView(i).mySlotsThisHand), [0, 1, 0, 0]);
});
