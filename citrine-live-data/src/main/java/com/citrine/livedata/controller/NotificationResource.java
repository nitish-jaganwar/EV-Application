package com.citrine.livedata.controller;

import com.citrine.livedata.model.AppNotification;
import com.citrine.livedata.model.PushTokenRegistration;
import com.citrine.livedata.model.PushTokenRequest;
import com.citrine.livedata.service.AppServices;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Map;

@Path("/api/users/me")
@Produces(MediaType.APPLICATION_JSON)
public class NotificationResource {
    private final AppServices services = AppServices.get();

    @POST
    @Path("/push-tokens")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response registerToken(
            @HeaderParam("X-Resident-Id") String residentId,
            PushTokenRequest request
    ) {
        Response denied = authorize(residentId);
        if (denied != null) return denied;
        try {
            PushTokenRegistration registration = services.deviceTokens()
                    .register(residentId.trim(), request);
            return Response.status(Response.Status.CREATED).entity(registration).build();
        } catch (IllegalArgumentException exception) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", exception.getMessage())).build();
        }
    }

    @GET
    @Path("/push-tokens")
    public Response listTokens(@HeaderParam("X-Resident-Id") String residentId) {
        Response denied = authorize(residentId);
        if (denied != null) return denied;
        return Response.ok(services.deviceTokens().registrations(residentId.trim())).build();
    }

    @DELETE
    @Path("/push-tokens/{registrationId}")
    public Response deleteToken(
            @HeaderParam("X-Resident-Id") String residentId,
            @PathParam("registrationId") String registrationId
    ) {
        Response denied = authorize(residentId);
        if (denied != null) return denied;
        boolean removed = services.deviceTokens().remove(residentId.trim(), registrationId);
        return removed ? Response.noContent().build()
                : Response.status(Response.Status.NOT_FOUND)
                .entity(Map.of("error", "Push token registration not found")).build();
    }

    @GET
    @Path("/notifications")
    public Response notifications(@HeaderParam("X-Resident-Id") String residentId) {
        Response denied = authorize(residentId);
        if (denied != null) return denied;
        List<AppNotification> notifications = services.notifications().list(residentId.trim());
        return Response.ok(notifications).build();
    }

    @PATCH
    @Path("/notifications/{notificationId}/read")
    public Response markRead(
            @HeaderParam("X-Resident-Id") String residentId,
            @PathParam("notificationId") String notificationId
    ) {
        Response denied = authorize(residentId);
        if (denied != null) return denied;
        boolean changed = services.notifications().markRead(residentId.trim(), notificationId);
        return changed ? Response.ok(Map.of("status", "read")).build()
                : Response.status(Response.Status.NOT_FOUND)
                .entity(Map.of("error", "Notification not found")).build();
    }

    @POST
    @Path("/notifications/read-all")
    public Response markAllRead(@HeaderParam("X-Resident-Id") String residentId) {
        Response denied = authorize(residentId);
        if (denied != null) return denied;
        int changed = services.notifications().markAllRead(residentId.trim());
        return Response.ok(Map.of("updated", changed)).build();
    }

    @POST
    @Path("/notifications/test")
    public Response test(@HeaderParam("X-Resident-Id") String residentId) {
        Response denied = authorize(residentId);
        if (denied != null) return denied;
        return Response.accepted(services.notificationService().sendTest(residentId.trim())).build();
    }

    private Response authorize(String residentId) {
        if (residentId == null || residentId.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("error", "X-Resident-Id header is required for this POC"))
                    .build();
        }
        if (!services.ownership().isKnownResident(residentId.trim())) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity(Map.of("error", "Resident has no assigned charger"))
                    .build();
        }
        return null;
    }
}
