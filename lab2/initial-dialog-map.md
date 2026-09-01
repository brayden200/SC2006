# ChargeWise SG - Initial Dialog Map

## Scope

This state machine models the current user-interface flow for searching, reviewing, and routing to a charging station. It is an initial Lab 2 dialog map and should be refined alongside the UI and conceptual model in Lab 3.

## Dialog map

```mermaid
stateDiagram-v2
direction TB

[*] --> SearchIdle: application opens

state "Search screen - idle" as SearchIdle
state "Requesting browser location" as GettingSearchLocation
state "Search screen - location ready" as SearchLocationReady
state "Search validation error" as SearchValidationError
state "Ranking compatible chargers" as Searching
state "Results - ranked list and map" as Results
state "Results - cached-data warning" as CachedResults
state "No compatible stations" as NoResults
state "Search/provider error" as SearchError
state "Station details modal" as Details
state "Requesting route origin" as GettingRouteLocation
state "Loading OneMap route" as LoadingRoute
state "Details and route shown" as RouteShown
state "Details with route error" as RouteError

SearchIdle --> GettingSearchLocation: select Use current location
GettingSearchLocation --> SearchLocationReady: permission granted / populate location
GettingSearchLocation --> SearchValidationError: unavailable or permission denied
SearchValidationError --> SearchIdle: edit location
SearchLocationReady --> SearchIdle: edit location or priority

SearchIdle --> SearchValidationError: Search with no location
SearchLocationReady --> Searching: select Search
SearchIdle --> Searching: enter address/postal code and select Search

Searching --> Results: live ranked options returned
Searching --> CachedResults: cached ranked options returned
Searching --> NoResults: zero compatible options
Searching --> SearchError: location or provider request fails

NoResults --> Searching: change location/priority and search again
SearchError --> Searching: correct input/configuration and retry
CachedResults --> Searching: run another search
Results --> Searching: run another search

Results --> Details: select station card or map marker
CachedResults --> Details: select station card or map marker
Details --> Results: close modal
Details --> GettingRouteLocation: select Show route

GettingRouteLocation --> LoadingRoute: permission granted
GettingRouteLocation --> RouteError: unavailable or permission denied
LoadingRoute --> RouteShown: OneMap route returned
LoadingRoute --> RouteError: road route unavailable
RouteShown --> Details: select another station or clear route
RouteShown --> Results: close modal
RouteError --> GettingRouteLocation: retry Show route
RouteError --> Results: close modal
```

## Dialog/state descriptions

| State                   | UI content and permitted actions                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SearchIdle`            | Location input, ranking-priority selector, current-location button, Search button, and provider indicator.               |
| `GettingSearchLocation` | Browser permission is pending; success fills the location field, while failure displays an actionable message.           |
| `Searching`             | Loading feedback explains that compatible chargers are being ranked by savings, speed, and availability.                 |
| `Results`               | Ranked cards and map markers are displayed; the best match is identified and either representation may select a station. |
| `CachedResults`         | The normal result interactions remain available, with a visible snapshot timestamp and fallback reason.                  |
| `NoResults`             | The interface explains that no compatible station was found and invites a revised search.                                |
| `Details`               | A modal displays station, connector, availability, charging, parking, travel, source, and freshness information.         |
| `LoadingRoute`          | Current coordinates and the selected station are sent for a OneMap driving route.                                        |
| `RouteShown`            | Route distance, travel time, and road geometry are shown in the modal/map context.                                       |
| `RouteError`            | The modal remains open and clearly states why a route could not be displayed, allowing retry or close.                   |

## Navigation rules and constraints

- Selecting a station does not reserve it; availability remains a snapshot.
- Search errors and route errors are separate so a route failure does not discard valid station results.
- Closing the details modal returns to the existing ranked results without repeating the search.
- A new search clears any previously selected route and station-specific route error.
- Provider-health polling updates the top-bar status without changing the driver's current dialog state.
