import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = (await readFile(new URL("worker.js", import.meta.url), "utf8")).replace('import { DurableObject } from "cloudflare:workers";', 'class DurableObject { constructor(ctx, env) { this.ctx=ctx; this.env=env; } }');
const { default: worker, LinkRegistry } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const data = new Map(), scripts = new Map([["existing-site", { id: "existing-site" }]]);
let pending = Promise.resolve(), uploads = 0, enables = 0, failEnable = false, allowed = true;
const ctx = { storage: { get: async key => structuredClone(data.get(key)), put: async (key, value) => data.set(key, structuredClone(value)) },
  blockConcurrencyWhile(fn) { const next = pending.then(fn); pending = next.catch(() => {}); return next; } };
const env = { CF_API_TOKEN: "test-secret", CF_ACCOUNT_ID: "test", WORKERS_SUBDOMAIN: "gonicvrnew", INTERSTELLAR_SERVICE: "interstellar", CREATE_LIMIT: { limit: async () => ({ success: allowed }) } };
const registry = new LinkRegistry(ctx, env);
env.LINKS = { getByName: () => ({ fetch: (url, options) => registry.fetch(new Request(url, options)) }) };
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  assert.equal(options.headers.Authorization, "Bearer test-secret");
  if (url.endsWith("/scripts")) return Response.json({ success: true, result: [...scripts.values()] });
  const name = url.match(/scripts\/([^/]+)/)?.[1];
  if (options.method === "PUT") {
    assert.ok(!scripts.has(name), "Never overwrite an existing Worker"); uploads++;
    const metadata = JSON.parse(await options.body.get("metadata").text());
    assert.deepEqual(metadata.bindings, [{ type: "service", name: "INTERSTELLAR", service: "interstellar" }]);
    assert.ok(!(await options.body.get("alias.js").text()).includes("test-secret"));
    scripts.set(name, { id: name, tags: metadata.tags });
  } else {
    assert.equal(options.method, "POST");
    if (failEnable) { failEnable = false; return Response.json({ success: false }, { status: 503 }); }
    assert.deepEqual(JSON.parse(options.body), { enabled: true, previews_enabled: false }); enables++;
  }
  return Response.json({ success: true, result: {} });
};
const origin = "https://generator.gonicvrnew.workers.dev";
const create = (name, headers = {}) => worker.fetch(new Request(origin + "/api/links", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify({ name }) }), env);
try {
  for (const name of ["x", "-bad", "bad-", "9bad", "../existing-site", "a".repeat(41), "__proto__", { bad: true }]) assert.equal((await create(name)).status, 400);
  assert.equal((await create("valid-name", { Origin: "https://evil.test" })).status, 403);
  assert.equal((await create("valid-name", { "Sec-Fetch-Site": "cross-site" })).status, 403);
  assert.equal((await create("valid-name", { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await create("a".repeat(300))).status, 413);
  allowed = false; assert.equal((await create("valid-name")).status, 429); allowed = true;
  delete env.CF_API_TOKEN; assert.equal((await create("valid-name")).status, 503); env.CF_API_TOKEN = "test-secret";
  for (const name of ["interstellar", "schoolwork", "schoolworkv2", "generator", "interstellar-links", "existing-site"]) assert.equal((await create(name)).status, 409);
  const concurrent = await Promise.all([create(" My-Link "), create("my-link")]);
  assert.deepEqual(concurrent.map(x => x.status), [201, 200]); assert.equal(uploads, 1); assert.equal(enables, 1);
  assert.equal((await concurrent[0].json()).url, "https://my-link.gonicvrnew.workers.dev");
  failEnable = true; assert.equal((await create("retry-link")).status, 502);
  assert.equal((await create("retry-link")).status, 201); assert.equal(uploads, 2); assert.equal(enables, 2);
  scripts.set("foreign-owned", { id: "foreign-owned", tags: ["interstellar-public-link"] });
  assert.equal((await create("foreign-owned")).status, 409);
  const full = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`link-${i}`, "ready"]));
  data.set("links", full);
  assert.equal((await create("one-too-many")).status, 409);
  assert.equal((await create("constructor")).status, 409);
  data.set("links", {});
  for (let i = 0; i < 95; i++) scripts.set(`other-${i}`, { id: `other-${i}` });
  assert.equal((await create("account-full")).status, 409);
  const config = await worker.fetch(new Request(origin + "/api/config"), env);
  assert.deepEqual(await config.json(), { subdomain: "gonicvrnew", ready: true });
  console.log("Passed: public creation, name validation, origin/body/rate limits, no overwrite, shared-service aliases, concurrency, retry recovery, and free-account capacity guards.");
} finally { globalThis.fetch = originalFetch; }
