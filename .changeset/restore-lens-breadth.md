---
"humanity-plus-commons": patch
---

Three lens definitions reworded in 0.3.0 had quietly narrowed what they check; they're restored to full breadth in our own phrasing. `zombies` Boundaries covers time edges again (expiry at the boundary, clock rollover, DST — not only timeouts), Many covers concurrency again (async interleaving and ordering races — not only parallel access), and `triage`'s always-high rule covers any authentication (API keys and service-to-service auth included — not only user sign-in and sessions).
