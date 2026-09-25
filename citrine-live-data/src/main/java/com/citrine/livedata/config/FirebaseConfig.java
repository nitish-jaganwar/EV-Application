package com.citrine.livedata.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

import java.io.IOException;

public final class FirebaseConfig {

    private FirebaseConfig() {
    }

    public static boolean initialize() {
        if (!Boolean.parseBoolean(environment("FIREBASE_ENABLED", "false"))) {
            System.out.println("Firebase push delivery is disabled");
            return false;
        }
        if (!FirebaseApp.getApps().isEmpty()) {
            return true;
        }

        String projectId = requiredEnvironment("FIREBASE_PROJECT_ID");
        try {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.getApplicationDefault())
                    .setProjectId(projectId)
                    .build();
            FirebaseApp.initializeApp(options);
            System.out.println("Firebase Admin initialized for project " + projectId);
            return true;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load Firebase Admin credentials", exception);
        }
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " environment variable is required");
        }
        return value.trim();
    }

    private static String environment(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
