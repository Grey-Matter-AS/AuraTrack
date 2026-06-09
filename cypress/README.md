This Cypress suite intentionally covers one seeded core-flow journey and one mobile-layout journey.

The old dual-context IndexedDB isolation test is not ported here. Cypress is strong for single-install end-to-end coverage, but it is not a trustworthy fit for validating two independently installed app contexts with separate storage partitions in one repeatable run. For this release, that scenario should stay in the manual verification checklist unless we later introduce a dedicated multi-context harness.
