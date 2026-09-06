# River Rats

A playable digital version of **River Rats**, the cooperative poker game by Mathijs Jansen &
Robin Stokkel (Four Suit Studio). Two wealthy River Rats deal you into their game: put five
Debt on each of them before the players collect five Debt between you.

It runs entirely in the browser — no build step, no server, no network once loaded — and is
built for a phone held in portrait.

## Play on your iPhone

The quickest route is GitHub Pages:

1. In this repository, open **Settings → Pages**.
2. Under *Build and deployment*, choose **Deploy from a branch**, pick the branch and the
   `/ (root)` folder, and save. GitHub then rebuilds the site on every push to that branch —
   there is nothing to deploy by hand.
3. Open the published URL in Safari on your phone, tap **Share → Add to Home Screen**.

It then launches full screen like an app, works with no signal (a service worker caches
everything), and saves your game at the start of every turn, so you can close it mid-game.

To try it on a computer first: `npm start` and open `http://localhost:8080`.

## What is implemented

Everything in the rulebook, enforced by the engine rather than left to the honour system:

- **Setup** — each player takes an Ace as their Character, two of the four Kings become the
  River Rats (one active, one face down and never revealed until it steps up), the rest of the
  deck is the Draw Deck, two cards per player, three in the Market.
- **Round setup** — the Rat's Hand of five face-up and two face-down cards next to the Rat, the
  Joker's Prediction turned up as the round's first Debt card.
- **Turns** — refill to a hand limit of three from the Market or the Deck, play a card into the
  Collective Hand, then take that card's **Suit Action** or, if it matches your Ace, your
  **Player Power**. Or use a face-up Joker instead. A turn can be taken back until the hands are
  resolved — the Deck order is part of the saved state, so replaying it draws the same cards.
- **Hand Resolution** — the Prediction check that flips a Joker, revealing the face-down cards,
  best five cards on each side, and the rulebook's tiebreakers: flushes, straights and straight
  flushes are decided by their highest card alone, and the River Rats win every True Tie.
- **All four River Rats** — each Rat's ability while it is active and its defeat bonus after it
  goes down, including the beaten Rat staying in the second Rat's Hand.
- **Difficulty** — the rulebook's first game (no Rat abilities, no Player Powers), then Normal,
  Advanced and Expert, each with its own Rat's Hand size and its own way of using a Joker.
- **Solo and 2–4 players** — solo uses the rulebook's solo variants for ♣; multiplayer hands the
  phone around with a pass screen so nobody sees anyone else's cards. The communication
  restriction is still yours to keep: talk strategy, never name a card.
- **Bot teammates** — any seat but the first can be a bot, so you can play the co-op game on
  your own against the Rats. See below.

## Bot teammates

Tap a seat on the setup screen to fill it with a bot. Bots take their turns on the same screen,
with a beat between decisions so you can follow what they do.

**They play blind.** A bot is handed `RRGame.publicView(i)` — its own hand and what is face up
on the table — and nothing else. It cannot see the Deck, the Rat's face-down cards, or your
hand, so it has to guess at its teammates exactly as they have to guess at it. That is the
point: bots that read the whole game state would turn a co-op game into a solved puzzle. They
also talk the way the rulebook allows, saying how they feel about the table and never what they
hold or what hand they are building.

**Nothing is trained.** The table hands us a perfect evaluator and the River Rat shows most of
its hand, so a bot deals out the cards it cannot see a few hundred times and counts how often
each option wins. Every candidate play is scored against the *same* rollouts — the difference
between a good card and a bad one is a few percent, and so is the sampling error, so judging
each option on fresh deals would just pick noise.

Four things they learned from measurement rather than from the rulebook:

- **The Market is the channel.** It is face up, so it is the one hand the whole table shares:
  every player sees the same cards and any of them can take one. Rollouts therefore always offer
  the whole Market when working out how a hand might finish, rather than treating a Market card
  as something a teammate has to happen to draw — and a bot spending ♣ gives away its *best*
  spare card, not its worst, because a card it cannot play this turn is worth more face up where
  someone else can use it.
- **Follow the suit.** A blind team can agree on a flush but not on a rank — nobody may say "I
  have another eight", but everyone can see three hearts. Modelling teammates as suit-chasers
  rather than pair-chasers is worth about ten points of hand win rate.
- **Count only the turns you get.** A hand is always five cards, so the turn order settles who
  plays them: one each around a table of four, and two for whoever started the hand. A rollout
  may spend at most that many cards from the player's own hand — finishing the hand out of your
  own three cards is true playing alone and fantasy at a full table.
- **The Debt is a bet.** Five Debt defeats a Rat and five ends the players, so a Debt card is
  worth about twice as much against you as for you. Bots raise only late in a hand, when there is
  something to read, and only on a strong read; they refuse to pad a pot that already finishes
  the Rat, and raise freely when one card would.

They also play a hand they cannot win toward the Joker's Prediction, which pays out whoever wins
the hand, weighted so that chasing a Joker never costs a winnable hand.

**How strong are they?** At a table of four: **about 48% of hands and 4 games in 30**.

**How that was measured, and why it matters.** Hands inside one game share a deal, a River Rat
and a Market, so a bad game loses several in a row: 250 hands out of 30 games are nothing like
250 independent samples, and independent runs of that size cannot separate policies that differ
by a few points. `Bot.setRandom()` exists for this — it holds the shuffle fixed and varies only
how the bots think, so two policies can be run over the *same* deals. That is the same
variance-reduction trick the rollouts use internally, turned on the measurement itself. Two
findings only became visible under it, and one of them had already been wrongly discarded on
noisier numbers.

Losing most games is the game, not the bots — the Rat plays eight cards against your five, and
defeating both Rats needs ten Debt on them before five lands on you, so winning hands is not
enough on its own. Worth knowing before you blame your teammates: a bot that could see the Rat's
face-down cards does no better, so the limit is the hand a blind team can build, not what anyone
knows.

The constants worth touching are all at the top of `js/bot.js`.

## Playing it

Name the seats what you like on the setup screen; the names are remembered for next time. Tap a
seat to swap between a person and a bot.

Anything marked ⓘ explains itself: the zone headings, the four counters above the Collective
Hand, and the suit key under your cards. The answers are about the game in front of you — how
many cards you still play this hand, what the active Rat is doing, what your own Ace lets you do
— rather than the rulebook in general.

At the end of a hand the face-down cards turn over one at a time, and the outcome follows a beat
later — tap anywhere to hurry it along.

## Playing on separate phones

Once a room server is deployed (`docs/rooms-setup.md`), the setup screen offers **Separate
phones**. One person starts a table and reads out the four-letter code — or sends the link,
which drops the others straight into joining. The host arranges the seats, adds bots for any
empty ones, picks the difficulty, and deals.

The game runs on the server, not on anybody's phone. Each phone is sent the view for its own
seat and the question addressed to it, so nobody's hand is on anybody else's device — the
communication restriction stops being an honour system. It also means the pass-the-phone screen
is unnecessary, and that a phone can lock, sleep or lose signal and pick the table up again.

**Leaving.** In the lobby your seat goes. Mid-game it stays, because the hand it holds is part
of the game — a bot plays it out for the others, and the table shows the seat as *(gone)*. A
phone that simply vanishes — locked, out of signal, closed — is treated the same way after three
missed poll cycles, so nobody is ever left waiting on somebody else's pocket. A table nobody
has been at for ten minutes closes itself and deletes what it was holding.

Without a room server configured the option does not appear and everything plays on one phone
as before.

## Layout

```
index.html            markup and the zones on the table
styles.css            the whole look; dark, portrait, safe-area aware
js/cards.js           cards, deck, shuffling
js/poker.js           hand evaluation, the rulebook's tiebreakers, Joker wildcards
js/game.js            the rules engine: it asks the UI for every decision
js/bot.js             bot players: rollouts over the cards they cannot see
js/ui.js              DOM rendering, prompts, sheets, save/resume
js/net.js             playing in a room: the phone's half
js/config.js          where the room server lives (empty: multiplayer off)
server/room.js        one table, hosting one game
server/api.js         every request a phone can make, with no HTTP in it
server/worker.js      the Cloudflare wrapper: one room per Durable Object
server/local.js       the same server on node, for testing (npm run rooms)
sw.js                 offline cache
tools/make_icons.py   regenerates the app icons
tests/                node --test suites for the evaluator and the engine
```

`js/game.js` never touches the DOM: it drives the game and calls `io.choose`, `io.pick` and the
rest, which `js/ui.js` answers with taps and `js/bot.js` answers with rollouts. Each prompt
carries a `tag` naming the decision, so a bot dispatches on what is being asked rather than on
the wording. The same interface is answered by a bot in `tests/game.test.js`, which plays 144
complete games across every mode and player count and checks after every turn that all 52 cards
are still exactly where they should be.

## Tests

```
npm test
```

`.github/workflows/tests.yml` runs the same suite on every push and pull request. It does not
deploy: GitHub Pages publishes the branch directly, so there is no deployment workflow to keep
in step with it.

## Credits

Game design: Mathijs Jansen & Robin Stokkel, published by Four Suit Studio. This is an
unofficial digital adaptation of the printed rulebook for personal play; the artwork, cards and
box design of the physical game are not reproduced here.
