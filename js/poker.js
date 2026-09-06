/* Poker hand evaluation using the River Rats hand ranking and tiebreakers. */
(function (root) {
  'use strict';

  var Cards = root.RRCards || (typeof require === 'function' ? require('./cards.js') : null);

  var RANK_NAMES = {
    9: 'Straight flush',
    8: 'Four of a kind',
    7: 'Full house',
    6: 'Flush',
    5: 'Straight',
    4: 'Three of a kind',
    3: 'Two pair',
    2: 'Pair',
    1: 'High card'
  };

  function isFlush(five) {
    for (var i = 1; i < 5; i++) if (five[i].s !== five[0].s) return false;
    return true;
  }

  /* Returns the high card of the straight, or 0 when the five cards are not a
     sequence. An Ace counts as 1 in A-2-3-4-5. */
  function straightHigh(five) {
    var seen = {};
    var ranks = [];
    for (var i = 0; i < 5; i++) {
      if (seen[five[i].r]) return 0;
      seen[five[i].r] = true;
      ranks.push(five[i].r);
    }
    ranks.sort(function (a, b) { return a - b; });
    if (ranks[4] - ranks[0] === 4) return ranks[4];
    if (ranks.join(',') === '2,3,4,5,14') return 5;
    return 0;
  }

  function groupsOf(five) {
    var counts = {};
    for (var i = 0; i < 5; i++) counts[five[i].r] = (counts[five[i].r] || 0) + 1;
    var groups = Object.keys(counts).map(function (r) {
      return { r: parseInt(r, 10), n: counts[r] };
    });
    groups.sort(function (a, b) { return b.n - a.n || b.r - a.r; });
    return groups;
  }

  function descRanks(five) {
    return five.map(function (c) { return c.r; }).sort(function (a, b) { return b - a; });
  }

  /* Evaluates exactly five cards. The tiebreak array follows the rulebook:
     flushes, straights and straight flushes are decided by their highest card
     alone, everything else compares ranks in descending order of relevance. */
  function evaluate5(five) {
    var flush = isFlush(five);
    var straight = straightHigh(five);
    if (flush && straight) return { rank: 9, tb: [straight] };
    var g = groupsOf(five);
    if (g[0].n === 4) return { rank: 8, tb: [g[0].r, g[1].r] };
    if (g[0].n === 3 && g[1].n === 2) return { rank: 7, tb: [g[0].r, g[1].r] };
    if (flush) return { rank: 6, tb: [descRanks(five)[0]] };
    if (straight) return { rank: 5, tb: [straight] };
    if (g[0].n === 3) {
      return { rank: 4, tb: [g[0].r, Math.max(g[1].r, g[2].r), Math.min(g[1].r, g[2].r)] };
    }
    if (g[0].n === 2 && g[1].n === 2) {
      return { rank: 3, tb: [Math.max(g[0].r, g[1].r), Math.min(g[0].r, g[1].r), g[2].r] };
    }
    if (g[0].n === 2) {
      var kickers = [g[1].r, g[2].r, g[3].r].sort(function (a, b) { return b - a; });
      return { rank: 2, tb: [g[0].r].concat(kickers) };
    }
    return { rank: 1, tb: descRanks(five) };
  }

  function compare(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    var n = Math.max(a.tb.length, b.tb.length);
    for (var i = 0; i < n; i++) {
      var x = a.tb[i] || 0, y = b.tb[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  }

  function combinations(arr, k) {
    var out = [];
    var idx = [];
    (function walk(start) {
      if (idx.length === k) {
        out.push(idx.map(function (i) { return arr[i]; }));
        return;
      }
      for (var i = start; i < arr.length; i++) {
        idx.push(i);
        walk(i + 1);
        idx.pop();
      }
    })(0);
    return out;
  }

  /* Best five-card hand out of any number of cards. A Joker is wild and is
     resolved to whichever of the 52 cards makes the strongest hand. */
  function bestFive(cards) {
    var jokerIndex = -1;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] && cards[i].joker) { jokerIndex = i; break; }
    }
    if (jokerIndex >= 0) {
      var deck = Cards.fullDeck();
      var best = null;
      for (var d = 0; d < deck.length; d++) {
        var copy = cards.slice();
        copy[jokerIndex] = {
          id: cards[jokerIndex].id, r: deck[d].r, s: deck[d].s, wasJoker: true
        };
        var res = bestFive(copy);
        if (res && (!best || compare(res.ev, best.ev) > 0)) best = res;
      }
      return best;
    }
    if (cards.length < 5) return null;
    var combos = combinations(cards, 5);
    var top = null;
    for (var c = 0; c < combos.length; c++) {
      var ev = evaluate5(combos[c]);
      if (!top || compare(ev, top.ev) > 0) top = { ev: ev, cards: combos[c] };
    }
    return top;
  }

  /* Can these cards form the given combination at all? Used for the Joker's
     Prediction, where a straight flush also satisfies "flush" and "straight". */
  function canForm(cards, category) {
    var jokerIndex = -1;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] && cards[i].joker) { jokerIndex = i; break; }
    }
    if (jokerIndex >= 0) {
      var deck = Cards.fullDeck();
      for (var d = 0; d < deck.length; d++) {
        var copy = cards.slice();
        copy[jokerIndex] = { id: cards[jokerIndex].id, r: deck[d].r, s: deck[d].s };
        if (canForm(copy, category)) return true;
      }
      return false;
    }
    if (cards.length < 5) return false;
    var combos = combinations(cards, 5);
    for (var c = 0; c < combos.length; c++) {
      var five = combos[c];
      var flush = isFlush(five);
      var straight = straightHigh(five) > 0;
      var g = groupsOf(five);
      var ok = false;
      if (category === 'straight-flush') ok = flush && straight;
      else if (category === 'four-of-a-kind') ok = g[0].n === 4;
      else if (category === 'full-house') ok = g[0].n === 3 && g[1].n === 2;
      else if (category === 'flush') ok = flush;
      else if (category === 'straight') ok = straight;
      if (ok) return true;
    }
    return false;
  }

  function describe(ev) {
    if (!ev) return '—';
    var name = RANK_NAMES[ev.rank];
    var high = Cards.RANK_LABEL[ev.tb[0]];
    if (ev.rank === 9 || ev.rank === 6 || ev.rank === 5 || ev.rank === 1) {
      return name + ', ' + high + ' high';
    }
    if (ev.rank === 8) return name + ', ' + high + 's';
    if (ev.rank === 7) return name + ', ' + high + 's over ' + Cards.RANK_LABEL[ev.tb[1]] + 's';
    if (ev.rank === 4) return name + ', ' + high + 's';
    if (ev.rank === 3) return name + ', ' + high + 's and ' + Cards.RANK_LABEL[ev.tb[1]] + 's';
    return name + ' of ' + high + 's';
  }

  var api = {
    RANK_NAMES: RANK_NAMES,
    evaluate5: evaluate5,
    compare: compare,
    combinations: combinations,
    bestFive: bestFive,
    canForm: canForm,
    describe: describe
  };

  root.RRPoker = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
