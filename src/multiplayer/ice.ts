// The public deployment can point at a broker that issues short-lived TURN credentials.
export async function roomIceServers(endpoint?: string): Promise<RTCIceServer[]> {
  const direct = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  if (!endpoint) return direct;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 4000);
  try {
    const response = await fetch(endpoint, {
      signal: timeout.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    if (!response.ok) return direct;
    const data = await response.json();
    const servers = Array.isArray(data) ? data : data?.iceServers;
    if (!Array.isArray(servers)) return direct;
    const relay: RTCIceServer[] = [];
    for (const server of servers) {
      if (typeof server?.username !== 'string' || typeof server.credential !== 'string') continue;
      const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(
        (url: unknown) => typeof url === 'string' && /^turns?:[\w.-]+(?::\d+)?(?:\?transport=(?:udp|tcp))?$/i.test(url),
      );
      if (urls.length) relay.push({ urls, username: server.username, credential: server.credential });
    }
    return [...direct, ...relay];
  } catch {
    return direct;
  } finally {
    clearTimeout(timer);
  }
}
