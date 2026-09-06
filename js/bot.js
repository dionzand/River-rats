/* River Rats - bot players.
   A bot answers the same io interface a person taps, from the same public view
   a person has: its own hand and what is face up on the table. It never sees the
   Deck, the face-down cards, or anyone else's hand, so it plays blind - it has
   to guess what its teammates are holding, exactly as they have to guess at it.

   No trained model: the table hands us a perfect evaluator (RRPoker), and the
   River Rat shows most of its hand, so the bot deals out the cards it cannot see
   a few hundred times and counts how often each option wins. */
(function (root) {
  'use strict';

  var Cards = root.RRCards;
  var Poker = root.RRPoker;

  var SAMPLES = 140;        // rollouts per candidate
  var SAMPLES_JOKER = 32;   // a wild card costs 52x more to evaluate
  var SWAP_MARGIN = 0.04;   // only rearrange the Collective Hand for a real gain
  var JOKER_MARGIN = 0.10;  // Jokers are scarce; spend one only for a clear gain
  var NEVER = 2;            // a confidence no hand can reach: do not raise
  var TEAM_CHOICE = 2;      // Deck cards a rollout offers on top of the whole Market
  // How a modelled teammate weighs what is already on the table. Suits matter
  // more than ranks: nobody may say "I have another eight", but everyone can see
  // three hearts and play a heart, so a flush is the hand a blind team can
  // actually agree on. Measured over a few hundred hands - pulling toward ranks
  // instead costs about ten points of hand win rate.
  var RANK_PULL = 1;
  var SUIT_PULL = 3;

  function hasJoker(cards) {
    for (var i = 0; i < cards.length; i++) if (cards[i].joker) return true;
    return false;
  }

  /* Deals `n` cards off a copy of the pool. */
  function dealFrom(pool, n) {
    var out = [];
    for (var i = 0; i < n && pool.length; i++) {
      var j = Math.floor(Math.random() * pool.length);
      out.push(pool[j]);
      pool[j] = pool[pool.length - 1];
      pool.pop();
    }
    return out;
  }

  /* One rollout of everything this player cannot see: what the River Rat is
     hiding, and a few ways the rest of the Collective Hand might come in.

     Every candidate play is scored against the SAME set of rollouts. Judging each
     option on its own fresh deals buries the difference between them in sampling
     noise - the gap between a good card and a bad one here is a few percent, and
     so is the error - and the bot ends up picking noise. Dealing once and
     comparing like with like is what makes the choice mean anything. */
  /* How much shape a part-built hand has. Not a judgement of the hand - just
     enough to tell which card a sensible teammate would add to it. */
  function shape(cards) {
    var ranks = {}, suits = {}, wild = 0, i, key;
    for (i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.joker) { wild += 1; continue; }
      ranks[c.r] = (ranks[c.r] || 0) + 1;
      suits[c.s] = (suits[c.s] || 0) + 1;
    }
    var topRank = 0, topSuit = 0, pairs = 0;
    for (key in ranks) {
      if (ranks[key] > topRank) topRank = ranks[key];
      if (ranks[key] >= 2) pairs += 1;
    }
    for (key in suits) if (suits[key] > topSuit) topSuit = suits[key];
    return (topRank + wild) * RANK_PULL + (topSuit + wild) * SUIT_PULL + pairs;
  }

  function arena(view, slots, samples) {
    var n = samples || SAMPLES;
    var worlds = [];
    var hidden = view.ratFaceDownCount;
    var offer = slots * TEAM_CHOICE;
    for (var i = 0; i < n; i++) {
      var pool = view.unseen.slice();
      var theirCards = view.ratFaceUp.concat(dealFrom(pool, hidden));
      // The Market is the team's shared hand: it is face up, so every player can
      // see the same cards and any of them can take one. A rollout therefore
      // always offers the whole Market, plus a few cards off the Deck for what
      // teammates might be holding - rather than treating a Market card as
      // something a teammate has to happen to draw.
      worlds.push({
        theirs: Poker.bestFive(theirCards),
        offer: slots > 0 ? view.market.concat(dealFrom(pool, Math.min(offer, pool.length))) : []
      });
    }
    return { worlds: worlds, slots: slots };
  }

  /* Nobody may say what they are holding, but everyone can see the Collective
     Hand - so a team converges on it: two hearts down and the next player adds a
     heart. Each rollout picks its cards out of the same offered pool by that
     rule, which is both how teammates really behave and what makes one candidate
     play score differently from another. */
  function completeLikeATeam(ourCards, offer, slots) {
    var out = ourCards.slice();
    var pool = offer.slice();
    for (var s = 0; s < slots && pool.length; s++) {
      var bestAt = 0, bestScore = -1;
      for (var i = 0; i < pool.length; i++) {
        var score = shape(out.concat([pool[i]]));
        if (score > bestScore) { bestScore = score; bestAt = i; }
      }
      out.push(pool[bestAt]);
      pool.splice(bestAt, 1);
    }
    return out;
  }

  function scoreIn(arena, ourCards, mine) {
    var wins = 0;
    for (var i = 0; i < arena.worlds.length; i++) {
      var w = arena.worlds[i];
      if (!w.theirs) continue;
      var best;
      if (!arena.slots) {
        best = Poker.bestFive(ourCards);
      } else {
        best = Poker.bestFive(completeLikeATeam(ourCards, w.offer, arena.slots));
        // The cards still in this player's own hand are not a guess: if they can
        // finish the Collective Hand, that is worth knowing before playing.
        if (mine && mine.length) {
          var own = completeLikeATeam(ourCards, mine.concat(w.offer), arena.slots);
          var ownHand = Poker.bestFive(own);
          if (ownHand && (!best || Poker.compare(ownHand.ev, best.ev) > 0)) best = ownHand;
        }
      }
      if (best && Poker.compare(best.ev, w.theirs.ev) > 0) wins += 1;
    }
    return wins / arena.worlds.length;
  }

  function winChance(view, ourCards, samples) {
    var slots = Math.max(0, view.collectiveTarget - ourCards.length);
    var n = samples || (hasJoker(ourCards) ? SAMPLES_JOKER : SAMPLES);
    if (view.unseen.length < slots + view.ratFaceDownCount) return 0.5;
    return scoreIn(arena(view, slots, n), ourCards);
  }

  /* Ranks every candidate card by what the Collective Hand becomes with it, with
     whatever else this player holds counted as a possible finish. */
  function rank(view, cards, samples) {
    if (!cards.length) return null;
    var slots = Math.max(0, view.collectiveTarget - view.collectiveKnown.length - 1);
    var wild = cards.some(function (c) { return c.joker; });
    var a = arena(view, slots, samples || (wild ? SAMPLES_JOKER : SAMPLES));
    var scored = cards.map(function (card) {
      var mine = view.myHand.filter(function (c) { return c.id !== card.id; });
      return { card: card, score: scoreIn(a, view.collectiveKnown.concat([card]), mine) };
    });
    scored.sort(function (x, y) { return y.score - x.score; });
    return { best: scored[0], worst: scored[scored.length - 1], all: scored, arena: a };
  }

  function byId(cards, id) { return Cards.byId(cards, id); }

  /* Rough worth of an unknown card, for deciding whether the Market beats the
     Deck: score a handful of the cards that could come up next. */
  function deckValue(view) {
    var pool = view.unseen.slice();
    var probe = dealFrom(pool, Math.min(5, pool.length));
    if (!probe.length) return 0;
    var scored = rank(view, probe, 60);
    var total = 0;
    scored.all.forEach(function (s) { total += s.score; });
    return total / scored.all.length;
  }

  /* When is raising the Debt worth it? A Debt card is a bet: win the hand and it
     lands on the River Rat, lose it and it lands on the players. The two sides
     are not worth the same, and how much they are worth changes as the game
     goes. Five Debt defeats a Rat and ends the players, so compare how much of a
     win one card buys against how much of a loss it costs.

     Two corrections matter more than the arithmetic:
     - a pot already big enough to finish the active Rat is wasted effort, since
       Debt beyond its fifth card is discarded with it;
     - one Debt from defeating a Rat, the same card is nearly free money. */
  /* How many cards of the Collective Hand are still to come. */
  function slotsLeft(view) {
    return Math.max(0, view.collectiveTarget - view.collectiveKnown.length - view.collectiveHidden);
  }

  function debtThreshold(view) {
    var roomOnRat = 5 - view.ratDebt;
    if (view.debtAtStake >= roomOnRat) return NEVER;      // the pot already finishes it
    var ratNeeds = roomOnRat + (view.ratsRemaining > 1 ? 5 : 0);
    var playerRoom = 5 - view.playerDebt;
    if (playerRoom <= 1) return NEVER;                    // one Debt from losing
    // Raising early is betting on cards nobody has played yet. With the hand
    // nearly full the read is worth something; with three cards still to come it
    // is a guess, and the pot rides on it either way.
    if (slotsLeft(view) > 1) return NEVER;
    return ratNeeds / (ratNeeds + playerRoom);
  }

  /* --------------- the decisions --------------- */

  var handlers = {};

  handlers['turn-action'] = function (spec, view, memo) {
    var canJoker = spec.options.some(function (o) { return o.value === 'joker'; });
    if (!canJoker) return 'play';
    if (view.difficulty === 'advanced') {
      // The Joker strips a card from the Rat, but it draws two more face down:
      // only worth it when the Rat is already showing something frightening.
      var ratNow = Poker.bestFive(view.ratFaceUp);
      var losing = winChance(view, view.collectiveKnown) < 0.35;
      return (losing && ratNow && ratNow.ev.rank >= 4) ? 'joker' : 'play';
    }
    var options = view.myHand.concat([{ id: 'JOKER', joker: true }]);
    var scored = rank(view, options, SAMPLES_JOKER);
    var joker = scored.all.filter(function (s) { return s.card.joker; })[0];
    var card = scored.all.filter(function (s) { return !s.card.joker; })[0];
    memo.jokerScore = joker ? joker.score : 0;
    return (joker && (!card || joker.score > card.score + JOKER_MARGIN)) ? 'joker' : 'play';
  };

  handlers['draw-source'] = function (spec, view) {
    if (!view.market.length) return 'deck';
    var best = rank(view, view.market, 60).best;
    return best.score >= deckValue(view) ? 'market' : 'deck';
  };

  handlers['draw-market'] = function (spec, view) {
    var options = spec.zones.market.map(function (id) { return byId(view.market, id); })
      .filter(Boolean);
    return { zone: 'market', id: rank(view, options, 80).best.card.id };
  };

  handlers['play-card'] = function (spec, view, memo) {
    var options = spec.zones.hand.map(function (id) { return byId(view.myHand, id); }).filter(Boolean);
    var best = rank(view, options).best;
    memo.playScore = best.score;
    memo.played = best.card;
    return { zone: 'hand', id: best.card.id };
  };

  handlers['card-action'] = function (spec, view, memo) {
    var has = function (v) { return spec.options.some(function (o) { return o.value === v; }); };
    // The Player Power is a stronger version of every Suit Action, so take it
    // whenever the played card matches this bot's Character.
    if (spec.suit === 'H' && !has('power')) {
      // The plain ♥ action forces the Debt up: only good when the bet is worth it.
      return memo.playScore >= debtThreshold(view) ? 'suit' : 'none';
    }
    if (has('power')) return 'power';
    return has('suit') ? 'suit' : 'none';
  };

  handlers['hearts-flip'] = function (spec, view) {
    var ids = spec.zones.ratHand || [];
    return ids.length ? { zone: 'ratHand', id: ids[0] } : null;  // free information
  };

  handlers['hearts-debt'] = function (spec, view, memo) {
    // By now a card of the Rat's Hand has just been turned over, so this is the
    // best-informed moment in the round to take the bet.
    var score = winChance(view, view.collectiveKnown, 120);
    return score >= debtThreshold(view) ? 'yes' : 'no';
  };

  handlers['clubs-add'] = function (spec, view, memo) {
    // The Market is the one channel a blind team really has. Nobody may say what
    // they are holding, but a card laid face up in the Market says it for them:
    // anyone can see it, and anyone can take it and play it.
    //
    // So this offers the best card left in hand, not the worst. A bot plays one
    // card a turn; a second card that would suit the Collective Hand is dead
    // weight until its next turn, and in the Market a teammate can use it now.
    // (Nothing is lost if they do not: the bot can take it back next turn.)
    var options = (spec.zones.hand || []).map(function (id) { return byId(view.myHand, id); })
      .filter(Boolean);
    if (options.length < 2) return null;          // never play the hand empty
    var scored = rank(view, options, 60);
    var offer = scored.best;
    // Only worth offering if it is a card the team can actually use.
    if (offer.score < deckValue(view)) return null;
    memo.offered = true;
    return { zone: 'hand', id: offer.card.id };
  };

  handlers['spades-discard'] = function (spec, view, memo) {
    // Two things are worth clearing out: a Market card everyone is stuck looking
    // at, and a card in this bot's own hand - the hand refills to three at the
    // start of the next turn, so dropping a dead card buys a fresh one.
    if ((memo.discarded || 0) >= 2) return null;
    var floor = deckValue(view);
    var options = [];
    (spec.zones.market || []).forEach(function (id) {
      var card = byId(view.market, id);
      if (card) options.push({ zone: 'market', card: card });
    });
    (spec.zones.hand || []).forEach(function (id) {
      var card = byId(view.myHand, id);
      if (card) options.push({ zone: 'hand', card: card });
    });
    if (!options.length) return null;
    var scored = rank(view, options.map(function (o) { return o.card; }), 60);
    var worstId = scored.worst.card.id;
    if (scored.worst.score >= floor) return null;         // nothing here is dead weight
    var choice = options.filter(function (o) { return o.card.id === worstId; })[0];
    // Never strip the hand bare - a card in hand is a card that can be played.
    if (choice.zone === 'hand' && view.myHand.length <= 1) return null;
    memo.discarded = (memo.discarded || 0) + 1;
    return { zone: choice.zone, id: choice.card.id };
  };

  handlers['diamonds-out'] = function (spec, view, memo) {
    var pool = spec.source === 'market' ? view.market : view.myHand;
    if (!pool.length) return null;
    // A swap keeps the hand the same size, so every option is judged in one arena.
    var slots = Math.max(0, view.collectiveTarget - view.collectiveKnown.length);
    var a = arena(view, slots, 80);
    var current = scoreIn(a, view.collectiveKnown);
    var best = null;
    (spec.zones.collective || []).forEach(function (outId) {
      var kept = view.collectiveKnown.filter(function (c) { return c.id !== outId; });
      pool.forEach(function (incoming) {
        var score = scoreIn(a, kept.concat([incoming]));
        if (!best || score > best.score) best = { outId: outId, incoming: incoming, score: score };
      });
    });
    if (!best || best.score < current + SWAP_MARGIN) return null;
    memo.swapIn = best.incoming.id;
    return { zone: 'collective', id: best.outId };
  };

  handlers['diamonds-in'] = function (spec, view, memo) {
    var zone = spec.zones.market ? 'market' : 'hand';
    var ids = spec.zones[zone] || [];
    var id = memo.swapIn && ids.indexOf(memo.swapIn) >= 0 ? memo.swapIn : ids[0];
    memo.swapIn = null;
    return { zone: zone, id: id };
  };

  handlers['joker-remove'] = function (spec, view) {
    // Strip whichever face-up card the Rat would miss most.
    var ids = spec.zones.ratHand || [];
    var base = Poker.bestFive(view.ratFaceUp);
    var best = null;
    ids.forEach(function (id) {
      var card = byId(view.ratFaceUp, id);
      if (!card) return;                                   // a face-down card: unknowable
      var without = Poker.bestFive(view.ratFaceUp.filter(function (c) { return c.id !== id; }));
      var drop = without && base ? Poker.compare(base.ev, without.ev) : 0;
      if (!best || drop > best.drop) best = { id: id, drop: drop };
    });
    return { zone: 'ratHand', id: best ? best.id : ids[0] };
  };

  handlers['joker-resolve'] = function (spec, view) {
    return winChance(view, view.collectiveKnown) < 0.45 ? 'yes' : 'no';
  };

  handlers['joker-reveal'] = function (spec, view) {
    return winChance(view, view.collectiveKnown, 60) < 0.55 ? 'reveal' : 'stop';
  };

  /* --------------- table talk --------------- */

  /* The rulebook allows general strategy talk but forbids revealing card
     specifics *or the Collective Hand you are after*. That leaves plenty: how
     the table looks, whether this is a round to raise the Debt on, whether to
     spend a Joker, and where to look. Bots stay on the legal side of that line -
     they never name a card, a suit, or the hand they are building. */
  function chatter(view, score, memo, seat) {
    var pick = function (a, b) { return (seat || 0) % 2 ? b : a; };
    if (memo && memo.offered) return pick('Something for you in the Market.', 'I have left one in the Market.');
    if (view.ratDebt === 4) return pick('One more Debt and this Rat is finished.', 'That Rat is one Debt from done.');
    if (view.playerDebt === 4) return pick('Careful now — one more and we are done for.', 'We cannot take another Debt.');
    if (score < 0.3 && view.jokerAvailable) return pick('This might be a round for the Joker.', 'A Joker would not hurt about now.');
    if (score >= 0.75) return pick('I like our chances.', 'This is looking good.');
    if (score >= 0.55) return pick('We are in this.', 'We have a shot here.');
    if (score >= 0.35) return pick('This could go either way.', 'Too close to call.');
    if (score >= 0.18) return pick('We need something better.', 'This needs work.');
    return pick('This one looks grim.', 'I do not like this one.');
  }

  var Bot = {
    /* Answers one prompt. `memo` carries scratch state across the prompts of a
       single turn (the two halves of a ♦ swap, say). */
    answer: function (spec, view, memo) {
      var handler = handlers[spec.tag];
      if (handler) {
        var answer = handler(spec, view, memo || {});
        if (answer !== undefined) return answer;
      }
      return Bot.fallback(spec);
    },

    /* Anything untagged: take the first legal option rather than stall. */
    fallback: function (spec) {
      if (spec.options) return spec.options[spec.options.length - 1].value;
      if (spec.optional) return null;
      var zones = Object.keys(spec.zones || {}).filter(function (z) { return spec.zones[z].length; });
      return zones.length ? { zone: zones[0], id: spec.zones[zones[0]][0] } : null;
    },

    winChance: winChance,
    chatter: chatter,
    SAMPLES: SAMPLES
  };

  root.RRBot = Bot;
  if (typeof module !== 'undefined' && module.exports) module.exports = Bot;
})(typeof globalThis !== 'undefined' ? globalThis : this);
