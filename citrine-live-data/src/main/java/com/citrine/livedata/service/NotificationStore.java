package com.citrine.livedata.service;

import com.citrine.livedata.model.AppNotification;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

public class NotificationStore {
    private static final int MAX_PER_RESIDENT = 100;
    private final Map<String, ConcurrentLinkedDeque<AppNotification>> byResident =
            new ConcurrentHashMap<>();
    private final Map<String, Boolean> knownIds = new ConcurrentHashMap<>();

    public boolean add(AppNotification notification) {
        if (knownIds.putIfAbsent(notification.getId(), Boolean.TRUE) != null) {
            return false;
        }
        ConcurrentLinkedDeque<AppNotification> items = byResident.computeIfAbsent(
                notification.getRecipientId(), ignored -> new ConcurrentLinkedDeque<>());
        items.addFirst(notification);
        while (items.size() > MAX_PER_RESIDENT) {
            AppNotification removed = items.pollLast();
            if (removed != null) knownIds.remove(removed.getId());
        }
        return true;
    }

    public List<AppNotification> list(String residentId) {
        ConcurrentLinkedDeque<AppNotification> items = byResident.get(residentId);
        return items == null ? List.of() : new ArrayList<>(items);
    }

    public boolean markRead(String residentId, String notificationId) {
        for (AppNotification item : list(residentId)) {
            if (item.getId().equals(notificationId)) {
                item.setRead(true);
                return true;
            }
        }
        return false;
    }

    public int markAllRead(String residentId) {
        int changed = 0;
        for (AppNotification item : list(residentId)) {
            if (!item.isRead()) {
                item.setRead(true);
                changed++;
            }
        }
        return changed;
    }
}
