import assert from "node:assert/strict";
import relay from "./interstellar-relay.js";

const originalFetch = globalThis.fetch;
const origin = "https://example.discordaccoutcolmaster.workers.dev";
const backend = "https://interstellar.gonicvrnew.workers.dev";
try {
  for (const incomingOrigin of [origin, "https://untrusted.example"]) {
    globalThis.fetch = async (request, options) => {
      assert.equal(request.url, backend + "/api/pc/login?test=1");
      assert.equal(request.headers.get("Origin"), incomingOrigin === origin ? backend : incomingOrigin);
      assert.equal(request.headers.get("Sec-Fetch-Site"), "same-origin");
      assert.equal(request.headers.get("Cookie"), "pc-session=test");
      assert.equal(request.headers.get("Host"), null);
      assert.equal(request.method, "POST");
      assert.equal(await request.text(), '{"username":"test"}');
      assert.equal(options.redirect, "manual");
      return new Response("ok", { headers: { "Set-Cookie": "pc-session=new; Path=/; Secure; HttpOnly", "Access-Control-Allow-Origin": backend } });
    };
    const response = await relay.fetch(new Request(origin + "/api/pc/login?test=1", {
      method: "POST", headers: { Host: new URL(origin).host, Origin: incomingOrigin, "Sec-Fetch-Site": "same-origin", Cookie: "pc-session=test" }, body: '{"username":"test"}',
    }));
    assert.equal(await response.text(), "ok");
    assert.match(response.headers.get("Set-Cookie"), /^pc-session=new/);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  }
  for (const [location, expected] of [[backend + "/play.html", origin + "/play.html"], ["/pc", origin + "/pc"], ["https://example.com/", "https://example.com/"]]) {
    globalThis.fetch = async () => new Response(null, { status: 307, headers: { Location: location } });
    const response = await relay.fetch(new Request(origin));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("Location"), expected);
  }
  const upgrade = { status: 101, webSocket: {} };
  globalThis.fetch = async request => {
    assert.equal(request.headers.get("Upgrade"), "websocket");
    return upgrade;
  };
  assert.equal(await relay.fetch(new Request(origin + "/wisp/", { headers: { Upgrade: "websocket" } })), upgrade);
  globalThis.fetch = async () => new Response(new Uint8Array([0, 97, 115, 109]), { status: 206, headers: {
    "Content-Range": "bytes 0-3/40", "Cross-Origin-Embedder-Policy": "require-corp", "Cross-Origin-Opener-Policy": "same-origin",
  } });
  const bytes = await relay.fetch(new Request(origin + "/game.wasm"));
  assert.equal(bytes.status, 206);
  assert.equal(bytes.headers.get("Content-Range"), "bytes 0-3/40");
  assert.equal(bytes.headers.get("Cross-Origin-Embedder-Policy"), "require-corp");
  assert.deepEqual([...new Uint8Array(await bytes.arrayBuffer())], [0, 97, 115, 109]);
  console.log("Passed: account relay, request bodies/cookies, origin protection, redirects, WebSocket upgrades and binary responses.");
} finally { globalThis.fetch = originalFetch; }
