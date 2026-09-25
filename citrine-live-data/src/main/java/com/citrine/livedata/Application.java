package com.citrine.livedata;

import com.citrine.livedata.config.JerseyConfig;
import org.glassfish.grizzly.http.server.HttpServer;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.server.ResourceConfig;

import java.net.URI;

public final class Application {

    private Application() {
    }

    public static void main(String[] args) {
        String host = environment("BIND_HOST", "0.0.0.0");
        String port = environment("PORT", "9100");
        URI baseUri = URI.create("http://" + host + ":" + port + "/");

        ResourceConfig config = new JerseyConfig();
        HttpServer server = GrizzlyHttpServerFactory.createHttpServer(baseUri, config);

        System.out.println("Citrine live-data service listening at " + baseUri);
        Runtime.getRuntime().addShutdownHook(new Thread(server::shutdownNow));

        try {
            Thread.currentThread().join();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            server.shutdownNow();
        }
    }

    private static String environment(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
