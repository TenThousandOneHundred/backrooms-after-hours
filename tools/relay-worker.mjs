// Optional Cloudflare Worker. The owner selects the active provider in Worker settings.
export default {
  async fetch(request, env) {
    const origin = 'https://tenthousandonehundred.github.io';
    if (new URL(request.url).pathname !== '/ice' || request.method !== 'GET')
      return new Response(null, { status: 404 });
    if (request.headers.get('Origin') !== origin) return new Response(null, { status: 403 });
    const headers = { 'Access-Control-Allow-Origin': origin, 'Cache-Control': 'no-store', Vary: 'Origin' };
    const unavailable = () => new Response('Relay unavailable', { status: 503, headers });
    const options = { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 14400 }), redirect: 'manual' };
    let url;
    switch (env.ACTIVE_PROVIDER) {
      case 'cloudflare':
        if (!env.CLOUDFLARE_TURN_KEY_ID || !env.CLOUDFLARE_TURN_TOKEN) return unavailable();
        url = 'https://rtc.live.cloudflare.com/v1/turn/keys/' + encodeURIComponent(env.CLOUDFLARE_TURN_KEY_ID) + '/credentials/generate-ice-servers';
        options.headers.Authorization = 'Bearer ' + env.CLOUDFLARE_TURN_TOKEN;
        break;
      case 'turnix':
        if (!env.TURNIX_API_TOKEN) return unavailable();
        url = 'https://turnix.io/api/v1/credentials/ice';
        options.headers.Authorization = 'Bearer ' + env.TURNIX_API_TOKEN;
        const client = request.headers.get('CF-Connecting-IP');
        if (client) options.headers['X-TURN-CLIENT-IP'] = client;
        break;
      case 'metered':
        if (!env.METERED_CREDENTIALS_URL) return unavailable();
        url = env.METERED_CREDENTIALS_URL;
        break;
      default: return unavailable();
    }
    try {
      const upstream = await fetch(url, env.ACTIVE_PROVIDER === 'metered' ? { redirect: 'manual' } : options);
      if (!upstream.ok) return unavailable();
      const data = await upstream.json();
      const iceServers = Array.isArray(data) ? data : data?.iceServers;
      if (!Array.isArray(iceServers)) return unavailable();
      return Response.json({ iceServers }, { headers });
    } catch {
      return unavailable();
    }
  },
};
