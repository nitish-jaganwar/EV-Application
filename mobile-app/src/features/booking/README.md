# Single-apartment booking prototype

`BookingSchedule.tsx` owns presentation and user confirmation. `bookingRules.ts` owns date, compatibility, overlap, and alternative-time calculations. `bookingConfig.ts` contains the one test apartment's hours and charger inventory. `BookingRepository` is the persistence boundary. `bookingRepository.ts` selects the current adapter; `localBookingRepository.ts` implements the demo with AsyncStorage and clearly marked sample occupied windows.

The local repository is for testing on one device only. It cannot prevent two residents on different devices from selecting the same slot, and it does not reserve or start a physical charger. AsyncStorage is unencrypted; keep payment and sensitive vehicle details out of demo bookings.

For a real deployment, implement `BookingRepository` through the backend. The server must authenticate the resident, verify apartment/vehicle/connector eligibility, check current charger health and site capacity, and commit a reservation with an atomic overlap check. It must also recheck these conditions at QR check-in before issuing the charger start authorization. Charger telemetry and meter readings belong to separate live services; rated charger power in this prototype is not a live power reading or an energy guarantee.
