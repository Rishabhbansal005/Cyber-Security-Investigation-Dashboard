from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ThreatObject(BaseModel):
    id: str
    threat_name: str
    threat_score: int
    confidence: int
    sources: List[str]
    ioc_list: List[str]
    malware_family: Optional[str] = None
    related_urls: List[str] = []
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    indicator_count: int = 0
    related_events: List[Dict[str, Any]] = []
    # OTX enrichment — populated by ThreatCorrelationEngine when OTX events
    # are present in the cluster.  Empty lists / None when no OTX data exists.
    otx_pulses: List[Dict[str, Any]] = []
    otx_tags: List[str] = []
    otx_references: List[str] = []
    otx_attack_ids: List[str] = []
    otx_threat_actor: Optional[str] = None
