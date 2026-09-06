/* The room's HTTP shape, with no HTTP in it.

   Every request a phone can make is one call to `handle`, against one Room.
   Keeping it separate from the Cloudflare wrapper means the whole API can be
   tested in node, and that the wrapper stays thin enough to read in one go. */
(function (root) {
  'use strict';

  var Rooms = root.RRRoom;

  function ok(data) { return { status: 200, data: data || { ok: true } }; }
  function bad(message, status) { return { status: status || 400, data: { error: message } }; }

  /* `body` is the parsed JSON a phone sent; `query` its query string values. */
  function handle(room, action, body, query) {
    body = body || {};
    query = query || {};

    if (action === 'join') {
      var joined = room.join(body.name);
      if (joined.error) return bad(joined.error);
      return ok({
        token: joined.seat.token,
        code: room.code,
        seat: { id: joined.seat.id, name: joined.seat.name, suit: joined.seat.suit }
      });
    }

    var token = body.token || query.token;
    if (!token) return bad('no seat token', 401);
    if (!room.seatByToken(token)) return bad('not at this table', 403);

    if (action === 'view') return ok(room.viewFor(token));
    if (action === 'seat') {
      var changed = room.update(token, { name: body.name, suit: body.suit });
      return changed.error ? bad(changed.error) : ok(room.viewFor(token));
    }
    if (action === 'bot') {
      var added = room.addBot(token);
      return added.error ? bad(added.error) : ok(room.viewFor(token));
    }
    if (action === 'remove') {
      var removed = room.removeSeat(token, Number(body.seat));
      return removed.error ? bad(removed.error) : ok(room.viewFor(token));
    }
    if (action === 'start') {
      var started = room.start(token, body.difficulty);
      return started.error ? bad(started.error) : ok(room.viewFor(token));
    }
    if (action === 'answer') {
      var answered = room.answer(token, body.promptId, body.answer);
      // A tap that arrives twice, or after a dropped connection, is not worth
      // shouting about: the question it answered is simply no longer the
      // question. Tell the phone where the table is now and let it redraw.
      var harmless = answered.error === 'that question has moved on' ||
        answered.error === 'nothing to answer';
      if (answered.error && !harmless) return bad(answered.error);
      return ok(room.viewFor(token));
    }
    return bad('no such action: ' + action, 404);
  }

  /* Long-poll: hold the request open until something changes or time runs out,
     so a phone is not asking every second for nothing. */
  function waitThenView(room, token, since, timeoutMs, setTimer) {
    if (!room.seatByToken(token)) return Promise.resolve(bad('not at this table', 403));
    return room.waitForChange(Number(since) || 0, timeoutMs, setTimer)
      .then(function () { return ok(room.viewFor(token)); });
  }

  var api = { handle: handle, waitThenView: waitThenView };
  root.RRApi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
