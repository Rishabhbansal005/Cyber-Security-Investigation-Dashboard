import httpx
import logging
from typing import Dict, Any, List
from app.core.config import settings

logger = logging.getLogger(__name__)

class URLhausService:
    def __init__(self):
        self.api_key = settings.urlhaus_auth_key
        self.base_url = "https://urlhaus-api.abuse.ch/v1/"
        
    async def get_recent_urls(self) -> Dict[str, Any]:
        """Fetch recent URLs from URLhaus API."""
        if not self.api_key:
            return {
                "success": False,
                "error": "URLHAUS_AUTH_KEY is not configured.",
                "data": []
            }
            
        headers = {
            "Auth-Key": self.api_key
        }
        
        async with httpx.AsyncClient() as client:
            try:
                # URLhaus API for recent URLs is GET /urls/recent/
                response = await client.get(
                    self.base_url + "urls/recent/",
                    headers=headers,
                    timeout=15.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("query_status") != "ok":
                        if data.get("query_status") == "no_results":
                            return {"success": True, "data": []}
                        return {"success": False, "error": f"URLhaus API Error: {data.get('query_status')}", "data": []}
                    
                    raw_data = data.get("urls", [])
                    normalized = self._normalize_urls(raw_data)
                    return {"success": True, "data": normalized}
                else:
                    return {"success": False, "error": f"API returned status {response.status_code}", "data": []}
            except httpx.TimeoutException:
                logger.error("URLhaus API timeout.")
                return {"success": False, "error": "Connection to URLhaus API timed out.", "data": []}
            except Exception as e:
                logger.error(f"URLhaus API error: {e}")
                return {"success": False, "error": str(e), "data": []}

    def _normalize_urls(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        for item in raw_data:
            # item fields from URLhaus: id, url, url_status, dateadded, threat, reporter, tags, payloads
            normalized.append({
                "id": str(item.get("id")),
                "ioc": item.get("url"),
                "ioc_type": "url",
                "threat_type": "payload_delivery" if item.get("payloads") else "malicious_url",
                "threat_type_desc": "Malware Payload" if item.get("payloads") else "Malicious URL",
                "malware_family": item.get("tags", ["Unknown"])[0] if item.get("tags") else "Unknown",
                "malware_printable": ", ".join(item.get("tags", [])) if item.get("tags") else None,
                "confidence_level": 100 if item.get("url_status") == "online" else 50,
                "first_seen": item.get("date_added"),
                "last_seen": item.get("date_added"),
                "reporter": item.get("reporter"),
                "source": "URLhaus"
            })
        return normalized
