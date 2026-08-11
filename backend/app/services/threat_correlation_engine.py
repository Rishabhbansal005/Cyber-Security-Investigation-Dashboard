import uuid
import re
from typing import List, Dict, Any, Optional
from app.models.threat_intel import ThreatObject

class ThreatCorrelationEngine:
    def __init__(self):
        pass

    def correlate_events(self, events: List[Dict[str, Any]]) -> List[ThreatObject]:
        clusters: Dict[str, List[Dict[str, Any]]] = {}

        for event in events:
            # 1. Correlate by malware family if it exists and is not unknown
            malware = event.get("malware_family")
            ioc = event.get("ioc", "")
            
            cluster_key = None
            if malware and malware.lower() != "unknown":
                cluster_key = f"malware:{malware.lower()}"
            else:
                # 2. Correlate by domain/IP if it's a URL, otherwise exact IOC
                cluster_key = f"ioc:{self._extract_domain_or_ip(ioc)}"
            
            if cluster_key not in clusters:
                clusters[cluster_key] = []
            clusters[cluster_key].append(event)
        
        correlated_threats = []
        for key, cluster_events in clusters.items():
            threat_obj = self._build_threat_object(key, cluster_events)
            correlated_threats.append(threat_obj)

        # Sort by threat score descending
        correlated_threats.sort(key=lambda x: x.threat_score, reverse=True)
        return correlated_threats

    def _extract_domain_or_ip(self, ioc: str) -> str:
        # Extract domain/IP from URL or return exact ioc if not URL
        if ioc.startswith("http://") or ioc.startswith("https://"):
            try:
                # Basic extraction for http(s)://domain.com/path
                return ioc.split("//")[1].split("/")[0].split(":")[0]
            except Exception:
                pass
        return ioc

    def _build_threat_object(self, cluster_key: str, events: List[Dict[str, Any]]) -> ThreatObject:
        sources = list(set(e.get("source") for e in events if e.get("source")))
        iocs = list(set(e.get("ioc") for e in events if e.get("ioc")))
        
        malware_families = list(set(e.get("malware_family") for e in events if e.get("malware_family") and e.get("malware_family").lower() != "unknown"))
        malware_family = malware_families[0] if malware_families else None

        # Determine generic threat name if no malware family
        if malware_family:
            threat_name = f"{malware_family.upper()} Campaign"
        else:
            if cluster_key.startswith("ioc:"):
                threat_name = f"Suspicious Cluster: {cluster_key.replace('ioc:', '')}"
            else:
                threat_name = "Unknown Threat Cluster"

        # Calculate max confidence from events
        confidences = [e.get("confidence_level", 50) for e in events if isinstance(e.get("confidence_level"), (int, float))]
        base_confidence = max(confidences) if confidences else 50
        
        # Boost score if multiple sources
        threat_score = min(100, base_confidence + (10 * (len(sources) - 1)))
        
        # Calculate time bounds
        first_seens = [e.get("first_seen") for e in events if e.get("first_seen")]
        first_seen = min(first_seens) if first_seens else None

        # ── OTX enrichment aggregation ────────────────────────────────────────
        # Collect OTX-specific fields from all OTX-sourced events in this cluster.
        # Only events that came through OTXService carry these keys.
        otx_events = [e for e in events if e.get("source") == "OTX"]

        seen_pulse_ids: set = set()
        otx_pulses: List[Dict[str, Any]] = []
        otx_tags: set = set()
        otx_references: set = set()
        otx_attack_ids: set = set()
        otx_threat_actor: Optional[str] = None

        for e in otx_events:
            pid = e.get("otx_pulse_id")
            if pid and pid not in seen_pulse_ids:
                seen_pulse_ids.add(pid)
                otx_pulses.append({
                    "id": pid,
                    "name": e.get("otx_pulse_name") or "",
                    "description": e.get("otx_pulse_description") or "",
                    "malware_family": e.get("otx_malware_family"),
                })
            otx_tags.update(e.get("otx_tags") or [])
            otx_references.update(e.get("otx_references") or [])
            otx_attack_ids.update(e.get("otx_attack_ids") or [])
            if not otx_threat_actor and e.get("otx_threat_actor"):
                otx_threat_actor = e["otx_threat_actor"]

        return ThreatObject(
            id=str(uuid.uuid4()),
            threat_name=threat_name,
            threat_score=int(threat_score),
            confidence=int(base_confidence),
            sources=sources,
            ioc_list=iocs,
            malware_family=malware_family,
            related_urls=[ioc for ioc in iocs if ioc.startswith("http")],
            first_seen=first_seen,
            last_seen=first_seen, # Simplification
            indicator_count=len(iocs),
            related_events=events,
            # OTX enrichment
            otx_pulses=otx_pulses,
            otx_tags=sorted(otx_tags),
            otx_references=sorted(otx_references),
            otx_attack_ids=sorted(otx_attack_ids),
            otx_threat_actor=otx_threat_actor,
        )
