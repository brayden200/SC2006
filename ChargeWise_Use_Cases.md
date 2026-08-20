# ChargeWise SG - Implemented Use Cases

## 1. Scope

This document describes only user-facing use cases that are implemented in the current React frontend and NestJS backend. The existing use-case IDs are retained so that they remain consistent with the README and codebase.

The current application has no authentication, account management, saved vehicle profile, saved preferences, external navigation, charger reservation, payments, push notifications, or charging history. Monitoring records are stored in a local backend file and monitoring runs only while the local ChargeWise backend is running.

## 2. Actors

| Actor                    | Description                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| EV driver                | Searches for, evaluates, compares, and monitors EV charging stations.                                        |
| LTA DataMall             | Secondary actor that supplies charging-station and availability data to the backend.                         |
| OneMap                   | Secondary actor that supplies Singapore address search and driving-route data to the backend.                |
| URA                      | Secondary actor that supplies official car-park details and published rates when configured.                 |
| HDB / data.gov.sg        | Secondary actor that supplies HDB car-park metadata, combined with HDB's published short-term parking rules. |
| Browser location service | Secondary actor that supplies the driver's current coordinates after permission is granted.                  |

## 3. Use-Case Summary

| ID    | Use case                                | Primary actor | Priority |
| ----- | --------------------------------------- | ------------- | -------- |
| UC-01 | Find compatible charging stations       | EV driver     | High     |
| UC-02 | Receive a ranked charger recommendation | EV driver     | High     |
| UC-03 | Compare charging options                | EV driver     | High     |
| UC-04 | Monitor charger availability            | EV driver     | High     |
| UC-05 | Find and accept an alternative charger  | EV driver     | High     |

## 4. Use-Case Descriptions

### UC-01: Find Compatible Charging Stations

**Actor:** EV driver

**Description:** Allows an EV driver to search for charging stations near a Singapore address, postal code, or current location and filter the results to match the driver's immediate charging requirements.

**Preconditions:**

1. The application is running.
2. The backend has retrieved at least one charging station from LTA DataMall.
3. OneMap is configured when the driver searches by address or postal code, unless the query matches a station already present in the live station data.

**Postconditions:** Matching stations are displayed in a ranked list and on an interactive map, or the system displays a no-results message with recovery suggestions.

**Priority:** High

**Frequency of use:** High

**Flow of events:**

1. The system displays a location field, connector selector, ranking-priority selector, and search filters.
2. The driver enters a Singapore address or postal code.
3. The driver optionally selects a connector type: CCS2, Type 2, CHAdeMO, or any connector.
4. The driver optionally configures the following implemented filters:
   - search radius from 2 km to 25 km;
   - available chargers only;
   - include stations whose availability is unknown;
   - minimum charging power, including the 100+ kW quick filter;
   - maximum known price per kWh;
   - operator; and
   - intended energy to add, which is used for estimates.
5. The driver selects **Search**.
6. The backend resolves the search location and retrieves the current LTA charging-station snapshot.
7. The backend removes stations outside the radius and stations that do not satisfy the selected filters.
8. The system displays the matching stations in a list and as selectable map markers.
9. The backend attempts to associate each charger with an official URA or HDB car park using identifier, address/name, and conservative geographic evidence. Uncertain associations are omitted.
10. For each displayed station, the system shows its selected connector, distance, availability, charging power, travel estimate, charging price when known, published parking rate when matched, charging/parking estimates, recommendation score, and data-update time.
11. The driver may select **View details** on a station card or select a map marker to view the station's address, operator, postal code, connector details, charging/parking estimates, data sources, and freshness.

**Alternative flows:**

- **AF-S2 - Use current location:** The driver selects the location button and grants browser location permission. The browser supplies coordinates, and the driver then selects **Search**.
- **AF-S8 - No matching stations:** The system displays suggestions to increase the radius, try another connector, or allow unknown availability. Implemented suggestion buttons can increase the radius to 20 km or enable unknown availability; the driver must search again.
- **AF-S8 - Cached provider snapshot:** If a previously retrieved LTA snapshot remains available after a provider error, the system labels the results as cached and shows the last-update time and fallback reason.
- **AF-S10 - View another station:** The driver closes the details modal or selects a different station or map marker.

**Exceptions:**

1. If no location or coordinates are provided, the system asks the driver to enter an address or postal code or use the current location.
2. If browser location is unavailable or permission is denied, the system asks the driver to enter an address or Singapore postal code.
3. If the location cannot be resolved, the system displays the backend error and does not show results.
4. If live charging data has never been loaded or is not configured, the system displays an availability/configuration error and does not fabricate station data.

**Includes:** UC-02 Receive a Ranked Charger Recommendation

**Special requirements:** LTA and OneMap credentials remain in the backend. Unknown values remain labelled as unknown.

**Assumptions:** Availability is a snapshot and does not reserve a charger or guarantee that it will remain available.

**Notes and issues:** The station-details modal contains a visible **Directions** button, but no navigation action is connected to it; directions are therefore not an implemented use case.

---

### UC-02: Receive a Ranked Charger Recommendation

**Actor:** EV driver

**Description:** Allows an EV driver to receive explainable, ranked charging-station options based on the selected search criteria and ranking priority.

**Preconditions:**

1. UC-01 has resolved a location and found at least one station matching the active filters.
2. At least one compatible connector can be selected for each candidate station.

**Postconditions:** The system displays a best match followed by the remaining ranked compatible stations.

**Priority:** High

**Frequency of use:** High

**Flow of events:**

1. During a station search, the driver selects one of four implemented ranking priorities: Balanced, Availability, Speed, or Savings.
2. The system selects the requested connector or, when **Any connector** is selected, chooses a connector for each station using availability and charging speed.
3. The backend attempts to obtain OneMap driving distance and travel time for up to the first eight search candidates.
4. For candidates without a OneMap route, the backend calculates straight-line distance and an estimated travel time.
5. The system normalizes and combines availability, travel time, charging speed, estimated total visit cost when complete, and operator preference using the selected priority's weights.
6. When charging or parking cost is unknown, the system removes the cost component and redistributes the effective weight across the remaining components; unknown parking is never treated as free.
7. The system calculates estimated charging time from the intended energy and connector power when charging power is known.
8. The system calculates estimated charging cost and evaluates the same charging duration as a parking duration against supported official tariffs. It calculates an estimated total only when both components are known.
9. The system sorts the candidates by score and labels the first station as **Best match**.
10. The system displays up to three reasons for each recommendation, such as current availability, charging speed, proximity, estimated parking cost, incomplete parking data, operator match, or the connector selected.

**Alternative flows:**

- **AF-S3 - Route unavailable:** The system uses straight-line distance and labels the travel source as an estimate.
- **AF-S6 - Charging or parking cost unavailable:** The system displays the known component separately and excludes incomplete visit cost from the station's score.
- **AF-S9 - Fewer than three results:** The system displays only the number of ranked stations that are available.

**Exceptions:** If a candidate has no compatible connector, the backend rejects it rather than ranking an incompatible charging option.

**Includes:** None

**Special requirements:** The recommendation must remain explainable and must identify whether travel data came from OneMap or a straight-line estimate.

**Assumptions:** A higher score indicates a better match for the selected ranking priority; it is not a guarantee of charger availability on arrival.

**Notes and issues:** Ranking priorities are chosen for each search and are not saved to a user profile.

---

### UC-03: Compare Charging Options

**Actor:** EV driver

**Description:** Allows an EV driver to compare two to four stations from the current ranked search results side by side.

**Preconditions:**

1. UC-01 and UC-02 have produced at least two ranked stations.
2. The current search location and intended energy amount are available.

**Postconditions:** The driver selects a preferred station for detailed viewing or closes the comparison and returns to the search results.

**Priority:** High

**Frequency of use:** Medium

**Flow of events:**

1. The driver selects **Compare** on two to four station cards.
2. The system displays a comparison tray showing how many stations are selected.
3. The driver selects **Compare side by side**.
4. The backend compares the selected stations using the connector preference and intended energy from the current search.
5. The system displays each station's:
   - connector used;
   - current availability;
   - charging power;
   - estimated charging time;
   - price per kWh;
   - estimated charging cost;
   - published parking rate/status;
   - estimated parking cost;
   - estimated total visit cost;
   - travel time and travel-data source; and
   - operator.
6. The system highlights the best and weakest known numeric values for availability, power, charging time, price, charging cost, parking cost, total visit cost, and travel time. Unknown total costs are ignored.
7. The driver selects **Choose** for one station.
8. The system closes the comparison and opens that station's details.

**Alternative flows:**

- **AF-S1 - Remove a selection:** The driver selects **Compare** again on a selected station or uses **Clear** to remove all selections.
- **AF-S5 - Unknown data:** The system displays **Unknown** instead of inventing an availability, charging-power, charging-time, price, or cost value.
- **AF-S8 - Close comparison:** The driver closes the modal without selecting a station and returns to the search results.

**Exceptions:**

1. The comparison action remains disabled until at least two stations are selected.
2. If the driver tries to select more than four stations, the system keeps the existing selections and displays a limit message.
3. If the comparison request fails, the modal displays the backend error.

**Includes:** None

**Special requirements:** Only known numeric values are considered when highlighting best and weakest values.

**Assumptions:** The compared values use the latest station snapshot held by the running backend.

**Notes and issues:** Operating hours and amenities are not compared because they are not part of the implemented station model.

---

### UC-04: Monitor Charger Availability

**Actor:** EV driver

**Description:** Allows an EV driver to monitor the availability of a selected station and connector for 90 minutes.

**Preconditions:**

1. UC-01 has displayed at least one station.
2. The selected station supports the connector chosen for monitoring.

**Postconditions:** A monitor is active, stopped, or expired. Its current status and recorded events are reloaded from the local backend data file when the backend starts.

**Priority:** High

**Frequency of use:** Medium

**Flow of events:**

1. The driver selects **Monitor** on a station card or **Monitor this charger** in the station-details modal.
2. The frontend sends the selected station and connector to the backend with a 90-minute duration.
3. The backend validates that the station supports the connector and creates an active monitor.
4. The system opens the monitoring page and displays the station, connector, current availability, charging speed, last-check time, expiry time, and recent event history.
5. Every 30 seconds, the backend attempts to refresh the LTA snapshot and checks every active monitor.
6. When the available count changes, the backend adds a timestamped availability-change event.
7. While open, the monitoring page refreshes its displayed monitor list every 15 seconds.
8. The driver may select **Check now** to request an immediate live-provider refresh and availability check.
9. The driver may select **Stop** to end monitoring before it expires.
10. The backend saves monitor state and event history after creation, stopping, expiry, availability changes, and alternative acceptance.

**Alternative flows:**

- **AF-S3 - Monitor already active:** If the same station and connector already have an active monitor, the backend returns the existing monitor instead of creating a duplicate.
- **AF-S6 - No availability change:** The backend updates the last-check time without creating an availability-change event, and a manual check reports that there was no change.
- **AF-S9 - Monitoring expires:** Once the expiry time is reached, the backend marks the monitor as expired and moves it to previous monitoring.

**Exceptions:**

1. If the station does not support the selected connector, the backend rejects the monitor request.
2. If an immediate live refresh fails, the system displays an error and does not claim that a new availability check succeeded.
3. A stopped or expired monitor cannot be checked again.

**Includes:** None

**Special requirements:** Availability-change events and monitor state must include timestamps.

**Assumptions:** The user keeps the application available to view changes. The implementation does not send operating-system, email, SMS, or push notifications.

**Notes and issues:** Monitoring state is stored in the configurable local backend data directory. Monitoring does not continue after the local backend is closed, and no notification service is implemented.

---

### UC-05: Find and Accept an Alternative Charger

**Actor:** EV driver

**Description:** Allows an EV driver with an existing monitor to find available compatible alternatives near the driver's current location and switch monitoring to one of them.

**Preconditions:**

1. A monitor created through UC-04 exists.
2. The browser supports location access.

**Postconditions:** The existing monitor is updated to the accepted alternative, or the original monitored station remains unchanged.

**Priority:** High

**Frequency of use:** Medium

**Flow of events:**

1. The driver selects **Find alternatives near me** on a monitor.
2. The browser requests and returns the driver's current coordinates.
3. The frontend requests alternatives within the implemented 15 km search radius.
4. The backend searches for stations supporting the monitored connector.
5. The backend excludes the currently monitored station and any station whose compatible connector is not currently available.
6. The recommendation engine ranks the remaining stations with availability and travel weighted most heavily.
7. The system displays up to three alternatives with availability, travel time, additional travel time, charging power, and a recommendation reason.
8. The driver selects **Switch monitoring** for an alternative.
9. The backend checks that the alternative is still compatible and available.
10. The backend changes the existing monitor to the alternative station, records an acceptance event, updates its availability and last-check time, and continues monitoring it.

**Alternative flows:**

- **AF-S7 - No alternative found:** The system explains that no available alternative was found and suggests expanding the search radius or waiting for the current station. The current frontend request uses a fixed 15 km radius, so expanding it requires returning to the main search.
- **AF-S8 - Reject alternatives:** The driver closes the modal without switching, and the original station remains monitored.

**Exceptions:**

1. If browser location is unavailable or permission is denied, the system displays an error and does not request alternatives.
2. If the selected alternative has become unavailable or incompatible before acceptance, the backend rejects the switch and keeps the original monitor.

**Includes:** UC-02 Receive a Ranked Charger Recommendation

**Special requirements:** The current station must never be returned as its own alternative, and every alternative must support the monitored connector with at least one available charger.

**Assumptions:** Additional travel time is an estimate based on the driver's reported current location.

**Notes and issues:** The application does not detect whether the vehicle is moving and does not implement a reduced-interaction driving mode.

---
