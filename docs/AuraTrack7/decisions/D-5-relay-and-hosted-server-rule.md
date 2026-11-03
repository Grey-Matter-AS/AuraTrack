# D-5: The sealed push relay and the new hosted-server rule

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
Rule, new wording: "No records on any hosted server. The only hosted part is the push relay: opt-in at household setup, it passes on sealed alerts it cannot read and keeps nothing." One relay shared by all households, on Google Cloud Run in `europe-north1`, free tier, with sealed addresses, signed and sealed alerts, constant size, no database, no logs, least-privilege keys, OIDC deploys, budget alert.

## Why
Only Apple's push service can wake a closed iPhone app away from home, and only a sender holding the project's push key can use it; the key can't be put in an open-source app. Full parity in mixed households (Android recording, iPhone alerted) needs a sender. Hosting at Google adds no new party, since Android alerts already pass through Google. A stolen relay can block alerts but never read or fake them.
