# Interstellar Link Generator

A public form that creates `your-name.gonicvrnew.workers.dev`. Each address forwards to the existing Interstellar Worker through a service binding, including its assets, proxy connections, AI and PC APIs. Updates to Interstellar apply to every generated link.

Public generator: https://generator.gonicvrnew.workers.dev

## Deploy

1. Run `npm install` and `npx wrangler login`.
2. Set your account, subdomain and existing Interstellar service in `wrangler.jsonc`.
3. Create a Cloudflare API token with **Account → Workers Scripts → Edit**, restricted to this one account. Save it only as a secret: `npx wrangler secret put CF_API_TOKEN`.
4. Run `npm test` and `npm run deploy`.

No token belongs in this repository, the browser, or a generated Worker. Generated Workers receive only a service binding.

The current Interstellar deployment routes AI/PC requests from aliases to its original backend so accounts stay shared. Users sign in separately on each hostname with the same account credentials.

## Limits and recovery

- Public creation: two attempts per IP per minute.
- Names: 3–40 lowercase letters, digits or hyphens, starting with a letter and ending with a letter/digit.
- Maximum 50 generated names; stop if the account already contains 95 Workers. This leaves room within the free account's Worker limit. Cloudflare's request limits still apply.
- Existing Workers are never deliberately overwritten. The registry serializes creation, checks current Cloudflare names, and only resumes a name reserved by this generator carrying its ownership tag.
- If a request times out, retry the same name. Completed names return their existing link; interrupted uploads resume enabling their public address.
- To remove a generated link, delete that Worker in Cloudflare. Its registry reservation remains, so its original name can be recreated without consuming another slot.

Run `npm test` for validation, origin checks, collisions, quotas, concurrency and interrupted-creation tests. `npm run dev` starts a local preview; set a separate `.dev.vars` token only when testing real creation.
