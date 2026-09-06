/* River Rats - one room.

   A room owns a game and answers questions about it. It is deliberately plain:
   no HTTP, no storage, no timers, so it runs the same in a test, in node, or
   inside a Cloudflare Durable Object, and can be tested without any of them.

   The point of running the game here rather than on the phones is the hidden
   information. Each player is sent RRGame.publicView for their own seat and the
   prompt addressed to them, and nothing else - so a hand stays private because
   the other phones were never told it, not because they were asked not to look. */
(function (root) {
  'use strict';

  var Cards = root.RRCards;
  var Game = root.RRGame;
  var Bot = root.RRBot;

  var CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I or O: they read as 1 and 0
  var SEATS = 4;

  function makeCode(random) {
    var out = '';
    for (var i = 0; i < 4; i++) {
      out += CODE_LETTERS[Math.floor((random || Math.random)() * CODE_LETTERS.length)];
    }
    return out;
  }

  function token(random) {
    var out = '';
    for (var i = 0; i < 24; i++) {
      out += Math.floor((random || Math.random)() * 36).toString(36);
    }
    return out;
  }

  function Room(options) {
    options = options || {};
    this.code = options.code || makeCode(options.random);
    this.random = options.random || Math.random;
    this.engine = Game.create();
    this.seats = [];          // { id, token, name, suit, bot, joinedAt }
    this.status = 'lobby';    // lobby | playing | finished
    this.version = 0;         // bumped whenever anything a phone can see changes
    this.prompt = null;       // { id, seat, spec, resolve }
    this.reveal = null;       // { card, index, total } while cards are turning over
    this.result = null;
    this.error = null;
    this.waiters = [];        // resolve functions for phones waiting on a change
  }

  Room.prototype.touch = function () {
    this.version += 1;
    var waiting = this.waiters;
    this.waiters = [];
    waiting.forEach(function (fn) { fn(); });
  };

  /* Resolves once something a phone would want to redraw has changed. */
  Room.prototype.waitForChange = function (since, timeoutMs, setTimer) {
    var room = this;
    if (this.version > since) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (!done) { done = true; resolve(); } };
      room.waiters.push(finish);
      if (setTimer) setTimer(finish, timeoutMs || 25000);
    });
  };

  /* ---------------- the lobby ---------------- */

  Room.prototype.freeSuit = function () {
    var taken = {};
    this.seats.forEach(function (s) { taken[s.suit] = true; });
    return Cards.SUITS.filter(function (su) { return !taken[su]; })[0];
  };

  Room.prototype.join = function (name, asBot) {
    if (this.status !== 'lobby') return { error: 'the game has already started' };
    if (this.seats.length >= SEATS) return { error: 'the table is full' };
    var seat = {
      id: this.seats.length,
      token: token(this.random),
      name: (name || '').trim().slice(0, 16) || (asBot ? 'Bot' : 'Player ' + (this.seats.length + 1)),
      suit: this.freeSuit(),
      bot: !!asBot
    };
    this.seats.push(seat);
    this.touch();
    return { seat: seat };
  };

  Room.prototype.seatByToken = function (tok) {
    for (var i = 0; i < this.seats.length; i++) {
      if (this.seats[i].token === tok) return this.seats[i];
    }
    return null;
  };

  /* Anyone at the table can change their own name or suit while in the lobby;
     only the first seat - whoever made the room - can add bots or start. */
  Room.prototype.update = function (tok, change) {
    var seat = this.seatByToken(tok);
    if (!seat) return { error: 'not at this table' };
    if (this.status !== 'lobby') return { error: 'the game has already started' };
    if (change.name != null) seat.name = String(change.name).trim().slice(0, 16) || seat.name;
    if (change.suit && Cards.SUITS.indexOf(change.suit) >= 0) {
      var holder = this.seats.filter(function (s) { return s.suit === change.suit; })[0];
      if (holder && holder !== seat) holder.suit = seat.suit;   // swap, never collide
      seat.suit = change.suit;
    }
    this.touch();
    return { seat: seat };
  };

  Room.prototype.addBot = function (tok) {
    var seat = this.seatByToken(tok);
    if (!seat || seat.id !== 0) return { error: 'only the table’s host can add a bot' };
    var free = this.freeSuit();
    var added = this.join('Bot ' + (free ? Cards.SUIT_GLYPH[free] : ''), true);
    return added;
  };

  Room.prototype.removeSeat = function (tok, seatId) {
    var seat = this.seatByToken(tok);
    if (!seat || seat.id !== 0) return { error: 'only the table’s host can remove a seat' };
    if (this.status !== 'lobby') return { error: 'the game has already started' };
    if (seatId === 0) return { error: 'the host keeps their seat' };
    this.seats = this.seats.filter(function (s) { return s.id !== seatId; });
    this.seats.forEach(function (s, i) { s.id = i; });
    this.touch();
    return { ok: true };
  };

  /* ---------------- the game ---------------- */

  Room.prototype.start = function (tok, difficulty) {
    var seat = this.seatByToken(tok);
    if (!seat || seat.id !== 0) return { error: 'only the table’s host can start' };
    if (this.status !== 'lobby') return { error: 'the game has already started' };
    if (this.seats.length < 1) return { error: 'nobody is at the table' };

    var room = this;
    this.engine.io = this.makeIo();
    this.engine.newGame({
      players: this.seats.map(function (s) {
        return { name: s.name, suit: s.suit, bot: s.bot };
      }),
      difficulty: difficulty || 'normal'
    });
    this.status = 'playing';
    this.touch();
    this.play();
    return { ok: true };
  };

  /* The turn loop, the same shape the phone runs on its own. */
  Room.prototype.play = function () {
    var room = this;
    var engine = this.engine;
    if (this.status !== 'playing' || engine.state.over) return Promise.resolve();
    return engine.runTurn()
      .then(function () {
        if (engine.shouldResolve()) return engine.resolveHand();
      })
      .then(function () {
        if (engine.state.over) {
          room.status = 'finished';
          room.result = engine.state.over;
          room.touch();
          return;
        }
        engine.nextPlayer();
        room.touch();
        return room.play();
      })
      .catch(function (err) {
        room.error = String(err && err.message || err);
        room.touch();
      });
  };

  /* The engine asks; the room either answers for a bot or parks the question
     until the right phone sends something back. */
  Room.prototype.makeIo = function () {
    var room = this;
    var botMemo = {};
    var ask = function (spec) {
      var engine = room.engine;
      var seat = room.seats[engine.state.current];
      if (seat && seat.bot) {
        if (spec.tag === 'turn-action') botMemo = {};
        return Promise.resolve(Bot.answer(spec, engine.publicView(seat.id), botMemo));
      }
      return new Promise(function (resolve) {
        room.prompt = {
          id: 'p' + room.version + '-' + Math.floor(room.random() * 1e6),
          seat: engine.state.current,
          spec: spec,
          resolve: resolve
        };
        room.touch();
      });
    };
    return {
      choose: ask,
      pick: ask,
      passTo: function () { return Promise.resolve(); },   // separate phones: nothing to hide
      cardRevealed: function (card, index, total) {
        room.reveal = { card: card, index: index, total: total };
        room.touch();
        return null;                                        // pacing belongs to each phone
      },
      showResolution: function (r) {
        room.lastResolution = {
          playersWin: r.playersWin,
          trueTie: r.trueTie,
          debt: r.debt,
          ours: r.ours && r.ours.ev,
          theirs: r.theirs && r.theirs.ev,
          ourCards: r.ourCards,
          theirCards: r.theirCards,
          predictionHit: r.predictionHit,
          jokerFlipped: r.jokerFlipped,
          predictionLabel: r.predictionLabel
        };
        room.touch();
        return Promise.resolve();
      },
      ratDefeated: function (info) {
        room.lastDefeat = info;
        room.touch();
        return Promise.resolve();
      },
      gameOver: function () { return Promise.resolve(); }
    };
  };

  Room.prototype.answer = function (tok, promptId, value) {
    var seat = this.seatByToken(tok);
    if (!seat) return { error: 'not at this table' };
    var prompt = this.prompt;
    if (!prompt) return { error: 'nothing to answer' };
    if (prompt.id !== promptId) return { error: 'that question has moved on' };
    if (prompt.seat !== seat.id) return { error: 'not your turn' };
    this.prompt = null;
    this.reveal = null;
    prompt.resolve(value);
    this.touch();
    return { ok: true };
  };

  /* ---------------- what one phone is allowed to see ---------------- */

  Room.prototype.viewFor = function (tok) {
    var seat = this.seatByToken(tok);
    if (!seat) return { error: 'not at this table' };
    var out = {
      version: this.version,
      code: this.code,
      status: this.status,
      you: { id: seat.id, name: seat.name, suit: seat.suit, host: seat.id === 0 },
      seats: this.seats.map(function (s) {
        return { id: s.id, name: s.name, suit: s.suit, bot: s.bot };
      }),
      error: this.error
    };
    if (this.status === 'lobby') return out;

    var view = this.engine.publicView(seat.id);
    // `unseen` is the pool of cards nobody has shown. It is derivable by anyone
    // at the table from what is face up, so sending it leaks nothing - but a
    // phone has no use for it and it is most of the payload, so it stays here
    // where the bots use it.
    delete view.unseen;
    out.view = view;
    out.log = this.engine.state.log.slice(-40);
    out.turn = this.engine.state.current;
    out.reveal = this.reveal;
    out.resolution = this.lastResolution || null;
    out.defeat = this.lastDefeat || null;
    out.result = this.result;
    // Only the phone being asked is told what the question is.
    if (this.prompt && this.prompt.seat === seat.id) {
      out.prompt = { id: this.prompt.id, spec: this.prompt.spec };
    }
    return out;
  };

  var api = { Room: Room, makeCode: makeCode, SEATS: SEATS };
  root.RRRoom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
