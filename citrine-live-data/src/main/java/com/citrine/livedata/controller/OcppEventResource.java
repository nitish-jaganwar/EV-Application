package com.citrine.livedata.controller;

import com.citrine.livedata.model.ChargerState;
import com.citrine.livedata.model.OcppEvent;
import com.citrine.livedata.service.OcppEventService;
import com.citrine.livedata.service.AppServices;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Map;

@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
public class OcppEventResource {

    private final OcppEventService eventService = AppServices.get().ocppEvents();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @GET
    @Path("/health")
    public Response health() {
        return Response.ok(Map.of(
                "status", "UP",
                "service", "citrine-live-data"
        )).build();
    }

    @POST
    @Path("/ocpp-events")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response receiveEvent(String rawJson) {
        try {
            OcppEvent event = objectMapper.readValue(rawJson, OcppEvent.class);
            eventService.processEvent(event);

            System.out.printf(
                    "CitrineOS event charger=%s action=%s correlationId=%s timestamp=%s%n",
                    event.getOcppConnectionName(),
                    event.action(),
                    event.correlationId(),
                    event.timestamp()
            );
            return Response.ok(Map.of("status", "received")).build();
        } catch (IllegalArgumentException exception) {
            return error(Response.Status.BAD_REQUEST, exception);
        } catch (Exception exception) {
            exception.printStackTrace();
            return error(Response.Status.INTERNAL_SERVER_ERROR, exception);
        }
    }

    @GET
    @Path("/chargers")
    public Response getChargers() {
        List<String> chargers = eventService.getChargers();
        return Response.ok(chargers).build();
    }

    @GET
    @Path("/chargers/{chargerId}")
    public Response getCharger(@PathParam("chargerId") String chargerId) {
        ChargerState state = eventService.getChargerState(chargerId);
        if (state == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of(
                            "error", "Charger not found",
                            "chargerId", chargerId
                    ))
                    .build();
        }
        return Response.ok(state).build();
    }

    @GET
    @Path("/chargers/{chargerId}/events")
    public Response getChargerEvents(@PathParam("chargerId") String chargerId) {
        return Response.ok(eventService.getEvents(chargerId)).build();
    }

    @GET
    @Path("/chargers/{chargerId}/events/latest")
    public Response getLatestRawEvent(@PathParam("chargerId") String chargerId) {
        OcppEvent event = eventService.getLatestRawEvent(chargerId);
        if (event == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of(
                            "error", "Charger event not found",
                            "chargerId", chargerId
                    ))
                    .build();
        }
        return Response.ok(event).build();
    }

    private Response error(Response.Status status, Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            message = exception.getClass().getSimpleName();
        }
        return Response.status(status)
                .entity(Map.of("status", "error", "message", message))
                .build();
    }
}
