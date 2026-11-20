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
