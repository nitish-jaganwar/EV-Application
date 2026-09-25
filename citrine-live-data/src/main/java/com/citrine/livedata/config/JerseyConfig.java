package com.citrine.livedata.config;

import org.glassfish.jersey.jackson.JacksonFeature;
import org.glassfish.jersey.server.ResourceConfig;

public class JerseyConfig extends ResourceConfig {
    public JerseyConfig() {
        packages("com.citrine.livedata.controller");
        register(JacksonFeature.class);
         register(CorsResponseFilter.class);
    }
}
