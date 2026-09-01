# ChargeWise SG - Entity Class Diagram

## Purpose and scope

This initial conceptual model captures the domain information needed to find, rank, inspect, and route to compatible EV charging stations. It reflects the current ChargeWise SG search-and-route scope: data is transient, and the system has no user accounts, reservations, payments, or charging history.

## Entity class diagram

```mermaid
classDiagram
direction LR

class SearchRequest {
  +String query
  +ConnectorType connectorPreference
  +RankingPriority rankingPriority
  +Number radiusKm
  +Boolean availableOnly
  +Boolean includeUnknown
  +Number minimumPowerKw
  +Number maximumPricePerKwh
  +String operator
  +Number intendedEnergyKwh
}

class Location {
  +Number latitude
  +Number longitude
  +String label
}

class ChargingStation {
  +String stationId
  +String name
  +String address
  +String postalCode
  +Number latitude
  +Number longitude
  +String operator
  +Number pricePerKwh
  +String source
  +DateTime lastUpdated
}

class Connector {
  +ConnectorType type
  +Number powerKw
  +Number totalCount
  +Number availableCount
  +AvailabilityStatus status
}

class ParkingInformation {
  +String carParkId
  +String name
  +ParkingProvider provider
  +String publishedRateText
  +String sourceName
  +URL sourceUrl
  +DateTime lastUpdated
  +MatchConfidence matchConfidence
  +String associationLabel
}

class RankedChargingOption {
  +Number rank
  +Number recommendationScore
  +ConnectorType selectedConnector
  +Number distanceKm
  +Number travelMinutes
  +TravelSource travelSource
  +Number estimatedHourlyCost
  +Boolean hourlyCostIncludesParking
  +String[] recommendationReasons
}

class SearchResult {
  +Number totalMatches
  +Boolean cached
  +DateTime lastUpdated
  +String fallbackReason
}

class DrivingRoute {
  +Number distanceKm
  +Number travelMinutes
  +TravelSource source
  +Coordinate[] path
}

class ProviderStatus {
  +String providerName
  +Boolean configured
  +ProviderState state
  +String lastError
  +DateTime lastSuccessfulRequest
}

class ConnectorType {
  <<enumeration>>
  CCS2
  Type2
  CHAdeMO
}

class RankingPriority {
  <<enumeration>>
  Balanced
  Availability
  Speed
  Savings
}

class AvailabilityStatus {
  <<enumeration>>
  available
  busy
  offline
  unknown
}

class TravelSource {
  <<enumeration>>
  OneMap
  StraightLineEstimate
}

SearchRequest "1" *-- "1" Location : search centre
SearchResult "1" *-- "1" Location : resolved location
SearchResult "1" *-- "0..*" RankedChargingOption : contains
SearchResult "1" o-- "1..*" ProviderStatus : reports freshness
RankedChargingOption "0..*" --> "1" ChargingStation : evaluates
RankedChargingOption "1" --> "1" Connector : selects
RankedChargingOption "1" o-- "0..1" DrivingRoute : uses
ChargingStation "1" *-- "1..*" Connector : offers
ChargingStation "1" o-- "0..1" ParkingInformation : matched parking
DrivingRoute "1" --> "1" Location : starts at
DrivingRoute "0..*" --> "1" ChargingStation : ends at
SearchRequest --> ConnectorType
SearchRequest --> RankingPriority
Connector --> ConnectorType
Connector --> AvailabilityStatus
DrivingRoute --> TravelSource
```

## Relationship notes

- A `ChargingStation` owns one or more `Connector` records because availability, power, and status belong to a particular connector type.
- `ParkingInformation` is optional. An uncertain car-park match is omitted rather than treated as free parking.
- A `RankedChargingOption` evaluates one station using one selected connector. It stores derived values and explanations without changing the source station data.
- A `DrivingRoute` is optional because ChargeWise can still rank a station using a clearly labelled straight-line estimate when a OneMap road route is unavailable.
- `ProviderStatus` records whether displayed information is live, cached, unavailable, or not configured.

## Modelling assumptions

- Monetary and time estimates may be unknown; nullable numeric attributes must not silently become zero.
- Availability is a time-stamped snapshot, not a reservation or guarantee.
- Search requests, results, routes, and provider snapshots exist only for the current application session.
