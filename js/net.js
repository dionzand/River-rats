/* River Rats - playing in a room, on separate phones.

   The game itself runs on the room server; this file is the phone's half. It
   asks the room what has changed, turns the answer into something the board can
   draw, and sends back whatever the player taps.

   The board is drawn by the same code as a game on one phone. Rather than teach
   it a second shape, the view a room sends is rebuilt into the shape the engine
   would have produced - with the cards nobody can see standing in as blanks,
   which is all the board ever draws of them anyway. */
(function (root) {
  'use strict';

  var Cards = root.RRCards;

  var Net = {
    base: '',        // where the rooms live; empty means multiplayer is off
    code: null,
    token: null,
    seatId: null,
    version: 0,
    lastError: null
  };

  Net.available = function () { return !!Net.base; };

  function url(path) {
    return Net.base.replace(/\/$/, '') + path;
  }

  function request(path, options) {
    return fetch(url(path), options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || ('the room said ' + res.status));
        return data;
      });
    });
  }

  function post(path, body) {
    return request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    });
  }

  Net.create = function (name) {
    return post('/api/rooms', { name: name }).then(function (data) {
      Net.code = data.code;
      Net.token = data.token;
      Net.seatId = data.seat.id;
      Net.version = 0;
      return data;
    });
  };

  Net.join = function (code, name) {
    var clean = String(code || '').trim().toUpperCase();
    return post('/api/rooms/' + clean + '/join', { name: name }).then(function (data) {
      Net.code = data.code || clean;
      Net.token = data.token;
      Net.seatId = data.seat.id;
      Net.version = 0;
      return data;
    });
  };

  Net.act = function (action, body) {
    var payload = body || {};
    payload.token = Net.token;
    return post('/api/rooms/' + Net.code + '/' + action, payload);
  };

  /* Holds until the table changes, so the phone is not asking every second for
     nothing. Returns null if the wait simply timed out. */
  Net.poll = function () {
    return request('/api/rooms/' + Net.code + '/view?token=' +
      encodeURIComponent(Net.token) + '&since=' + Net.version)
      .then(function (data) {
        Net.version = data.version;
        return data;
      });
  };

  Net.leave = function () {
    Net.code = null;
    Net.token = null;
    Net.seatId = null;
    Net.version = 0;
  };

  /* ---------------- drawing someone else's table ---------------- */

  var blankCount = 0;
  function blank() {
    // Never a real card id, so nothing can mistake one of these for a card.
    blankCount += 1;
    return { id: '~' + blankCount };
  }
  function blanks(n) {
    var out = [];
    for (var i = 0; i < (n || 0); i++) out.push(blank());
    return out;
  }

  /* Turns what the room sent into the shape the board draws. */
  Net.tableFrom = function (payload) {
    var v = payload.view;
    if (!v) return null;
    var byId = {};
    (v.others || []).forEach(function (o) { byId[o.id] = o; });

    var rats = v.rats.map(function (r) {
      return {
        card: r.suit ? Cards.card(13, r.suit) : { id: '~rat', r: 13, s: null },
        debt: blanks(r.debt),
        defeated: r.defeated
      };
    });
    var activeRat = 0;
    v.rats.forEach(function (r, i) { if (r.active) activeRat = i; });

    // The Rat's Hand as the room has it: the waiting Rat face down at the front,
    // then everything face up, then the cards it is hiding.
    //
    // `ratFaceUp` already contains the active Rat's own card, and any Rat it has
    // been beaten with - they are face up in the Rat's Hand like anything else.
    // Adding them again here is what put a second King on the table.
    var ratHand = [];
    v.rats.forEach(function (r, i) {
      if (i !== activeRat && !r.defeated) {
        ratHand.push({ card: rats[i].card, faceDown: true, isRat: true, counts: false, inactive: true });
      }
    });
    v.ratFaceUp.forEach(function (card) {
      ratHand.push({ card: card, faceDown: false, counts: true });
    });
    blanks(v.ratFaceDownCount).forEach(function (card) {
      ratHand.push({ card: card, faceDown: true, counts: true });
    });

    var collective = v.collectiveKnown.map(function (card, i) {
      return { card: card, faceDown: false, seeded: i === 0 && v.collectiveSeeded };
    }).concat(blanks(v.collectiveHidden).map(function (card) {
      return { card: card, faceDown: true };
    }));

    return {
      round: v.round,
      difficulty: v.difficulty,
      players: payload.seats.map(function (seat) {
        var known = byId[seat.id];
        return {
          i: seat.id,
          name: seat.name,
          suit: seat.suit,
          bot: seat.bot,
          away: !!seat.away,
          ace: Cards.card(14, seat.suit),
          hand: seat.id === payload.you.id ? v.myHand.slice() : blanks(known ? known.handCount : 0)
        };
      }),
      current: v.current,
      deck: blanks(v.deckCount),
      discard: blanks(v.discardCount),
      market: v.market.slice(),
      marketCapacity: v.marketCapacity,
      rats: rats,
      activeRat: activeRat,
      ratHand: ratHand,
      collective: collective,
      jokers: v.jokers.map(function (j, i) {
        return { id: 'JOKER' + (i + 1), faceUp: j.faceUp, removed: j.removed, inCollective: false };
      }),
      playerDebt: blanks(v.playerDebt),
      debtPile: blanks(v.debtAtStake),
      prediction: v.prediction,
      predictionCard: null,
      bonuses: { oneLessFaceDown: 0, resolveAtSix: !!(v.bonuses && v.bonuses.resolveAtSix) },
      log: payload.log || [],
      over: payload.result || null
    };
  };

  root.RRNet = Net;
  if (typeof module !== 'undefined' && module.exports) module.exports = Net;
})(typeof globalThis !== 'undefined' ? globalThis : this);
