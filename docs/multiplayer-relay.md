# Connecting players on different networks

The host runs the campaign in their browser. The game tries a direct connection and can use a TURN relay when the players' networks require one. If the first handshake stalls after the host answers, the guest retries automatically with the same code. When a relay is available, that retry uses it. If the host answers but the browsers cannot connect, trying the same Wi-Fi or using a phone hotspot can help.

## Configure the live game

1. Set up a TURN service for this game with a browser-accessible HTTPS endpoint that returns short-lived credentials. Include a TURN-over-TLS address on TCP port 443 for networks that restrict UDP. Keep the provider's management key on the credential server.
2. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables**. Set `TURN_CREDENTIALS_URL` to the endpoint's public URL. Anyone loading the game can read this URL. The endpoint must allow requests from the game's GitHub Pages origin.
3. Run the **Publish game** workflow and reload the host and guest tabs. The host can then create a room and share the code as usual. Players do not need relay accounts.

With Metered, the credential-specific API key from **TURN Server & SFU → Credentials → Get credential** is designed for browser use. Use the fetch URL issued for that credential. Keep the account-wide Developers secret private. [Metered setup guide](https://www.metered.ca/docs/turn-server-service/quickstart/)

The endpoint may return an array of ICE servers or an object with an `iceServers` array. For example:

```json
{
  "iceServers": [{
    "urls": ["turn:relay.example.org:3478", "turns:relay.example.org:443?transport=tcp"],
    "username": "temporary-username",
    "credential": "temporary-password"
  }]
}
```

For a local build, set `VITE_TURN_CREDENTIALS_URL` before starting Vite. If the endpoint is unset or unreachable, players can still join wherever a direct connection is possible.

## Switch between Metered, Cloudflare and Turnix

The included [relay Worker](../tools/relay-worker.mjs) gives the game a single credential URL. The room host still runs the campaign. You can select the service used by new rooms without updating the game or asking friends to change a setting.

| Provider | Monthly free allowance | Account setup |
| --- | --- | --- |
| Metered | 500 MB, counting incoming and outgoing relay traffic | Reuse the game's existing credential URL. [Pricing](https://www.metered.ca/pricing) |
| Cloudflare Realtime TURN | 1,000 GB of outbound traffic shared with Realtime SFU. Additional usage is $0.05/GB. | Create a TURN key in a Cloudflare account. [Sign up](https://dash.cloudflare.com/sign-up) · [TURN key setup](https://developers.cloudflare.com/realtime/turn/generate-credentials/) · [Pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/) |
| Turnix | 10 GB. On the free plan, new credential requests stop at the limit. | Create a project and a project API token. [Sign up and plans](https://turnix.io/) · [Quickstart](https://turnix.io/docs/getting-started/quickstart) · [Usage limits](https://turnix.io/docs/concepts/usage-limits) |

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Worker**, deploy a starter Worker, then open its code editor. Replace the starter code with the contents of [relay-worker.mjs](../tools/relay-worker.mjs) and deploy.
2. In the Worker's **Settings → Variables and Secrets**, add the values for each provider you want to use. For Metered, copy the game's existing GitHub variable `TURN_CREDENTIALS_URL` into the Worker secret `METERED_CREDENTIALS_URL`. For Cloudflare, add `CLOUDFLARE_TURN_KEY_ID` and the secret `CLOUDFLARE_TURN_TOKEN` supplied with your TURN key. For Turnix, add the secret `TURNIX_API_TOKEN`. Provider management tokens belong in Worker secrets.
3. Add a text variable named `ACTIVE_PROVIDER` with the value `metered`, `cloudflare` or `turnix`. Deploy the settings. Set the game's GitHub Actions variable `TURN_CREDENTIALS_URL` to your Worker's public URL ending in `/ice`, then run **Actions → Publish game → Run workflow** once.
4. To switch again, change only `ACTIVE_PROVIDER` in the Worker and deploy its settings. Have everyone leave and rejoin a newly created room to move all connections, including voice, to the new configuration. Existing connections finish on their original provider.

The Worker issues credentials for this public game. Its origin check limits cross-site browser requests. Anyone able to obtain a game credential can consume its allowance. Check provider usage and billing limits before enabling paid overages.
