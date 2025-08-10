# Triathlon Dashboard — Spec v1.1

## 1) Purpose & Scope

* Track **Swim, Bike, Run** training at a glance for three periods: **Last 7 Days**, **This Month (MTD)**, **Year to Date (YTD)**.
* Show **distance** and **time** per sport.
* Add a **fourth card: “Total Time”** (sum of S/B/R time) for each period.

## 2) Data Model & Rules

**Inputs (from Strava):** `sport_type`, `distance` (m), `moving_time` (s), `start_date` (UTC).
**Supported sports:**

* Run: `Run`, `TrailRun`, `VirtualRun`
* Ride: `Ride`, `VirtualRide`, `GravelRide`, `EBikeRide` *(toggle to include/exclude e-bike in totals)*
* Swim: `Swim`

**Periods (timezone aware, default `Europe/Bratislava`):**

* **7d:** from local midnight 6 days ago → local midnight tomorrow (exclusive)
* **MTD:** from 1st of current month (local) → local midnight tomorrow
* **YTD:** from Jan 1 (local) → local midnight tomorrow

**Units/formatting:**

* Distance: **km** (default) or **mi**, one decimal (e.g., `26.8 km`).
* Time: `xh ym` (under 1h → `ym`).
* Numbers animate on update.

**Total Time definition:**

* For each period, **sum `moving_time` of Swim + Bike (+EBike if included) + Run**.
* Exclude all other sports.
* Display **time only** on the Total card (no distance).

## 3) UI / Layout

**Header**

* Title: “🏊🚴🏃 My Triathlon Training”
* Subtext: current date/time, last sync, **Units toggle** (km/mi), **E-bike toggle**.

**Period navigation**

* Tabs or segmented control: **Last 7 Days | This Month | YTD**.
* Desktop: 4-card grid per tab (3 sport cards + Total Time).
* Mobile: vertical stack or swipeable carousel, Total Time appears after the three sport cards.

**Cards**

* **Swim / Bike / Run** cards:

  * Icon + label
  * **Distance** (large) and **Time** (secondary)
  * Subtle sport gradient (Swim: aqua, Bike: amber, Run: teal)
  * Optional tiny sparkline for daily distance within the period
* **Total Time** card:

  * ⏱️ icon + “Total Time”
  * **Time** (large)
  * Muted neutral gradient (e.g., indigo/gray); visually distinct from sport cards
  * Caption: “Sum of Swim, Bike, Run”
* All cards: soft rounded corners (20–24px), gentle shadow, hover/press feedback, subtle entrance animation.

**States**

* Loading skeletons
* Empty state (no activities in range)
* Error banner (API/secrets issues)

## 4) Accessibility & Responsiveness

* Keyboard navigable period tabs
* Text contrast AA+ on light/dark themes
* Card grid collapses 4→2→1 across breakpoints

## 5) Settings

* **Timezone** (default `Europe/Bratislava`)
* **Units**: metric/imperial
* **Include E-bike**: on/off (affects Bike + Total Time)
* Persist preferences in local storage

## 6) API Contract (example)

`GET /totals?tz=Europe/Bratislava&units=metric&include_ebike=false`

```json
{
  "units": "km",
  "7d": {
    "run":  { "distance": 26.8, "time_s": 9120 },
    "ride": { "distance": 132.5, "time_s": 19380 },
    "swim": { "distance": 8.2,  "time_s": 7800  },
    "total_time_s": 36300
  },
  "mtd": {
    "run":  { "distance": 64.2,  "time_s": 21300 },
    "ride": { "distance": 387.0, "time_s": 43200 },
    "swim": { "distance": 12.8,  "time_s": 15600 },
    "total_time_s": 80100
  },
  "ytd": {
    "run":  { "distance": 367.8, "time_s": 122400 },
    "ride": { "distance": 2148.6,"time_s": 246000 },
    "swim": { "distance": 72.5,  "time_s": 83100  },
    "total_time_s": 451500
  }
}
```

## 7) Calculations (server)

For each window:

* Filter activities by local-range → UTC.
* Map to sport category; respect **e-bike** toggle.
* Sum per sport: `distance_m` and `moving_time_s`.
* Compute **`total_time_s = run.time + ride.time + swim.time`**.

## 8) Quality Bar / Acceptance Criteria

* ✅ Totals match manual checks on sample data (±0.1 km, exact seconds).
* ✅ E-bike toggle changes Bike + Total Time but not Swim/Run.
* ✅ Timezone windows align with local midnight boundaries.
* ✅ Mobile and desktop layouts both show **four cards** per period.
* ✅ Light/dark modes legible; animations subtle and performant.
* ✅ API returns in <300ms from cache for typical payloads.