# M7: how phones reach the hub (https), the Content Security Policy, and person keys

**Decided 2026-11-02** with the user, while building M7 run 1 (`docs/plan/M7-log.md`). Written so that, when someone asks "why is it like this?", the reasons are here. Read `docs/plan/M7-plan.md` first for what the hub is.

## 1. The hub must be reached over https

**Context.** The app is an https page (Vercel). Browsers refuse to let an https page call an http address (mixed content). The only exception is `localhost` / `127.0.0.1` on the same computer. A hub at `http://192.168.1.20:8420` therefore cannot be used from a phone. This is a browser rule; the app cannot turn it off.

**Decision.** The hub serves https when given a certificate (`HUB_CERT`, `HUB_KEY`), and the status page explains two routes. **The household chooses; neither is forced.** The app's Connect-a-hub form refuses an address that is not https (except localhost).

| | Tailscale certificate | Own certificate trusted on each phone |
|---|---|---|
| Works away from home | Yes (phones reach the computer over the Tailscale network) | No, home Wi-Fi only |
| Account / software | Free Tailscale account, Tailscale app on every phone and on the hub computer | None |
| Trust on the phone | Nothing to install: it is a normal publicly trusted certificate | Install the certificate on each phone (iPhone: profile + Certificate Trust Settings; Android: user certificate) |
| Renewal | About every 90 days: re-run `tailscale cert` and reload the hub | iOS limits trusted certificates to about 13 months |
| Address stability | A stable name (`<machine>.<tailnet>.ts.net`) | The certificate must match the address used, so the computer needs a fixed address or a `.local` name; a new address breaks it |
| Security trade-off | The certificate's name appears in public certificate logs (the name, not who uses it) | A certificate authority you trust on your phones could impersonate any site to those phones if its key leaks: keep that key off the hub, limit the certificate to the hub's name |

**Why both, not one, and which is the secure default.** Tailscale is the safer route: the certificate is publicly trusted, so no extra authority is installed on any phone, and it works away from home. It is the one the wizard and the status page recommend. Some households will not use an account or a third-party service; for them the own-certificate route stays possible, but with a condition for privacy: make a certificate for the hub's single name only (a leaf certificate), not a certificate authority, and trust only that on the phones, so a leaked key cannot impersonate other sites.

**Consequence of doing neither.** The hub cannot be used from phones. Nothing else is lost: the household still syncs when two devices are open at the same time (M6), by file or QR, and recording is unaffected.

**Known follow-up.** The hub reads its certificate at start. Renewal needs a restart (or a reload on a signal). Add automatic reload in run 2.

## 2. The Content Security Policy (`vercel.json`, `connect-src`)

**Context.** The CSP lists the addresses the page may talk to. Before M6 it allowed only itself. M6 added the PeerJS broker. A hub is at an address we cannot know when we build the app, so the list cannot name it.

**Options considered.**
- **A. Widen to `https:` and `wss:`.** Works for every household and every certificate route. But the page could then send data to any https server. The CSP is defence in depth: if an attacker ever got code running in the page, today it could not send what the page shows (decrypted records) anywhere. After A it could. What still protects: `script-src 'self'` (no third-party scripts), data decrypted only after the PIN, the hub holding only sealed data. Rejected: the loss is real and avoidable.
- **B. Serve the app from the hub (`HUB_APP`).** No CSP change (the hub is "self"). Consequences: a different address is a different browser storage, so records at the Vercel address are not visible (move them with backup and restore, or join as a new device), and it must be decided before the household starts; the installed home-screen app is tied to one address; app updates depend on the hub's copy being updated; the first install needs the hub on. And **the hub then serves the app's code**: a compromised hub could serve altered code that reads decrypted data. Today a hub that stores only sealed data is trusted with nothing readable; with B it is trusted completely. Acceptable for a household's own computer, but it is a different trust level, so it is an option, not the default.
- **C. Allow only Tailscale names:** add `https://*.ts.net wss://*.ts.net`. Covers Tailscale households, much narrower than A. Not airtight (anyone can have a `.ts.net` name, including publicly through Tailscale's Funnel feature), so it raises the bar rather than closing it.

**Decision (changed the same day, at the user's request to choose the most secure option that protects privacy): B only. The CSP is not widened.** `vercel.json` keeps `connect-src 'self'` plus the PeerJS broker added in M6, and nothing else. A household that uses a hub **opens the app from the hub's own address** (`HUB_APP`, the `app/` folder of the package), so the hub is "self" and the browser allows the calls. A and C are not used.

**Status: nothing to apply.** `vercel.json` is unchanged by M7. (An earlier version of this note chose C; the edit was blocked by a permission check, and the user then chose the stricter option, so the line was never added.)

**Why B and not C or A.** Privacy is the point of this app. Any widening of `connect-src` lets code that ever ran in the page send decrypted records to a server we do not control; C narrows that, but cannot close it (a `.ts.net` name can be public through Funnel). B keeps that protection exactly as it is. B's price is real and accepted knowingly: (1) the hub computer is trusted with the app's code, not only with sealed data, so it must be a computer the household fully trusts and keeps up to date; (2) a different address is a different browser storage, so a household decides this before it starts (or moves records by backup and restore); (3) app updates come from the hub's copy. We judged a household's own computer an acceptable trust anchor, and the hub's data is still sealed in any case; we did not judge it acceptable to give every page of the app a way out to any https server.

**Consequence to remember.** Every household with a hub, on either certificate route, opens the app from the hub's address. The Connect-a-hub form tells a user who is on a different address to do so. Hubless households are unaffected and keep using the app at its usual address. If this proves too inconvenient, option C is the next step and is one line in `vercel.json`; that is a decision to take again then, not now.

## 3. Person keys never go through the hub

**Context.** Each person's records are sealed with that person's own key; a device only receives the keys of the people it keeps. Everything the hub carries for the household (the device list, the household keys) is sealed with the **household key, which every device holds**.

**Decision.** The hub carries sealed entries and the household's device list and household keys. **It never carries a person's key.** Person keys travel only at pairing (the inviter sends the keys the new device will keep) and when two devices meet directly (M6; over the internet through the hub's connection finder when both are open at the same time).

**Why.** If person keys were sealed with the household key, any device could read the key of a person it does not keep, so "a device only gets the people it keeps" would hold only because our code behaves, not because the encryption enforces it. The guarantee is kept because the cost (below) is small for most households.

**Consequences.**
- A new device is fine: pairing gives it the keys.
- After a device is removed, the person keys are replaced. The device that did the removal has the new ones; each other device gets them the next time it meets that device (or one that has them) directly, both open at the same time. A new person added on one device likewise.
- Until then the hub delivers the sealed entries but the device cannot open them. They are counted as "rejected" and appear once the keys arrive (tested: `apps/server/src/hubSync.test.ts`, "missed the key change").
- **Gap to close in run 2:** the app shows nothing about this. Add a plain notice: "N changes cannot be opened yet; open this device together with <name> once."
- Households whose phones are never open together would stall after a removal or a new person until two of them meet once.

**Option kept open: device-targeted key delivery through the hub.** Give each device its own key pair (the public half in the device list). A person's key is sealed so that only the intended device can open it, and the hub carries it. This removes the stall and keeps the guarantee. Cost: a key pair per device, a change to the device list, a new message type, tests (moderate). **Decided 2026-11-02 (the most private option): build it in run 2.** It keeps the guarantee that a device only ever receives the people it keeps, and removes the stall. Sealing person keys with the household key is rejected (see above).

## Where this is applied
- Code: `apps/server/src/hub.ts`, `http.ts` (https via `HUB_CERT`/`HUB_KEY`, serving the app via `HUB_APP`), `packages/sync/src/hub.ts` (what goes through the hub), `apps/web/src/screens/Household.tsx` (https check).
- Docs: `apps/server/README.md`, the status page text, `docs/plan/M7-log.md`.
- Config: `vercel.json` is unchanged.
