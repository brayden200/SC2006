# ChargeWise SG

ChargeWise SG is an explainable EV-charger decision-support prototype for Singapore. It implements UC-01 through UC-05, UC-07, and UC-08 from `ChargeWise_Use_Cases.md`. UC-06 (vehicle profiles and saved preferences) is intentionally excluded.

The app uses a NestJS API and a responsive React/Vite client, both written in TypeScript. It runs without Docker. LTA DataMall supplies live charging points and availability, while OneMap supplies address geocoding and driving routes. A realistic Singapore charger dataset remains as a clearly labeled fallback so every flow is demonstrable during an outage or before keys are configured.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API is available at [http://localhost:3000/api](http://localhost:3000/api), with a health check at `/api/health`.

Copy `.env.example` to `.env` and add the keys you already obtained:

```dotenv
LTA_ACCOUNT_KEY=your-datamall-account-key
ONEMAP_TOKEN=your-current-onemap-token
```

OneMap tokens expire after three days. Instead of updating `ONEMAP_TOKEN` manually, you can omit it and set `ONEMAP_EMAIL` plus `ONEMAP_PASSWORD`; the backend will obtain and cache a token through OneMap's authentication endpoint. All credentials are read only by NestJS and are never returned to the client.

For separate production builds:

```bash
npm run build
npm run start -w @chargewise/backend
npm run dev -w @chargewise/frontend
```

The Vite development server proxies `/api` to port 3000. To point the frontend elsewhere, set `VITE_API_URL` using `.env.example` as a guide.

## Implemented use cases

| Use case | Implementation |
| --- | --- |
| UC-01 Find compatible stations | OneMap address/postal-code geocoding, LTA compatibility and availability data, radius, power, price and operator filters, map and list views, station details, no-result recovery suggestions, cached-data labeling. |
| UC-02 Recommend best charger | Normalized weighted scoring, OneMap driving time/distance, four ranking presets, top choice plus alternatives, score breakdown, reasons, cost/time estimates, missing-price weight redistribution. |
| UC-03 Compare options | Select 2–4 stations, compare live availability, compatibility, speed, charging duration, cost, travel, hours and operator, with best/weakest highlights and explicit unknown values. |
| UC-04 Monitor charger | 90-minute watchlist, backend 30-second checks, status timestamps, event history, expiry/stop controls, and a deterministic demo-status change for presentations. |
| UC-05 Recommend alternative | Re-ranks available compatible chargers from the latest location, displays added travel time, accepts a replacement and continues monitoring, plus a simplified driving-mode view. |
| UC-07 Charging sessions | Records energy, cost, duration and official-status accuracy; lists history and calculates monthly spend, energy, rate and frequently used stations. |
| UC-08 Availability prediction | Similar-weekday/time-window probability with sample size, confidence indicator, method explanation and insufficient-data handling. |

UC-06 is not present: there is no vehicle-profile or saved-preferences screen. Registered-user flows use the visible demo account, while connector and ranking priorities are chosen per search.

## Data and safety behavior

- The backend calls LTA DataMall `EVCBatch`, follows its short-lived JSON download link, normalizes the documented nested charging-point structure, and caches it for four minutes. `EVChargingPoints` postal-code lookup is also implemented.
- OneMap Search geocodes user input and OneMap Routing supplies driving distance and duration. Responses are cached to respect API limits; route failures fall back to clearly labeled straight-line estimates.
- Every station response identifies its source and includes `lastUpdated`. `/api/integrations/status` reports provider health without exposing credentials.
- `LTA_ACCOUNT_KEY`, `ONEMAP_TOKEN`, `ONEMAP_EMAIL`, and `ONEMAP_PASSWORD` are backend-only and are never referenced by frontend code.
- Unknown prices and statuses stay unknown. They are not fabricated. Operating hours and amenities are omitted because the current LTA batch does not provide them.
- An incompatible connector is removed before recommendation scoring.
- Availability is always presented as a snapshot, never as a reservation or guarantee.
- User-entered charging sessions are labeled `User submitted`.
- Runtime records use in-memory storage and reset when the API restarts. This keeps the prototype self-contained; a database can replace the service stores later without changing the client contract.

## Project structure

```text
app/
  backend/              NestJS API
    src/integrations/   LTA DataMall and OneMap clients, normalization and caches
    src/stations/       Live/cache provider selection and filtering
    src/recommendations Scoring and comparison
    src/monitoring/     Watchlist and alternatives
    src/sessions/       Charging history and summaries
    src/predictions/    Historical availability model
  frontend/             React/Vite client
    src/components/     Shared map, cards and dialogs
    src/pages/          Explore, monitoring and history flows
```

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The automated tests cover connector compatibility, missing-price handling, prediction evidence, and frontend unknown-price formatting.
