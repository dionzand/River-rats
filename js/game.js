/* River Rats - rules engine.
   The engine drives the game and asks the UI (the `io` object) for every
   decision, so all rule enforcement lives here and nowhere else. */
(function (root) {
  'use strict';

  var Cards = root.RRCards;
  var Poker = root.RRPoker;

  var PREDICTION_BY_RANK = {
    14: 'straight-flush',
    13: 'four-of-a-kind',
    12: 'full-house', 11: 'full-house', 10: 'full-house',
    9: 'flush', 8: 'flush', 7: 'flush', 6: 'flush',
    5: 'straight', 4: 'straight', 3: 'straight', 2: 'straight'
  };
  var PREDICTION_LABEL = {
    'straight-flush': 'Straight flush',
    'four-of-a-kind': 'Four of a kind',
    'full-house': 'Full house',
    'flush': 'Flush',
    'straight': 'Straight'
  };

  var RAT_ABILITY = {
    H: 'When the River Rat wins, the players take one extra Debt card.',
    S: 'The first card played into the Collective Hand is placed face down, triggers nothing and cannot be swapped or be a Joker.',
    C: 'The River Rat’s Hand is dealt two extra face-down cards.',
    D: 'At Round Setup the top card of the Deck is dealt face up as the first card of the Collective Hand.'
  };
  var RAT_BONUS = {
    H: 'Discard one Debt card from the players’ Debt.',
    S: 'The Market’s full capacity becomes four cards.',
    C: 'Every later River Rat’s Hand is dealt one less face-down card.',
    D: 'Hands are now resolved when the Collective Hand reaches six cards.'
  };

  var G = {
    state: null,
    io: null
  };

  /* ---------- helpers ---------- */

  function s() { return G.state; }
  function log(text, kind) {
    G.state.log.push({ text: text, kind: kind || '' });
    if (G.state.log.length > 200) G.state.log.shift();
  }
  /* Keeps the log readable whether the actor is "You" or a named player. */
  var BASE_FORM = { draws: 'draw', takes: 'take', plays: 'play', has: 'have', uses: 'use', adds: 'add' };
  function vb(p, third) {
    return p.name === 'You' ? (BASE_FORM[third] || third) : third;
  }
  function poss(p) { return p.name === 'You' ? 'your' : 'their'; }

  function activeRat() { return s().rats[s().activeRat]; }
  function activeRatSuit() { return activeRat().card.s; }
  function currentPlayer() { return s().players[s().current]; }
  function isSolo() { return s().players.length === 1; }
  function collectiveTarget() { return s().bonuses.resolveAtSix ? 6 : 5; }

  /* "First Time Playing: skip Player Powers and River Rats' Abilities." */
  function abilitiesOn() { return s().difficulty !== 'first'; }
  function powersOn() { return s().difficulty !== 'first'; }

  function deckAvailable() {
    var st = s();
    if (st.deck.length === 0 && st.discard.length > 0) {
      st.deck = Cards.shuffle(st.discard.slice());
      st.discard = [];
      log('The Deck ran out; the Discard pile was reshuffled into a new Deck.', 'sys');
    }
    return st.deck.length > 0;
  }

  function drawTop() {
    if (!deckAvailable()) return null;
    return s().deck.shift();
  }

  function discardCards(cards) {
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] && !cards[i].joker) s().discard.push(cards[i]);
    }
  }

  function refillMarket() {
    var st = s();
    while (st.market.length < st.marketCapacity && deckAvailable()) {
      st.market.push(drawTop());
    }
  }

  function availableJoker() {
    var js = s().jokers;
    for (var i = 0; i < js.length; i++) {
      if (js[i].faceUp && !js[i].removed && !js[i].inCollective) return js[i];
    }
    return null;
  }

  function jokerInCollective() {
    var c = s().collective;
    for (var i = 0; i < c.length; i++) if (c[i].card.joker) return true;
    return false;
  }

  function canUseJokerNow() {
    var st = s();
    if (!availableJoker()) return false;
    if (st.difficulty === 'expert') return false; // Expert Jokers are used at Hand Resolution.
    if (st.difficulty === 'normal' && jokerInCollective()) return false;
    return true;
  }

  function ratHandCards() {
    return s().ratHand.map(function (e) { return e.card; });
  }

  function collectiveCards() {
    return s().collective.map(function (e) { return e.card; });
  }

  function faceDownCountForRound() {
    var st = s();
    var n = 2;
    if (abilitiesOn() && activeRatSuit() === 'C') n += 2;
    if (st.difficulty === 'advanced') n += 1;
    if (st.difficulty === 'expert') n += 2;
    n -= st.bonuses.oneLessFaceDown;
    return Math.max(0, n);
  }

  /* ---------- setup ---------- */

  G.newGame = function (config) {
    var deck = Cards.fullDeck();
    var players = config.players.map(function (p, i) {
      var ace = Cards.card(14, p.suit);
      Cards.takeById(deck, ace.id);
      return {
        i: i,
        name: p.name || ('Player ' + (i + 1)),
        suit: p.suit,
        bot: !!p.bot,
        ace: ace,
        hand: []
      };
    });

    var kings = Cards.shuffle(['S', 'H', 'D', 'C'].map(function (su) { return Cards.card(13, su); }));
    var chosen = kings.slice(0, 2);
    chosen.forEach(function (k) { Cards.takeById(deck, k.id); });
    Cards.shuffle(deck);

    G.state = {
      version: 1,
      difficulty: config.difficulty || 'normal',
      players: players,
      current: 0,
      deck: deck,
      discard: [],
      market: [],
      marketCapacity: 3,
      rats: chosen.map(function (k) { return { card: k, debt: [], defeated: false }; }),
      activeRat: 0,
      jokers: [
        { id: 'JOKER1', faceUp: false, removed: false, inCollective: false },
        { id: 'JOKER2', faceUp: false, removed: false, inCollective: false }
      ],
      playerDebt: [],
      debtPile: [],
      prediction: null,
      predictionCard: null,
      collective: [],
      ratHand: [],
      bonuses: { oneLessFaceDown: 0, resolveAtSix: false },
      round: 0,
      over: null,
      log: []
    };

    log('The River Rats deal you in. Beat them at their own game.', 'sys');
    players.forEach(function (p) {
      for (var i = 0; i < 2; i++) p.hand.push(drawTop());
    });
    refillMarket();
    G.roundSetup();
    return G.state;
  };

  G.roundSetup = function () {
    var st = s();
    st.round += 1;
    st.collective = [];
    st.ratHand = [];

    // The Rats lead the hand: first the one still waiting its turn, face down and
    // never revealed, then the active Rat and any it has already been beaten with.
    st.rats.forEach(function (r, k) {
      if (k !== st.activeRat && !r.defeated) {
        st.ratHand.push({ card: r.card, faceDown: true, isRat: true, counts: false, inactive: true });
      }
    });
    st.ratHand.push({ card: activeRat().card, faceDown: false, isRat: true, counts: true });
    st.rats.forEach(function (r, i) {
      if (i !== st.activeRat && r.defeated) {
        st.ratHand.push({ card: r.card, faceDown: false, isRat: true, counts: true });
      }
    });
    for (var i = 0; i < 5; i++) {
      var c = drawTop();
      if (c) st.ratHand.push({ card: c, faceDown: false, counts: true });
    }
    var downs = faceDownCountForRound();
    for (var j = 0; j < downs; j++) {
      var d = drawTop();
      if (d) st.ratHand.push({ card: d, faceDown: true, counts: true });
    }

    var pred = drawTop();
    st.predictionCard = pred;
    st.prediction = pred ? PREDICTION_BY_RANK[pred.r] : null;
    st.debtPile = pred ? [pred] : [];

    if (abilitiesOn() && activeRatSuit() === 'D') {
      var seed = drawTop();
      if (seed) {
        st.collective.push({ card: seed, faceDown: false, seeded: true });
        log('River Rat ' + Cards.SUIT_GLYPH.D + ' seeds the Collective Hand with ' + Cards.label(seed) + '.', 'rat');
      }
    }

    refillMarket();
    log('Round ' + st.round + ' - Joker’s Prediction: ' + PREDICTION_LABEL[st.prediction] +
      ' (from ' + Cards.label(pred) + ').', 'sys');
  };

  /* ---------- turn ---------- */

  G.runTurn = function () {
    var st = s();
    var p = currentPlayer();
    return Promise.resolve()
      .then(function () {
        if (st.players.length > 1) return G.io.passTo(p);
      })
      .then(function () {
        var options = [{ value: 'play', label: 'Draw & Play', hint: 'Refill to three cards, then play one into the Collective Hand' }];
        if (canUseJokerNow()) {
          options.push({
            value: 'joker',
            label: 'Use a Joker',
            hint: st.difficulty === 'advanced'
              ? 'Remove a card from the River Rat’s Hand and add two face-down cards'
              : 'Add a Joker to the Collective Hand as any card you like'
          });
        }
        if (options.length === 1) return 'play';
        return G.io.choose({ tag: 'turn-action', title: p.name + '’s turn', options: options });
      })
      .then(function (choice) {
        if (choice === 'joker') return useJoker(p);
        return drawAndPlay(p);
      });
  };

  function drawStep(p) {
    var st = s();
    if (p.hand.length >= 3) return Promise.resolve();
    var canMarket = st.market.length > 0;
    var canDeck = deckAvailable();
    if (!canMarket && !canDeck) {
      log('No cards left to draw.', 'sys');
      return Promise.resolve();
    }
    var next;
    if (!canMarket) next = Promise.resolve('deck');
    else if (!canDeck) next = Promise.resolve('market');
    else {
      next = G.io.choose({
        tag: 'draw-source',
        title: 'Draw a card (' + (3 - p.hand.length) + ' more to reach your hand limit)',
        options: [
          { value: 'market', label: 'Take from the Market' },
          { value: 'deck', label: 'Draw from the Deck', hint: st.deck.length + ' cards left' }
        ]
      });
    }
    return next.then(function (src) {
      if (src === 'deck') {
        var c = drawTop();
        if (c) {
          p.hand.push(c);
          log(p.name + ' ' + vb(p, 'draws') + ' from the Deck.', 'player');
        }
        return;
      }
      return G.io.pick({
        tag: 'draw-market',
        title: 'Take a card from the Market',
        zones: { market: st.market.map(function (c) { return c.id; }) }
      }).then(function (sel) {
        if (!sel) return;
        var taken = Cards.takeById(st.market, sel.id);
        p.hand.push(taken);
        log(p.name + ' ' + vb(p, 'takes') + ' ' + Cards.label(taken) + ' from the Market.', 'player');
        refillMarket();
      });
    }).then(function () { return drawStep(p); });
  }

  function drawAndPlay(p) {
    var st = s();
    return drawStep(p).then(function () {
      if (p.hand.length === 0) {
        log(p.name + ' ' + vb(p, 'has') + ' no cards to play.', 'sys');
        return;
      }
      var forcedFaceDown = abilitiesOn() && activeRatSuit() === 'S' && st.collective.length === 0;
      return G.io.pick({
        tag: 'play-card',
        title: forcedFaceDown
          ? 'River Rat ♠: play the first card face down'
          : 'Play a card into the Collective Hand',
        zones: { hand: p.hand.map(function (c) { return c.id; }) }
      }).then(function (sel) {
        var card = Cards.takeById(p.hand, sel.id);
        st.collective.push({ card: card, faceDown: forcedFaceDown, owner: p.i });
        if (forcedFaceDown) {
          log(p.name + ' ' + vb(p, 'plays') + ' a card face down (River Rat ♠).', 'player');
          return;
        }
        log(p.name + ' ' + vb(p, 'plays') + ' ' + Cards.label(card) + ' into the Collective Hand.', 'player');
        return chooseAction(p, card);
      });
    });
  }

  function chooseAction(p, card) {
    var options = [];
    if (powersOn() && card.s === p.suit) {
      options.push({
        value: 'power',
        label: 'Player Power ' + Cards.SUIT_GLYPH[card.s],
        hint: G.powerText(card.s, isSolo())
      });
    }
    options.push({
      value: 'suit',
      label: 'Suit Action ' + Cards.SUIT_GLYPH[card.s],
      hint: G.suitText(card.s, isSolo())
    });
    options.push({ value: 'none', label: 'Do nothing' });
    return G.io.choose({ tag: 'card-action', suit: card.s, title: 'You played ' + Cards.label(card), options: options })
      .then(function (choice) {
        if (choice === 'suit') return suitAction(p, card);
        if (choice === 'power') return playerPower(p, card);
        log(p.name + ' ' + vb(p, 'takes') + ' no action.', 'player');
      });
  }

  G.suitText = function (suit, solo) {
    if (suit === 'C') {
      return solo
        ? 'Add the top card of the Deck face up to the Market (max. six).'
        : 'Add a card from your hand face up to the Market (max. six).';
    }
    if (suit === 'D') return 'Swap another card in the Collective Hand with a card from your hand.';
    if (suit === 'H') return 'Increase the Debt by one card.';
    return 'Discard a card from your hand or the Market.';
  };

  G.powerText = function (suit, solo) {
    if (suit === 'C') {
      return solo
        ? 'Add up to two cards from the Deck face up to the Market (max. six).'
        : 'Add up to two cards from your hand face up to the Market (max. six).';
    }
    if (suit === 'D') return 'Swap another card in the Collective Hand with a card from the Market.';
    if (suit === 'H') return 'Flip a card of the River Rat’s Hand face up, then choose whether to increase the Debt.';
    return 'Discard any number of cards from your hand and the Market.';
  };

  /* ---------- suit actions ---------- */

  function suitAction(p, card) {
    var st = s();
    if (card.s === 'C') {
      if (isSolo()) {
        if (st.market.length >= 6) { log('The Market is already full (six cards).', 'sys'); return Promise.resolve(); }
        var c = drawTop();
        if (c) { st.market.push(c); log('♣ adds ' + Cards.label(c) + ' from the Deck to the Market.', 'player'); }
        return Promise.resolve();
      }
      if (st.market.length >= 6 || p.hand.length === 0) {
        log('♣ has no legal target.', 'sys');
        return Promise.resolve();
      }
      return G.io.pick({
        tag: 'clubs-add',
        title: '♣ Add a card from your hand to the Market',
        optional: true,
        zones: { hand: p.hand.map(function (x) { return x.id; }) }
      }).then(function (sel) {
        if (!sel) return;
        var moved = Cards.takeById(p.hand, sel.id);
        st.market.push(moved);
        log('♣ ' + p.name + ' ' + vb(p, 'adds') + ' ' + Cards.label(moved) + ' to the Market.', 'player');
      });
    }

    if (card.s === 'D') {
      var targets = swappableCollective(card);
      if (!targets.length || p.hand.length === 0) { log('♦ has no legal swap.', 'sys'); return Promise.resolve(); }
      return G.io.pick({
        tag: 'diamonds-out',
        source: 'hand',
        title: '♦ Choose a card in the Collective Hand to swap out',
        optional: true,
        zones: { collective: targets }
      }).then(function (sel) {
        if (!sel) return;
        return G.io.pick({
          tag: 'diamonds-in',
          title: '♦ Choose a card from your hand to swap in',
          zones: { hand: p.hand.map(function (x) { return x.id; }) }
        }).then(function (sel2) {
          swapIntoCollective(sel.id, Cards.takeById(p.hand, sel2.id), function (out) { p.hand.push(out); });
        });
      });
    }

    if (card.s === 'H') {
      var d = drawTop();
      if (d) { st.debtPile.push(d); log('♥ The Debt grows to ' + st.debtPile.length + ' cards.', 'player'); }
      return Promise.resolve();
    }

    return discardOne(p, '♠ Discard a card from your hand or the Market');
  }

  function swappableCollective(playedCard) {
    return s().collective.filter(function (e) {
      return !e.card.joker && !e.faceDown && e.card.id !== playedCard.id;
    }).map(function (e) { return e.card.id; });
  }

  function swapIntoCollective(collectiveCardId, incoming, giveBack) {
    var st = s();
    for (var i = 0; i < st.collective.length; i++) {
      if (st.collective[i].card.id === collectiveCardId) {
        var out = st.collective[i].card;
        st.collective[i] = { card: incoming, faceDown: false };
        giveBack(out);
        log('♦ ' + Cards.label(out) + ' is swapped out for ' + Cards.label(incoming) + '.', 'player');
        return;
      }
    }
  }

  /* `allowed`, when given, limits the choice to the cards that were on the table
     when the action started - so a Market that refills mid-action cannot be
     discarded over and over. */
  function discardOne(p, title, allowed) {
    var st = s();
    var ok = function (c) { return !allowed || allowed.indexOf(c.id) >= 0; };
    var zones = {};
    var hand = p.hand.filter(ok).map(function (c) { return c.id; });
    var market = st.market.filter(ok).map(function (c) { return c.id; });
    if (hand.length) zones.hand = hand;
    if (market.length) zones.market = market;
    if (!zones.hand && !zones.market) return Promise.resolve();
    return G.io.pick({ tag: 'spades-discard', title: title, optional: true, zones: zones })
      .then(function (sel) {
      if (!sel) return;
      var from = sel.zone === 'hand' ? p.hand : st.market;
      var card = Cards.takeById(from, sel.id);
      st.discard.push(card);
      log('♠ ' + Cards.label(card) + ' is discarded from the ' + (sel.zone === 'hand' ? 'hand' : 'Market') + '.', 'player');
      refillMarket();
      return true;
    });
  }

  /* ---------- player powers ---------- */

  function playerPower(p, card) {
    var st = s();
    log(p.name + ' ' + vb(p, 'uses') + ' ' + poss(p) + ' Player Power ' + Cards.SUIT_GLYPH[card.s] + '.', 'power');

    if (card.s === 'C') {
      if (isSolo()) {
        for (var i = 0; i < 2; i++) {
          if (st.market.length >= 6) break;
          var c = drawTop();
          if (!c) break;
          st.market.push(c);
          log('♣ adds ' + Cards.label(c) + ' from the Deck to the Market.', 'power');
        }
        return Promise.resolve();
      }
      var added = 0;
      var addOne = function () {
        if (added >= 2 || st.market.length >= 6 || p.hand.length === 0) return Promise.resolve();
        return G.io.pick({
          tag: 'clubs-add',
          title: '♣ Add a card to the Market (' + (2 - added) + ' left)',
          optional: true,
          zones: { hand: p.hand.map(function (x) { return x.id; }) }
        }).then(function (sel) {
          if (!sel) return;
          var moved = Cards.takeById(p.hand, sel.id);
          st.market.push(moved);
          added += 1;
          log('♣ ' + Cards.label(moved) + ' joins the Market.', 'power');
          return addOne();
        });
      };
      return addOne();
    }

    if (card.s === 'D') {
      var targets = swappableCollective(card);
      if (!targets.length || st.market.length === 0) { log('♦ has no legal swap.', 'sys'); return Promise.resolve(); }
      return G.io.pick({
        tag: 'diamonds-out',
        source: 'market',
        title: '♦ Choose a card in the Collective Hand to swap out',
        optional: true,
        zones: { collective: targets }
      }).then(function (sel) {
        if (!sel) return;
        return G.io.pick({
          tag: 'diamonds-in',
          title: '♦ Choose a Market card to swap in',
          zones: { market: st.market.map(function (x) { return x.id; }) }
        }).then(function (sel2) {
          swapIntoCollective(sel.id, Cards.takeById(st.market, sel2.id), function (out) { st.market.push(out); });
        });
      });
    }

    if (card.s === 'H') {
      var hidden = st.ratHand.filter(function (e) { return e.faceDown && !e.inactive; })
        .map(function (e) { return e.card.id; });
      var flip = hidden.length
        ? G.io.pick({
            tag: 'hearts-flip',
            title: '♥ Flip a card of the River Rat’s Hand face up',
            optional: true,
            zones: { ratHand: hidden }
          }).then(function (sel) {
            if (!sel) return;
            st.ratHand.forEach(function (e) { if (e.card.id === sel.id) e.faceDown = false; });
            log('♥ The River Rat is holding ' + Cards.label(Cards.byId(ratHandCards(), sel.id)) + '.', 'power');
          })
        : Promise.resolve();
      return flip.then(function () {
        return G.io.choose({
          tag: 'hearts-debt',
          title: '♥ Increase the Debt?',
          options: [
            { value: 'no', label: 'Leave the Debt as it is', hint: 'Debt is currently ' + st.debtPile.length + ' card(s)' },
            { value: 'yes', label: 'Increase the Debt by one card' }
          ]
        });
      }).then(function (ans) {
        if (ans === 'yes') {
          var d = drawTop();
          if (d) { st.debtPile.push(d); log('♥ The Debt grows to ' + st.debtPile.length + ' cards.', 'power'); }
        }
      });
    }

    var allowed = p.hand.concat(st.market).map(function (c) { return c.id; });
    var loop = function () {
      return discardOne(p, '♠ Discard any number of cards (tap Done to stop)', allowed)
        .then(function (didDiscard) {
          if (didDiscard) return loop();
        });
    };
    return loop();
  }

  /* ---------- jokers ---------- */

  function useJoker(p) {
    var st = s();
    var joker = availableJoker();
    if (!joker) return Promise.resolve();

    if (st.difficulty === 'normal') {
      joker.inCollective = true;
      st.collective.push({ card: { id: joker.id, joker: true }, faceDown: false, owner: p.i });
      log(p.name + ' ' + vb(p, 'plays') + ' a Joker into the Collective Hand.', 'joker');
      return Promise.resolve();
    }

    // Advanced: strip a card from the River Rat's Hand, then it deals two more face down.
    var targets = st.ratHand.filter(function (e) { return !e.isRat; }).map(function (e) { return e.card.id; });
    if (!targets.length) return Promise.resolve();
    return G.io.pick({
      tag: 'joker-remove',
      title: 'Joker: remove a card from the River Rat’s Hand',
      zones: { ratHand: targets }
    }).then(function (sel) {
      for (var i = 0; i < st.ratHand.length; i++) {
        if (st.ratHand[i].card.id === sel.id) {
          var removed = st.ratHand.splice(i, 1)[0];
          st.discard.push(removed.card);
          log('Joker removes ' + (removed.faceDown ? 'a face-down card' : Cards.label(removed.card)) +
            ' from the River Rat’s Hand.', 'joker');
          break;
        }
      }
      for (var j = 0; j < 2; j++) {
        var c = drawTop();
        if (c) st.ratHand.push({ card: c, faceDown: true, counts: true });
      }
      log('The River Rat draws two extra face-down cards.', 'rat');
      joker.removed = true;
      joker.faceUp = false;
    });
  }

  function expertJoker() {
    var st = s();
    var joker = availableJoker();
    if (!joker) return Promise.resolve();
    var revealed = [];
    var step = function () {
      return G.io.choose({
        tag: 'joker-reveal',
        title: 'Joker: reveal the top card of the Deck?',
        options: [
          { value: 'reveal', label: 'Reveal a card', hint: 'It joins the Collective Hand unless it matches ' + Cards.SUIT_GLYPH[activeRatSuit()] },
          { value: 'stop', label: 'Stop revealing' }
        ]
      }).then(function (ans) {
        if (ans === 'stop') return;
        var c = drawTop();
        if (!c) return;
        if (c.s === activeRatSuit()) {
          log('Joker reveals ' + Cards.label(c) + ' - the River Rat’s suit! Everything revealed is discarded and the players gain one Debt.', 'bad');
          revealed.push(c);
          discardCards(revealed);
          st.collective = st.collective.filter(function (e) {
            return !revealed.some(function (r) { return r.id === e.card.id; });
          });
          var d = drawTop();
          if (d) st.playerDebt.push(d);
          return;
        }
        revealed.push(c);
        st.collective.push({ card: c, faceDown: false, fromJoker: true });
        log('Joker reveals ' + Cards.label(c) + ' into the Collective Hand.', 'joker');
        return step();
      });
    };
    return step().then(function () {
      joker.removed = true;
      joker.faceUp = false;
    });
  }

  /* ---------- hand resolution ---------- */

  G.shouldResolve = function () {
    return s().collective.length >= collectiveTarget();
  };

  G.resolveHand = function () {
    var st = s();
    return Promise.resolve()
      .then(function () {
        if (st.difficulty === 'expert' && availableJoker()) {
          return G.io.choose({
            tag: 'joker-resolve',
            title: 'Hand Resolution: use a Joker?',
            options: [
              { value: 'no', label: 'Resolve without a Joker' },
              { value: 'yes', label: 'Use a Joker', hint: 'Reveal Deck cards into the Collective Hand, but not the River Rat’s suit' }
            ]
          }).then(function (ans) { if (ans === 'yes') return expertJoker(); });
        }
      })
      .then(function () {
        var predictionHit = st.prediction && Poker.canForm(collectiveCards(), st.prediction);
        var jokerFlipped = false;
        if (predictionHit) {
          for (var i = 0; i < st.jokers.length; i++) {
            if (!st.jokers[i].faceUp && !st.jokers[i].removed) {
              st.jokers[i].faceUp = true;
              jokerFlipped = true;
              log('The Joker’s Prediction (' + PREDICTION_LABEL[st.prediction] + ') came true - a Joker is now available.', 'joker');
              break;
            }
          }
        }

        st.collective.forEach(function (e) { e.faceDown = false; });
        st.ratHand.forEach(function (e) { if (!e.inactive) e.faceDown = false; });

        var ours = Poker.bestFive(collectiveCards());
        var theirCards = st.ratHand.filter(function (e) { return e.counts !== false; })
          .map(function (e) { return e.card; });
        var theirs = Poker.bestFive(theirCards);

        var cmp = ours && theirs ? Poker.compare(ours.ev, theirs.ev) : (ours ? 1 : -1);
        var playersWin = cmp > 0;
        var trueTie = cmp === 0;

        var debtCount = st.debtPile.length;
        var extra = 0;
        if (playersWin) {
          activeRat().debt = activeRat().debt.concat(st.debtPile);
          log('The players win the hand: ' + debtCount + ' Debt to the River Rat ' +
            Cards.SUIT_GLYPH[activeRatSuit()] + '.', 'good');
        } else {
          if (abilitiesOn() && activeRatSuit() === 'H') {
            var extraCard = drawTop();
            if (extraCard) { st.debtPile.push(extraCard); extra = 1; }
          }
          st.playerDebt = st.playerDebt.concat(st.debtPile);
          log((trueTie ? 'A True Tie - the River Rats win it. ' : 'The River Rat wins the hand. ') +
            st.debtPile.length + ' Debt to the players.', 'bad');
        }
        st.debtPile = [];

        return G.io.showResolution({
          ours: ours,
          theirs: theirs,
          ourCards: collectiveCards(),
          theirCards: theirCards,
          playersWin: playersWin,
          trueTie: trueTie,
          debt: debtCount + extra,
          predictionHit: predictionHit,
          jokerFlipped: jokerFlipped,
          predictionLabel: PREDICTION_LABEL[st.prediction]
        });
      })
      .then(function () { return endOfHand(); });
  };

  function endOfHand() {
    var st = s();

    if (st.playerDebt.length >= 5) {
      st.over = 'lose';
      log('The players have taken five Debt. The River Rats clean you out.', 'bad');
      return G.io.gameOver('lose');
    }

    var defeatPromise = Promise.resolve();
    var rat = activeRat();
    if (rat.debt.length >= 5) {
      rat.defeated = true;
      discardCards(rat.debt);
      rat.debt = [];
      var suit = rat.card.s;
      log('River Rat ' + Cards.SUIT_GLYPH[suit] + ' is defeated!' +
        (abilitiesOn() ? ' ' + RAT_BONUS[suit] : ''), 'good');
      applyDefeatBonus(suit);
      var other = st.rats[1 - st.activeRat];
      if (other.defeated) {
        st.over = 'win';
        return G.io.gameOver('win');
      }
      st.activeRat = 1 - st.activeRat;
      defeatPromise = G.io.ratDefeated({
        defeated: rat.card,
        bonus: abilitiesOn() ? RAT_BONUS[suit] : null,
        next: other.card,
        nextAbility: abilitiesOn() ? RAT_ABILITY[other.card.s] : null
      });
    }

    return defeatPromise.then(function () {
      cleanup();
      G.roundSetup();
    });
  }

  function applyDefeatBonus(suit) {
    var st = s();
    if (!abilitiesOn()) return;
    if (suit === 'H') {
      if (st.playerDebt.length) {
        st.discard.push(st.playerDebt.pop());
        log('Defeat bonus ♥: one Debt card is wiped from the players’ Debt.', 'good');
      }
    } else if (suit === 'S') {
      st.marketCapacity = 4;
      refillMarket();
    } else if (suit === 'C') {
      st.bonuses.oneLessFaceDown += 1;
    } else if (suit === 'D') {
      st.bonuses.resolveAtSix = true;
    }
  }

  function cleanup() {
    var st = s();
    st.jokers.forEach(function (j) {
      if (j.inCollective) { j.removed = true; j.faceUp = false; j.inCollective = false; }
    });
    discardCards(collectiveCards());
    st.collective = [];
    st.ratHand.forEach(function (e) { if (!e.isRat) st.discard.push(e.card); });
    st.ratHand = [];
  }

  G.nextPlayer = function () {
    var st = s();
    st.current = (st.current + 1) % st.players.length;
  };

  /* Everything one player may legitimately know, and nothing else. Bots are
     handed this instead of the game state, so they play blind like a person at
     the table: no peeking at the Deck, the face-down cards, or anyone's hand.
     `unseen` is the pool a card the player cannot see must have come from. */
  G.publicView = function (playerIndex) {
    var st = s();
    var me = st.players[playerIndex];
    var seen = {};
    var see = function (c) { if (c && !c.joker) seen[c.id] = true; };

    me.hand.forEach(see);
    st.players.forEach(function (p) { see(p.ace); });   // Characters sit face up
    st.market.forEach(see);
    st.discard.forEach(see);
    if (st.debtPile.length) see(st.debtPile[0]);        // the Joker's Prediction

    var collectiveKnown = [];
    var collectiveHidden = 0;
    st.collective.forEach(function (e) {
      // A card played face down under the Rat's ♠ ability is known to whoever
      // played it, and to nobody else.
      if (!e.faceDown || e.owner === playerIndex) {
        collectiveKnown.push(e.card);
        see(e.card);
      } else {
        collectiveHidden += 1;
      }
    });

    var ratFaceUp = [];
    var ratFaceDownCount = 0;
    st.ratHand.forEach(function (e) {
      if (e.counts === false) return;                   // the waiting Rat never counts
      if (e.faceDown) { ratFaceDownCount += 1; return; }
      ratFaceUp.push(e.card);
      see(e.card);
    });

    var unseen = Cards.fullDeck().filter(function (c) { return !seen[c.id]; });

    return {
      myIndex: playerIndex,
      myHand: me.hand.slice(),
      mySuit: me.suit,
      handLimit: 3,
      collectiveKnown: collectiveKnown,
      collectiveHidden: collectiveHidden,
      collectiveTarget: collectiveTarget(),
      market: st.market.slice(),
      marketCapacity: st.marketCapacity,
      ratFaceUp: ratFaceUp,
      ratFaceDownCount: ratFaceDownCount,
      ratSuit: activeRatSuit(),
      ratDebt: activeRat().debt.length,
      ratsRemaining: st.rats.filter(function (r) { return !r.defeated; }).length,
      // A River Rat still waiting its turn is one of the Kings nobody has seen,
      // sitting face down beside the table: it is out of circulation, even
      // though which King it is stays unknown.
      waitingRat: st.rats.some(function (r, i) { return i !== st.activeRat && !r.defeated; }),
      playerDebt: st.playerDebt.length,
      debtAtStake: st.debtPile.length,
      prediction: st.prediction,
      jokerAvailable: !!availableJoker(),
      jokerInCollective: jokerInCollective(),
      deckCount: st.deck.length,
      discardCount: st.discard.length,
      difficulty: st.difficulty,
      others: st.players.filter(function (p) { return p.i !== playerIndex; })
        .map(function (p) { return { name: p.name, suit: p.suit, handCount: p.hand.length }; }),
      unseen: unseen
    };
  };

  /* True for the two Kings that are River Rats - never for the other two Kings,
     which are ordinary cards in the Deck. */
  G.isRatCard = function (card) {
    var st = s();
    if (!st || !card || card.joker) return false;
    for (var i = 0; i < st.rats.length; i++) {
      if (st.rats[i].card.id === card.id) return true;
    }
    return false;
  };

  G.RAT_ABILITY = RAT_ABILITY;
  G.RAT_BONUS = RAT_BONUS;
  G.PREDICTION_LABEL = PREDICTION_LABEL;
  G.PREDICTION_BY_RANK = PREDICTION_BY_RANK;
  G.collectiveTarget = collectiveTarget;
  G.abilitiesOn = abilitiesOn;
  G.powersOn = powersOn;
  G.activeRat = activeRat;
  G.activeRatSuit = activeRatSuit;
  G.currentPlayer = currentPlayer;
  G.availableJoker = availableJoker;
  G.isSolo = isSolo;
  G.log = log;

  root.RRGame = G;
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
})(typeof globalThis !== 'undefined' ? globalThis : this);
