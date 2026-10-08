package com.citrine.livedata.config;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Provider
public class CorsResponseFilter implements ContainerResponseFilter {

	private static final Set<String> ALLOWED_ORIGINS = allowedOrigins();

	@Override
	public void filter(ContainerRequestContext request, ContainerResponseContext response) throws IOException {
		String origin = request.getHeaderString("Origin");
		if (origin == null || !ALLOWED_ORIGINS.contains(origin)) {
			return;
		}

		response.getHeaders().putSingle("Access-Control-Allow-Origin", origin);
		response.getHeaders().putSingle("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		response.getHeaders().putSingle("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization");
		response.getHeaders().putSingle("Access-Control-Max-Age", "3600");
		response.getHeaders().add("Vary", "Origin");
	}

	private static Set<String> allowedOrigins() {
		String configured = System.getenv("CORS_ALLOWED_ORIGINS");
		String origins = configured == null || configured.isBlank()
				? "http://localhost:8081,http://127.0.0.1:8081," + "http://localhost:8082,http://127.0.0.1:8082,"
						+ "http://localhost:8083,http://127.0.0.1:8083"
				: configured;

		return Arrays.stream(origins.split(",")).map(String::trim).filter(value -> !value.isBlank())
				.collect(Collectors.toUnmodifiableSet());
	}
}
