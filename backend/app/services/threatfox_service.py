import httpx
import logging
from typing import Dict, Any, List
from app.core.config import settings

logger = logging.getLogger(__name__)

class ThreatFoxService:
    def __init__(self):
        self.api_key = settings.threatfox_auth_key
        self.base_url = "https://threatfox-api.abuse.ch/api/v1/"
        
    async def get_recent_iocs(self, days: int = 1) -> Dict[str, Any]:
        """Fetch recent IOCs from ThreatFox API."""
        if not self.api_key:
            return {
                "success": False,
                "error": "THREATFOX_AUTH_KEY is not configured.",
                "data": []
            }
            
        headers = {
            "Auth-Key": self.api_key
        }
        payload = {
            "query": "get_iocs",
            "days": days
        }
        
        async with httpx.AsyncClient() as client:
            try:
                # ThreatFox API uses POST for queries
                response = await client.post(
                    self.base_url,
                    json=payload,
                    headers=headers,
                    timeout=15.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("query_status") != "ok":
                        # E.g. no_result
                        if data.get("query_status") == "no_result":
                            return {"success": True, "data": []}
                        return {"success": False, "error": f"ThreatFox API Error: {data.get('query_status')}", "data": []}
                    
                    raw_data = data.get("data", [])
                    normalized = self._normalize_iocs(raw_data)
                    return {"success": True, "data": normalized}
                else:
                    return {"success": False, "error": f"API returned status {response.status_code}", "data": []}
            except httpx.TimeoutException:
                logger.error("ThreatFox API timeout.")
                return {"success": False, "error": "Connection to ThreatFox API timed out.", "data": []}
            except Exception as e:
                logger.error(f"ThreatFox API error: {e}")
                return {"success": False, "error": str(e), "data": []}

    def _normalize_iocs(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        for item in raw_data:
            normalized.append({
                "id": item.get("id"),
                "ioc": item.get("ioc"),
                "ioc_type": item.get("ioc_type"),
                "threat_type": item.get("threat_type"),
                "threat_type_desc": item.get("threat_type_desc"),
                "malware_family": item.get("malware"),
                "malware_printable": item.get("malware_printable"),
                "confidence_level": item.get("confidence_level"),
                "first_seen": item.get("first_seen_utc") or item.get("first_seen"),
                "last_seen": item.get("last_seen_utc") or item.get("last_seen"),
                "reporter": item.get("reporter"),
                "source": "ThreatFox"
            })
        return normalized
