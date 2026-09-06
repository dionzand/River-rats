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
  **Player Power**. Or use a face-up Joker instead.
- **Hand Resolution** — the Prediction check that flips a Joker, revealing the face-down cards,
  best five cards on each side, and the rulebook's tiebreakers: flushes, straights and straight
  flushes are decided by their highest card alone, and the River Rats win every True Tie.
- **All four River Rats** — each Rat's ability while it is active and its defeat bonus after it
  goes down, including the beaten Rat staying in the second Rat's Hand.
- **Difficulty** — Normal, Advanced and Expert, each with its own Rat's Hand size and its own
  way of using a Joker.
- **Solo and 2–4 players** — solo uses the rulebook's solo variants for ♣; multiplayer hands the
  phone around with a pass screen so nobody sees anyone else's cards. The communication
  restriction is still yours to keep: talk strategy, never name a card.

## Layout

```
index.html            markup and the zones on the table
styles.css            the whole look; dark, portrait, safe-area aware
js/cards.js           cards, deck, shuffling
js/poker.js           hand evaluation, the rulebook's tiebreakers, Joker wildcards
js/game.js            the rules engine: it asks the UI for every decision
js/ui.js              DOM rendering, prompts, sheets, save/resume
sw.js                 offline cache
tools/make_icons.py   regenerates the app icons
tests/                node --test suites for the evaluator and the engine
```

`js/game.js` never touches the DOM: it drives the game and calls `io.choose`, `io.pick` and the
rest, which `js/ui.js` answers with taps. The same interface is answered by a bot in
`tests/game.test.js`, which plays 144 complete games across every mode and player count and
checks after every turn that all 52 cards are still exactly where they should be.

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
