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

  // A phone holds its long poll for 25 seconds, so three missed cycles is a
  // phone that has locked, lost signal or been closed. Nobody at the table
  // should be waiting on it after that.
  var IDLE_MS = 75000;
  // Everyone gone this long and the table is over rather than paused.
  var ABANDON_MS = 10 * 60 * 1000;

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
    this.now = options.now || function () { return Date.now(); };
  }

  /* ---------------- who is still here ---------------- */

  Room.prototype.markSeen = function (seat) {
    if (seat) seat.lastSeen = this.now();
  };

  Room.prototype.seatIsHere = function (seat) {
    if (seat.bot) return true;                       // a bot never wanders off
    if (seat.away) return false;                     // said goodbye
    return this.now() - (seat.lastSeen || 0) <= IDLE_MS;
  };

  Room.prototype.peopleHere = function () {
    var room = this;
    return this.seats.filter(function (s) { return !s.bot && room.seatIsHere(s); });
  };

  /* Answers the question in front of the table on behalf of a seat nobody is
     sitting at. The bot plays their card so the rest of the table is not left
     waiting on a phone in somebody's pocket. */
  Room.prototype.answerForAbsentSeat = function () {
    var prompt = this.prompt;
    if (!prompt) return false;
    var seat = this.seats[prompt.seat];
    if (!seat || this.seatIsHere(seat)) return false;
    var answer = Bot.answer(prompt.spec, this.engine.publicView(seat.id), this.absentMemo || {});
    this.absentMemo = this.absentMemo || {};
    this.prompt = null;
    prompt.resolve(answer);
    this.touch();
    return true;
  };

  /* Run at the start of every request. No timers: the table only needs tidying
     when somebody is there to notice, and the long poll brings everybody back
     within half a minute. */
  Room.prototype.sweep = function () {
    if (this.status !== 'playing') return;
    if (this.peopleHere().length) {
      this.lastPersonSeen = this.now();
    } else if (this.now() - (this.lastPersonSeen || this.now()) > ABANDON_MS) {
      // Nobody has been here for a long while. Close the table rather than
      // playing the rest of the game out to an empty room.
      this.close('abandoned');
      return;
    }
    this.answerForAbsentSeat();
    this.stopWaitingOnAbsentSeats();
  };

  /* Nobody waits on a phone that has gone to look at a hand it will never see. */
  Room.prototype.stopWaitingOnAbsentSeats = function () {
    if (!this.pendingAck) return;
    var room = this;
    this.pendingAck.waiting = this.pendingAck.waiting.filter(function (id) {
      return room.seats[id] && room.seatIsHere(room.seats[id]);
    });
    if (!this.pendingAck.waiting.length) this.everyoneHasSeen();
  };

  /* Ends the table. Anything the engine is waiting on is answered so the game
     it is holding can unwind rather than sit parked forever. */
  Room.prototype.close = function (why) {
    if (this.status === 'finished' || this.status === 'abandoned') return;
    this.status = why || 'abandoned';
    if (this.pendingAck) this.everyoneHasSeen();
    var prompt = this.prompt;
    this.prompt = null;
    if (prompt) {
      var seat = this.seats[prompt.seat];
      var view = this.engine.state ? this.engine.publicView(seat ? seat.id : 0) : null;
      prompt.resolve(view ? Bot.answer(prompt.spec, view, {}) : null);
    }
    this.touch();
  };

  /* Leaving. In the lobby the seat goes; mid-game it stays, because the hand it
     is holding is part of the game - a bot plays it out instead. */
  Room.prototype.leave = function (tok) {
    var seat = this.seatByToken(tok);
    if (!seat) return { error: 'not at this table' };

    if (this.status === 'lobby') {
      this.seats = this.seats.filter(function (s) { return s !== seat; });
      this.seats.forEach(function (s, i) { s.id = i; });
      if (!this.seats.length) this.close('abandoned');
      this.touch();
      return { ok: true, left: true };
    }

    seat.away = true;
    this.answerForAbsentSeat();
    this.stopWaitingOnAbsentSeats();
    if (!this.peopleHere().length) this.close('abandoned');
    this.touch();
    return { ok: true, left: true };
  };

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
      bot: !!asBot,
      // Somebody who has just sat down is plainly here, whether or not their
      // phone has asked us anything yet.
      lastSeen: this.now()
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
    this.lastPersonSeen = this.now();
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
      // A table that has been closed answers itself, so the game unwinds
      // instead of parking on a question nobody will ever see.
      if (room.status !== 'playing') {
        return Promise.resolve(Bot.answer(spec, engine.publicView(seat ? seat.id : 0), botMemo));
      }
      return new Promise(function (resolve) {
        room.prompt = {
          id: 'p' + room.version + '-' + Math.floor(room.random() * 1e6),
          seat: engine.state.current,
          spec: spec,
          resolve: resolve
        };
        room.touch();
        // The seat may already be empty - somebody left, or their phone went
        // quiet - in which case nobody is coming to answer this.
        room.answerForAbsentSeat();
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
        room.resolutionSeq = (room.resolutionSeq || 0) + 1;
        room.lastResolution = {
          seq: room.resolutionSeq,
          playersWin: r.playersWin,
          trueTie: r.trueTie,
          debt: r.debt,
          // The whole thing, evaluation and the five cards it was made from:
          // the sheet names the hand and dims the cards outside it.
          ours: r.ours,
          theirs: r.theirs,
          ourCards: r.ourCards,
          theirCards: r.theirCards,
          predictionHit: r.predictionHit,
          jokerFlipped: r.jokerFlipped,
          predictionLabel: r.predictionLabel
        };
        // Hold the table here until everyone has seen it. Otherwise the next
        // round is dealt over the hand people are still looking at.
        return room.waitForEveryoneToSee();
      },
      ratDefeated: function (info) {
        room.lastDefeat = info;
        room.touch();
        return Promise.resolve();
      },
      gameOver: function () { return Promise.resolve(); }
    };
  };

  /* ---------------- pausing on a finished hand ---------------- */

  Room.prototype.waitForEveryoneToSee = function () {
    var room = this;
    var waiting = this.peopleHere().map(function (s) { return s.id; });
    if (!waiting.length) {
      this.touch();
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      room.pendingAck = { seq: room.resolutionSeq, waiting: waiting, resolve: resolve };
      room.touch();
    });
  };

  Room.prototype.seen = function (tok, seq) {
    var seat = this.seatByToken(tok);
    if (!seat) return { error: 'not at this table' };
    var ack = this.pendingAck;
    // Nothing to acknowledge, or an acknowledgement for a hand two rounds back:
    // either way the table has moved on and there is nothing to do.
    if (!ack || ack.seq !== seq) return { ok: true };
    ack.waiting = ack.waiting.filter(function (id) { return id !== seat.id; });
    if (!ack.waiting.length) this.everyoneHasSeen();
    this.touch();
    return { ok: true };
  };

  Room.prototype.everyoneHasSeen = function () {
    var ack = this.pendingAck;
    this.pendingAck = null;
    this.lastResolution = null;
    if (ack) ack.resolve();
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
    var room = this;
    var seat = this.seatByToken(tok);
    if (!seat) return { error: 'not at this table' };
    var out = {
      version: this.version,
      code: this.code,
      status: this.status,
      you: { id: seat.id, name: seat.name, suit: seat.suit, host: seat.id === 0 },
      seats: this.seats.map(function (s) {
        return {
          id: s.id, name: s.name, suit: s.suit, bot: s.bot,
          away: !room.seatIsHere(s)
        };
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
    out.mustSee = !!(this.pendingAck && this.pendingAck.waiting.indexOf(seat.id) >= 0);
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
