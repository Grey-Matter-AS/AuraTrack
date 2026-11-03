# D-13: Health data: read only; views and simple statistics

**Decided:** 2026-11-03, by you, in the native-apps discussion. Part of `../ROADMAP.md`.

## Decision
Read from HealthKit and Health Connect: heart rate and HRV, sleep, activity, SpO2, breathing rate, wrist temperature, menstrual cycle (opt-in). Never written. Shown together with seizures, with simple statistics, the amount of data shown, and neutral wording.

## Why
Reading keeps data on the device; writing would put seizures into stores that sync or that other apps can read. Statistics are subject to your regulatory adviser.
