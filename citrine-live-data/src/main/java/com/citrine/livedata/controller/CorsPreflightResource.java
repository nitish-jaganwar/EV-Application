package com.citrine.livedata.controller;

import jakarta.ws.rs.OPTIONS;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;

@Path("/api")
public class CorsPreflightResource {
    @OPTIONS
    @Path("{path: .*}")
    public Response preflight(@PathParam("path") String ignored) {
        return Response.noContent().build();
    }
}
