import httpx
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class OTXService:
    """
    AlienVault OTX intelligence service.

    Fetches real threat pulses from the OTX subscribed-pulses feed and
    normalises each indicator into the same flat event dict used by
    ThreatFoxService and URLhausService, so they can flow through the
    existing CCID Threat Correlation Engine unchanged.

    API key is read exclusively from settings.alienvault_otx_key which maps
    to the ALIENVAULT_OTX_KEY environment variable in backend/.env.
    The key is never exposed to the frontend.
    """

    BASE_URL = "https://otx.alienvault.com/api/v1"

    # OTX indicator type → CCID normalised ioc_type
    _OTX_TYPE_MAP: Dict[str, str] = {
        "IPv4": "ip",
        "IPv6": "ip",
        "domain": "domain",
        "hostname": "domain",
        "URL": "url",
        "FileHash-MD5": "hash",
        "FileHash-SHA1": "hash",
        "FileHash-SHA256": "hash",
        "FileHash-SHA512": "hash",
        "CIDR": "cidr",
        "email": "email",
        "CVE": "cve",
    }

    def __init__(self) -> None:
        self.api_key: str = settings.alienvault_otx_key

    # ──────────────────────────────────────────────────────────────────────────
    # Public interface
    # ──────────────────────────────────────────────────────────────────────────

    async def get_recent_pulses(self, days: int = 1) -> Dict[str, Any]:
        """
        Fetch subscribed pulses modified within the last *days* days.

        Returns the standard CCID provider response envelope:
            {"success": bool, "data": [<normalised event>, ...],
             "pulse_count": int, "raw_pulses": [...]}
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "ALIENVAULT_OTX_KEY is not configured in backend/.env.",
                "data": [],
            }

        modified_since = (
            datetime.now(timezone.utc) - timedelta(days=days)
        ).strftime("%Y-%m-%dT%H:%M:%S")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/pulses/subscribed",
                    headers={"X-OTX-API-KEY": self.api_key},
                    params={"modified_since": modified_since, "limit": 20},
                    timeout=20.0,
                )

                if response.status_code == 401:
                    return {
                        "success": False,
                        "error": "OTX authentication failed — check ALIENVAULT_OTX_KEY.",
                        "data": [],
                    }

                if response.status_code != 200:
                    return {
                        "success": False,
                        "error": f"OTX API returned HTTP {response.status_code}.",
                        "data": [],
                    }

                body = response.json()
                pulses: List[Dict[str, Any]] = body.get("results", [])

                if not pulses:
                    return {"success": True, "data": [], "pulse_count": 0, "raw_pulses": []}

                normalised = self._normalise_pulses(pulses)
                return {
                    "success": True,
                    "data": normalised,
                    "pulse_count": len(pulses),
                    "raw_pulses": [self._extract_pulse_summary(p) for p in pulses],
                }

            except httpx.TimeoutException:
                logger.error("OTX API request timed out.")
                return {
                    "success": False,
                    "error": "Connection to AlienVault OTX API timed out.",
                    "data": [],
                }
            except Exception as exc:
                logger.error("OTX API unexpected error: %s", exc)
                return {"success": False, "error": str(exc), "data": []}

    async def enrich_ioc(self, ioc: str) -> Dict[str, Any]:
        """
        Query OTX for real-time intelligence on a single IOC (IP, domain, hash, URL).

        Returns:
            {"success": bool, "data": <enrichment dict> | None, "message": str}
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "ALIENVAULT_OTX_KEY is not configured in backend/.env.",
                "data": None,
            }

        ioc_type = self._detect_ioc_type(ioc)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/indicators/{ioc_type}/{ioc}/general",
                    headers={"X-OTX-API-KEY": self.api_key},
                    timeout=15.0,
                )

                if response.status_code == 404:
                    return {
                        "success": True,
                        "data": None,
                        "message": "No OTX intelligence available.",
                    }

                if response.status_code != 200:
                    return {
                        "success": False,
                        "error": f"OTX API returned HTTP {response.status_code}.",
                        "data": None,
                    }

                body = response.json()
                pulse_info = body.get("pulse_info", {})
                pulses: List[Dict[str, Any]] = pulse_info.get("pulses", [])

                if not pulses:
                    return {
                        "success": True,
                        "data": None,
                        "message": "No OTX intelligence available.",
                    }

                enrichment = {
                    "ioc": ioc,
                    "ioc_type": ioc_type,
                    "pulse_count": pulse_info.get("count", len(pulses)),
                    "pulses": [self._extract_pulse_summary(p) for p in pulses[:10]],
                    "tags": sorted(
                        {tag for p in pulses for tag in p.get("tags", [])}
                    ),
                    "references": sorted(
                        {ref for p in pulses for ref in p.get("references", [])}
                    ),
                    "attack_ids": sorted(
                        {
                            a["id"]
                            for p in pulses
                            for a in p.get("attack_ids", [])
                            if a.get("id")
                        }
                    ),
                    "malware_families": sorted(
                        {
                            mf["display_name"]
                            for p in pulses
                            for mf in p.get("malware_families", [])
                            if mf.get("display_name")
                        }
                    ),
                }

                return {"success": True, "data": enrichment}

            except httpx.TimeoutException:
                return {
                    "success": False,
                    "error": "OTX API request timed out.",
                    "data": None,
                }
            except Exception as exc:
                logger.error("OTX enrich_ioc error: %s", exc)
                return {"success": False, "error": str(exc), "data": None}

    # ──────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────────────────

    def _detect_ioc_type(self, ioc: str) -> str:
        """Return the OTX indicator endpoint segment for a given IOC value."""
        if re.match(r"^\d{1,3}(?:\.\d{1,3}){3}$", ioc):
            return "IPv4"
        if re.match(r"^[a-fA-F0-9]{32}$", ioc):
            return "FileHash-MD5"
        if re.match(r"^[a-fA-F0-9]{40}$", ioc):
            return "FileHash-SHA1"
        if re.match(r"^[a-fA-F0-9]{64}$", ioc):
            return "FileHash-SHA256"
        if ioc.startswith("http://") or ioc.startswith("https://"):
            return "URL"
        return "domain"

    def _normalise_ioc_type(self, otx_type: str) -> str:
        return self._OTX_TYPE_MAP.get(otx_type, "unknown")

    def _extract_pulse_summary(self, pulse: Dict[str, Any]) -> Dict[str, Any]:
        """Return a clean, frontend-safe summary of an OTX pulse."""
        
        raw_malware = pulse.get("malware_families") or []
        malware_families: List[str] = []
        for mf in raw_malware:
            if isinstance(mf, str):
                malware_families.append(mf)
            elif isinstance(mf, dict) and mf.get("display_name"):
                malware_families.append(mf["display_name"])

        raw_attacks = pulse.get("attack_ids") or []
        attack_ids: List[str] = []
        attack_names: List[str] = []
        for a in raw_attacks:
            if isinstance(a, str):
                attack_ids.append(a)
                attack_names.append(a)
            elif isinstance(a, dict):
                if a.get("id"):
                    attack_ids.append(a["id"])
                if a.get("display_name"):
                    attack_names.append(a["display_name"])
        # author may be a string or a nested dict depending on the endpoint
        author = pulse.get("author_name") or (
            pulse.get("author", {}).get("username", "Unknown")
            if isinstance(pulse.get("author"), dict)
            else "Unknown"
        )
        return {
            "id": pulse.get("id", ""),
            "name": pulse.get("name", ""),
            "description": (pulse.get("description") or "").strip(),
            "tags": pulse.get("tags", []),
            "references": pulse.get("references", []),
            "malware_families": malware_families,
            "attack_ids": attack_ids,
            "attack_names": attack_names,
            "author": author,
            "created": pulse.get("created"),
            "modified": pulse.get("modified"),
            "indicator_count": pulse.get("indicator_count", 0),
        }

    def _normalise_pulses(self, pulses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert a list of OTX pulses into flat normalised event dicts.

        One event is produced per indicator (up to 50 per pulse).
        Every event carries the full OTX enrichment payload so the
        correlation engine can aggregate it into ThreatObject.
        """
        events: List[Dict[str, Any]] = []

        for pulse in pulses:
            pulse_id: str = pulse.get("id", "")
            pulse_name: str = pulse.get("name", "")
            pulse_description: str = (pulse.get("description") or "").strip()
            tags: List[str] = pulse.get("tags", [])
            references: List[str] = pulse.get("references", [])
            raw_malware = pulse.get("malware_families") or []
            malware_families: List[str] = []
            for mf in raw_malware:
                if isinstance(mf, str):
                    malware_families.append(mf)
                elif isinstance(mf, dict) and mf.get("display_name"):
                    malware_families.append(mf["display_name"])

            raw_attacks = pulse.get("attack_ids") or []
            attack_ids: List[str] = []
            for a in raw_attacks:
                if isinstance(a, str):
                    attack_ids.append(a)
                elif isinstance(a, dict) and a.get("id"):
                    attack_ids.append(a["id"])
            author: str = pulse.get("author_name") or (
                pulse.get("author", {}).get("username", "Unknown")
                if isinstance(pulse.get("author"), dict)
                else "Unknown"
            )
            created: Optional[str] = pulse.get("created")
            modified: Optional[str] = pulse.get("modified")

            # Heuristic: look for an APT/threat-actor tag
            threat_actor: Optional[str] = next(
                (
                    t
                    for t in tags
                    if t.lower().startswith("apt")
                    or "threat-actor" in t.lower()
                    or t.lower().startswith("ta")
                ),
                None,
            )

            malware_family: Optional[str] = malware_families[0] if malware_families else None
            malware_printable: Optional[str] = (
                ", ".join(malware_families) if malware_families else None
            )

            # Confidence scoring: OTX is a reputable source, boost for specificity
            confidence: int = 70
            if malware_family:
                confidence += 10
            if attack_ids:
                confidence += 10
            confidence = min(confidence, 95)

            indicators: List[Dict[str, Any]] = pulse.get("indicators", [])

            # Pre-build related indicator lists for the entire pulse
            related_domains = [
                i["indicator"]
                for i in indicators
                if i.get("type") in ("domain", "hostname") and i.get("indicator")
            ]
            related_urls = [
                i["indicator"]
                for i in indicators
                if i.get("type") == "URL" and i.get("indicator")
            ]
            related_hashes = [
                i["indicator"]
                for i in indicators
                if "FileHash" in i.get("type", "") and i.get("indicator")
            ]

            added = 0
            for idx, indicator in enumerate(indicators[:50]):
                ioc_value: Optional[str] = indicator.get("indicator")
                if not ioc_value:
                    continue

                events.append(
                    {
                        "id": f"otx-{pulse_id}-{idx}",
                        "ioc": ioc_value,
                        "ioc_type": self._normalise_ioc_type(
                            indicator.get("type", "")
                        ),
                        "threat_type": "malware" if malware_family else "threat",
                        "threat_type_desc": pulse_name,
                        "malware_family": malware_family,
                        "malware_printable": malware_printable,
                        "confidence_level": confidence,
                        "first_seen": created,
                        "last_seen": modified,
                        "reporter": author,
                        "source": "OTX",
                        # OTX-specific enrichment — carried through to ThreatObject
                        "otx_pulse_id": pulse_id,
                        "otx_pulse_name": pulse_name,
                        "otx_pulse_description": pulse_description,
                        "otx_tags": tags,
                        "otx_references": references,
                        "otx_related_domains": related_domains,
                        "otx_related_urls": related_urls,
                        "otx_related_hashes": related_hashes,
                        "otx_malware_family": malware_family,
                        "otx_threat_actor": threat_actor,
                        "otx_attack_ids": attack_ids,
                    }
                )
                added += 1

            # If the pulse has no indicators, emit a single pulse-level event
            # so the pulse name still flows into the correlation engine
            if added == 0 and pulse_name:
                events.append(
                    {
                        "id": f"otx-{pulse_id}-summary",
                        "ioc": pulse_name,
                        "ioc_type": "pulse",
                        "threat_type": "threat",
                        "threat_type_desc": pulse_name,
                        "malware_family": malware_family,
                        "malware_printable": malware_printable,
                        "confidence_level": confidence,
                        "first_seen": created,
                        "last_seen": modified,
                        "reporter": author,
                        "source": "OTX",
                        "otx_pulse_id": pulse_id,
                        "otx_pulse_name": pulse_name,
                        "otx_pulse_description": pulse_description,
                        "otx_tags": tags,
                        "otx_references": references,
                        "otx_related_domains": related_domains,
                        "otx_related_urls": related_urls,
                        "otx_related_hashes": related_hashes,
                        "otx_malware_family": malware_family,
                        "otx_threat_actor": threat_actor,
                        "otx_attack_ids": attack_ids,
                    }
                )

        return events
