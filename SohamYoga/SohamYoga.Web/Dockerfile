# ── Build stage ──────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

COPY SohamYoga.Web.csproj .
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app

# Non-root user
RUN addgroup -S slpgroup && adduser -S slpuser -G slpgroup

# Copy published output
COPY --from=build /app/publish .

# Data directory for SQLite
RUN mkdir -p /app/data /app/logs && chown -R slpuser:slpgroup /app

USER slpuser

ENV ASPNETCORE_URLS=http://+:5070
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5070

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5070/api/health || exit 1

ENTRYPOINT ["dotnet", "SohamYoga.Web.dll"]
