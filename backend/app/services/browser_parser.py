import os
import sqlite3
import json
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class BrowserParser:
    @staticmethod
    def parse_chrome_history(file_path: str) -> Dict[str, Any]:
        """Parse Chrome History SQLite database."""
        result = {
            "browser_type": "chrome",
            "history_entries": [],
            "downloads": [],
            "search_terms": [],
            "suspicious_urls": [],
            "cookies": [],
            "bookmarks": []
        }
        
        if not os.path.exists(file_path) or os.path.getsize(file_path) < 100:
            logger.warning("Chrome history file missing or too small: %s", file_path)
            result["error_message"] = "History file could not be read."
            return result
            
        try:
            # Check if valid SQLite
            with open(file_path, 'rb') as f:
                header = f.read(16)
                if header != b'SQLite format 3\x00':
                    logger.warning("Not a valid SQLite Chrome history file")
                    result["error_message"] = "File is not a valid Chrome History database."
                    return result

            conn = sqlite3.connect(file_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Extract URLs
            cursor.execute('''
                SELECT urls.url, urls.title, urls.visit_count, 
                       datetime(visits.visit_time/1000000-11644473600, 'unixepoch') as visit_time
                FROM urls 
                JOIN visits ON urls.id = visits.url 
                ORDER BY visits.visit_time DESC LIMIT 1000
            ''')
            
            for row in cursor.fetchall():
                url = row['url']
                entry = {
                    "url": url,
                    "title": row['title'],
                    "visit_count": row['visit_count'],
                    "visit_time": row['visit_time']
                }
                result["history_entries"].append(entry)
                
                # Check for suspicious URLs
                if "darkweb" in url or ".onion" in url or "hacking" in url:
                    result["suspicious_urls"].append({
                        "url": url,
                        "reason": "Known suspicious keyword or domain",
                        "severity": "high"
                    })
                    
                # Extract search terms (simple heuristic)
                if "google.com/search?q=" in url:
                    try:
                        import urllib.parse
                        parsed = urllib.parse.urlparse(url)
                        qs = urllib.parse.parse_qs(parsed.query)
                        if 'q' in qs:
                            result["search_terms"].append({
                                "engine": "Google",
                                "term": qs['q'][0],
                                "time": row['visit_time']
                            })
                    except Exception:
                        pass
                        
            # Extract Downloads
            cursor.execute('''
                SELECT target_path, start_time, received_bytes, total_bytes 
                FROM downloads 
                ORDER BY start_time DESC LIMIT 100
            ''')
            for row in cursor.fetchall():
                result["downloads"].append({
                    "path": row['target_path'],
                    "received_bytes": row['received_bytes'],
                    "total_bytes": row['total_bytes']
                })
                
            conn.close()
            return result
        except Exception as e:
            logger.error(f"Error parsing Chrome History: {e}")
            result["error_message"] = str(e)
            return result
