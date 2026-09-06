/* A room server for a laptop: the same Room and the same API as Cloudflare, over
   node's http. Handy for trying multiplayer without deploying anything, and it
   is what the browser tests run against.

     node server/local.js          # http://localhost:8787
*/
const http = require('http');

require('../js/cards.js');
require('../js/poker.js');
require('../js/game.js');
require('../js/bot.js');
const { Room, makeCode } = require('./room.js');
const Api = require('./api.js');

const rooms = new Map();
const PORT = Number(process.env.PORT || 8787);

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

function send(res, status, data) {
  res.writeHead(status, Object.assign({ 'content-type': 'application/json' }, CORS));
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'rooms') return send(res, 404, { error: 'not found' });
  const body = req.method === 'POST' ? await readBody(req) : {};

  if (parts.length === 2 && req.method === 'POST') {
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    const room = new Room({ code });
    rooms.set(code, room);
    const joined = room.join(body.name);
    return send(res, 200, {
      code,
      token: joined.seat.token,
      seat: { id: joined.seat.id, name: joined.seat.name, suit: joined.seat.suit }
    });
  }

  const room = rooms.get((parts[2] || '').toUpperCase());
  const action = parts[3];
  if (!room) return send(res, 404, { error: 'no table with that code' });

  if (action === 'view') {
    const result = await Api.waitThenView(room, url.searchParams.get('token'),
      url.searchParams.get('since'), 25000, (fire, ms) => setTimeout(fire, ms).unref());
    return send(res, result.status, result.data);
  }
  const result = Api.handle(room, action, body, Object.fromEntries(url.searchParams));
  return send(res, result.status, result.data);
});

server.listen(PORT, () => {
  console.log('River Rats rooms on http://localhost:' + PORT);
});
