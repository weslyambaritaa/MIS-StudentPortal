FROM maven:3.9.9-eclipse-temurin-21 AS provider-build
WORKDIR /provider
COPY keycloak/providers/st01/pom.xml ./pom.xml
COPY keycloak/providers/st01/src ./src
RUN mvn -B -DskipTests compile jar:jar

FROM quay.io/keycloak/keycloak:26.7.3 AS keycloak-build
COPY --from=provider-build /provider/target/st01-reset-providers-1.0.0.jar /opt/keycloak/providers/st01-reset-providers.jar
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.7.3
COPY --from=keycloak-build /opt/keycloak/ /opt/keycloak/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start-dev", "--import-realm"]
