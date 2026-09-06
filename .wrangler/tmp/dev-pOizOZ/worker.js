var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// js/cards.js
var require_cards = __commonJS({
  "js/cards.js"(exports, module) {
    init_modules_watch_stub();
    (function(root) {
      "use strict";
      var SUITS = ["S", "H", "D", "C"];
      var SUIT_GLYPH = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
      var SUIT_NAME = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
      var RANK_LABEL = {
        2: "2",
        3: "3",
        4: "4",
        5: "5",
        6: "6",
        7: "7",
        8: "8",
        9: "9",
        10: "10",
        11: "J",
        12: "Q",
        13: "K",
        14: "A"
      };
      function card(rank, suit) {
        return { id: rank + suit, r: rank, s: suit };
      }
      __name(card, "card");
      function fullDeck() {
        var out = [];
        for (var i = 0; i < SUITS.length; i++) {
          for (var r = 2; r <= 14; r++) out.push(card(r, SUITS[i]));
        }
        return out;
      }
      __name(fullDeck, "fullDeck");
      function joker(n) {
        return { id: "JOKER" + n, joker: true };
      }
      __name(joker, "joker");
      function label(c) {
        if (!c) return "?";
        if (c.joker) return "Joker";
        return RANK_LABEL[c.r] + SUIT_GLYPH[c.s];
      }
      __name(label, "label");
      function shuffle(arr, rnd) {
        var random = rnd || Math.random;
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(random() * (i + 1));
          var t = arr[i];
          arr[i] = arr[j];
          arr[j] = t;
        }
        return arr;
      }
      __name(shuffle, "shuffle");
      function byId(arr, id) {
        for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
        return null;
      }
      __name(byId, "byId");
      function takeById(arr, id) {
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].id === id) return arr.splice(i, 1)[0];
        }
        return null;
      }
      __name(takeById, "takeById");
      var api = {
        SUITS,
        SUIT_GLYPH,
        SUIT_NAME,
        RANK_LABEL,
        card,
        fullDeck,
        joker,
        label,
        shuffle,
        byId,
        takeById
      };
      root.RRCards = api;
      if (typeof module !== "undefined" && module.exports) module.exports = api;
    })(typeof globalThis !== "undefined" ? globalThis : exports);
  }
});

// js/poker.js
var require_poker = __commonJS({
  "js/poker.js"(exports, module) {
    init_modules_watch_stub();
    (function(root) {
      "use strict";
      var Cards = root.RRCards || (typeof __require === "function" ? require_cards() : null);
      var RANK_NAMES = {
        9: "Straight flush",
        8: "Four of a kind",
        7: "Full house",
        6: "Flush",
        5: "Straight",
        4: "Three of a kind",
        3: "Two pair",
        2: "Pair",
        1: "High card"
      };
      function isFlush(five) {
        for (var i = 1; i < 5; i++) if (five[i].s !== five[0].s) return false;
        return true;
      }
      __name(isFlush, "isFlush");
      function straightHigh(five) {
        var seen = {};
        var ranks = [];
        for (var i = 0; i < 5; i++) {
          if (seen[five[i].r]) return 0;
          seen[five[i].r] = true;
          ranks.push(five[i].r);
        }
        ranks.sort(function(a, b) {
          return a - b;
        });
        if (ranks[4] - ranks[0] === 4) return ranks[4];
        if (ranks.join(",") === "2,3,4,5,14") return 5;
        return 0;
      }
      __name(straightHigh, "straightHigh");
      function groupsOf(five) {
        var counts = {};
        for (var i = 0; i < 5; i++) counts[five[i].r] = (counts[five[i].r] || 0) + 1;
        var groups = Object.keys(counts).map(function(r) {
          return { r: parseInt(r, 10), n: counts[r] };
        });
        groups.sort(function(a, b) {
          return b.n - a.n || b.r - a.r;
        });
        return groups;
      }
      __name(groupsOf, "groupsOf");
      function descRanks(five) {
        return five.map(function(c) {
          return c.r;
        }).sort(function(a, b) {
          return b - a;
        });
      }
      __name(descRanks, "descRanks");
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
          var kickers = [g[1].r, g[2].r, g[3].r].sort(function(a, b) {
            return b - a;
          });
          return { rank: 2, tb: [g[0].r].concat(kickers) };
        }
        return { rank: 1, tb: descRanks(five) };
      }
      __name(evaluate5, "evaluate5");
      function compare(a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        var n = Math.max(a.tb.length, b.tb.length);
        for (var i = 0; i < n; i++) {
          var x = a.tb[i] || 0, y = b.tb[i] || 0;
          if (x !== y) return x - y;
        }
        return 0;
      }
      __name(compare, "compare");
      function combinations(arr, k) {
        var out = [];
        var idx = [];
        (/* @__PURE__ */ __name((function walk(start) {
          if (idx.length === k) {
            out.push(idx.map(function(i2) {
              return arr[i2];
            }));
            return;
          }
          for (var i = start; i < arr.length; i++) {
            idx.push(i);
            walk(i + 1);
            idx.pop();
          }
        }), "walk"))(0);
        return out;
      }
      __name(combinations, "combinations");
      function bestFive(cards) {
        var jokerIndex = -1;
        for (var i = 0; i < cards.length; i++) {
          if (cards[i] && cards[i].joker) {
            jokerIndex = i;
            break;
          }
        }
        if (jokerIndex >= 0) {
          var deck = Cards.fullDeck();
          var best = null;
          for (var d = 0; d < deck.length; d++) {
            var copy = cards.slice();
            copy[jokerIndex] = {
              id: cards[jokerIndex].id,
              r: deck[d].r,
              s: deck[d].s,
              wasJoker: true
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
          if (!top || compare(ev, top.ev) > 0) top = { ev, cards: combos[c] };
        }
        return top;
      }
      __name(bestFive, "bestFive");
      function canForm(cards, category) {
        var jokerIndex = -1;
        for (var i = 0; i < cards.length; i++) {
          if (cards[i] && cards[i].joker) {
            jokerIndex = i;
            break;
          }
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
          if (category === "straight-flush") ok = flush && straight;
          else if (category === "four-of-a-kind") ok = g[0].n === 4;
          else if (category === "full-house") ok = g[0].n === 3 && g[1].n === 2;
          else if (category === "flush") ok = flush;
          else if (category === "straight") ok = straight;
          if (ok) return true;
        }
        return false;
      }
      __name(canForm, "canForm");
      function describe(ev) {
        if (!ev) return "\u2014";
        var name = RANK_NAMES[ev.rank];
        var high = Cards.RANK_LABEL[ev.tb[0]];
        if (ev.rank === 9 || ev.rank === 6 || ev.rank === 5 || ev.rank === 1) {
          return name + ", " + high + " high";
        }
        if (ev.rank === 8) return name + ", " + high + "s";
        if (ev.rank === 7) return name + ", " + high + "s over " + Cards.RANK_LABEL[ev.tb[1]] + "s";
        if (ev.rank === 4) return name + ", " + high + "s";
        if (ev.rank === 3) return name + ", " + high + "s and " + Cards.RANK_LABEL[ev.tb[1]] + "s";
        return name + " of " + high + "s";
      }
      __name(describe, "describe");
      var api = {
        RANK_NAMES,
        evaluate5,
        compare,
        combinations,
        bestFive,
        canForm,
        describe
      };
      root.RRPoker = api;
      if (typeof module !== "undefined" && module.exports) module.exports = api;
    })(typeof globalThis !== "undefined" ? globalThis : exports);
  }
});

// js/game.js
var require_game = __commonJS({
  "js/game.js"(exports, module) {
    init_modules_watch_stub();
    (function(root) {
      "use strict";
      var Cards = root.RRCards;
      var Poker = root.RRPoker;
      var PREDICTION_BY_RANK = {
        14: "straight-flush",
        13: "four-of-a-kind",
        12: "full-house",
        11: "full-house",
        10: "full-house",
        9: "flush",
        8: "flush",
        7: "flush",
        6: "flush",
        5: "straight",
        4: "straight",
        3: "straight",
        2: "straight"
      };
      var PREDICTION_LABEL = {
        "straight-flush": "Straight flush",
        "four-of-a-kind": "Four of a kind",
        "full-house": "Full house",
        "flush": "Flush",
        "straight": "Straight"
      };
      var RAT_ABILITY = {
        H: "When the River Rat wins, the players take one extra Debt card.",
        S: "The first card played into the Collective Hand is placed face down, triggers nothing and cannot be swapped or be a Joker.",
        C: "The River Rat\u2019s Hand is dealt two extra face-down cards.",
        D: "At Round Setup the top card of the Deck is dealt face up as the first card of the Collective Hand."
      };
      var RAT_BONUS = {
        H: "Discard one Debt card from the players\u2019 Debt.",
        S: "The Market\u2019s full capacity becomes four cards.",
        C: "Every later River Rat\u2019s Hand is dealt one less face-down card.",
        D: "Hands are now resolved when the Collective Hand reaches six cards."
      };
      function createEngine() {
        var G = {
          state: null,
          io: null
        };
        function s() {
          return G.state;
        }
        __name(s, "s");
        function log(text, kind) {
          G.state.log.push({ text, kind: kind || "" });
          if (G.state.log.length > 200) G.state.log.shift();
        }
        __name(log, "log");
        var BASE_FORM = { draws: "draw", takes: "take", plays: "play", has: "have", uses: "use", adds: "add" };
        function vb(p, third) {
          return p.name === "You" ? BASE_FORM[third] || third : third;
        }
        __name(vb, "vb");
        function poss(p) {
          return p.name === "You" ? "your" : "their";
        }
        __name(poss, "poss");
        function activeRat() {
          return s().rats[s().activeRat];
        }
        __name(activeRat, "activeRat");
        function activeRatSuit() {
          return activeRat().card.s;
        }
        __name(activeRatSuit, "activeRatSuit");
        function currentPlayer() {
          return s().players[s().current];
        }
        __name(currentPlayer, "currentPlayer");
        function isSolo() {
          return s().players.length === 1;
        }
        __name(isSolo, "isSolo");
        function collectiveTarget() {
          return s().bonuses.resolveAtSix ? 6 : 5;
        }
        __name(collectiveTarget, "collectiveTarget");
        function abilitiesOn() {
          return s().difficulty !== "first";
        }
        __name(abilitiesOn, "abilitiesOn");
        function powersOn() {
          return s().difficulty !== "first";
        }
        __name(powersOn, "powersOn");
        function deckAvailable() {
          var st = s();
          if (st.deck.length === 0 && st.discard.length > 0) {
            st.deck = Cards.shuffle(st.discard.slice());
            st.discard = [];
            log("The Deck ran out; the Discard pile was reshuffled into a new Deck.", "sys");
          }
          return st.deck.length > 0;
        }
        __name(deckAvailable, "deckAvailable");
        function drawTop() {
          if (!deckAvailable()) return null;
          return s().deck.shift();
        }
        __name(drawTop, "drawTop");
        function discardCards(cards) {
          for (var i = 0; i < cards.length; i++) {
            if (cards[i] && !cards[i].joker) s().discard.push(cards[i]);
          }
        }
        __name(discardCards, "discardCards");
        function refillMarket() {
          var st = s();
          while (st.market.length < st.marketCapacity && deckAvailable()) {
            st.market.push(drawTop());
          }
        }
        __name(refillMarket, "refillMarket");
        function availableJoker() {
          var js = s().jokers;
          for (var i = 0; i < js.length; i++) {
            if (js[i].faceUp && !js[i].removed && !js[i].inCollective) return js[i];
          }
          return null;
        }
        __name(availableJoker, "availableJoker");
        function jokerInCollective() {
          var c = s().collective;
          for (var i = 0; i < c.length; i++) if (c[i].card.joker) return true;
          return false;
        }
        __name(jokerInCollective, "jokerInCollective");
        function canUseJokerNow() {
          var st = s();
          if (!availableJoker()) return false;
          if (st.difficulty === "expert") return false;
          if (st.difficulty === "normal" && jokerInCollective()) return false;
          return true;
        }
        __name(canUseJokerNow, "canUseJokerNow");
        function ratHandCards() {
          return s().ratHand.map(function(e) {
            return e.card;
          });
        }
        __name(ratHandCards, "ratHandCards");
        function collectiveCards() {
          return s().collective.map(function(e) {
            return e.card;
          });
        }
        __name(collectiveCards, "collectiveCards");
        function faceDownCountForRound() {
          var st = s();
          var n = 2;
          if (abilitiesOn() && activeRatSuit() === "C") n += 2;
          if (st.difficulty === "advanced") n += 1;
          if (st.difficulty === "expert") n += 2;
          n -= st.bonuses.oneLessFaceDown;
          return Math.max(0, n);
        }
        __name(faceDownCountForRound, "faceDownCountForRound");
        G.newGame = function(config) {
          var deck = Cards.fullDeck();
          var players = config.players.map(function(p, i) {
            var ace = Cards.card(14, p.suit);
            Cards.takeById(deck, ace.id);
            return {
              i,
              name: p.name || "Player " + (i + 1),
              suit: p.suit,
              bot: !!p.bot,
              ace,
              hand: []
            };
          });
          var kings = Cards.shuffle(["S", "H", "D", "C"].map(function(su) {
            return Cards.card(13, su);
          }));
          var chosen = kings.slice(0, 2);
          chosen.forEach(function(k) {
            Cards.takeById(deck, k.id);
          });
          Cards.shuffle(deck);
          G.state = {
            version: 1,
            difficulty: config.difficulty || "normal",
            players,
            current: 0,
            deck,
            discard: [],
            market: [],
            marketCapacity: 3,
            rats: chosen.map(function(k) {
              return { card: k, debt: [], defeated: false };
            }),
            activeRat: 0,
            jokers: [
              { id: "JOKER1", faceUp: false, removed: false, inCollective: false },
              { id: "JOKER2", faceUp: false, removed: false, inCollective: false }
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
          log("The River Rats deal you in. Beat them at their own game.", "sys");
          players.forEach(function(p) {
            for (var i = 0; i < 2; i++) p.hand.push(drawTop());
          });
          refillMarket();
          G.roundSetup();
          return G.state;
        };
        G.roundSetup = function() {
          var st = s();
          st.round += 1;
          st.collective = [];
          st.ratHand = [];
          st.rats.forEach(function(r, k) {
            if (k !== st.activeRat && !r.defeated) {
              st.ratHand.push({ card: r.card, faceDown: true, isRat: true, counts: false, inactive: true });
            }
          });
          st.ratHand.push({ card: activeRat().card, faceDown: false, isRat: true, counts: true });
          st.rats.forEach(function(r, i2) {
            if (i2 !== st.activeRat && r.defeated) {
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
          if (abilitiesOn() && activeRatSuit() === "D") {
            var seed = drawTop();
            if (seed) {
              st.collective.push({ card: seed, faceDown: false, seeded: true });
              log("River Rat " + Cards.SUIT_GLYPH.D + " seeds the Collective Hand with " + Cards.label(seed) + ".", "rat");
            }
          }
          refillMarket();
          log("Round " + st.round + " - Joker\u2019s Prediction: " + PREDICTION_LABEL[st.prediction] + " (from " + Cards.label(pred) + ").", "sys");
        };
        G.runTurn = function() {
          var st = s();
          var p = currentPlayer();
          return Promise.resolve().then(function() {
            if (st.players.length > 1) return G.io.passTo(p);
          }).then(function() {
            var options = [{ value: "play", label: "Draw & Play", hint: "Refill to three cards, then play one into the Collective Hand" }];
            if (canUseJokerNow()) {
              options.push({
                value: "joker",
                label: "Use a Joker",
                hint: st.difficulty === "advanced" ? "Remove a card from the River Rat\u2019s Hand and add two face-down cards" : "Add a Joker to the Collective Hand as any card you like"
              });
            }
            if (options.length === 1) return "play";
            return G.io.choose({ tag: "turn-action", title: p.name + "\u2019s turn", options });
          }).then(function(choice) {
            if (choice === "joker") return useJoker(p);
            return drawAndPlay(p);
          });
        };
        function drawStep(p) {
          var st = s();
          if (p.hand.length >= 3) return Promise.resolve();
          var canMarket = st.market.length > 0;
          var canDeck = deckAvailable();
          if (!canMarket && !canDeck) {
            log("No cards left to draw.", "sys");
            return Promise.resolve();
          }
          var next;
          if (!canMarket) next = Promise.resolve("deck");
          else if (!canDeck) next = Promise.resolve("market");
          else {
            next = G.io.choose({
              tag: "draw-source",
              title: "Draw a card (" + (3 - p.hand.length) + " more to reach your hand limit)",
              options: [
                { value: "market", label: "Take from the Market" },
                { value: "deck", label: "Draw from the Deck", hint: st.deck.length + " cards left" }
              ]
            });
          }
          return next.then(function(src) {
            if (src === "deck") {
              var c = drawTop();
              if (c) {
                p.hand.push(c);
                log(p.name + " " + vb(p, "draws") + " from the Deck.", "player");
              }
              return;
            }
            return G.io.pick({
              tag: "draw-market",
              title: "Take a card from the Market",
              zones: { market: st.market.map(function(c2) {
                return c2.id;
              }) }
            }).then(function(sel) {
              if (!sel) return;
              var taken = Cards.takeById(st.market, sel.id);
              p.hand.push(taken);
              log(p.name + " " + vb(p, "takes") + " " + Cards.label(taken) + " from the Market.", "player");
              refillMarket();
            });
          }).then(function() {
            return drawStep(p);
          });
        }
        __name(drawStep, "drawStep");
        function drawAndPlay(p) {
          var st = s();
          return drawStep(p).then(function() {
            if (p.hand.length === 0) {
              log(p.name + " " + vb(p, "has") + " no cards to play.", "sys");
              return;
            }
            var forcedFaceDown = abilitiesOn() && activeRatSuit() === "S" && st.collective.length === 0;
            return G.io.pick({
              tag: "play-card",
              title: forcedFaceDown ? "River Rat \u2660: play the first card face down" : "Play a card into the Collective Hand",
              zones: { hand: p.hand.map(function(c) {
                return c.id;
              }) }
            }).then(function(sel) {
              var card = Cards.takeById(p.hand, sel.id);
              st.collective.push({ card, faceDown: forcedFaceDown, owner: p.i });
              if (forcedFaceDown) {
                log(p.name + " " + vb(p, "plays") + " a card face down (River Rat \u2660).", "player");
                return;
              }
              log(p.name + " " + vb(p, "plays") + " " + Cards.label(card) + " into the Collective Hand.", "player");
              return chooseAction(p, card);
            });
          });
        }
        __name(drawAndPlay, "drawAndPlay");
        function chooseAction(p, card) {
          var options = [];
          if (powersOn() && card.s === p.suit) {
            options.push({
              value: "power",
              label: "Player Power " + Cards.SUIT_GLYPH[card.s],
              hint: G.powerText(card.s, isSolo())
            });
          }
          options.push({
            value: "suit",
            label: "Suit Action " + Cards.SUIT_GLYPH[card.s],
            hint: G.suitText(card.s, isSolo())
          });
          options.push({ value: "none", label: "Do nothing" });
          return G.io.choose({ tag: "card-action", suit: card.s, title: "You played " + Cards.label(card), options }).then(function(choice) {
            if (choice === "suit") return suitAction(p, card);
            if (choice === "power") return playerPower(p, card);
            log(p.name + " " + vb(p, "takes") + " no action.", "player");
          });
        }
        __name(chooseAction, "chooseAction");
        G.suitText = function(suit, solo) {
          if (suit === "C") {
            return solo ? "Add the top card of the Deck face up to the Market (max. six)." : "Add a card from your hand face up to the Market (max. six).";
          }
          if (suit === "D") return "Swap another card in the Collective Hand with a card from your hand.";
          if (suit === "H") return "Increase the Debt by one card.";
          return "Discard a card from your hand or the Market.";
        };
        G.powerText = function(suit, solo) {
          if (suit === "C") {
            return solo ? "Add up to two cards from the Deck face up to the Market (max. six)." : "Add up to two cards from your hand face up to the Market (max. six).";
          }
          if (suit === "D") return "Swap another card in the Collective Hand with a card from the Market.";
          if (suit === "H") return "Flip a card of the River Rat\u2019s Hand face up, then choose whether to increase the Debt.";
          return "Discard any number of cards from your hand and the Market.";
        };
        function suitAction(p, card) {
          var st = s();
          if (card.s === "C") {
            if (isSolo()) {
              if (st.market.length >= 6) {
                log("The Market is already full (six cards).", "sys");
                return Promise.resolve();
              }
              var c = drawTop();
              if (c) {
                st.market.push(c);
                log("\u2663 adds " + Cards.label(c) + " from the Deck to the Market.", "player");
              }
              return Promise.resolve();
            }
            if (st.market.length >= 6 || p.hand.length === 0) {
              log("\u2663 has no legal target.", "sys");
              return Promise.resolve();
            }
            return G.io.pick({
              tag: "clubs-add",
              title: "\u2663 Add a card from your hand to the Market",
              optional: true,
              zones: { hand: p.hand.map(function(x) {
                return x.id;
              }) }
            }).then(function(sel) {
              if (!sel) return;
              var moved = Cards.takeById(p.hand, sel.id);
              st.market.push(moved);
              log("\u2663 " + p.name + " " + vb(p, "adds") + " " + Cards.label(moved) + " to the Market.", "player");
            });
          }
          if (card.s === "D") {
            var targets = swappableCollective(card);
            if (!targets.length || p.hand.length === 0) {
              log("\u2666 has no legal swap.", "sys");
              return Promise.resolve();
            }
            return G.io.pick({
              tag: "diamonds-out",
              source: "hand",
              title: "\u2666 Choose a card in the Collective Hand to swap out",
              optional: true,
              zones: { collective: targets }
            }).then(function(sel) {
              if (!sel) return;
              return G.io.pick({
                tag: "diamonds-in",
                title: "\u2666 Choose a card from your hand to swap in",
                zones: { hand: p.hand.map(function(x) {
                  return x.id;
                }) }
              }).then(function(sel2) {
                swapIntoCollective(sel.id, Cards.takeById(p.hand, sel2.id), function(out) {
                  p.hand.push(out);
                });
              });
            });
          }
          if (card.s === "H") {
            var d = drawTop();
            if (d) {
              st.debtPile.push(d);
              log("\u2665 The Debt grows to " + st.debtPile.length + " cards.", "player");
            }
            return Promise.resolve();
          }
          return discardOne(p, "\u2660 Discard a card from your hand or the Market");
        }
        __name(suitAction, "suitAction");
        function swappableCollective(playedCard) {
          return s().collective.filter(function(e) {
            return !e.card.joker && !e.faceDown && e.card.id !== playedCard.id;
          }).map(function(e) {
            return e.card.id;
          });
        }
        __name(swappableCollective, "swappableCollective");
        function swapIntoCollective(collectiveCardId, incoming, giveBack) {
          var st = s();
          for (var i = 0; i < st.collective.length; i++) {
            if (st.collective[i].card.id === collectiveCardId) {
              var out = st.collective[i].card;
              st.collective[i] = { card: incoming, faceDown: false };
              giveBack(out);
              log("\u2666 " + Cards.label(out) + " is swapped out for " + Cards.label(incoming) + ".", "player");
              return;
            }
          }
        }
        __name(swapIntoCollective, "swapIntoCollective");
        function discardOne(p, title, allowed) {
          var st = s();
          var ok = /* @__PURE__ */ __name(function(c) {
            return !allowed || allowed.indexOf(c.id) >= 0;
          }, "ok");
          var zones = {};
          var hand = p.hand.filter(ok).map(function(c) {
            return c.id;
          });
          var market = st.market.filter(ok).map(function(c) {
            return c.id;
          });
          if (hand.length) zones.hand = hand;
          if (market.length) zones.market = market;
          if (!zones.hand && !zones.market) return Promise.resolve();
          return G.io.pick({ tag: "spades-discard", title, optional: true, zones }).then(function(sel) {
            if (!sel) return;
            var from = sel.zone === "hand" ? p.hand : st.market;
            var card = Cards.takeById(from, sel.id);
            st.discard.push(card);
            log("\u2660 " + Cards.label(card) + " is discarded from the " + (sel.zone === "hand" ? "hand" : "Market") + ".", "player");
            refillMarket();
            return true;
          });
        }
        __name(discardOne, "discardOne");
        function playerPower(p, card) {
          var st = s();
          log(p.name + " " + vb(p, "uses") + " " + poss(p) + " Player Power " + Cards.SUIT_GLYPH[card.s] + ".", "power");
          if (card.s === "C") {
            if (isSolo()) {
              for (var i = 0; i < 2; i++) {
                if (st.market.length >= 6) break;
                var c = drawTop();
                if (!c) break;
                st.market.push(c);
                log("\u2663 adds " + Cards.label(c) + " from the Deck to the Market.", "power");
              }
              return Promise.resolve();
            }
            var added = 0;
            var addOne = /* @__PURE__ */ __name(function() {
              if (added >= 2 || st.market.length >= 6 || p.hand.length === 0) return Promise.resolve();
              return G.io.pick({
                tag: "clubs-add",
                title: "\u2663 Add a card to the Market (" + (2 - added) + " left)",
                optional: true,
                zones: { hand: p.hand.map(function(x) {
                  return x.id;
                }) }
              }).then(function(sel) {
                if (!sel) return;
                var moved = Cards.takeById(p.hand, sel.id);
                st.market.push(moved);
                added += 1;
                log("\u2663 " + Cards.label(moved) + " joins the Market.", "power");
                return addOne();
              });
            }, "addOne");
            return addOne();
          }
          if (card.s === "D") {
            var targets = swappableCollective(card);
            if (!targets.length || st.market.length === 0) {
              log("\u2666 has no legal swap.", "sys");
              return Promise.resolve();
            }
            return G.io.pick({
              tag: "diamonds-out",
              source: "market",
              title: "\u2666 Choose a card in the Collective Hand to swap out",
              optional: true,
              zones: { collective: targets }
            }).then(function(sel) {
              if (!sel) return;
              return G.io.pick({
                tag: "diamonds-in",
                title: "\u2666 Choose a Market card to swap in",
                zones: { market: st.market.map(function(x) {
                  return x.id;
                }) }
              }).then(function(sel2) {
                swapIntoCollective(sel.id, Cards.takeById(st.market, sel2.id), function(out) {
                  st.market.push(out);
                });
              });
            });
          }
          if (card.s === "H") {
            var hidden = st.ratHand.filter(function(e) {
              return e.faceDown && !e.inactive;
            }).map(function(e) {
              return e.card.id;
            });
            var flip = hidden.length ? G.io.pick({
              tag: "hearts-flip",
              title: "\u2665 Flip a card of the River Rat\u2019s Hand face up",
              optional: true,
              zones: { ratHand: hidden }
            }).then(function(sel) {
              if (!sel) return;
              st.ratHand.forEach(function(e) {
                if (e.card.id === sel.id) e.faceDown = false;
              });
              log("\u2665 The River Rat is holding " + Cards.label(Cards.byId(ratHandCards(), sel.id)) + ".", "power");
            }) : Promise.resolve();
            return flip.then(function() {
              return G.io.choose({
                tag: "hearts-debt",
                title: "\u2665 Increase the Debt?",
                options: [
                  { value: "no", label: "Leave the Debt as it is", hint: "Debt is currently " + st.debtPile.length + " card(s)" },
                  { value: "yes", label: "Increase the Debt by one card" }
                ]
              });
            }).then(function(ans) {
              if (ans === "yes") {
                var d = drawTop();
                if (d) {
                  st.debtPile.push(d);
                  log("\u2665 The Debt grows to " + st.debtPile.length + " cards.", "power");
                }
              }
            });
          }
          var allowed = p.hand.concat(st.market).map(function(c2) {
            return c2.id;
          });
          var loop = /* @__PURE__ */ __name(function() {
            return discardOne(p, "\u2660 Discard any number of cards (tap Done to stop)", allowed).then(function(didDiscard) {
              if (didDiscard) return loop();
            });
          }, "loop");
          return loop();
        }
        __name(playerPower, "playerPower");
        function useJoker(p) {
          var st = s();
          var joker = availableJoker();
          if (!joker) return Promise.resolve();
          if (st.difficulty === "normal") {
            joker.inCollective = true;
            st.collective.push({ card: { id: joker.id, joker: true }, faceDown: false, owner: p.i });
            log(p.name + " " + vb(p, "plays") + " a Joker into the Collective Hand.", "joker");
            return Promise.resolve();
          }
          var targets = st.ratHand.filter(function(e) {
            return !e.isRat;
          }).map(function(e) {
            return e.card.id;
          });
          if (!targets.length) return Promise.resolve();
          return G.io.pick({
            tag: "joker-remove",
            title: "Joker: remove a card from the River Rat\u2019s Hand",
            zones: { ratHand: targets }
          }).then(function(sel) {
            for (var i = 0; i < st.ratHand.length; i++) {
              if (st.ratHand[i].card.id === sel.id) {
                var removed = st.ratHand.splice(i, 1)[0];
                st.discard.push(removed.card);
                log("Joker removes " + (removed.faceDown ? "a face-down card" : Cards.label(removed.card)) + " from the River Rat\u2019s Hand.", "joker");
                break;
              }
            }
            for (var j = 0; j < 2; j++) {
              var c = drawTop();
              if (c) st.ratHand.push({ card: c, faceDown: true, counts: true });
            }
            log("The River Rat draws two extra face-down cards.", "rat");
            joker.removed = true;
            joker.faceUp = false;
          });
        }
        __name(useJoker, "useJoker");
        function expertJoker() {
          var st = s();
          var joker = availableJoker();
          if (!joker) return Promise.resolve();
          var revealed = [];
          var step = /* @__PURE__ */ __name(function() {
            return G.io.choose({
              tag: "joker-reveal",
              title: "Joker: reveal the top card of the Deck?",
              options: [
                { value: "reveal", label: "Reveal a card", hint: "It joins the Collective Hand unless it matches " + Cards.SUIT_GLYPH[activeRatSuit()] },
                { value: "stop", label: "Stop revealing" }
              ]
            }).then(function(ans) {
              if (ans === "stop") return;
              var c = drawTop();
              if (!c) return;
              if (c.s === activeRatSuit()) {
                log("Joker reveals " + Cards.label(c) + " - the River Rat\u2019s suit! Everything revealed is discarded and the players gain one Debt.", "bad");
                revealed.push(c);
                discardCards(revealed);
                st.collective = st.collective.filter(function(e) {
                  return !revealed.some(function(r) {
                    return r.id === e.card.id;
                  });
                });
                var d = drawTop();
                if (d) st.playerDebt.push(d);
                return;
              }
              revealed.push(c);
              st.collective.push({ card: c, faceDown: false, fromJoker: true });
              log("Joker reveals " + Cards.label(c) + " into the Collective Hand.", "joker");
              return step();
            });
          }, "step");
          return step().then(function() {
            joker.removed = true;
            joker.faceUp = false;
          });
        }
        __name(expertJoker, "expertJoker");
        G.shouldResolve = function() {
          return s().collective.length >= collectiveTarget();
        };
        G.resolveHand = function() {
          var st = s();
          return Promise.resolve().then(function() {
            if (st.difficulty === "expert" && availableJoker()) {
              return G.io.choose({
                tag: "joker-resolve",
                title: "Hand Resolution: use a Joker?",
                options: [
                  { value: "no", label: "Resolve without a Joker" },
                  { value: "yes", label: "Use a Joker", hint: "Reveal Deck cards into the Collective Hand, but not the River Rat\u2019s suit" }
                ]
              }).then(function(ans) {
                if (ans === "yes") return expertJoker();
              });
            }
          }).then(function() {
            var predictionHit = st.prediction && Poker.canForm(collectiveCards(), st.prediction);
            var jokerFlipped = false;
            st.lastPredictionHit = predictionHit;
            st.lastJokerFlipped = false;
            if (predictionHit) {
              for (var i = 0; i < st.jokers.length; i++) {
                if (!st.jokers[i].faceUp && !st.jokers[i].removed) {
                  st.jokers[i].faceUp = true;
                  jokerFlipped = true;
                  st.lastJokerFlipped = true;
                  log("The Joker\u2019s Prediction (" + PREDICTION_LABEL[st.prediction] + ") came true - a Joker is now available.", "joker");
                  break;
                }
              }
            }
            return revealFaceDown().then(function() {
              return judge();
            });
          });
        };
        function revealFaceDown() {
          var st = s();
          var hidden = [];
          st.collective.forEach(function(e) {
            if (e.faceDown) hidden.push(e);
          });
          st.ratHand.forEach(function(e) {
            if (e.faceDown && !e.inactive) hidden.push(e);
          });
          var step = /* @__PURE__ */ __name(function(i) {
            if (i >= hidden.length) return Promise.resolve();
            hidden[i].faceDown = false;
            var shown = G.io.cardRevealed ? G.io.cardRevealed(hidden[i].card, i, hidden.length) : null;
            return Promise.resolve(shown).then(function() {
              return step(i + 1);
            });
          }, "step");
          return step(0);
        }
        __name(revealFaceDown, "revealFaceDown");
        function judge() {
          var st = s();
          var ours = Poker.bestFive(collectiveCards());
          var theirCards = st.ratHand.filter(function(e) {
            return e.counts !== false;
          }).map(function(e) {
            return e.card;
          });
          var theirs = Poker.bestFive(theirCards);
          var cmp = ours && theirs ? Poker.compare(ours.ev, theirs.ev) : ours ? 1 : -1;
          var playersWin = cmp > 0;
          var trueTie = cmp === 0;
          var debtCount = st.debtPile.length;
          var extra = 0;
          if (playersWin) {
            activeRat().debt = activeRat().debt.concat(st.debtPile);
            log("The players win the hand: " + debtCount + " Debt to the River Rat " + Cards.SUIT_GLYPH[activeRatSuit()] + ".", "good");
          } else {
            if (abilitiesOn() && activeRatSuit() === "H") {
              var extraCard = drawTop();
              if (extraCard) {
                st.debtPile.push(extraCard);
                extra = 1;
              }
            }
            st.playerDebt = st.playerDebt.concat(st.debtPile);
            log((trueTie ? "A True Tie - the River Rats win it. " : "The River Rat wins the hand. ") + st.debtPile.length + " Debt to the players.", "bad");
          }
          st.debtPile = [];
          return G.io.showResolution({
            ours,
            theirs,
            ourCards: collectiveCards(),
            theirCards,
            playersWin,
            trueTie,
            debt: debtCount + extra,
            predictionHit: st.lastPredictionHit,
            jokerFlipped: st.lastJokerFlipped,
            predictionLabel: PREDICTION_LABEL[st.prediction]
          }).then(function() {
            return endOfHand();
          });
        }
        __name(judge, "judge");
        function endOfHand() {
          var st = s();
          if (st.playerDebt.length >= 5) {
            st.over = "lose";
            log("The players have taken five Debt. The River Rats clean you out.", "bad");
            return G.io.gameOver("lose");
          }
          var defeatPromise = Promise.resolve();
          var rat = activeRat();
          if (rat.debt.length >= 5) {
            rat.defeated = true;
            discardCards(rat.debt);
            rat.debt = [];
            var suit = rat.card.s;
            log("River Rat " + Cards.SUIT_GLYPH[suit] + " is defeated!" + (abilitiesOn() ? " " + RAT_BONUS[suit] : ""), "good");
            applyDefeatBonus(suit);
            var other = st.rats[1 - st.activeRat];
            if (other.defeated) {
              st.over = "win";
              return G.io.gameOver("win");
            }
            st.activeRat = 1 - st.activeRat;
            defeatPromise = G.io.ratDefeated({
              defeated: rat.card,
              bonus: abilitiesOn() ? RAT_BONUS[suit] : null,
              next: other.card,
              nextAbility: abilitiesOn() ? RAT_ABILITY[other.card.s] : null
            });
          }
          return defeatPromise.then(function() {
            cleanup();
            G.roundSetup();
          });
        }
        __name(endOfHand, "endOfHand");
        function applyDefeatBonus(suit) {
          var st = s();
          if (!abilitiesOn()) return;
          if (suit === "H") {
            if (st.playerDebt.length) {
              st.discard.push(st.playerDebt.pop());
              log("Defeat bonus \u2665: one Debt card is wiped from the players\u2019 Debt.", "good");
            }
          } else if (suit === "S") {
            st.marketCapacity = 4;
            refillMarket();
          } else if (suit === "C") {
            st.bonuses.oneLessFaceDown += 1;
          } else if (suit === "D") {
            st.bonuses.resolveAtSix = true;
          }
        }
        __name(applyDefeatBonus, "applyDefeatBonus");
        function cleanup() {
          var st = s();
          st.jokers.forEach(function(j) {
            if (j.inCollective) {
              j.removed = true;
              j.faceUp = false;
              j.inCollective = false;
            }
          });
          discardCards(collectiveCards());
          st.collective = [];
          st.ratHand.forEach(function(e) {
            if (!e.isRat) st.discard.push(e.card);
          });
          st.ratHand = [];
        }
        __name(cleanup, "cleanup");
        G.nextPlayer = function() {
          var st = s();
          st.current = (st.current + 1) % st.players.length;
        };
        function slotsFor(playerIndex) {
          var st = s();
          var remaining = collectiveTarget() - st.collective.length;
          var count = 0;
          for (var k = 0; k < remaining; k++) {
            if ((st.current + k) % st.players.length === playerIndex) count += 1;
          }
          return count;
        }
        __name(slotsFor, "slotsFor");
        G.publicView = function(playerIndex) {
          var st = s();
          var me = st.players[playerIndex];
          var seen = {};
          var see = /* @__PURE__ */ __name(function(c) {
            if (c && !c.joker) seen[c.id] = true;
          }, "see");
          me.hand.forEach(see);
          st.players.forEach(function(p) {
            see(p.ace);
          });
          st.market.forEach(see);
          st.discard.forEach(see);
          if (st.debtPile.length) see(st.debtPile[0]);
          var collectiveKnown = [];
          var collectiveHidden = 0;
          st.collective.forEach(function(e) {
            if (!e.faceDown || e.owner === playerIndex) {
              collectiveKnown.push(e.card);
              see(e.card);
            } else {
              collectiveHidden += 1;
            }
          });
          var ratFaceUp = [];
          var ratFaceDownCount = 0;
          st.ratHand.forEach(function(e) {
            if (e.counts === false) return;
            if (e.faceDown) {
              ratFaceDownCount += 1;
              return;
            }
            ratFaceUp.push(e.card);
            see(e.card);
          });
          var unseen = Cards.fullDeck().filter(function(c) {
            return !seen[c.id];
          });
          return {
            myIndex: playerIndex,
            myHand: me.hand.slice(),
            // The public facts a board shows. A phone playing over the network draws
            // from this, so anything face up on the table belongs here.
            round: st.round,
            bonuses: { resolveAtSix: st.bonuses.resolveAtSix },
            rats: st.rats.map(function(r, i) {
              var known = r.defeated || i === st.activeRat;
              return {
                suit: known ? r.card.s : null,
                // the waiting Rat keeps its suit
                debt: r.debt.length,
                defeated: r.defeated,
                active: i === st.activeRat
              };
            }),
            collectiveSeeded: st.collective.length > 0 && !!st.collective[0].seeded,
            jokers: st.jokers.map(function(j) {
              return { faceUp: j.faceUp, removed: j.removed };
            }),
            current: st.current,
            mySuit: me.suit,
            handLimit: 3,
            collectiveKnown,
            collectiveHidden,
            collectiveTarget: collectiveTarget(),
            mySlotsThisHand: slotsFor(playerIndex),
            market: st.market.slice(),
            marketCapacity: st.marketCapacity,
            ratFaceUp,
            ratFaceDownCount,
            ratSuit: activeRatSuit(),
            ratDebt: activeRat().debt.length,
            ratsRemaining: st.rats.filter(function(r) {
              return !r.defeated;
            }).length,
            // A River Rat still waiting its turn is one of the Kings nobody has seen,
            // sitting face down beside the table: it is out of circulation, even
            // though which King it is stays unknown.
            waitingRat: st.rats.some(function(r, i) {
              return i !== st.activeRat && !r.defeated;
            }),
            playerDebt: st.playerDebt.length,
            debtAtStake: st.debtPile.length,
            prediction: st.prediction,
            jokerAvailable: !!availableJoker(),
            jokersUnearned: st.jokers.filter(function(j) {
              return !j.faceUp && !j.removed;
            }).length,
            jokerInCollective: jokerInCollective(),
            deckCount: st.deck.length,
            discardCount: st.discard.length,
            difficulty: st.difficulty,
            others: st.players.filter(function(p) {
              return p.i !== playerIndex;
            }).map(function(p) {
              return { id: p.i, name: p.name, suit: p.suit, bot: !!p.bot, handCount: p.hand.length };
            }),
            unseen
          };
        };
        G.isRatCard = function(card) {
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
        return G;
      }
      __name(createEngine, "createEngine");
      var singleton = createEngine();
      singleton.create = createEngine;
      root.RRGame = singleton;
      if (typeof module !== "undefined" && module.exports) module.exports = singleton;
    })(typeof globalThis !== "undefined" ? globalThis : exports);
  }
});

// js/bot.js
var require_bot = __commonJS({
  "js/bot.js"(exports, module) {
    init_modules_watch_stub();
    (function(root) {
      "use strict";
      var Cards = root.RRCards;
      var Poker = root.RRPoker;
      var SAMPLES = 140;
      var SAMPLES_JOKER = 32;
      var SWAP_MARGIN = 0.04;
      var JOKER_MARGIN = 0.1;
      var NEVER = 2;
      var MARKET_TOLL = 0.04;
      var JOKER_WORTH = 0.25;
      var PREDICTION_STRIDE = 3;
      var TEAM_CHOICE = 2;
      var RANK_PULL = 1;
      var SUIT_PULL = 3;
      var random = /* @__PURE__ */ __name(function() {
        return Math.random();
      }, "random");
      function hasJoker(cards) {
        for (var i = 0; i < cards.length; i++) if (cards[i].joker) return true;
        return false;
      }
      __name(hasJoker, "hasJoker");
      function dealFrom(pool, n) {
        var out = [];
        for (var i = 0; i < n && pool.length; i++) {
          var j = Math.floor(random() * pool.length);
          out.push(pool[j]);
          pool[j] = pool[pool.length - 1];
          pool.pop();
        }
        return out;
      }
      __name(dealFrom, "dealFrom");
      function removeOneKing(pool) {
        var kings = [];
        for (var i = 0; i < pool.length; i++) if (pool[i].r === 13) kings.push(i);
        if (!kings.length) return;
        var at = kings[Math.floor(random() * kings.length)];
        pool[at] = pool[pool.length - 1];
        pool.pop();
      }
      __name(removeOneKing, "removeOneKing");
      function shape(cards) {
        var ranks = {}, suits = {}, wild = 0, i, key;
        for (i = 0; i < cards.length; i++) {
          var c = cards[i];
          if (c.joker) {
            wild += 1;
            continue;
          }
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
      __name(shape, "shape");
      function arena(view, slots, samples) {
        var n = samples || SAMPLES;
        var worlds = [];
        var hidden = view.ratFaceDownCount;
        var offer = slots * TEAM_CHOICE;
        for (var i = 0; i < n; i++) {
          var pool = view.unseen.slice();
          if (view.waitingRat) removeOneKing(pool);
          var theirCards = view.ratFaceUp.concat(dealFrom(pool, hidden));
          worlds.push({
            theirs: Poker.bestFive(theirCards),
            offer: slots > 0 ? view.market.concat(dealFrom(pool, Math.min(offer, pool.length))) : []
          });
        }
        var chasing = JOKER_WORTH > 0 && view.jokersUnearned > 0;
        return {
          worlds,
          slots,
          prediction: chasing ? view.prediction : null,
          jokerWorth: chasing ? JOKER_WORTH : 0
        };
      }
      __name(arena, "arena");
      function completeLikeATeam(ourCards, offer, slots, mineIds, mineCap) {
        var out = ourCards.slice();
        var pool = offer.slice();
        var usedMine = 0;
        for (var s = 0; s < slots && pool.length; s++) {
          var bestAt = -1, bestScore = -1;
          for (var i = 0; i < pool.length; i++) {
            if (mineIds && mineIds[pool[i].id] && usedMine >= mineCap) continue;
            var score = shape(out.concat([pool[i]]));
            if (score > bestScore) {
              bestScore = score;
              bestAt = i;
            }
          }
          if (bestAt < 0) break;
          if (mineIds && mineIds[pool[bestAt].id]) usedMine += 1;
          out.push(pool[bestAt]);
          pool.splice(bestAt, 1);
        }
        return out;
      }
      __name(completeLikeATeam, "completeLikeATeam");
      function playOut(arena2, ourCards, mine) {
        var wins = 0, predicted = 0, checked = 0;
        var mineIds = null;
        if (mine && mine.cards && mine.cards.length && mine.cap > 0) {
          mineIds = {};
          mine.cards.forEach(function(c) {
            mineIds[c.id] = true;
          });
        }
        for (var i = 0; i < arena2.worlds.length; i++) {
          var w = arena2.worlds[i];
          if (!w.theirs) continue;
          var cards = arena2.slots ? completeLikeATeam(
            ourCards,
            mineIds ? mine.cards.concat(w.offer) : w.offer,
            arena2.slots,
            mineIds,
            mineIds ? mine.cap : 0
          ) : ourCards;
          var best = Poker.bestFive(cards);
          if (best && Poker.compare(best.ev, w.theirs.ev) > 0) wins += 1;
          if (arena2.prediction && i % PREDICTION_STRIDE === 0) {
            checked += 1;
            if (Poker.canForm(cards, arena2.prediction)) predicted += 1;
          }
        }
        return {
          win: wins / arena2.worlds.length,
          prediction: checked ? predicted / checked : 0
        };
      }
      __name(playOut, "playOut");
      function scoreIn(arena2, ourCards, mine) {
        var out = playOut(arena2, ourCards, mine);
        if (!arena2.jokerWorth) return out.win;
        return out.win + arena2.jokerWorth * out.prediction * (1 - out.win);
      }
      __name(scoreIn, "scoreIn");
      function winChance(view, ourCards, samples) {
        var slots = Math.max(0, view.collectiveTarget - ourCards.length);
        var n = samples || (hasJoker(ourCards) ? SAMPLES_JOKER : SAMPLES);
        if (view.unseen.length < slots + view.ratFaceDownCount) return 0.5;
        return playOut(arena(view, slots, n), ourCards, {
          cards: view.myHand,
          cap: Math.max(0, view.mySlotsThisHand == null ? 0 : view.mySlotsThisHand)
        }).win;
      }
      __name(winChance, "winChance");
      function rank(view, cards, samples) {
        if (!cards.length) return null;
        var slots = Math.max(0, view.collectiveTarget - view.collectiveKnown.length - 1);
        var wild = cards.some(function(c) {
          return c.joker;
        });
        var a = arena(view, slots, samples || (wild ? SAMPLES_JOKER : SAMPLES));
        var cap = Math.max(0, (view.mySlotsThisHand == null ? 1 : view.mySlotsThisHand) - 1);
        var scored = cards.map(function(card) {
          var mine = {
            cards: view.myHand.filter(function(c) {
              return c.id !== card.id;
            }),
            cap
          };
          return { card, score: scoreIn(a, view.collectiveKnown.concat([card]), mine) };
        });
        scored.sort(function(x, y) {
          return y.score - x.score;
        });
        return { best: scored[0], worst: scored[scored.length - 1], all: scored, arena: a };
      }
      __name(rank, "rank");
      function byId(cards, id) {
        return Cards.byId(cards, id);
      }
      __name(byId, "byId");
      function deckValue(view) {
        var pool = view.unseen.slice();
        var probe = dealFrom(pool, Math.min(5, pool.length));
        if (!probe.length) return 0;
        var scored = rank(view, probe, 60);
        var total = 0;
        scored.all.forEach(function(s) {
          total += s.score;
        });
        return total / scored.all.length;
      }
      __name(deckValue, "deckValue");
      function slotsLeft(view) {
        return Math.max(0, view.collectiveTarget - view.collectiveKnown.length - view.collectiveHidden);
      }
      __name(slotsLeft, "slotsLeft");
      function debtThreshold(view) {
        var roomOnRat = 5 - view.ratDebt;
        if (view.debtAtStake >= roomOnRat) return NEVER;
        var ratNeeds = roomOnRat + (view.ratsRemaining > 1 ? 5 : 0);
        var playerRoom = 5 - view.playerDebt;
        if (playerRoom <= 1) return NEVER;
        if (slotsLeft(view) > 1) return NEVER;
        return ratNeeds / (ratNeeds + playerRoom);
      }
      __name(debtThreshold, "debtThreshold");
      var handlers = {};
      handlers["turn-action"] = function(spec, view, memo) {
        var canJoker = spec.options.some(function(o) {
          return o.value === "joker";
        });
        if (!canJoker) return "play";
        if (view.difficulty === "advanced") {
          var ratNow = Poker.bestFive(view.ratFaceUp);
          var losing = winChance(view, view.collectiveKnown) < 0.35;
          return losing && ratNow && ratNow.ev.rank >= 4 ? "joker" : "play";
        }
        var options = view.myHand.concat([{ id: "JOKER", joker: true }]);
        var scored = rank(view, options, SAMPLES_JOKER);
        var joker = scored.all.filter(function(s) {
          return s.card.joker;
        })[0];
        var card = scored.all.filter(function(s) {
          return !s.card.joker;
        })[0];
        memo.jokerScore = joker ? joker.score : 0;
        return joker && (!card || joker.score > card.score + JOKER_MARGIN) ? "joker" : "play";
      };
      handlers["draw-source"] = function(spec, view) {
        if (!view.market.length) return "deck";
        var best = rank(view, view.market, 60).best;
        return best.score >= deckValue(view) + MARKET_TOLL ? "market" : "deck";
      };
      handlers["draw-market"] = function(spec, view) {
        var options = spec.zones.market.map(function(id) {
          return byId(view.market, id);
        }).filter(Boolean);
        return { zone: "market", id: rank(view, options, 80).best.card.id };
      };
      handlers["play-card"] = function(spec, view, memo) {
        var options = spec.zones.hand.map(function(id) {
          return byId(view.myHand, id);
        }).filter(Boolean);
        var best = rank(view, options).best;
        memo.playScore = best.score;
        memo.played = best.card;
        return { zone: "hand", id: best.card.id };
      };
      handlers["card-action"] = function(spec, view, memo) {
        var has = /* @__PURE__ */ __name(function(v) {
          return spec.options.some(function(o) {
            return o.value === v;
          });
        }, "has");
        if (spec.suit === "H" && !has("power")) {
          return memo.playScore >= debtThreshold(view) ? "suit" : "none";
        }
        if (has("power")) return "power";
        return has("suit") ? "suit" : "none";
      };
      handlers["hearts-flip"] = function(spec, view) {
        var ids = spec.zones.ratHand || [];
        return ids.length ? { zone: "ratHand", id: ids[0] } : null;
      };
      handlers["hearts-debt"] = function(spec, view, memo) {
        var score = winChance(view, view.collectiveKnown, 120);
        return score >= debtThreshold(view) ? "yes" : "no";
      };
      handlers["clubs-add"] = function(spec, view, memo) {
        var options = (spec.zones.hand || []).map(function(id) {
          return byId(view.myHand, id);
        }).filter(Boolean);
        if (options.length < 2) return null;
        var scored = rank(view, options, 60);
        var offer = scored.best;
        if (offer.score < deckValue(view)) return null;
        memo.offered = true;
        return { zone: "hand", id: offer.card.id };
      };
      handlers["spades-discard"] = function(spec, view, memo) {
        if ((memo.discarded || 0) >= 2) return null;
        var floor = deckValue(view);
        var options = [];
        (spec.zones.market || []).forEach(function(id) {
          var card = byId(view.market, id);
          if (card) options.push({ zone: "market", card });
        });
        (spec.zones.hand || []).forEach(function(id) {
          var card = byId(view.myHand, id);
          if (card) options.push({ zone: "hand", card });
        });
        if (!options.length) return null;
        var scored = rank(view, options.map(function(o) {
          return o.card;
        }), 60);
        var worstId = scored.worst.card.id;
        if (scored.worst.score >= floor) return null;
        var choice = options.filter(function(o) {
          return o.card.id === worstId;
        })[0];
        if (choice.zone === "hand" && view.myHand.length <= 1) return null;
        memo.discarded = (memo.discarded || 0) + 1;
        return { zone: choice.zone, id: choice.card.id };
      };
      handlers["diamonds-out"] = function(spec, view, memo) {
        var pool = spec.source === "market" ? view.market : view.myHand;
        if (!pool.length) return null;
        var slots = Math.max(0, view.collectiveTarget - view.collectiveKnown.length);
        var a = arena(view, slots, 80);
        var current = scoreIn(a, view.collectiveKnown);
        var best = null;
        (spec.zones.collective || []).forEach(function(outId) {
          var kept = view.collectiveKnown.filter(function(c) {
            return c.id !== outId;
          });
          pool.forEach(function(incoming) {
            var score = scoreIn(a, kept.concat([incoming]));
            if (!best || score > best.score) best = { outId, incoming, score };
          });
        });
        if (!best || best.score < current + SWAP_MARGIN) return null;
        memo.swapIn = best.incoming.id;
        return { zone: "collective", id: best.outId };
      };
      handlers["diamonds-in"] = function(spec, view, memo) {
        var zone = spec.zones.market ? "market" : "hand";
        var ids = spec.zones[zone] || [];
        var id = memo.swapIn && ids.indexOf(memo.swapIn) >= 0 ? memo.swapIn : ids[0];
        memo.swapIn = null;
        return { zone, id };
      };
      handlers["joker-remove"] = function(spec, view) {
        var ids = spec.zones.ratHand || [];
        var base = Poker.bestFive(view.ratFaceUp);
        var best = null;
        ids.forEach(function(id) {
          var card = byId(view.ratFaceUp, id);
          if (!card) return;
          var without = Poker.bestFive(view.ratFaceUp.filter(function(c) {
            return c.id !== id;
          }));
          var drop = without && base ? Poker.compare(base.ev, without.ev) : 0;
          if (!best || drop > best.drop) best = { id, drop };
        });
        return { zone: "ratHand", id: best ? best.id : ids[0] };
      };
      handlers["joker-resolve"] = function(spec, view) {
        return winChance(view, view.collectiveKnown) < 0.45 ? "yes" : "no";
      };
      handlers["joker-reveal"] = function(spec, view) {
        return winChance(view, view.collectiveKnown, 60) < 0.55 ? "reveal" : "stop";
      };
      function chatter(view, score, memo, seat) {
        var pick = /* @__PURE__ */ __name(function(a, b) {
          return (seat || 0) % 2 ? b : a;
        }, "pick");
        if (memo && memo.offered) return pick("Something for you in the Market.", "I have left one in the Market.");
        if (view.ratDebt === 4) return pick("One more Debt and this Rat is finished.", "That Rat is one Debt from done.");
        if (view.playerDebt === 4) return pick("Careful now \u2014 one more and we are done for.", "We cannot take another Debt.");
        if (score < 0.3 && view.jokerAvailable) return pick("This might be a round for the Joker.", "A Joker would not hurt about now.");
        if (score >= 0.75) return pick("I like our chances.", "This is looking good.");
        if (score >= 0.55) return pick("We are in this.", "We have a shot here.");
        if (score >= 0.35) return pick("This could go either way.", "Too close to call.");
        if (score >= 0.18) return pick("We need something better.", "This needs work.");
        return pick("This one looks grim.", "I do not like this one.");
      }
      __name(chatter, "chatter");
      var Bot = {
        /* Answers one prompt. `memo` carries scratch state across the prompts of a
           single turn (the two halves of a ♦ swap, say). */
        answer: /* @__PURE__ */ __name(function(spec, view, memo) {
          var handler = handlers[spec.tag];
          if (handler) {
            var answer = handler(spec, view, memo || {});
            if (answer !== void 0) return answer;
          }
          return Bot.fallback(spec);
        }, "answer"),
        /* Anything untagged: take the first legal option rather than stall. */
        fallback: /* @__PURE__ */ __name(function(spec) {
          if (spec.options) return spec.options[spec.options.length - 1].value;
          if (spec.optional) return null;
          var zones = Object.keys(spec.zones || {}).filter(function(z) {
            return spec.zones[z].length;
          });
          return zones.length ? { zone: zones[0], id: spec.zones[zones[0]][0] } : null;
        }, "fallback"),
        /* Swap in a seeded generator to make a bot's thinking reproducible. */
        setRandom: /* @__PURE__ */ __name(function(fn) {
          random = fn || function() {
            return Math.random();
          };
        }, "setRandom"),
        winChance,
        chatter,
        SAMPLES
      };
      root.RRBot = Bot;
      if (typeof module !== "undefined" && module.exports) module.exports = Bot;
    })(typeof globalThis !== "undefined" ? globalThis : exports);
  }
});

// server/room.js
var require_room = __commonJS({
  "server/room.js"(exports, module) {
    init_modules_watch_stub();
    (function(root) {
      "use strict";
      var Cards = root.RRCards;
      var Game = root.RRGame;
      var Bot = root.RRBot;
      var CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      var SEATS = 4;
      function makeCode2(random) {
        var out = "";
        for (var i = 0; i < 4; i++) {
          out += CODE_LETTERS[Math.floor((random || Math.random)() * CODE_LETTERS.length)];
        }
        return out;
      }
      __name(makeCode2, "makeCode");
      function token(random) {
        var out = "";
        for (var i = 0; i < 24; i++) {
          out += Math.floor((random || Math.random)() * 36).toString(36);
        }
        return out;
      }
      __name(token, "token");
      function Room2(options) {
        options = options || {};
        this.code = options.code || makeCode2(options.random);
        this.random = options.random || Math.random;
        this.engine = Game.create();
        this.seats = [];
        this.status = "lobby";
        this.version = 0;
        this.prompt = null;
        this.reveal = null;
        this.result = null;
        this.error = null;
        this.waiters = [];
      }
      __name(Room2, "Room");
      Room2.prototype.touch = function() {
        this.version += 1;
        var waiting = this.waiters;
        this.waiters = [];
        waiting.forEach(function(fn) {
          fn();
        });
      };
      Room2.prototype.waitForChange = function(since, timeoutMs, setTimer) {
        var room = this;
        if (this.version > since) return Promise.resolve();
        return new Promise(function(resolve) {
          var done = false;
          var finish = /* @__PURE__ */ __name(function() {
            if (!done) {
              done = true;
              resolve();
            }
          }, "finish");
          room.waiters.push(finish);
          if (setTimer) setTimer(finish, timeoutMs || 25e3);
        });
      };
      Room2.prototype.freeSuit = function() {
        var taken = {};
        this.seats.forEach(function(s) {
          taken[s.suit] = true;
        });
        return Cards.SUITS.filter(function(su) {
          return !taken[su];
        })[0];
      };
      Room2.prototype.join = function(name, asBot) {
        if (this.status !== "lobby") return { error: "the game has already started" };
        if (this.seats.length >= SEATS) return { error: "the table is full" };
        var seat = {
          id: this.seats.length,
          token: token(this.random),
          name: (name || "").trim().slice(0, 16) || (asBot ? "Bot" : "Player " + (this.seats.length + 1)),
          suit: this.freeSuit(),
          bot: !!asBot
        };
        this.seats.push(seat);
        this.touch();
        return { seat };
      };
      Room2.prototype.seatByToken = function(tok) {
        for (var i = 0; i < this.seats.length; i++) {
          if (this.seats[i].token === tok) return this.seats[i];
        }
        return null;
      };
      Room2.prototype.update = function(tok, change) {
        var seat = this.seatByToken(tok);
        if (!seat) return { error: "not at this table" };
        if (this.status !== "lobby") return { error: "the game has already started" };
        if (change.name != null) seat.name = String(change.name).trim().slice(0, 16) || seat.name;
        if (change.suit && Cards.SUITS.indexOf(change.suit) >= 0) {
          var holder = this.seats.filter(function(s) {
            return s.suit === change.suit;
          })[0];
          if (holder && holder !== seat) holder.suit = seat.suit;
          seat.suit = change.suit;
        }
        this.touch();
        return { seat };
      };
      Room2.prototype.addBot = function(tok) {
        var seat = this.seatByToken(tok);
        if (!seat || seat.id !== 0) return { error: "only the table\u2019s host can add a bot" };
        var free = this.freeSuit();
        var added = this.join("Bot " + (free ? Cards.SUIT_GLYPH[free] : ""), true);
        return added;
      };
      Room2.prototype.removeSeat = function(tok, seatId) {
        var seat = this.seatByToken(tok);
        if (!seat || seat.id !== 0) return { error: "only the table\u2019s host can remove a seat" };
        if (this.status !== "lobby") return { error: "the game has already started" };
        if (seatId === 0) return { error: "the host keeps their seat" };
        this.seats = this.seats.filter(function(s) {
          return s.id !== seatId;
        });
        this.seats.forEach(function(s, i) {
          s.id = i;
        });
        this.touch();
        return { ok: true };
      };
      Room2.prototype.start = function(tok, difficulty) {
        var seat = this.seatByToken(tok);
        if (!seat || seat.id !== 0) return { error: "only the table\u2019s host can start" };
        if (this.status !== "lobby") return { error: "the game has already started" };
        if (this.seats.length < 1) return { error: "nobody is at the table" };
        var room = this;
        this.engine.io = this.makeIo();
        this.engine.newGame({
          players: this.seats.map(function(s) {
            return { name: s.name, suit: s.suit, bot: s.bot };
          }),
          difficulty: difficulty || "normal"
        });
        this.status = "playing";
        this.touch();
        this.play();
        return { ok: true };
      };
      Room2.prototype.play = function() {
        var room = this;
        var engine = this.engine;
        if (this.status !== "playing" || engine.state.over) return Promise.resolve();
        return engine.runTurn().then(function() {
          if (engine.shouldResolve()) return engine.resolveHand();
        }).then(function() {
          if (engine.state.over) {
            room.status = "finished";
            room.result = engine.state.over;
            room.touch();
            return;
          }
          engine.nextPlayer();
          room.touch();
          return room.play();
        }).catch(function(err) {
          room.error = String(err && err.message || err);
          room.touch();
        });
      };
      Room2.prototype.makeIo = function() {
        var room = this;
        var botMemo = {};
        var ask = /* @__PURE__ */ __name(function(spec) {
          var engine = room.engine;
          var seat = room.seats[engine.state.current];
          if (seat && seat.bot) {
            if (spec.tag === "turn-action") botMemo = {};
            return Promise.resolve(Bot.answer(spec, engine.publicView(seat.id), botMemo));
          }
          return new Promise(function(resolve) {
            room.prompt = {
              id: "p" + room.version + "-" + Math.floor(room.random() * 1e6),
              seat: engine.state.current,
              spec,
              resolve
            };
            room.touch();
          });
        }, "ask");
        return {
          choose: ask,
          pick: ask,
          passTo: /* @__PURE__ */ __name(function() {
            return Promise.resolve();
          }, "passTo"),
          // separate phones: nothing to hide
          cardRevealed: /* @__PURE__ */ __name(function(card, index, total) {
            room.reveal = { card, index, total };
            room.touch();
            return null;
          }, "cardRevealed"),
          showResolution: /* @__PURE__ */ __name(function(r) {
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
          }, "showResolution"),
          ratDefeated: /* @__PURE__ */ __name(function(info) {
            room.lastDefeat = info;
            room.touch();
            return Promise.resolve();
          }, "ratDefeated"),
          gameOver: /* @__PURE__ */ __name(function() {
            return Promise.resolve();
          }, "gameOver")
        };
      };
      Room2.prototype.answer = function(tok, promptId, value) {
        var seat = this.seatByToken(tok);
        if (!seat) return { error: "not at this table" };
        var prompt = this.prompt;
        if (!prompt) return { error: "nothing to answer" };
        if (prompt.id !== promptId) return { error: "that question has moved on" };
        if (prompt.seat !== seat.id) return { error: "not your turn" };
        this.prompt = null;
        this.reveal = null;
        prompt.resolve(value);
        this.touch();
        return { ok: true };
      };
      Room2.prototype.viewFor = function(tok) {
        var seat = this.seatByToken(tok);
        if (!seat) return { error: "not at this table" };
        var out = {
          version: this.version,
          code: this.code,
          status: this.status,
          you: { id: seat.id, name: seat.name, suit: seat.suit, host: seat.id === 0 },
          seats: this.seats.map(function(s) {
            return { id: s.id, name: s.name, suit: s.suit, bot: s.bot };
          }),
          error: this.error
        };
        if (this.status === "lobby") return out;
        var view = this.engine.publicView(seat.id);
        delete view.unseen;
        out.view = view;
        out.log = this.engine.state.log.slice(-40);
        out.turn = this.engine.state.current;
        out.reveal = this.reveal;
        out.resolution = this.lastResolution || null;
        out.defeat = this.lastDefeat || null;
        out.result = this.result;
        if (this.prompt && this.prompt.seat === seat.id) {
          out.prompt = { id: this.prompt.id, spec: this.prompt.spec };
        }
        return out;
      };
      var api = { Room: Room2, makeCode: makeCode2, SEATS };
      root.RRRoom = api;
      if (typeof module !== "undefined" && module.exports) module.exports = api;
    })(typeof globalThis !== "undefined" ? globalThis : exports);
  }
});

// server/api.js
var require_api = __commonJS({
  "server/api.js"(exports, module) {
    init_modules_watch_stub();
    (function(root) {
      "use strict";
      var Rooms = root.RRRoom;
      function ok(data) {
        return { status: 200, data: data || { ok: true } };
      }
      __name(ok, "ok");
      function bad(message, status) {
        return { status: status || 400, data: { error: message } };
      }
      __name(bad, "bad");
      function handle(room, action, body, query) {
        body = body || {};
        query = query || {};
        if (action === "join") {
          var joined = room.join(body.name);
          if (joined.error) return bad(joined.error);
          return ok({
            token: joined.seat.token,
            code: room.code,
            seat: { id: joined.seat.id, name: joined.seat.name, suit: joined.seat.suit }
          });
        }
        var token = body.token || query.token;
        if (!token) return bad("no seat token", 401);
        if (!room.seatByToken(token)) return bad("not at this table", 403);
        if (action === "view") return ok(room.viewFor(token));
        if (action === "seat") {
          var changed = room.update(token, { name: body.name, suit: body.suit });
          return changed.error ? bad(changed.error) : ok(room.viewFor(token));
        }
        if (action === "bot") {
          var added = room.addBot(token);
          return added.error ? bad(added.error) : ok(room.viewFor(token));
        }
        if (action === "remove") {
          var removed = room.removeSeat(token, Number(body.seat));
          return removed.error ? bad(removed.error) : ok(room.viewFor(token));
        }
        if (action === "start") {
          var started = room.start(token, body.difficulty);
          return started.error ? bad(started.error) : ok(room.viewFor(token));
        }
        if (action === "answer") {
          var answered = room.answer(token, body.promptId, body.answer);
          var harmless = answered.error === "that question has moved on" || answered.error === "nothing to answer";
          if (answered.error && !harmless) return bad(answered.error);
          return ok(room.viewFor(token));
        }
        return bad("no such action: " + action, 404);
      }
      __name(handle, "handle");
      function waitThenView(room, token, since, timeoutMs, setTimer) {
        if (!room.seatByToken(token)) return Promise.resolve(bad("not at this table", 403));
        return room.waitForChange(Number(since) || 0, timeoutMs, setTimer).then(function() {
          return ok(room.viewFor(token));
        });
      }
      __name(waitThenView, "waitThenView");
      var api = { handle, waitThenView };
      root.RRApi = api;
      if (typeof module !== "undefined" && module.exports) module.exports = api;
    })(typeof globalThis !== "undefined" ? globalThis : exports);
  }
});

// .wrangler/tmp/bundle-sJkmCj/middleware-loader.entry.ts
init_modules_watch_stub();

// .wrangler/tmp/bundle-sJkmCj/middleware-insertion-facade.js
init_modules_watch_stub();

// server/worker.js
init_modules_watch_stub();
var import_cards = __toESM(require_cards());
var import_poker = __toESM(require_poker());
var import_game = __toESM(require_game());
var import_bot = __toESM(require_bot());
var import_room = __toESM(require_room());
var import_api = __toESM(require_api());
var { Room, makeCode } = globalThis.RRRoom;
var Api = globalThis.RRApi;
var CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, CORS)
  });
}
__name(json, "json");
var RiverRatsRoom = class {
  static {
    __name(this, "RiverRatsRoom");
  }
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
    this.room = null;
    this.ready = state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get("room");
      if (saved) this.restore(saved);
    });
  }
  restore(saved) {
    const room = new Room({ code: saved.code });
    room.seats = saved.seats;
    room.status = saved.status;
    room.result = saved.result || null;
    if (saved.game) {
      room.engine.state = saved.game;
      room.engine.io = room.makeIo();
      if (room.status === "playing") room.play();
    }
    this.room = room;
  }
  async persist() {
    if (!this.room) return;
    await this.ctx.storage.put("room", {
      code: this.room.code,
      seats: this.room.seats,
      status: this.room.status,
      result: this.room.result,
      game: this.room.engine.state
    });
  }
  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const code = url.searchParams.get("code");
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    if (action === "create") {
      if (this.room) return json({ error: "that code is taken" }, 409);
      this.room = new Room({ code });
      const joined = this.room.join(body.name);
      await this.persist();
      return json({
        code: this.room.code,
        token: joined.seat.token,
        seat: { id: joined.seat.id, name: joined.seat.name, suit: joined.seat.suit }
      });
    }
    if (!this.room) return json({ error: "no table with that code" }, 404);
    if (action === "view") {
      const token = url.searchParams.get("token");
      const since = url.searchParams.get("since");
      const result2 = await Api.waitThenView(
        this.room,
        token,
        since,
        25e3,
        (fire, ms) => setTimeout(fire, ms)
      );
      return json(result2.data, result2.status);
    }
    const result = Api.handle(this.room, action, body, Object.fromEntries(url.searchParams));
    await this.persist();
    return json(result.data, result.status);
  }
};
var worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "api" || parts[1] !== "rooms") {
      return json({ error: "not found" }, 404);
    }
    if (parts.length === 2 && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      for (let attempt = 0; attempt < 8; attempt++) {
        const code2 = makeCode();
        const stub2 = env.ROOMS.get(env.ROOMS.idFromName(code2));
        const made = await stub2.fetch(new Request(
          "https://room/?action=create&code=" + code2,
          { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }
        ));
        if (made.status !== 409) {
          return json(await made.json(), made.status);
        }
      }
      return json({ error: "could not find a free code, try again" }, 503);
    }
    const code = (parts[2] || "").toUpperCase();
    const action = parts[3];
    if (!/^[A-Z]{4}$/.test(code) || !action) return json({ error: "not found" }, 404);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const forward = new URL("https://room/");
    forward.searchParams.set("action", action);
    for (const [k, v] of url.searchParams) forward.searchParams.set(k, v);
    return stub.fetch(new Request(forward, {
      method: request.method,
      body: request.method === "POST" ? await request.text() : void 0,
      headers: { "content-type": "application/json" }
    }));
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-sJkmCj/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-sJkmCj/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  RiverRatsRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
