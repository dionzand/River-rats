/* River Rats - interface layer. Owns the DOM, and answers the engine's
   questions through the `io` object it hands to RRGame. */
(function () {
  'use strict';

  var Cards = window.RRCards;
  var Poker = window.RRPoker;
  var G = window.RRGame;
  var Bot = window.RRBot;

  var SAVE_KEY = 'riverrats.save.v1';

  /* The whole rulebook a player needs at a glance, four words at a time. */
  var SUIT_SHORT = { C: 'to Market', D: 'swap a card', H: 'Debt +1', S: 'discard' };

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  var setup = {
    players: 1,
    suits: ['S', 'H', 'D', 'C'],
    bots: [false, true, true, true],   // seat 1 is always the person holding the phone
    names: ['', '', '', ''],           // blank means "use the default for this seat"
    difficulty: 'normal'
  };
  var NAMES_KEY = 'riverrats.names.v1';
  var pending = null;    // active pick: { zones, resolve, optional }
  var revealed = false;  // has the current player looked at their hand?
  var turnStart = null;  // the game as it stood when this turn began
  var turnTouched = false;
  var epoch = 0;         // bumped to orphan a turn that has been undone
  var resolving = false; // true once the hands are being resolved
  var revealedId = null; // the card that just turned over, for the flip
  var skipReveal = false;

  /* ---------------- cards ---------------- */

  function cardEl(card, opts) {
    opts = opts || {};
    var b = el('button', 'card');
    b.type = 'button';
    if (opts.small) b.classList.add('small');
    var isRat = !card.joker && G.isRatCard(card);
    if (opts.faceDown && isRat) {
      // The River Rat waiting its turn: known to be a Rat, but never revealed.
      b.classList.add('rat-card', 'unknown');
      b.appendChild(el('span', 'mark', '🐀'));
      b.appendChild(el('span', 'r', '?'));
      b.setAttribute('aria-label', 'the waiting River Rat, face down');
    } else if (opts.faceDown) {
      b.classList.add('back');
      b.setAttribute('aria-label', 'face-down card');
    } else if (card.joker) {
      b.classList.add('joker');
      b.appendChild(el('span', 'r', 'JOKER'));
      b.appendChild(el('span', 's', '★'));
    } else {
      if (isRat) {
        b.classList.add('rat-card');
        b.appendChild(el('span', 'mark', '🐀'));
        b.setAttribute('aria-label', 'River Rat ' + Cards.SUIT_NAME[card.s]);
      } else if (card.s === 'H' || card.s === 'D') {
        b.classList.add('red');
      }
      b.appendChild(el('span', 'r', Cards.RANK_LABEL[card.r]));
      b.appendChild(el('span', 's', Cards.SUIT_GLYPH[card.s]));
    }
    if (opts.classes) opts.classes.forEach(function (c) { b.classList.add(c); });
    if (!opts.faceDown && !card.joker && card.id === revealedId) b.classList.add('turning');

    var selectable = pending && pending.zones[opts.zone] &&
      pending.zones[opts.zone].indexOf(card.id) >= 0;
    if (selectable) {
      b.classList.add('selectable');
      b.dataset.id = card.id;
      b.addEventListener('click', function () { resolvePick(opts.zone, card.id); });
    } else if (pending) {
      b.classList.add('dim');
      b.disabled = true;
    }
    return b;
  }

  function fill(node, entries) {
    node.innerHTML = '';
    if (!entries.length) {
      node.appendChild(el('span', 'empty-note', 'empty'));
      return;
    }
    entries.forEach(function (n) { node.appendChild(n); });
  }

  function pips(count, max, good) {
    var wrap = el('div', 'pips');
    for (var i = 0; i < max; i++) {
      var p = el('span', 'pip' + (i < count ? ' on' + (good ? ' good' : '') : ''));
      wrap.appendChild(p);
    }
    wrap.appendChild(el('span', null, count + '/' + max));
    return wrap;
  }

  /* ---------------- render ---------------- */

  function render() {
    var s = G.state;
    if (!s) return;
    var rat = G.activeRat();
    var suit = rat.card.s;

    $('chip-rat').innerHTML = '<b>' + Cards.SUIT_GLYPH[suit] + '</b> Rat Debt ' +
      rat.debt.length + '/5';
    $('chip-debt').innerHTML = 'Your Debt <b>' + s.playerDebt.length + '/5</b>';
    $('chip-round').textContent = 'Round ' + s.round;

    $('rat-ability').textContent = G.abilitiesOn()
      ? Cards.SUIT_GLYPH[suit] + ' ' + G.RAT_ABILITY[suit]
      : Cards.SUIT_GLYPH[suit] + ' No ability in a first game — it just plays its cards.';
    $('rat-count').textContent = s.ratHand.filter(function (e) { return e.counts !== false; }).length +
      ' cards in play';

    fill($('rat-hand'), s.ratHand.map(function (e) {
      return cardEl(e.card, { zone: 'ratHand', faceDown: e.faceDown });
    }));

    var status = $('rat-status');
    status.innerHTML = '';
    s.rats.forEach(function (r, i) {
      var box = el('div', 'pips');
      // The second River Rat is never revealed until it becomes active.
      var known = r.defeated || i === s.activeRat;
      var lbl = el('span', null, (known ? Cards.SUIT_GLYPH[r.card.s] : '?') + ' ' +
        (r.defeated ? 'defeated ' : (i === s.activeRat ? 'active ' : 'waiting ')));
      box.appendChild(lbl);
      if (!r.defeated) box.appendChild(pips(r.debt.length, 5, true));
      status.appendChild(box);
    });

    var tag = function (label) { return label + ' <i>ⓘ</i>'; };
    $('token-prediction').innerHTML = tag('Prediction') + '<b>' +
      (s.prediction ? G.PREDICTION_LABEL[s.prediction] : '—') + '</b>';
    $('token-debt').innerHTML = tag('Debt at stake') + '<b>' + s.debtPile.length + '</b>';
    $('token-jokers').innerHTML = tag('Jokers') + '<b>' + s.jokers.map(function (j) {
      return j.removed ? '·' : (j.faceUp ? '★' : '☆');
    }).join(' ') + '</b>';
    $('token-deck').innerHTML = tag('Deck') + '<b>' + s.deck.length + '</b>';

    $('collective-note').textContent = s.collective.length + ' / ' + G.collectiveTarget() + ' cards';
    fill($('collective'), s.collective.map(function (e) {
      return cardEl(e.card, {
        zone: 'collective',
        faceDown: e.faceDown,
        classes: e.seeded ? ['seeded'] : (e.faceDown ? ['facedown-play'] : [])
      });
    }));

    $('market-note').textContent = 'capacity ' + s.marketCapacity + ' (max 6)';
    fill($('market'), s.market.map(function (c) {
      return cardEl(c, { zone: 'market' });
    }));

    var p = viewer();
    var multiHuman = humanCount() > 1 && !inRoom();
    $('hand-title').textContent = multiHuman ? p.name + '’s hand' : 'Your hand';
    $('hand-note').textContent = Cards.SUIT_GLYPH[p.suit] + ' character · ' + p.hand.length + '/3 cards';

    var seats = $('seats');
    seats.innerHTML = '';
    if (s.players.length > 1) {
      s.players.forEach(function (o) {
        var chip = el('div', 'seat' + (o.i === s.current ? ' active' : ''));
        // A bot's name already carries its suit, so do not print it twice.
        var label = o.bot ? o.name : o.name + ' ' + Cards.SUIT_GLYPH[o.suit];
        if (o.away) label += ' (gone)';
        chip.innerHTML = '<b>' + label + '</b> · ' + o.hand.length;
        seats.appendChild(chip);
      });
    }

    var hide = multiHuman && !revealed;
    fill($('hand'), p.hand.map(function (c) {
      return cardEl(c, { zone: 'hand', faceDown: hide });
    }));

    var key = $('suit-key');
    key.innerHTML = '';
    Cards.SUITS.forEach(function (su) {
      var b = el('button', su === p.suit ? 'mine' : '');
      b.type = 'button';
      var glyph = el('span', 'g' + (su === 'H' || su === 'D' ? ' red' : ''), Cards.SUIT_GLYPH[su]);
      b.appendChild(glyph);
      b.appendChild(document.createTextNode(SUIT_SHORT[su]));
      if (su === p.suit) b.appendChild(el('span', 'tag', 'your power'));
      b.addEventListener('click', function () { if (!pending) showAid('suit-' + su); });
      key.appendChild(b);
    });

    var logBox = $('log');
    logBox.innerHTML = '';
    s.log.slice(-40).reverse().forEach(function (entry) {
      logBox.appendChild(el('div', entry.kind, entry.text));
    });
  }

  function humanCount() {
    return G.state.players.filter(function (p) { return !p.bot; }).length;
  }

  /* The hand on screen belongs to whoever is holding the phone: the player whose
     turn it is when people pass it around, otherwise the one human at the table. */
  function viewer() {
    var s = G.state;
    // In a room, the phone belongs to one seat and shows that seat's hand
    // whoever's turn it is. Only when a phone is passed around does the hand on
    // screen follow the turn.
    if (inRoom() && s.players[Net.seatId]) return s.players[Net.seatId];
    if (humanCount() > 1) return G.currentPlayer();
    for (var i = 0; i < s.players.length; i++) if (!s.players[i].bot) return s.players[i];
    return s.players[0];
  }

  function otherPlayersNote() {
    return G.state.players.filter(function (o) { return o.i !== G.state.current; })
      .map(function (o) { return o.name + ' ' + o.hand.length; }).join(', ');
  }

  /* ---------------- player aids ---------------- */

  /* Short answers to "what is this?", written for someone mid-game who does not
     want to read the rules again. Each returns a title and a few lines; some
     lean on the state so the answer is about this table, not the rulebook. */
  function aidContent(topic) {
    var s = G.state;
    var suit = G.activeRatSuit();
    var me = viewer();

    if (topic === 'rat') {
      return {
        title: 'The River Rat’s Hand',
        lines: [
          'The Rat card itself, five cards face up and two face down — it plays the best five of them. That is eight cards against your five, which is why a pair rarely wins.',
          G.abilitiesOn()
            ? 'While it is active: ' + Cards.SUIT_GLYPH[suit] + ' ' + G.RAT_ABILITY[suit]
            : 'No ability in a first game.',
          'The card with a ? is the second Rat, waiting its turn. It is never revealed and never counts toward this hand.'
        ]
      };
    }
    if (topic === 'collective') {
      return {
        title: 'The Collective Hand',
        lines: [
          'The hand you build together — one card per turn, ' + G.collectiveTarget() +
            ' in all. When it is full, both hands are shown and compared.',
          'Only ♦ can change a card already played, and a card played face down under the Rat’s ♠ cannot be touched at all.',
          'You may talk about the table, but never about the cards in your hand or the hand you are trying to build.'
        ]
      };
    }
    if (topic === 'market') {
      return {
        title: 'The Market',
        lines: [
          'Face up and shared: everyone sees the same cards and anyone can take one. It refills from the Deck whenever it drops below ' + s.marketCapacity + '.',
          '♣ puts a card there for somebody else to use — the one legal way to pass a good card to a teammate.',
          '♠ clears a card out of it. It can hold six at a push.'
        ]
      };
    }
    if (topic === 'hand') {
      return {
        title: 'Your hand',
        lines: [
          'Three cards, refilled one at a time at the start of your turn from the Market or the Deck.',
          'You play exactly one card per turn into the Collective Hand. This hand needs ' +
            G.publicView(me.i).mySlotsThisHand + ' more card(s) from you.',
          'Your Character is the Ace of ' + Cards.SUIT_NAME[me.suit] + ': play a ' +
            Cards.SUIT_GLYPH[me.suit] + ' and you may use your Player Power instead of the Suit Action.'
        ]
      };
    }
    if (topic === 'prediction') {
      return {
        title: 'The Joker’s Prediction',
        lines: [
          'Set by the first Debt card of the round. Match it with the Collective Hand and a Joker turns face up — whoever wins the hand.',
          'This round: ' + G.PREDICTION_LABEL[s.prediction] + '.',
          'Ace → straight flush · King → four of a kind · Q, J, 10 → full house · 9 to 6 → flush · 5 to 2 → straight'
        ]
      };
    }
    if (topic === 'debt') {
      return {
        title: 'Debt at stake',
        lines: [
          'The pot for this hand: ' + s.debtPile.length + ' card(s). Win and it goes face down on the River Rat; lose and the players take it.',
          'Five Debt defeats a Rat. Five on the players and the Rats have you.',
          '♥ adds one to the pot — good when you expect to win, expensive when you do not.'
        ]
      };
    }
    if (topic === 'jokers') {
      return {
        title: 'Jokers',
        lines: [
          '☆ still to be earned · ★ face up and ready · · spent.',
          'Earn one by matching the Prediction. ' + (s.difficulty === 'normal'
            ? 'Use one instead of your turn: it joins the Collective Hand as any card you like.'
            : s.difficulty === 'advanced'
              ? 'Use one instead of your turn: strip a card from the Rat’s Hand — but it draws two more face down.'
              : 'Use one at Hand Resolution: turn Deck cards into the Collective Hand until you stop, or until the Rat’s suit costs you a Debt.'),
          'Only one Joker per Collective Hand, and a used Joker leaves the game.'
        ]
      };
    }
    if (topic === 'deck') {
      return {
        title: 'The Deck',
        lines: [
          s.deck.length + ' cards left, with ' + s.discard.length + ' in the Discard pile.',
          'When the Deck runs out, the Discard pile is shuffled into a new one.',
          'Everything on the table is worth watching: what has been spent is not coming back until then.'
        ]
      };
    }
    if (topic.indexOf('suit-') === 0) {
      var su = topic.slice(5);
      var mine = su === me.suit;
      return {
        title: Cards.SUIT_GLYPH[su] + ' ' + Cards.SUIT_NAME[su],
        lines: [
          'Suit Action — ' + G.suitText(su, G.isSolo()),
          mine
            ? 'Your Player Power — ' + G.powerText(su, G.isSolo())
            : 'The Player Power for ' + Cards.SUIT_NAME[su] + ' belongs to whoever holds that Ace.',
          'You may do one or the other when you play the card, or nothing at all.'
        ]
      };
    }
    return null;
  }

  function showAid(topic) {
    var content = aidContent(topic);
    if (!content) return;
    openSheet(function (sheet, close) {
      sheet.appendChild(el('h2', null, content.title));
      content.lines.forEach(function (line) { sheet.appendChild(el('p', null, line)); });
      sheetButton(sheet, 'Got it', close);
    });
  }

  function wireAids() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-aid]'), function (node) {
      node.addEventListener('click', function () {
        if (pending) return;              // mid-choice: do not steal the tap
        showAid(node.dataset.aid);
      });
    });
  }

  /* ---------------- prompts ---------------- */

  function clearPrompt() {
    $('prompt-title').textContent = '';
    $('prompt-actions').innerHTML = '';
  }

  function showChoice(spec) {
    return new Promise(function (resolve) {
      pending = null;
      render();
      $('prompt-title').textContent = spec.title;
      var box = $('prompt-actions');
      box.innerHTML = '';
      spec.options.forEach(function (opt, i) {
        var b = el('button', i === 0 && spec.options.length > 1 ? 'accent' : '');
        b.appendChild(document.createTextNode(opt.label));
        if (opt.hint) b.appendChild(el('span', 'sub', opt.hint));
        b.addEventListener('click', function () {
          clearPrompt();
          turnTouched = true;
          resolve(opt.value);
        });
        box.appendChild(b);
      });
      addUndo(box);
    });
  }

  function showPick(spec) {
    return new Promise(function (resolve) {
      pending = { zones: spec.zones, resolve: resolve, optional: spec.optional };
      $('prompt-title').textContent = spec.title;
      var box = $('prompt-actions');
      box.innerHTML = '';
      if (spec.optional) {
        var b = el('button', 'quiet', spec.cancelLabel || 'Done / skip');
        b.addEventListener('click', function () { resolvePick(null, null); });
        box.appendChild(b);
      } else {
        box.appendChild(el('button', 'quiet', 'Tap a highlighted card'));
        box.lastChild.disabled = true;
      }
      addUndo(box);
      render();
      scrollToZones(spec.zones);
    });
  }

  function scrollToZones(zones) {
    var order = ['hand', 'market', 'collective', 'ratHand'];
    for (var i = 0; i < order.length; i++) {
      if (zones[order[i]] && zones[order[i]].length) {
        var node = $(order[i] === 'ratHand' ? 'rat-hand' : order[i]);
        if (node && node.scrollIntoView) {
          node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        return;
      }
    }
  }

  function resolvePick(zone, id) {
    if (!pending) return;
    var done = pending.resolve;
    pending = null;
    turnTouched = true;
    clearPrompt();
    render();
    done(id ? { zone: zone, id: id } : null);
  }

  /* ---------------- overlays ---------------- */

  function openSheet(build) {
    return new Promise(function (resolve) {
      var sheet = $('sheet');
      sheet.innerHTML = '';
      var close = function (value) {
        $('overlay').hidden = true;
        sheet.innerHTML = '';
        resolve(value);
      };
      build(sheet, close);
      $('overlay').hidden = false;
      sheet.scrollTop = 0;
    });
  }

  function sheetButton(sheet, label, close, value, cls) {
    var b = el('button', cls || 'primary', label);
    b.addEventListener('click', function () { close(value); });
    sheet.appendChild(b);
    return b;
  }

  function handRow(cards, highlightIds) {
    var row = el('div', 'cards');
    cards.forEach(function (c) {
      var node = cardEl(c, { small: true });
      node.disabled = true; // display only
      if (highlightIds && highlightIds.indexOf(c.id) < 0) node.classList.add('dim');
      row.appendChild(node);
    });
    return row;
  }

  /* ---------------- bot turns ---------------- */

  var botMemo = {};
  var lastMood = {};

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function hurryReveal() { skipReveal = true; }

  function botIsPlaying() {
    return G.state && !G.state.over && G.currentPlayer().bot;
  }

  /* A bot answers from RRGame.publicView - its own hand and the face-up table,
     nothing else - so it plays as blind as the person sitting next to it. */
  function botAnswer(spec) {
    var p = G.currentPlayer();
    if (spec.tag === 'turn-action') botMemo = {};
    pending = null;
    render();
    $('prompt-title').textContent = p.name + ' is thinking…';
    $('prompt-actions').innerHTML = '';
    return delay(spec.tag === 'turn-action' ? 450 : 200).then(function () {
      return Bot.answer(spec, G.publicView(p.i), botMemo);
    });
  }

  /* Bots may talk strategy but never about their cards or the hand they are
     after, so they only ever share a mood - and only when it has changed. */
  function talk(p, score, view) {
    if (score == null) return;                       // it never got to play
    var line = Bot.chatter(view, score, botMemo, p.i);
    if (lastMood[p.i] === line) return;              // do not repeat itself
    lastMood[p.i] = line;
    G.log(p.name + ': “' + line + '”', 'talk');
  }

  /* ---------------- io for the engine ---------------- */

  var io = {
    choose: function (spec) { return botIsPlaying() ? botAnswer(spec) : showChoice(spec); },
    pick: function (spec) { return botIsPlaying() ? botAnswer(spec) : showPick(spec); },

    /* One face-down card has just been turned over. Show it landing, and give it
       a moment - the wait before you know is most of the fun. A tap anywhere
       hurries the rest along for anyone who would rather just know. */
    cardRevealed: function (card, index, total) {
      pending = null;
      revealedId = card.id;
      if (index === 0) {
        skipReveal = false;
        document.addEventListener('click', hurryReveal, true);
      }
      $('prompt-title').textContent = 'Turning them over…  ' + (index + 1) + ' / ' + total;
      $('prompt-actions').innerHTML = '';
      render();
      // Most of the face-down cards belong to the River Rat, whose hand sits at
      // the top of the board - bring whatever is turning over into view.
      var turning = document.querySelector('.card.turning');
      if (turning && turning.scrollIntoView) {
        // Instant, not smooth: the card should already be in view when it turns,
        // and a scroll animation under a flip animation reads as jitter.
        turning.scrollIntoView({ block: 'center' });
      }
      return delay(skipReveal ? 60 : 520).then(function () {
        revealedId = null;
        if (index === total - 1) {
          document.removeEventListener('click', hurryReveal, true);
          render();
          return delay(skipReveal ? 80 : 700);   // the beat before the verdict
        }
      });
    },

    passTo: function (player) {
      // Nothing to hide when only one person is holding the phone.
      if (humanCount() < 2) {
        revealed = true;
        render();
        return Promise.resolve();
      }
      revealed = false;
      render();
      return openSheet(function (sheet, close) {
        var box = el('div', 'pass-screen');
        box.appendChild(el('h2', null, 'Pass the phone'));
        box.appendChild(el('div', 'big-suit', Cards.SUIT_GLYPH[player.suit]));
        box.appendChild(el('p', null, player.name + '’s turn. Hand the phone over before tapping.'));
        box.appendChild(el('p', null, 'Remember: you may talk strategy, but never reveal or hint at the cards in your hand.'));
        sheet.appendChild(box);
        sheetButton(sheet, 'I am ' + player.name, close);
      }).then(function () {
        revealed = true;
        render();
      });
    },

    showResolution: function (r) {
      render(); // the face-down cards have just been turned over
      return openSheet(function (sheet, close) {
        sheet.appendChild(el('h2', null, 'Hand Resolution'));
        // Both hands first, the outcome a moment later.
        var verdict = el('div', 'verdict pending', 'Comparing hands…');
        sheet.appendChild(verdict);
        setTimeout(function () {
          if (!verdict.parentNode) return;
          verdict.className = 'verdict ' + (r.playersWin ? 'good' : 'bad');
          verdict.textContent = r.playersWin
            ? 'The players take it — ' + r.debt + ' Debt onto the River Rat'
            : (r.trueTie ? 'True Tie — the River Rats win — ' + r.debt + ' Debt to you'
              : 'The River Rat takes it — ' + r.debt + ' Debt to you');
        }, skipReveal ? 100 : 900);

        sheet.appendChild(el('h3', null, 'Collective Hand — ' + Poker.describe(r.ours && r.ours.ev)));
        sheet.appendChild(handRow(r.ourCards, r.ours ? r.ours.cards.map(function (c) { return c.id; }) : null));
        sheet.appendChild(el('h3', null, 'River Rat’s Hand — ' + Poker.describe(r.theirs && r.theirs.ev)));
        sheet.appendChild(handRow(r.theirCards, r.theirs ? r.theirs.cards.map(function (c) { return c.id; }) : null));

        sheet.appendChild(el('h3', null, 'Joker’s Prediction'));
        sheet.appendChild(el('p', null, r.predictionLabel + ' — ' +
          (r.predictionHit
            ? (r.jokerFlipped ? 'matched! A Joker is now face up.' : 'matched, but both Jokers are already spent.')
            : 'not matched.')));

        sheetButton(sheet, 'Continue', close);
      });
    },

    ratDefeated: function (info) {
      render();
      return openSheet(function (sheet, close) {
        sheet.appendChild(el('h2', null, 'River Rat ' + Cards.SUIT_GLYPH[info.defeated.s] + ' is defeated!'));
        sheet.appendChild(el('p', null, 'It scurries back to its cabin in debt. Its ability is switched off, but the card stays in the Rat’s Hand.'));
        if (info.bonus) {
          sheet.appendChild(el('h3', null, 'Defeat bonus'));
          sheet.appendChild(el('p', null, info.bonus));
        }
        sheet.appendChild(el('h3', null, 'The second River Rat steps up'));
        sheet.appendChild(el('p', null, info.nextAbility
          ? Cards.SUIT_GLYPH[info.next.s] + ' ' + info.nextAbility
          : Cards.SUIT_GLYPH[info.next.s] + ' — no ability in a first game.'));
        sheetButton(sheet, 'Deal the next round', close);
      });
    },

    gameOver: function (result) {
      clearSave();
      return openSheet(function (sheet, close) {
        sheet.appendChild(el('h2', null, result === 'win' ? 'Both Rats are in debt!' : 'Cleaned out'));
        sheet.appendChild(el('p', null, result === 'win'
          ? 'Five Debt on each River Rat. They scurry back to their cabins and you keep the pot.'
          : 'The players took five Debt. The River Rats collect everything and deal themselves back in.'));
        sheet.appendChild(el('h3', null, 'This game'));
        var t = el('table');
        [['Rounds played', G.state.round],
         ['Difficulty', G.state.difficulty],
         ['Players', G.state.players.length]].forEach(function (row) {
          var tr = el('tr');
          tr.appendChild(el('td', null, row[0]));
          tr.appendChild(el('td', null, String(row[1])));
          t.appendChild(tr);
        });
        sheet.appendChild(t);
        sheetButton(sheet, 'New game', close).addEventListener('click', function () {
          $('screen-game').hidden = true;
          $('screen-setup').hidden = false;
          refreshSetup();
        });
      });
    }
  };

  G.io = io;

  /* ---------------- game loop ---------------- */

  function loop() {
    if (!G.state || G.state.over) return Promise.resolve();
    // Everything needed to put this turn back the way it started. The Deck order
    // is part of it, so undoing and replaying draws the same cards - an undo, not
    // a second roll of the dice.
    turnStart = JSON.stringify(G.state);
    turnTouched = false;
    var myEpoch = ++epoch;
    save();
    render();
    var actor = G.currentPlayer();
    return G.runTurn()
      .then(function () {
        if (myEpoch !== epoch) return;   // this turn was undone; another is running
        // A bot speaks once its whole turn is done, so what it says can take in
        // everything it did - the card it played and anything it left behind.
        if (actor.bot) talk(actor, botMemo.playScore, G.publicView(actor.i));
        render();
        if (!G.shouldResolve()) return;
        resolving = true;
        return G.resolveHand();
      })
      .then(function () {
        resolving = false;
        if (myEpoch !== epoch) return;
        if (G.state.over) { clearSave(); return; }
        turnStart = null;                // past the point of taking it back
        G.nextPlayer();
        return loop();
      });
  }

  /* Puts the table back to the start of this turn. The turn in flight is parked
     on a prompt that will now never be answered, and the epoch check above stops
     it doing anything if it ever were. */
  function undoTurn() {
    if (!turnStart) return;
    G.state = JSON.parse(turnStart);
    pending = null;
    epoch += 1;
    clearPrompt();
    G.log('Turn taken back.', 'sys');
    loop();
  }

  function canUndo() {
    // Never once resolution has started: the River Rat's face-down cards are on
    // the table by then, and taking the turn back would be replaying it knowing
    // what they are.
    return !!turnStart && turnTouched && !resolving && !G.state.over && !G.currentPlayer().bot;
  }

  function addUndo(box) {
    if (!canUndo()) return;
    var b = el('button', 'quiet undo', '↩ Take this turn back');
    b.addEventListener('click', undoTurn);
    box.appendChild(b);
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G.state));
    } catch (e) { /* private browsing or a full quota - play on regardless */ }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function startGame(state) {
    $('screen-setup').hidden = true;
    $('screen-game').hidden = false;
    revealed = humanCount() < 2;
    botMemo = {};
    lastMood = {};
    render();
    loop();
  }

  /* ---------------- setup screen ---------------- */

  var DIFFICULTY_HINT = {
    first: 'The rulebook’s first game: no River Rat abilities and no Player Powers, so it is just the cards, the Market and the Debt.',
    normal: 'The River Rat’s Hand holds two face-down cards. Jokers join the Collective Hand as any card.',
    advanced: 'One extra face-down card for the Rat. A Joker instead strips a card from the Rat’s Hand — and it draws two more face down.',
    expert: 'Two extra face-down cards for the Rat. A Joker is used at Hand Resolution: flip Deck cards into your hand until you stop — or until the Rat’s suit shows up and costs you a Debt.'
  };

  /* What a seat is called when nobody has typed anything. */
  function defaultName(idx) {
    if (idx === 0) return 'You';
    return setup.bots[idx] ? 'Bot ' + Cards.SUIT_GLYPH[setup.suits[idx]] : 'Player ' + (idx + 1);
  }

  function seatName(idx) {
    return (setup.names[idx] || '').trim() || defaultName(idx);
  }

  function rememberNames() {
    try { localStorage.setItem(NAMES_KEY, JSON.stringify(setup.names)); } catch (e) {}
  }
  function recallNames() {
    try {
      var saved = JSON.parse(localStorage.getItem(NAMES_KEY) || '[]');
      if (saved && saved.length) {
        for (var i = 0; i < 4; i++) setup.names[i] = saved[i] || '';
      }
    } catch (e) {}
  }

  function refreshSetup() {
    var picker = $('char-picker');
    picker.innerHTML = '';
    for (var i = 0; i < setup.players; i++) {
      (function (idx) {
        var seat = el('div', 'seat-row');
        var top = el('div', 'seat-top');

        var name = el('input', 'seat-name');
        name.type = 'text';
        name.maxLength = 16;
        name.value = setup.names[idx] || '';
        name.placeholder = defaultName(idx);
        name.setAttribute('aria-label', 'Name for seat ' + (idx + 1));
        name.addEventListener('input', function () {
          setup.names[idx] = name.value;
          rememberNames();
        });
        top.appendChild(name);

        var row = el('div', 'char-row');
        var who = el('button', 'who');
        if (idx === 0) {
          who.textContent = '🧑 You';
          who.disabled = true;
        } else if (setup.bots[idx]) {
          who.textContent = '🤖 Bot';
          who.classList.add('bot');
          who.addEventListener('click', function () { setup.bots[idx] = false; refreshSetup(); });
        } else {
          who.textContent = '🧑 Person';
          who.addEventListener('click', function () { setup.bots[idx] = true; refreshSetup(); });
        }
        top.appendChild(who);
        seat.appendChild(top);
        var suits = el('div', 'suits');
        Cards.SUITS.forEach(function (su) {
          var b = el('button', (su === 'H' || su === 'D') ? 'red' : '');
          b.textContent = Cards.SUIT_GLYPH[su];
          if (setup.suits[idx] === su) b.classList.add('on');
          var takenBy = setup.suits.slice(0, setup.players).indexOf(su);
          if (takenBy >= 0 && takenBy !== idx) b.disabled = true;
          b.addEventListener('click', function () {
            setup.suits[idx] = su;
            refreshSetup();
          });
          suits.appendChild(b);
        });
        row.appendChild(suits);
        seat.appendChild(row);
        picker.appendChild(seat);
      })(i);
    }
    $('difficulty-hint').textContent = DIFFICULTY_HINT[setup.difficulty];
    var saved = loadSave();
    $('btn-resume').hidden = !(saved && !saved.over);
  }

  function ensureDistinctSuits() {
    var used = {};
    for (var i = 0; i < setup.players; i++) {
      var su = setup.suits[i];
      if (!su || used[su]) {
        su = Cards.SUITS.filter(function (x) { return !used[x]; })[0];
        setup.suits[i] = su;
      }
      used[su] = true;
    }
  }

  function wireSetup() {
    Array.prototype.forEach.call($('seg-players').children, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call($('seg-players').children, function (o) { o.classList.remove('on'); });
        b.classList.add('on');
        setup.players = parseInt(b.dataset.n, 10);
        ensureDistinctSuits();
        refreshSetup();
      });
    });
    Array.prototype.forEach.call($('seg-difficulty').children, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call($('seg-difficulty').children, function (o) { o.classList.remove('on'); });
        b.classList.add('on');
        setup.difficulty = b.dataset.d;
        refreshSetup();
      });
    });

    $('btn-start').addEventListener('click', function () {
      ensureDistinctSuits();
      var players = [];
      for (var i = 0; i < setup.players; i++) {
        players.push({ name: seatName(i), suit: setup.suits[i], bot: i > 0 && setup.bots[i] });
      }
      G.newGame({ players: players, difficulty: setup.difficulty });
      startGame();
    });

    $('btn-resume').addEventListener('click', function () {
      var saved = loadSave();
      if (!saved) return;
      G.state = saved;
      startGame();
    });

    $('btn-rules-setup').addEventListener('click', showRules);
    $('btn-rules').addEventListener('click', showRules);
    $('btn-menu').addEventListener('click', showMenu);
  }

  /* ---------------- reference sheets ---------------- */

  function showMenu() {
    openSheet(function (sheet, close) {
      sheet.appendChild(el('h2', null, 'Menu'));
      sheet.appendChild(el('p', null, 'Your game is saved at the start of every turn, so you can close the app and come back.'));
      sheetButton(sheet, 'How to play', close, 'rules', 'ghost');
      sheetButton(sheet, 'Back to the table', close, 'back', 'primary');
      var quit = el('button', 'ghost', inRoom() ? 'Leave the table' : 'Quit to the title screen');
      quit.addEventListener('click', function () {
        var warning = inRoom()
          ? 'Leave the table? A bot will play your hand out for the others.'
          : 'Leave this game? Your saved game is kept.';
        if (!confirm(warning)) return;
        close('quit');
      });
      sheet.appendChild(quit);
    }).then(function (value) {
      if (value === 'rules') showRules();
      if (value === 'quit') {
        if (inRoom()) return leaveTable();
        $('screen-game').hidden = true;
        $('screen-setup').hidden = false;
        refreshSetup();
      }
    });
  }

  function showRules() {
    openSheet(function (sheet, close) {
      sheet.appendChild(el('h2', null, 'How to play'));
      sheet.appendChild(el('p', null, 'Cooperative poker against two River Rats. Put five Debt on each Rat before the players collect five Debt between them.'));

      sheet.appendChild(el('h3', null, 'Your turn'));
      var ul = el('ul');
      ['Refill your hand to three cards, one at a time, from the Market or the Deck.',
       'Play one card into the Collective Hand.',
       'Then either take that card’s Suit Action, or — if the suit matches your Ace — your Player Power.',
       'Instead of all that, you may use a face-up Joker.',
       'When the Collective Hand is full, the hands are resolved.'].forEach(function (t) {
        ul.appendChild(el('li', null, t));
      });
      sheet.appendChild(ul);

      sheet.appendChild(el('h3', null, 'Suit Actions'));
      var t1 = el('table');
      Cards.SUITS.forEach(function (su) {
        var tr = el('tr');
        tr.appendChild(el('td', null, Cards.SUIT_GLYPH[su]));
        tr.appendChild(el('td', null, G.suitText(su, G.state && G.isSolo())));
        t1.appendChild(tr);
      });
      sheet.appendChild(t1);

      sheet.appendChild(el('h3', null, 'Player Powers' +
        (G.state && !G.powersOn() ? ' (not in a first game)' : '')));
      var t2 = el('table');
      Cards.SUITS.forEach(function (su) {
        var tr = el('tr');
        tr.appendChild(el('td', null, Cards.SUIT_GLYPH[su]));
        tr.appendChild(el('td', null, G.powerText(su, G.state && G.isSolo())));
        t2.appendChild(tr);
      });
      sheet.appendChild(t2);

      sheet.appendChild(el('h3', null, 'Joker’s Prediction'));
      var t3 = el('table');
      [['Ace', 'Straight flush'], ['King', 'Four of a kind'], ['Queen, Jack, 10', 'Full house'],
       ['9, 8, 7, 6', 'Flush'], ['5, 4, 3, 2', 'Straight']].forEach(function (row) {
        var tr = el('tr');
        tr.appendChild(el('td', null, row[0]));
        tr.appendChild(el('td', null, row[1]));
        t3.appendChild(tr);
      });
      sheet.appendChild(t3);
      sheet.appendChild(el('p', null, 'Match the prediction with the Collective Hand and a Joker turns face up, whoever wins the hand.'));

      sheet.appendChild(el('h3', null, 'Hand ranking'));
      var t4 = el('table');
      for (var r = 9; r >= 1; r--) {
        var tr = el('tr');
        tr.appendChild(el('td', null, String(10 - r)));
        tr.appendChild(el('td', null, Poker.RANK_NAMES[r]));
        t4.appendChild(tr);
      }
      sheet.appendChild(t4);
      sheet.appendChild(el('p', null, 'Flushes, straights and straight flushes are decided by their highest card. If nothing separates the hands it is a True Tie — and the River Rats win those.'));

      sheet.appendChild(el('h3', null, 'Talking'));
      sheet.appendChild(el('p', null, 'You may discuss general strategy, but never reveal or hint at the cards in your hand, and never name the Collective Hand you are after. Bots keep to the same rule — they will tell you how the table looks and nothing more.'));

      sheet.appendChild(el('h3', null, 'River Rats'));
      var t5 = el('table');
      Cards.SUITS.forEach(function (su) {
        var tr = el('tr');
        tr.appendChild(el('td', null, Cards.SUIT_GLYPH[su] + ' ability'));
        tr.appendChild(el('td', null, G.RAT_ABILITY[su]));
        t5.appendChild(tr);
        var tr2 = el('tr');
        tr2.appendChild(el('td', null, Cards.SUIT_GLYPH[su] + ' defeat bonus'));
        tr2.appendChild(el('td', null, G.RAT_BONUS[su]));
        t5.appendChild(tr2);
      });
      sheet.appendChild(t5);

      sheetButton(sheet, 'Close', close);
    });
  }

  /* ---------------- playing in a room ---------------- */

  var Net = window.RRNet;
  var roomPolling = false;
  var roomDifficulty = 'normal';

  function inRoom() { return !!(Net && Net.token); }

  function showScreen(name) {
    ['setup', 'room', 'game'].forEach(function (s) {
      $('screen-' + s).hidden = (s !== name);
    });
  }

  function roomError(message) {
    $('room-error').textContent = message || '';
  }

  /* The lobby, drawn from whatever the room last told us. */
  function renderLobby(payload) {
    $('room-entry').hidden = true;
    $('room-lobby').hidden = false;
    $('room-code-display').textContent = payload.code;

    var seats = $('room-seats');
    seats.innerHTML = '';
    payload.seats.forEach(function (seat) {
      var row = el('div', 'lobby-seat');
      var glyph = el('span', 'suit' + (seat.suit === 'H' || seat.suit === 'D' ? ' red' : ''),
        Cards.SUIT_GLYPH[seat.suit]);
      row.appendChild(glyph);
      row.appendChild(el('span', null, seat.name + (seat.bot ? ' 🤖' : (seat.away ? ' (gone)' : ''))));
      if (seat.id === payload.you.id) {
        row.appendChild(el('span', 'you', 'you'));
      } else if (payload.you.host) {
        var drop = el('button', 'drop', '×');
        drop.title = 'Remove this seat';
        drop.addEventListener('click', function () {
          Net.act('remove', { seat: seat.id }).catch(function (e) { roomError(e.message); });
        });
        row.appendChild(drop);
      }
      seats.appendChild(row);
    });

    var host = payload.you.host;
    $('room-host-controls').hidden = !host;
    $('btn-add-bot').hidden = !host || payload.seats.length >= 4;
    $('btn-room-start').hidden = !host;
    $('room-waiting').textContent = host
      ? 'Read the code out. Deal when everyone is in.'
      : 'Waiting for the table’s host to deal…';
  }

  /* Draws the board from what the room sent, then answers if it asked us. */
  function applyRoomPayload(payload) {
    // A poll already in flight when we left would otherwise draw the table back
    // over the screen we just went to.
    if (!roomPolling || !Net.token) return Promise.resolve();
    if (payload.status === 'abandoned') {
      roomPolling = false;
      Net.leave();
      return openSheet(function (sheet, close) {
        sheet.appendChild(el('h2', null, 'The table has closed'));
        sheet.appendChild(el('p', null, 'Everyone left, so the game is over. Start another whenever you like.'));
        sheetButton(sheet, 'Back', close);
      }).then(function () { showScreen('setup'); });
    }
    if (payload.status === 'lobby') {
      showScreen('room');
      renderLobby(payload);
      return Promise.resolve();
    }

    var table = Net.tableFrom(payload);
    if (!table) return Promise.resolve();
    G.state = table;
    showScreen('game');
    revealed = true;
    render();

    if (payload.resolution && payload.resolution !== lastShownResolution) {
      lastShownResolution = payload.resolution;
      return io.showResolution(payload.resolution);
    }
    if (payload.prompt) {
      var spec = payload.prompt.spec;
      var promptId = payload.prompt.id;
      var ask = spec.options ? showChoice(spec) : showPick(spec);
      return ask.then(function (answer) {
        return Net.act('answer', { promptId: promptId, answer: answer });
      }).then(function (fresh) {
        Net.version = fresh.version;
        return applyRoomPayload(fresh);
      });
    }
    if (payload.result) {
      return io.gameOver(payload.result).then(function () {
        roomPolling = false;
        Net.leave();
        showScreen('setup');
      });
    }
    if (!payload.prompt) {
      var whose = payload.seats[payload.turn];
      $('prompt-title').textContent = whose
        ? 'Waiting for ' + whose.name + '…'
        : 'Waiting…';
      $('prompt-actions').innerHTML = '';
    }
    return Promise.resolve();
  }

  var lastShownResolution = null;

  /* Ask the room what has changed, forever, until we leave the table. */
  function roomLoop() {
    if (!roomPolling) return Promise.resolve();
    return Net.poll()
      .then(function (payload) {
        roomError('');
        return applyRoomPayload(payload);
      })
      .catch(function (err) {
        roomError(err.message);
        return delay(1500);
      })
      .then(function () { return roomLoop(); });
  }

  function startRoomLoop() {
    if (roomPolling) return;
    roomPolling = true;
    lastShownResolution = null;
    roomLoop();
  }

  /* Tell the room we are going, so the table is not left waiting on a phone
     that has walked off. If the message does not get through, the room notices
     the silence soon enough on its own. */
  function leaveTable() {
    var goodbye = Net.token ? Net.act('leave').catch(function () {}) : Promise.resolve();
    roomPolling = false;
    return goodbye.then(function () {
      Net.leave();
      lastShownResolution = null;
      showScreen('setup');
      $('room-entry').hidden = false;
      $('room-lobby').hidden = true;
    });
  }

  function wireRoom() {
    if (!Net || !Net.available()) return;
    $('field-mode').hidden = false;

    Array.prototype.forEach.call($('seg-mode').children, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call($('seg-mode').children, function (o) { o.classList.remove('on'); });
        b.classList.add('on');
        if (b.dataset.m === 'room') {
          $('room-name').value = setup.names[0] || '';
          $('room-entry').hidden = false;
          $('room-lobby').hidden = true;
          roomError('');
          showScreen('room');
        }
      });
    });

    $('btn-create').addEventListener('click', function () {
      roomError('');
      Net.create($('room-name').value).then(function () {
        startRoomLoop();
      }).catch(function (e) { roomError(e.message); });
    });

    $('btn-join').addEventListener('click', function () {
      roomError('');
      Net.join($('room-code').value, $('room-name').value).then(function () {
        startRoomLoop();
      }).catch(function (e) { roomError(e.message); });
    });

    $('btn-room-back').addEventListener('click', function () {
      Array.prototype.forEach.call($('seg-mode').children, function (o) {
        o.classList.toggle('on', o.dataset.m === 'local');
      });
      showScreen('setup');
    });

    $('btn-room-leave').addEventListener('click', leaveTable);

    $('btn-add-bot').addEventListener('click', function () {
      Net.act('bot').catch(function (e) { roomError(e.message); });
    });

    Array.prototype.forEach.call($('seg-room-difficulty').children, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call($('seg-room-difficulty').children, function (o) {
          o.classList.remove('on');
        });
        b.classList.add('on');
        roomDifficulty = b.dataset.d;
      });
    });

    $('btn-room-start').addEventListener('click', function () {
      Net.act('start', { difficulty: roomDifficulty }).catch(function (e) { roomError(e.message); });
    });

    $('btn-share').addEventListener('click', function () {
      var link = location.href.split('#')[0] + '#' + Net.code;
      if (navigator.share) navigator.share({ text: 'Join my River Rats table: ' + Net.code, url: link });
      else if (navigator.clipboard) navigator.clipboard.writeText(link);
      $('btn-share').textContent = 'Link copied';
    });

    // Opened from a shared link: drop straight into joining that table.
    var fromLink = (location.hash || '').replace('#', '').toUpperCase();
    if (/^[A-Z]{4}$/.test(fromLink)) {
      $('room-code').value = fromLink;
      showScreen('room');
    }
  }

  /* ---------------- boot ---------------- */

  if (window.RRNet) window.RRNet.base = window.RR_ROOM_SERVER || '';
  wireSetup();
  wireAids();
  wireRoom();
  recallNames();
  ensureDistinctSuits();
  refreshSetup();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
