/* Where the rooms live. Empty means multiplayer is switched off and the game
   plays on one phone exactly as it always has.

   Set by deploying server/worker.js - see docs/rooms-setup.md - and pasting the
   address the deploy prints here. */
// Anything set before this file loads wins, which is how the browser tests and
// a laptop pointed at `npm run rooms` reach a local server.
window.RR_ROOM_SERVER = window.RR_ROOM_SERVER ||
  'https://river-rats-rooms.dion-zandstra.workers.dev';
