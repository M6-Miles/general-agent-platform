"""Validate deployment manifests without requiring Docker or external services."""

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    compose = yaml.safe_load((ROOT / "docker-compose.yml").read_text(encoding="utf-8"))
    services = compose.get("services", {})
    required = {"api", "worker", "postgres", "redis", "migrate", "seed"}
    missing = required - services.keys()
    if missing:
        raise SystemExit(f"DEPLOYMENT_SERVICES_MISSING:{','.join(sorted(missing))}")
    for name in ("api", "worker"):
        service = services[name]
        if "restart" not in service or "depends_on" not in service:
            raise SystemExit(f"DEPLOYMENT_SERVICE_INCOMPLETE:{name}")
    api_health = services["api"].get("healthcheck", {}).get("test", [])
    if not any("/ready" in str(item) for item in api_health):
        raise SystemExit("DEPLOYMENT_READINESS_CHECK_MISSING")
    production = yaml.safe_load((ROOT / "docker-compose.production.yml").read_text(encoding="utf-8"))
    for name in ("api", "worker"):
        if production.get("services", {}).get(name, {}).get("read_only") is not True:
            raise SystemExit(f"PRODUCTION_READ_ONLY_REQUIRED:{name}")
    alerts = yaml.safe_load((ROOT / "monitoring/prometheus-alerts.yml").read_text(encoding="utf-8"))
    if not alerts.get("groups") or not all(group.get("rules") for group in alerts["groups"]):
        raise SystemExit("PROMETHEUS_ALERT_RULES_MISSING")
    import json
    dashboard = json.loads((ROOT / "monitoring/grafana-agent-runtime.json").read_text(encoding="utf-8"))
    if not dashboard.get("panels"):
        raise SystemExit("GRAFANA_PANELS_MISSING")
    print("deployment-check-ok")


if __name__ == "__main__":
    main()
