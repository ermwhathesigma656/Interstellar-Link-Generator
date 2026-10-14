# Interstellar Link Generator

A public form that creates `your-name.gonicvrnew.workers.dev`. Each address forwards to the existing Interstellar Worker through a service binding, including its assets, proxy connections, AI and PC APIs. Updates to Interstellar apply to every generated link.

Public generator: https://generator.gonicvrnew.workers.dev

Second account generator: https://generator.discordaccoutcolmaster.workers.dev

The second account uses `wrangler.new-account.jsonc`. Deploy `wrangler.relay.jsonc` first; it provides the `interstellar` service there and forwards requests to the original site's public address. Then deploy the new generator and set its own account-scoped `CF_API_TOKEN` secret with `--config wrangler.new-account.jsonc`. Both configurations pin the second account ID. The original configuration and generator remain separate. Generated links in the new account still depend on the original Interstellar deployment, including its request limits and availability.

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
- There is no lifetime limit on generated names. Creation stops at 95 live Workers across the account, leaving five slots within Cloudflare's 100-Worker free-plan limit. Deleted links and failed reservations do not consume capacity. Cloudflare's request limits still apply.
- Existing Workers are never deliberately overwritten. The registry serializes creation, checks current Cloudflare names, and only resumes a name reserved by this generator carrying its ownership tag.
- If a request times out, retry the same name. Completed names return their existing link; interrupted uploads resume enabling their public address.
- To remove a generated link, delete that Worker in Cloudflare. This frees capacity for any new name. Its ownership reservation remains so the original name can also be recreated when there is space; it cannot bypass the account capacity guard.

Run `npm test` for validation, origin checks, collisions, quotas, concurrency and interrupted-creation tests. `npm run dev` starts a local preview; set a separate `.dev.vars` token only when testing real creation.
