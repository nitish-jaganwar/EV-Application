FROM maven:3.9.11-eclipse-temurin-17 AS build

WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests -B
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/citrine-live-data-1.0.0.jar app.jar
EXPOSE 9100
CMD ["java", "-jar", "app.jar"]
