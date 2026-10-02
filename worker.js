import { DurableObject } from "cloudflare:workers";

const tag = "interstellar-public-link";
const alias = "export default { fetch(request, env) { return env.INTERSTELLAR.fetch(request); } };";
const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const validName = name => typeof name === "string" && /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(name);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/config" && request.method === "GET") {
      return reply({ subdomain: env.WORKERS_SUBDOMAIN, ready: !!env.CF_API_TOKEN });
    }
    if (url.pathname !== "/api/links") return reply({ error: "Not found." }, 404);
    if (request.method !== "POST") return reply({ error: "Use POST." }, 405);
    if (request.headers.get("Origin") !== url.origin || request.headers.get("Sec-Fetch-Site") === "cross-site") return reply({ error: "Create links from this website." }, 403);
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return reply({ error: "Expected JSON." }, 415);
    const { success } = await env.CREATE_LIMIT.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
    if (!success) return reply({ error: "Please wait one minute before creating another link." }, 429);
    let text = "";
    if (Number(request.headers.get("Content-Length")) > 256) return reply({ error: "Name is too long." }, 413);
    if (request.body) for await (const chunk of request.body) {
      text += new TextDecoder().decode(chunk);
      if (text.length > 256) return reply({ error: "Name is too long." }, 413);
    }
    let name;
    try { name = JSON.parse(text).name?.trim().toLowerCase(); } catch {}
    if (!validName(name)) return reply({ error: "Use 3–40 letters, numbers or hyphens. Start with a letter and end with a letter or number." }, 400);
    if (!env.CF_API_TOKEN) return reply({ error: "The site owner needs to connect Cloudflare before links can be created." }, 503);
    return env.LINKS.getByName("registry").fetch("https://registry/create", { method: "POST", body: JSON.stringify({ name }) });
  },
};

export class LinkRegistry extends DurableObject {
  fetch(request) {
    // ponytail: serialize all creation; at most 50 links, no distributed queue needed.
    return this.ctx.blockConcurrencyWhile(async () => {
      try { return await this.create((await request.json()).name); }
      catch { return reply({ error: "Cloudflare could not finish this link. Wait a minute, then retry the same name." }, 502); }
    });
  }
  async cloudflare(path, options = {}) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.env.CF_ACCOUNT_ID}/workers/${path}`, {
      ...options, headers: { ...options.headers, Authorization: `Bearer ${this.env.CF_API_TOKEN}` }, signal: AbortSignal.timeout(8000),
    });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error("Cloudflare request failed");
    return body.result;
  }
  async create(name) {
    if (!validName(name) || [this.env.INTERSTELLAR_SERVICE, "schoolwork", "schoolworkv2", "generator", "interstellar-links"].includes(name)) return reply({ error: "That name is reserved. Choose another." }, 409);
    const links = await this.ctx.storage.get("links") || {};
    const reserved = Object.hasOwn(links, name);
    const scripts = await this.cloudflare("scripts");
    const existing = scripts.find(script => script.id === name);
    if (existing && (!reserved || !existing.tags?.includes(tag))) return reply({ error: "That name is already in use. Choose another." }, 409);
    const url = `https://${name}.${this.env.WORKERS_SUBDOMAIN}.workers.dev`;
    if (existing && links[name] === "ready") return reply({ url, existing: true });
    if (!reserved && (Object.keys(links).length >= 50 || scripts.length >= 95)) return reply({ error: "The link generator has reached its limit. Use an existing link or contact the site owner." }, 409);
    // Reserve before uploading: retries can safely finish an interrupted creation.
    links[name] = "creating";
    await this.ctx.storage.put("links", links);
    if (!existing) {
      const form = new FormData();
      form.set("metadata", new Blob([JSON.stringify({ main_module: "alias.js", compatibility_date: "2026-10-01", tags: [tag],
        bindings: [{ type: "service", name: "INTERSTELLAR", service: this.env.INTERSTELLAR_SERVICE }] })], { type: "application/json" }));
      form.set("alias.js", new Blob([alias], { type: "application/javascript+module" }), "alias.js");
      await this.cloudflare(`scripts/${name}`, { method: "PUT", body: form });
    }
    await this.cloudflare(`scripts/${name}/subdomain`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true, previews_enabled: false }) });
    links[name] = "ready";
    await this.ctx.storage.put("links", links);
    return reply({ url }, 201);
  }
}
