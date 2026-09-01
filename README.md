# ChargeWise SG

ChargeWise helps an EV driver answer: “Which nearby charger is currently available, compatible, and suitable after considering travel, charging speed, charging price per hour, and parking rates?”

It is a TypeScript monorepo with a NestJS API and a responsive React/Vite client. LTA DataMall supplies live charging points and availability; OneMap supplies Singapore geocoding and driving routes.

## Requirements and local run

- Node.js 20 or newer
- npm 10 or newer

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API is available at [http://localhost:3000/api](http://localhost:3000/api), with a health check at `/api/health`.

Add the backend credentials you already have to `.env`:

```dotenv
LTA_ACCOUNT_KEY=your-datamall-account-key
ONEMAP_TOKEN=your-current-onemap-token
```

OneMap tokens expire after three days. Instead of updating `ONEMAP_TOKEN` manually, set `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` and the backend will obtain and cache a token. Credentials are read only by NestJS and are never returned to React.

URA parking data is optional. To enable it, configure `URA_ACCESS_KEY`; `URA_TOKEN` may be supplied when available, otherwise the backend obtains the daily token. HDB car-park metadata is fetched from data.gov.sg without a credential. See `.env.example` for all backend-only settings.

## Implemented use cases

| Use case                       | Implementation                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-01 Find compatible stations | Address/current-location search, LTA compatibility and availability, map/list views, cached-data labeling, and official parking enrichment where a conservative match exists. |
| UC-02 Sort charging options    | Weighted ranking with OneMap travel, four priority presets, automatic connector selection, explanations, hourly charging prices, and published parking rates.                 |
| UC-03 Route to a station       | OneMap driving routes from the driver's current location, with route distance, travel time, map line, and clearly labelled fallback estimates.                                |

There are no accounts, authentication, charging logs, charging history, payments, reservations, cloud sync, or push notifications.

## Parking data and limitations

- URA car-park details and rates come from the official [URA Data Service](https://eservice.ura.gov.sg/maps/api/) and are cached in backend memory for up to one day.
- HDB car-park locations come from the official [HDB Carpark Information dataset](https://data.gov.sg/datasets/d_23f946fa557947f93a8043bbef41dd09/view). The backend combines that metadata with HDB's published [short-term parking charges](https://www.hdb.gov.sg/parking/other-parking-matters/shortterm-parking/shortterm-parking-charges).
- The application does not use the old 2018 LTA “Carpark Rates” dataset, scrape private malls/developments, or invent private-carpark rates.
- A charger is associated only when identifier/address/name evidence and conservative proximity support the match. A questionable match returns `parking: null`.
- Published rate text is shown when available. A numeric parking estimate is produced only for supported structured weekday, Saturday, Sunday/public-holiday, time-band, per-unit, or per-entry rules. Ambiguous text remains `rate_only`.
- Hourly cost is derived from the published charging price per kWh, selected connector power, and one hour of parking when an official tariff is available. If parking is unavailable, the displayed rate is charging-only; no total visit cost is calculated.
- Unknown parking is never treated as zero or free. Private-carpark rates remain unavailable.

## Runtime state and caching

No user state is persisted. LTA, OneMap, URA, and HDB provider caches are transient backend memory caches. The app does not persist charger snapshots, routes, searches, sessions, or user history.

`/api/integrations/status` reports provider configuration, health, last success, and last error without exposing secrets.

## Project structure

```text
app/
  backend/
    src/integrations/   LTA, OneMap, URA, HDB, matching, tariffs, and caches
    src/stations/       Live station refresh and filtering
    src/recommendations Weighted station sorting
  frontend/
    src/components/     Map, station cards, details, and routing
    src/pages/          Search and sorting flows
docs/                   Use-case diagram
```

## Verification

```bash
npm run format:check
npm run typecheck
npm test
npm run build
```
