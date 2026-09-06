const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/cards.js');
const P = require('../js/poker.js');

const h = (...codes) => codes.map(code => {
  const suit = code.slice(-1);
  const rankText = code.slice(0, -1);
  const ranks = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
  return C.card(ranks[rankText] || parseInt(rankText, 10), suit);
});

test('ranks the nine combinations', () => {
  assert.equal(P.evaluate5(h('5D', '6D', '7D', '8D', '9D')).rank, 9);
  assert.equal(P.evaluate5(h('9S', '9D', '9C', '9H', '2S')).rank, 8);
  assert.equal(P.evaluate5(h('QS', 'QD', 'QH', '5C', '5S')).rank, 7);
  assert.equal(P.evaluate5(h('AH', '7H', '5H', '3H', '2H')).rank, 6);
  assert.equal(P.evaluate5(h('4D', '5S', '6C', '7S', '8H')).rank, 5);
  assert.equal(P.evaluate5(h('8S', '8H', '8C', '2D', '9S')).rank, 4);
  assert.equal(P.evaluate5(h('TS', 'TC', '4D', '4H', '7S')).rank, 3);
  assert.equal(P.evaluate5(h('KS', 'KC', '4D', '9H', '7S')).rank, 2);
  assert.equal(P.evaluate5(h('KS', '2C', '4D', '9H', '7S')).rank, 1);
});

test('an ace plays low in a wheel straight', () => {
  const ev = P.evaluate5(h('AS', '2C', '3D', '4H', '5S'));
  assert.equal(ev.rank, 5);
  assert.equal(ev.tb[0], 5);
  assert.equal(P.evaluate5(h('AS', '2S', '3S', '4S', '5S')).rank, 9);
});

test('flushes are decided by the highest card alone (rulebook tiebreak)', () => {
  const a = P.evaluate5(h('KH', 'TH', '8H', '5H', '3H'));
  const b = P.evaluate5(h('KS', 'TS', '8S', '5S', '2S'));
  assert.equal(P.compare(a, b), 0, 'same high card is a True Tie');
  const c = P.evaluate5(h('AH', '4H', '3H', '5H', '7H'));
  assert.ok(P.compare(c, a) > 0);
});

test('pairs compare kickers one by one', () => {
  const a = P.evaluate5(h('8S', '8H', 'KD', '7C', '3S'));
  const b = P.evaluate5(h('8D', '8C', 'KS', '6C', '4S'));
  assert.ok(P.compare(a, b) > 0);
  const same = P.evaluate5(h('8S', '8H', 'KD', '7C', '3S'));
  assert.equal(P.compare(a, same), 0);
});

test('full houses are decided by the three of a kind', () => {
  const a = P.evaluate5(h('9S', '9D', '9C', '2H', '2S'));
  const b = P.evaluate5(h('8S', '8D', '8C', 'AH', 'AS'));
  assert.ok(P.compare(a, b) > 0);
});

test('best five of a larger hand', () => {
  const best = P.bestFive(h('AS', 'KS', 'QS', 'JS', 'TS', '2D', '2H', '2C'));
  assert.equal(best.ev.rank, 9);
  assert.equal(best.ev.tb[0], 14);
});

test('a joker becomes whichever card is strongest', () => {
  const cards = h('AS', 'KS', 'QS', 'JS').concat([C.joker(1)]);
  const best = P.bestFive(cards);
  assert.equal(best.ev.rank, 9);
  assert.equal(best.ev.tb[0], 14);
});

test('prediction categories, where a straight flush also counts as a flush', () => {
  const sf = h('5D', '6D', '7D', '8D', '9D');
  assert.ok(P.canForm(sf, 'straight-flush'));
  assert.ok(P.canForm(sf, 'flush'));
  assert.ok(P.canForm(sf, 'straight'));
  const quads = h('9S', '9D', '9C', '9H', '2S');
  assert.ok(P.canForm(quads, 'four-of-a-kind'));
  assert.ok(!P.canForm(quads, 'full-house'));
  const six = h('QS', 'QD', 'QH', '5C', '5S', '2D');
  assert.ok(P.canForm(six, 'full-house'));
  assert.ok(!P.canForm(h('2S', '5D', '9C', 'JH', 'KS'), 'straight'));
});

test('a joker can complete a predicted combination', () => {
  const cards = h('QS', 'QD', 'QH', '5C').concat([C.joker(1)]);
  assert.ok(P.canForm(cards, 'full-house'));
});
