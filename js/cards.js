/* Card model and deck helpers for River Rats. */
(function (root) {
  'use strict';

  var SUITS = ['S', 'H', 'D', 'C'];
  var SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
  var SUIT_NAME = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
  var RANK_LABEL = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  };

  function card(rank, suit) {
    return { id: rank + suit, r: rank, s: suit };
  }

  function fullDeck() {
    var out = [];
    for (var i = 0; i < SUITS.length; i++) {
      for (var r = 2; r <= 14; r++) out.push(card(r, SUITS[i]));
    }
    return out;
  }

  function joker(n) {
    return { id: 'JOKER' + n, joker: true };
  }

  function label(c) {
    if (!c) return '?';
    if (c.joker) return 'Joker';
    return RANK_LABEL[c.r] + SUIT_GLYPH[c.s];
  }

  function shuffle(arr, rnd) {
    var random = rnd || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function byId(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  /* Removes the card with the given id and returns it (or null). */
  function takeById(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr.splice(i, 1)[0];
    }
    return null;
  }

  var api = {
    SUITS: SUITS,
    SUIT_GLYPH: SUIT_GLYPH,
    SUIT_NAME: SUIT_NAME,
    RANK_LABEL: RANK_LABEL,
    card: card,
    fullDeck: fullDeck,
    joker: joker,
    label: label,
    shuffle: shuffle,
    byId: byId,
    takeById: takeById
  };

  root.RRCards = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
