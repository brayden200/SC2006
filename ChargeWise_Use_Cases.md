# ChargeWise SG Use Cases

## 1. System Overview

**Project title:** ChargeWise SG: A Context-Aware EV Charging Recommendation and Availability Monitoring System

ChargeWise SG helps electric-vehicle drivers select a suitable charging station based on live availability, connector compatibility, travel time, charging speed, price, and personal preferences. It can monitor a selected charger and recommend an alternative when conditions change.

The application is intended to be a decision-support system rather than a simple map or data dashboard.

## 2. Actors

| Actor                | Description                                                                      |
| -------------------- | -------------------------------------------------------------------------------- |
| EV driver            | Searches for, compares, selects, and navigates to charging stations.             |
| Registered user      | An EV driver with saved vehicles, preferences, watchlists, and charging history. |
| LTA DataMall         | Supplies charging-station details and availability data.                         |
| OneMap               | Supplies address search, geocoding, and route information.                       |
| System administrator | Monitors API operation, cached data, and system health.                          |

## 3. Use-Case Summary

| ID    | Use case                               | Primary actor   | Priority    |
| ----- | -------------------------------------- | --------------- | ----------- |
| UC-01 | Find compatible charging stations      | EV driver       | Must have   |
| UC-02 | Recommend the best charger             | EV driver       | Must have   |
| UC-03 | Compare charging options               | EV driver       | Must have   |
| UC-04 | Monitor a selected charger             | Registered user | Must have   |
| UC-05 | Recommend an alternative charger       | Registered user | Must have   |
| UC-06 | Manage vehicle profile and preferences | Registered user | Must have   |
| UC-07 | Record and review charging sessions    | Registered user | Should have |

## 4. Detailed Use Cases

### UC-01: Find Compatible Charging Stations

**Primary actor:** EV driver

**Goal:** Find charging stations that are suitable for the user's vehicle and current needs.

**Preconditions:**

- The application is running.
- Charging-station data is available from LTA DataMall or a recent cache.

**Trigger:** The driver chooses to search for a charger.

**Main flow:**

1. The driver provides a current location, destination, or postal code.
2. The driver selects a saved vehicle or specifies a connector type.
3. The system retrieves charging stations near the requested location.
4. The system removes incompatible stations.
5. The system applies optional filters such as availability, distance, charging speed, operator, operating hours, and price.
6. The system displays the matching stations on a map and in a list.
7. The driver selects a station to view its details.

**Alternative flows:**

- **A1 - Location permission denied:** The system asks the driver to enter a postal code or address.
- **A2 - No compatible stations found:** The system suggests increasing the search radius or relaxing optional filters.
- **A3 - Live API unavailable:** The system displays cached results and clearly shows when they were last updated.
- **A4 - Station status unknown:** The system includes the station only if the user allows unknown availability and labels it accordingly.

**Postconditions:** A list of compatible charging stations is displayed.

---

### UC-02: Recommend the Best Charger

**Primary actor:** EV driver

**Goal:** Receive a ranked and explainable recommendation instead of choosing only the nearest charger.

**Preconditions:**

- At least one compatible charging station has been found.
- The system has the driver's location and basic charging requirements.

**Trigger:** The driver requests a recommendation or completes a charger search.

**Main flow:**

1. The system evaluates each compatible station using:
   - current availability;
   - estimated travel time or detour;
   - charging speed;
   - charging price;
   - operating hours; and
   - user preferences.
2. The system calculates a recommendation score for every candidate.
3. The system ranks the candidates by score.
4. The system presents the best option and at least two alternatives.
5. The system explains the important reasons behind the recommendation.
6. The driver accepts a recommendation or selects another station.

**Example initial scoring model:**

```text
Recommendation score =
    30% availability confidence
  + 25% travel time
  + 20% charging speed
  + 15% price
  + 10% user preference
```

The final implementation should normalize values before combining them and allow weights to change according to the user's priorities.

**Alternative flows:**

- **A1 - Price missing:** The system excludes price from the score and redistributes its weight.
- **A2 - Route service unavailable:** The system uses straight-line distance and marks the travel time as unavailable.
- **A3 - All matching chargers occupied:** The system suggests a larger search area or allowing stations with unknown status.

**Postconditions:** The driver has a ranked list and can understand why the top charger was recommended.

---

### UC-03: Compare Charging Options

**Primary actor:** EV driver

**Goal:** Compare several charging stations side by side.

**Preconditions:** At least two stations are present in the search results.

**Main flow:**

1. The driver selects two or more stations.
2. The system compares their:
   - live availability;
   - connector compatibility;
   - charging speed;
   - estimated charging duration;
   - price and estimated charging cost;
   - travel time or detour;
   - operating hours; and
   - operator.
3. The system highlights the strongest and weakest value in each category.
4. The driver selects a preferred station.

**Alternative flow:** If a value is unavailable, the system displays "Unknown" instead of estimating it without evidence.

**Postconditions:** A station is selected or the driver returns to the results.

---

### UC-04: Monitor a Selected Charger

**Primary actor:** Registered user

**Goal:** Be informed if the selected charger becomes occupied or unavailable before arrival.

**Preconditions:**

- The user is signed in.
- The user has selected a station or connector to monitor.

**Main flow:**

1. The user selects "Monitor charger."
2. The system adds the station to a temporary watchlist.
3. The backend checks updated availability at an appropriate interval.
4. The system records the time of every update.
5. If availability changes, the system notifies the user.
6. The user keeps the station, stops monitoring it, or requests an alternative.

**Alternative flows:**

- **A1 - Updates unavailable:** The system warns the user that the displayed status may be stale.
- **A2 - Monitoring expires:** The system stops monitoring after the journey or a configured time limit.

**Postconditions:** Monitoring ends or continues until its expiry time.

---

### UC-05: Recommend an Alternative Charger

**Primary actor:** Registered user

**Goal:** Find a suitable replacement when the selected charger becomes occupied or unavailable.

**Preconditions:**

- A charger is being monitored.
- Its availability has changed or the user has requested another option.

**Main flow:**

1. The system searches around the user's latest known location or current route.
2. The system excludes incompatible and unavailable chargers.
3. The recommendation engine ranks the remaining alternatives.
4. The system shows the best alternative and the additional travel time.
5. The user accepts or rejects the alternative.
6. If accepted, the system updates the selected station and begins monitoring it.

**Safety rule:** While a vehicle is moving, the application should present a simplified notification and avoid requiring detailed interaction.

**Alternative flow:** If no alternative is available, the system recommends expanding the search radius or waiting for the current station.

**Postconditions:** A new charger is selected, or the original choice is retained.

---

### UC-06: Manage Vehicle Profile and Preferences

**Primary actor:** Registered user

**Goal:** Save information used to personalize filtering and recommendations.

**Main flow:**

1. The user creates or edits a vehicle profile.
2. The user enters:
   - vehicle name;
   - supported connector types;
   - maximum supported charging power;
   - battery capacity;
   - typical energy consumption; and
   - optional current range or battery percentage.
3. The user configures preferences such as maximum price, preferred operator, maximum detour, and ranking priorities.
4. The system validates and saves the profile.

**Alternative flow:** If a required value is invalid, the system explains the valid range or format and does not save the profile.

**Postconditions:** The vehicle and preferences are available for future recommendations.

---

### UC-07: Record and Review Charging Sessions

**Primary actor:** Registered user

**Goal:** Maintain a useful history of charging activity and costs.

**Main flow:**

1. The user starts a new charging-session record.
2. As the user types a station name, address, or postal code, the system queries matching stations from the backend.
3. The user selects a station; the system fills the current date and time by default.
4. The user enters the energy added and total cost and may adjust the date.
5. The backend validates the station and saves its authoritative name with the session.
6. The system updates summaries such as monthly cost, energy added, and average cost per kWh.

**Postconditions:** The session appears in the user's charging history.

---

## 5. External Data Requirements

### LTA DataMall

Potential feeds include:

- `EVChargingPoints` for charging points and availability by postal code.
- `EVCBatch` for all charging points and availability.
- `CarParkAvailability` for nearby parking capacity.
- `TrafficSpeedBands` and `TrafficIncidents` for optional traffic-aware recommendations.

The DataMall `AccountKey` must be stored on the backend and must not be exposed in frontend code.

### OneMap

Potential services include:

- address and postal-code search;
- reverse geocoding; and
- route and travel-time calculation.

## 6. Important System Rules

- Always display when availability information was last updated.
- Never guarantee that a charger will still be available when the user arrives.
- Never recommend a connector that is incompatible with the selected vehicle.
- Do not invent missing prices, statuses, or operating hours.
- Distinguish official API data from user-submitted information.
- Cache API responses to reduce unnecessary calls and remain usable during temporary outages.
- Keep external API keys and tokens on the backend.
