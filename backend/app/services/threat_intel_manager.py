import logging
from typing import List, Dict, Any
from app.services.threatfox_service import ThreatFoxService
from app.services.urlhaus_service import URLhausService
from app.services.otx_service import OTXService
from app.services.threat_correlation_engine import ThreatCorrelationEngine
from app.models.threat_intel import ThreatObject

logger = logging.getLogger(__name__)

class ThreatIntelligenceManager:
    def __init__(self):
        self.threatfox = ThreatFoxService()
        self.urlhaus = URLhausService()
        self.otx = OTXService()
        self.correlation_engine = ThreatCorrelationEngine()

    async def get_correlated_threats(self) -> Dict[str, Any]:
        """
        Fetches events from all active providers, normalizes them,
        and correlates them into CCID Threat Objects.
        """
        all_events = []
        
        # 1. Fetch from ThreatFox
        try:
            tf_result = await self.threatfox.get_recent_iocs(days=1)
            if tf_result.get("success"):
                all_events.extend(tf_result.get("data", []))
        except Exception as e:
            logger.error(f"Error fetching from ThreatFox: {e}")

        # 2. Fetch from URLhaus
        try:
            uh_result = await self.urlhaus.get_recent_urls()
            if uh_result.get("success"):
                all_events.extend(uh_result.get("data", []))
        except Exception as e:
            logger.error(f"Error fetching from URLhaus: {e}")

        # 3. Fetch from AlienVault OTX
        try:
            otx_result = await self.otx.get_recent_pulses(days=1)
            if otx_result.get("success"):
                all_events.extend(otx_result.get("data", []))
            else:
                logger.warning(f"OTX provider unavailable: {otx_result.get('error')}")
        except Exception as e:
            logger.error(f"Error fetching from OTX: {e}")
            
        # 4. Correlate
        correlated_threats = self.correlation_engine.correlate_events(all_events)
        
        return {
            "success": True,
            "data": [t.dict() for t in correlated_threats],
            "total_events": len(all_events),
            "total_threats": len(correlated_threats)
        }
