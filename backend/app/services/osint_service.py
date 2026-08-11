import httpx
import os
from datetime import datetime
from typing import Dict, Any, List
import re
import ipaddress
import asyncio
from app.core.config import settings

class OsintService:
    def __init__(self):
        self.otx_url = "https://otx.alienvault.com/api/v1"
        # Read directly from env so we always get the latest value,
        # even if the .env file was updated after the process started.
        self.otx_key = os.environ.get("ALIENVAULT_OTX_KEY", "") or settings.alienvault_otx_key
        self.shodan_key = os.environ.get("SHODAN_API_KEY", "")
        self.headers = {}
        if self.otx_key:
            self.headers["X-OTX-API-KEY"] = self.otx_key

    def _normalize_query(self, query: str) -> str:
        """Strip URL schemes, paths and trailing slashes so users can paste full URLs."""
        query = query.strip()
        # Remove protocol prefix (https://, http://)
        query = re.sub(r'^https?://', '', query, flags=re.IGNORECASE)
        # Remove everything after the first '/' (path, query string, fragments)
        query = query.split('/')[0]
        # Remove port number if present (e.g. example.com:8080)
        query = re.sub(r':\d+$', '', query)
        return query.strip().lower()

    def _determine_type(self, query: str) -> str:
        # Very basic regex for IP
        if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", query):
            return "IPv4"
        # Regex for MD5/SHA1/SHA256
        if re.match(r"^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$", query):
            return "file"
        # Otherwise assume domain
        return "domain"

    async def search_indicator(self, query: str) -> Dict[str, Any]:
        query = self._normalize_query(query)
        indicator_type = self._determine_type(query)
        
        # If no API key is provided, return a clear error
        if not self.otx_key:
            return {
                "success": False,
                "error": "ALIENVAULT_OTX_KEY is not configured in backend.",
                "type": indicator_type,
                "findings": [],
                "stats": {"mentions": 0, "leaks": 0}
            }

        endpoint = f"{self.otx_url}/indicators/{indicator_type}/{query}/general"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(endpoint, headers=self.headers, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    
                    # Parse OTX data into our expected dashboard format
                    pulse_info = data.get("pulse_info", {})
                    pulses = pulse_info.get("pulses", [])
                    total_pulse_count = pulse_info.get("count", 0)
                    
                    # Map indicator type to the correct OTX URL path
                    otx_type_map = {"IPv4": "ip", "domain": "domain", "file": "file"}
                    otx_indicator_path = otx_type_map.get(indicator_type, "domain")

                    findings = []
                    for idx, pulse in enumerate(pulses[:50]):  # show up to 50 real reports
                        pulse_id = pulse.get('id', '')
                        # Severity: High if tagged with 3+ tags, Medium if 1-2, Low if none
                        tag_count = len(pulse.get('tags', []))
                        if tag_count > 2:
                            severity = "High"
                        elif tag_count > 0:
                            severity = "Medium"
                        else:
                            severity = "Low"
                        findings.append({
                            "id": f"OTX-{pulse_id[:8]}",
                            "entity": query,
                            "type": pulse.get("name", "Threat Intel Pulse"),
                            "source": "AlienVault OTX",
                            "severity": severity,
                            "time": pulse.get("modified", "N/A")[:10],
                            # Direct link to the full pulse report on AlienVault
                            "url": f"https://otx.alienvault.com/pulse/{pulse_id}"
                        })
                        
                    return {
                        "success": True,
                        "type": indicator_type,
                        "pulse_count": total_pulse_count,
                        "findings": findings,
                        "stats": {
                            # 100% accurate: total reports = Active Alerts, shown pulses = Data Leaks
                            "mentions": total_pulse_count,
                            "leaks": len(pulses)
                        }
                    }
                else:
                    err_body = ""
                    try:
                        err_body = response.text[:200]
                    except Exception:
                        pass
                    return {
                        "success": False,
                        "error": f"OTX API returned status {response.status_code}: {err_body}",
                        "findings": [],
                        "stats": {"mentions": 0, "leaks": 0}
                    }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "findings": [],
                    "stats": {"mentions": 0, "leaks": 0}
                }

    async def get_cve_details(self, cve_id: str) -> Dict[str, Any]:
        """Look up CVE details. Tries NIST NVD first, falls back to cve.circl.lu."""
        cve_id = cve_id.strip().upper()

        # ── Primary: NIST NVD API (official, high limits, no auth required) ──
        nvd_url = f"https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={cve_id}"
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(nvd_url, timeout=12.0, headers={"Accept": "application/json"})
                if r.status_code == 200:
                    data = r.json()
                    items = data.get("vulnerabilities", [])
                    if items:
                        cve_data = items[0].get("cve", {})
                        # Description
                        descriptions = cve_data.get("descriptions", [])
                        summary = next(
                            (d["value"] for d in descriptions if d.get("lang") == "en"),
                            "No description available."
                        )
                        # CVSS score — prefer v3.1 > v3.0 > v2
                        cvss = None
                        metrics = cve_data.get("metrics", {})
                        for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
                            entries = metrics.get(key, [])
                            if entries:
                                cvss = entries[0].get("cvssData", {}).get("baseScore")
                                break
                        # References
                        refs = [ref.get("url") for ref in cve_data.get("references", []) if ref.get("url")][:5]
                        # Severity label
                        severity = None
                        for key in ("cvssMetricV31", "cvssMetricV30"):
                            entries = metrics.get(key, [])
                            if entries:
                                severity = entries[0].get("cvssData", {}).get("baseSeverity")
                                break
                        return {
                            "success": True,
                            "cve": cve_data.get("id", cve_id),
                            "cvss": cvss,
                            "severity": severity,
                            "summary": summary,
                            "references": refs,
                            "published": cve_data.get("published", "")[:10],
                            "lastModified": cve_data.get("lastModified", "")[:10],
                            "source": "NIST NVD"
                        }
            except Exception:
                pass  # Fall through to backup source

        # ── Fallback: cve.circl.lu ────────────────────────────────────────────
        circl_url = f"https://cve.circl.lu/api/cve/{cve_id}"
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(circl_url, timeout=10.0)
                if r.status_code == 200:
                    data = r.json()
                    if data:
                        if "cveMetadata" in data:
                            cna = data.get("containers", {}).get("cna", {})
                            cvss = None
                            for m in cna.get("metrics", []):
                                for k in ("cvssV3_1", "cvssV3_0", "cvssV2_0"):
                                    if k in m:
                                        cvss = m[k].get("baseScore")
                                        break
                                if cvss:
                                    break
                            descriptions = cna.get("descriptions", [])
                            summary = descriptions[0].get("value", "") if descriptions else ""
                            refs = [ref.get("url") for ref in cna.get("references", []) if ref.get("url")][:5]
                            return {
                                "success": True,
                                "cve": data["cveMetadata"].get("cveId", cve_id),
                                "cvss": cvss,
                                "summary": summary,
                                "references": refs,
                                "source": "CIRCL"
                            }
                        elif data.get("id"):
                            return {
                                "success": True,
                                "cve": data.get("id"),
                                "cvss": data.get("cvss"),
                                "summary": data.get("summary"),
                                "references": data.get("references", [])[:5],
                                "source": "CIRCL"
                            }
                elif r.status_code == 429:
                    return {"success": False, "error": "Rate limited by CVE API. Please wait a moment and try again."}
                else:
                    return {"success": False, "error": f"CVE lookup failed (status {r.status_code})"}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "error": f"CVE '{cve_id}' not found in any database."}



    async def check_domain(self, domain: str) -> Dict[str, Any]:
        """Check domain reputation and WHOIS data via AlienVault OTX."""
        domain = self._normalize_query(domain)
        if not self.otx_key:
            return {
                "success": False,
                "error": "ALIENVAULT_OTX_KEY is not configured in backend.",
                "domain": domain,
            }
        endpoint = f"{self.otx_url}/indicators/domain/{domain}/general"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(endpoint, headers=self.headers, timeout=12.0)
                if response.status_code == 200:
                    data = response.json()
                    pulse_info = data.get("pulse_info", {})
                    pulses = pulse_info.get("pulses", [])
                    whois = data.get("whois", "")
                    geo = data.get("geo", {})
                    validation = data.get("validation", [])
                    alexa = data.get("alexa", "")
                    
                    # Build a simple reputation score: 100 = clean, lower = suspicious
                    pulse_count = pulse_info.get("count", 0)
                    if pulse_count == 0:
                        reputation = "Clean"
                        rep_color = "green"
                    elif pulse_count <= 3:
                        reputation = "Suspicious"
                        rep_color = "yellow"
                    else:
                        reputation = "Malicious"
                        rep_color = "red"

                    # Recent pulses (up to 10)
                    recent_pulses = [
                        {
                            "name": p.get("name", ""),
                            "tags": p.get("tags", []),
                            "modified": p.get("modified", "")[:10],
                        }
                        for p in pulses[:10]
                    ]

                    return {
                        "success": True,
                        "domain": domain,
                        "pulse_count": pulse_count,
                        "reputation": reputation,
                        "rep_color": rep_color,
                        "whois": whois,
                        "alexa_rank": alexa,
                        "country": geo.get("country_name", "Unknown") if isinstance(geo, dict) else "Unknown",
                        "validation": [v.get("name", "") for v in validation],
                        "recent_pulses": recent_pulses,
                    }
                elif response.status_code == 404:
                    return {
                        "success": True,
                        "domain": domain,
                        "pulse_count": 0,
                        "reputation": "Unknown / Not in OTX",
                        "rep_color": "gray",
                        "whois": "",
                        "alexa_rank": "",
                        "country": "Unknown",
                        "validation": [],
                        "recent_pulses": [],
                    }
                else:
                    return {"success": False, "error": f"OTX API returned status {response.status_code}"}
            except Exception as e:
                return {"success": False, "error": str(e)}



    async def get_ip_geolocation(self, ip: str) -> Dict[str, Any]:
        """Look up IP Geolocation via ip-api.com"""
        try:
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.is_private:
                return {
                    "success": True,
                    "ip": ip,
                    "country": "Local Network (LAN)",
                    "city": "Internal Routing",
                    "isp": "Private IP Address",
                    "org": "RFC 1918 / Local Router",
                    "lat": "N/A",
                    "lon": "N/A"
                }
        except ValueError:
            pass

        endpoint = f"http://ip-api.com/json/{ip}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(endpoint, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "success":
                        return {
                            "success": True,
                            "ip": ip,
                            "country": data.get("country"),
                            "city": data.get("city"),
                            "isp": data.get("isp"),
                            "org": data.get("org"),
                            "lat": data.get("lat"),
                            "lon": data.get("lon")
                        }
                    else:
                        error_msg = data.get("message", "IP lookup failed")
                        if error_msg == "private range":
                            error_msg = "This is a Local (Private) IP address used for your internal network (e.g., your home Wi-Fi). It cannot be geolocated. Please enter a Public IP address instead."
                        return {"success": False, "error": error_msg}
                return {"success": False, "error": f"API returned status {response.status_code}"}
            except Exception as e:
                return {"success": False, "error": str(e)}



    async def run_nmap(self, target: str, scan_type: str = "quick") -> Dict[str, Any]:
        """Run a Python-based port scan against a target."""
        # Define common ports to scan
        if scan_type == "full":
            ports_to_scan = list(range(1, 1025)) + [3389, 8080, 8443]
        else:
            ports_to_scan = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5432, 5900, 8080, 8443]
        
        open_ports = []
        
        async def check_port(ip, port):
            try:
                # Use a fast timeout for scanning
                conn = asyncio.open_connection(ip, port)
                reader, writer = await asyncio.wait_for(conn, timeout=0.5)
                writer.close()
                await writer.wait_closed()
                
                # Try to map common services
                services = {
                    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
                    80: "HTTP", 110: "POP3", 135: "RPC", 139: "NetBIOS",
                    143: "IMAP", 443: "HTTPS", 445: "SMB", 993: "IMAPS",
                    995: "POP3S", 1433: "MSSQL", 3306: "MySQL", 3389: "RDP",
                    5432: "PostgreSQL", 5900: "VNC", 8080: "HTTP-Proxy", 8443: "HTTPS-Alt"
                }
                
                open_ports.append({
                    "port": port,
                    "service": services.get(port, "unknown"),
                    "state": "open"
                })
            except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
                pass # Port is closed or filtered

        tasks = [check_port(target, port) for port in ports_to_scan]
        await asyncio.gather(*tasks)
        
        open_ports.sort(key=lambda x: x["port"])

        return {
            "success": True,
            "target": target,
            "scan_type": scan_type,
            "open_ports": open_ports,
            "total_scanned": len(ports_to_scan)
        }





    async def lookup_whois(self, domain: str) -> Dict[str, Any]:
        """Perform a WHOIS lookup using RDAP (Registration Data Access Protocol)."""
        endpoint = f"https://rdap.org/domain/{domain}"
        async with httpx.AsyncClient(follow_redirects=True) as client:
            try:
                response = await client.get(endpoint, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    
                    registrar = "Unknown"
                    creation_date = "Unknown"
                    expiration_date = "Unknown"
                    nameservers = []
                    
                    if "entities" in data:
                        for entity in data["entities"]:
                            if "roles" in entity and "registrar" in entity["roles"]:
                                if "vcardArray" in entity:
                                    try:
                                        registrar = entity["vcardArray"][1][1][3]
                                    except (IndexError, TypeError):
                                        registrar = entity.get("handle", "Unknown")
                                        
                    if "events" in data:
                        for event in data["events"]:
                            if event.get("eventAction") == "registration":
                                creation_date = event.get("eventDate", "Unknown")
                            elif event.get("eventAction") == "expiration":
                                expiration_date = event.get("eventDate", "Unknown")
                                
                    if "nameservers" in data:
                        for ns in data["nameservers"]:
                            nameservers.append(ns.get("ldhName", "Unknown"))
                            
                    return {
                        "success": True,
                        "domain": domain,
                        "registrar": registrar,
                        "creation_date": creation_date,
                        "expiration_date": expiration_date,
                        "nameservers": nameservers
                    }
                elif response.status_code == 404:
                    return {"success": False, "error": "Domain not found or no RDAP record available."}
                else:
                    return {"success": False, "error": f"RDAP API returned {response.status_code}"}
            except Exception as e:
                return {"success": False, "error": str(e)}

    async def lookup_shodan(self, ip: str) -> Dict[str, Any]:
        """Perform a Shodan host lookup for an IP address."""
        
        async def fetch_internetdb():
            # Shodan's free InternetDB API requires no authentication
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"https://internetdb.shodan.io/{ip}", timeout=10.0)
                    if resp.status_code == 200:
                        data = resp.json()
                        
                        # Fetch org/isp from ip-api since InternetDB doesn't have it
                        org = "Unknown"
                        isp = "Unknown"
                        try:
                            geo_resp = await client.get(f"http://ip-api.com/json/{ip}", timeout=5.0)
                            if geo_resp.status_code == 200:
                                geo_data = geo_resp.json()
                                org = geo_data.get("org") or geo_data.get("isp") or "Unknown"
                                isp = geo_data.get("isp") or "Unknown"
                        except Exception:
                            pass

                        return {
                            "success": True, 
                            "ip": data.get("ip", ip),
                            "org": org,
                            "isp": isp,
                            "os": "Unknown",
                            "ports": data.get("ports", []),
                            "vulns": data.get("vulns", []),
                            "hostnames": data.get("hostnames", []),
                            "_note": "Data fetched from Shodan InternetDB (Free Tier)"
                        }
                    return {"success": False, "error": "No information available for that IP on Shodan InternetDB."}
            except Exception as e:
                return {"success": False, "error": f"InternetDB Error: {str(e)}"}

        if not self.shodan_key:
            return await fetch_internetdb()
            
        endpoint = f"https://api.shodan.io/shodan/host/{ip}?key={self.shodan_key}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(endpoint, timeout=12.0)
                if response.status_code == 200:
                    data = response.json()
                    
                    return {
                        "success": True,
                        "ip": data.get("ip_str", ip),
                        "org": data.get("org", "Unknown"),
                        "isp": data.get("isp", "Unknown"),
                        "os": data.get("os", "Unknown"),
                        "ports": data.get("ports", []),
                        "vulns": data.get("vulns", []),
                        "hostnames": data.get("hostnames", [])
                    }
                elif response.status_code == 404:
                    return {"success": False, "error": "No information available for that IP on Shodan."}
                elif response.status_code in (401, 403):
                    # Shodan API keys on free tier often get 403, or invalid key gets 401
                    # Fallback to InternetDB
                    return await fetch_internetdb()
                else:
                    return {"success": False, "error": f"Shodan API returned status {response.status_code}"}
            except Exception as e:
                return {"success": False, "error": str(e)}
