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

To enable **Ask ChargeWise**, add an AI API key and model. These values are read only by NestJS and must never use the `VITE_` prefix:

```dotenv
AI_API_KEY=your-api-key
AI_MODEL=gpt-5-mini
# Optional OpenAI-compatible API root; defaults to https://api.openai.com/v1
AI_API_BASE_URL=
```

OneMap tokens expire after three days. Instead of updating `ONEMAP_TOKEN` manually, set `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` and the backend will obtain and cache a token. Credentials are read only by NestJS and are never returned to React.

URA parking data is optional. To enable it, configure `URA_ACCESS_KEY`; `URA_TOKEN` may be supplied when available, otherwise the backend obtains the daily token. HDB car-park metadata is fetched from data.gov.sg without a credential. See `.env.example` for all backend-only settings.

## Implemented use cases

| Use case                       | Implementation                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-01 Find compatible stations | Address/current-location search, LTA compatibility and availability, map/list views, cached-data labeling, and official parking enrichment where a conservative match exists. |
| UC-02 Sort charging options    | Weighted ranking with OneMap travel, four priority presets, automatic connector selection, explanations, hourly charging prices, and published parking rates.                 |
| UC-03 Route to a station       | OneMap driving routes from the driver's current location, with route distance, travel time, map line, and clearly labelled fallback estimates.                                |

## Ask ChargeWise chatbot

The Explore page includes an optional conversational search panel. The browser sends a message, recent conversation turns, coarse location context when available, and selected station IDs to `POST /api/ai/chat`. The NestJS backend asks the configured model for a strict structured intent and filter object, validates and bounds those filters, and then calls the existing recommendation service.

The model does not receive the AI key in the browser and is not the source of station results. LTA DataMall supplies station and availability data, OneMap supplies location and route data, and the existing deterministic backend applies compatibility, price, availability, parking, and ranking calculations. The model is instructed not to invent live facts, and unknown charging prices or parking costs remain unknown rather than being treated as zero or free.

Chat messages are sent to the configured AI provider to interpret the request. Do not enter sensitive or personal information. ChargeWise does not persist chat history, but the configured AI provider may process requests under its own data and retention policies. The chatbot can explain monitoring, but it cannot create or stop monitors; use only the application's explicit controls for those actions.

If `AI_API_KEY` is missing, the provider fails, or the 15-second request timeout is reached, the chatbot shows an error and the normal search form remains available.

### Chat API contract

```http
POST /api/ai/chat
Content-Type: application/json
```

```json
{
  "message": "Find a fast CCS2 charger near Orchard under S$0.60/kWh",
  "conversation": [{ "role": "user", "content": "I prefer fast charging" }],
  "context": {
    "latitude": 1.3,
    "longitude": 103.83,
    "selectedStationIds": []
  }
}
```

The response contains `reply`, `intent` (`search`, `clarification`, or `explanation`), validated `filters`, `needsClarification`, and either a deterministic `recommendation` response or `null`.

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
