FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/ai-presenter-0.0.1-SNAPSHOT.jar app.jar
RUN mkdir slides
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
