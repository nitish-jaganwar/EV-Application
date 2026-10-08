# Energy-based parking allocation

One demo apartment, 15 bays. User chooses a vehicle and energy in kWh, receives the earliest compatible bay, then confirms. No manual appointment times.

- `parkingRules.ts`: pure compatibility, energy validation, charging duration, gap selection and readiness rules; site settings are here. Demo effective rates are 1 kW for scooters and up to 7.2 kW for cars. They are not measured vehicle capabilities.
- `parkingRepository.ts`: serialized AsyncStorage adapter, with a replaceable repository interface. Stores allocations separately from physical occupancy and preserves cancelled/released history. One active allocation per user. Old appointment records remain in their original store for history.
- `ParkingScreen.tsx`: energy input, recommendation, confirmation, 15-bay illustrative layout, arrival and vacancy confirmation. Tap seeded occupied bays for clearly labelled demo vacancy/delay controls.
- `parkingNotifications.ts`: five-minute estimated native reminders when enabled; in-app readiness/delay notifications while Home is mounted. Real vacancy notifications while the app is closed require server push. Never schedule a future notification claiming physical vacancy.

Production adapter must authenticate the owner server-side, transact reservation conflicts across users/devices, provide actual site/vehicle power and bay geometry, ingest occupancy independently from charging completion, and send push on vacancy/delay. The prototype's local queue only prevents races in one app instance. Old booking data is retained as historical data, not imported as new physical parking occupancy.

Run `node --test tests/parkingRules.test.cjs` and `npx tsc --noEmit`.
