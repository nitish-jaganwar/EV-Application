package com.citrine.livedata.service;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public class OwnershipService {
    private final Map<String, String> chargerOwners;

    public OwnershipService() {
        this.chargerOwners = parseOwnership(System.getenv("POC_CHARGER_OWNERSHIP"));
    }

    public String ownerForCharger(String chargerId) {
        return chargerOwners.get(chargerId);
    }

    public boolean owns(String residentId, String chargerId) {
        return residentId != null && residentId.equals(ownerForCharger(chargerId));
    }

    public boolean isKnownResident(String residentId) {
        return residentId != null && chargerOwners.containsValue(residentId);
    }

    public Map<String, String> mappings() {
        return chargerOwners;
    }

    private Map<String, String> parseOwnership(String configured) {
        String value = configured == null || configured.isBlank()
                ? "cp001:8305763637" : configured;
        Map<String, String> result = new HashMap<>();
        for (String mapping : value.split(",")) {
            String[] parts = mapping.trim().split(":", 2);
            if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
                throw new IllegalStateException(
                        "POC_CHARGER_OWNERSHIP must use chargerId:residentId entries"
                );
            }
            result.put(parts[0].trim(), parts[1].trim());
        }
        return Collections.unmodifiableMap(result);
    }
}
