import httpx
import asyncio
from typing import Dict, Any, List

class SocmintService:
    """
    Social Media Intelligence (SOCMINT) service.
    Queries various social platforms to check if a username exists.
    """
    
    # A simplified list of platforms with their profile URLs.
    # We replace {username} to check the URL.
    PLATFORMS = {
        "Instagram": "https://www.instagram.com/{username}/",
        "Twitter/X": "https://twitter.com/{username}",
        "GitHub": "https://github.com/{username}",
        "Reddit": "https://www.reddit.com/user/{username}",
        "Pinterest": "https://www.pinterest.com/{username}/",
        "TikTok": "https://www.tiktok.com/@{username}",
        "YouTube": "https://www.youtube.com/@{username}"
    }

    @staticmethod
    async def _check_platform(client: httpx.AsyncClient, platform: str, url_template: str, username: str) -> Dict[str, Any]:
        url = url_template.format(username=username)
        try:
            # We use GET with some standard headers to avoid blocks
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
            }
            response = await client.get(url, headers=headers, follow_redirects=True, timeout=5.0)
            
            # 200 usually means profile exists, 404 means it does not.
            # Some sites return 200 for 404s but this is a basic heuristic for OSINT.
            if response.status_code == 200:
                # Basic check to see if the page seems like a profile and not a generic "not found" page
                if "page not found" not in response.text.lower() and "doesn't exist" not in response.text.lower():
                    return {"platform": platform, "url": url, "exists": True, "status_code": 200}
                
            return {"platform": platform, "url": url, "exists": False, "status_code": response.status_code}
        except Exception as e:
            return {"platform": platform, "url": url, "exists": False, "error": str(e)}

    @classmethod
    async def search_username(cls, username: str) -> Dict[str, Any]:
        """
        Searches for a username across defined platforms concurrently.
        """
        results = []
        async with httpx.AsyncClient() as client:
            tasks = []
            for platform, url_template in cls.PLATFORMS.items():
                tasks.append(cls._check_platform(client, platform, url_template, username))
            
            completed_tasks = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in completed_tasks:
                if isinstance(result, Exception):
                    continue
                results.append(result)
                
        # Count how many found
        found_count = sum(1 for r in results if r.get('exists'))
        
        return {
            "success": True,
            "username": username,
            "total_platforms_checked": len(cls.PLATFORMS),
            "found_count": found_count,
            "results": results
        }
