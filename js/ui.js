/* River Rats - interface layer. Owns the DOM, and answers the engine's
   questions through the `io` object it hands to RRGame. */
(function () {
  'use strict';

  var Cards = window.RRCards;
  var Poker = window.RRPoker;
  var G = window.RRGame;

  var SAVE_KEY = 'riverrats.save.v1';

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  var setup = { players: 1, suits: ['S', 'H', 'D', 'C'], difficulty: 'normal' };
  var pending = null;   // active pick: { zones, resolve, optional }
  var revealed = false; // has the current player looked at their hand?

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

    $('rat-ability').textContent = Cards.SUIT_GLYPH[suit] + ' ' + G.RAT_ABILITY[suit];
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

    $('token-prediction').innerHTML = 'Prediction<b>' +
      (s.prediction ? G.PREDICTION_LABEL[s.prediction] : '—') + '</b>';
    $('token-debt').innerHTML = 'Debt at stake<b>' + s.debtPile.length + '</b>';
    $('token-jokers').innerHTML = 'Jokers<b>' + s.jokers.map(function (j) {
      return j.removed ? '·' : (j.faceUp ? '★' : '☆');
    }).join(' ') + '</b>';
    $('token-deck').innerHTML = 'Deck<b>' + s.deck.length + '</b>';

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

    var p = G.currentPlayer();
    $('hand-title').textContent = s.players.length > 1 ? p.name + '’s hand' : 'Your hand';
    $('hand-note').textContent = Cards.SUIT_GLYPH[p.suit] + ' character · ' +
      p.hand.length + '/3 cards' +
      (s.players.length > 1 ? ' · ' + otherPlayersNote() : '');
    var hide = s.players.length > 1 && !revealed;
    fill($('hand'), p.hand.map(function (c) {
      return cardEl(c, { zone: 'hand', faceDown: hide });
    }));

    var logBox = $('log');
    logBox.innerHTML = '';
    s.log.slice(-40).reverse().forEach(function (entry) {
      logBox.appendChild(el('div', entry.kind, entry.text));
    });
  }

  function otherPlayersNote() {
    return G.state.players.filter(function (o) { return o.i !== G.state.current; })
      .map(function (o) { return o.name + ' ' + o.hand.length; }).join(', ');
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
          resolve(opt.value);
        });
        box.appendChild(b);
      });
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

  /* ---------------- io for the engine ---------------- */

  var io = {
    choose: showChoice,
    pick: showPick,

    passTo: function (player) {
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
        var verdict = el('div', 'verdict ' + (r.playersWin ? 'good' : 'bad'),
          r.playersWin ? 'The players take it — ' + r.debt + ' Debt onto the River Rat'
            : (r.trueTie ? 'True Tie — the River Rats win — ' + r.debt + ' Debt to you'
              : 'The River Rat takes it — ' + r.debt + ' Debt to you'));
        sheet.appendChild(verdict);

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
        sheet.appendChild(el('h3', null, 'Defeat bonus'));
        sheet.appendChild(el('p', null, info.bonus));
        sheet.appendChild(el('h3', null, 'The second River Rat steps up'));
        sheet.appendChild(el('p', null, Cards.SUIT_GLYPH[info.next.s] + ' ' + info.nextAbility));
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
    save();
    render();
    return G.runTurn()
      .then(function () {
        render();
        if (G.shouldResolve()) return G.resolveHand();
      })
      .then(function () {
        if (G.state.over) { clearSave(); return; }
        G.nextPlayer();
        return loop();
      });
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
    revealed = G.state.players.length === 1;
    render();
    loop();
  }

  /* ---------------- setup screen ---------------- */

  var DIFFICULTY_HINT = {
    normal: 'The River Rat’s Hand holds two face-down cards. Jokers join the Collective Hand as any card.',
    advanced: 'One extra face-down card for the Rat. A Joker instead strips a card from the Rat’s Hand — and it draws two more face down.',
    expert: 'Two extra face-down cards for the Rat. A Joker is used at Hand Resolution: flip Deck cards into your hand until you stop — or until the Rat’s suit shows up and costs you a Debt.'
  };

  function refreshSetup() {
    var picker = $('char-picker');
    picker.innerHTML = '';
    for (var i = 0; i < setup.players; i++) {
      (function (idx) {
        var row = el('div', 'char-row');
        row.appendChild(el('span', 'who', setup.players === 1 ? 'You' : 'Player ' + (idx + 1)));
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
        picker.appendChild(row);
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
        players.push({
          name: setup.players === 1 ? 'You' : 'Player ' + (i + 1),
          suit: setup.suits[i]
        });
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
      var quit = el('button', 'ghost', 'Quit to the title screen');
      quit.addEventListener('click', function () {
        if (!confirm('Leave this game? Your saved game is kept.')) return;
        close('quit');
      });
      sheet.appendChild(quit);
    }).then(function (value) {
      if (value === 'rules') showRules();
      if (value === 'quit') {
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

      sheet.appendChild(el('h3', null, 'Player Powers'));
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

  /* ---------------- boot ---------------- */

  wireSetup();
  ensureDistinctSuits();
  refreshSetup();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
