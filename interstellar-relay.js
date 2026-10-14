// Keep aliases in the second account connected to the existing site and account backend.
export default {
  async fetch(request) {
    const original = new URL(request.url);
    const upstream = new URL(request.url);
    upstream.protocol = "https:";
    upstream.hostname = "interstellar.gonicvrnew.workers.dev";
    upstream.port = "";
    const headers = new Headers(request.headers);
    headers.delete("Host");
    // Translate only a same-origin request; foreign origins must still fail the site's checks.
    if (headers.get("Origin") === original.origin) headers.set("Origin", upstream.origin);
    const response = await fetch(new Request(upstream, new Request(request, { headers })), { redirect: "manual" });
    if (response.status === 101) return response;
    const result = new Response(response.body, response);
    const location = result.headers.get("Location");
    if (location) {
      const next = new URL(location, upstream);
      if (next.origin === upstream.origin) {
        next.protocol = original.protocol;
        next.host = original.host;
        result.headers.set("Location", next.href);
      }
    }
    if (result.headers.get("Access-Control-Allow-Origin") === upstream.origin) {
      result.headers.set("Access-Control-Allow-Origin", original.origin);
    }
    return result;
  },
};
