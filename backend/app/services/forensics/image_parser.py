import logging
import exifread
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ImageParser:
    @staticmethod
    def _convert_to_degrees(value):
        """Helper function to convert GPS coordinates to degrees."""
        d0 = value.values[0].num
        d1 = value.values[0].den
        d = float(d0) / float(d1)

        m0 = value.values[1].num
        m1 = value.values[1].den
        m = float(m0) / float(m1)

        s0 = value.values[2].num
        s1 = value.values[2].den
        s = float(s0) / float(s1)

        return d + (m / 60.0) + (s / 3600.0)

    @staticmethod
    def parse_image(file_path: str, original_file_name: str) -> Dict[str, Any]:
        """Parse Image files for EXIF data (GPS, timestamps, etc)."""
        try:
            with open(file_path, "rb") as f:
                return ImageParser.parse_stream(f, original_file_name)
        except Exception as e:
            logger.error(f"Error parsing Image file {file_path}: {e}")
            return {
                "exif_data": {},
                "gps_coordinates": None,
                "timeline_events": [],
                "analysis_summary": {"has_exif": False, "has_gps": False},
            }

    @staticmethod
    def parse_stream(stream, original_file_name: str) -> Dict[str, Any]:
        """Parse Image files for EXIF data (GPS, timestamps, etc)."""
        results = {
            "exif_data": {},
            "gps_coordinates": None,
            "timeline_events": [],
            "analysis_summary": {
                "has_exif": False,
                "has_gps": False
            }
        }
        
        try:
            tags = exifread.process_file(stream, details=False)
                
            if not tags:
                return results

            results["analysis_summary"]["has_exif"] = True
            
            exif_summary = {}
            for tag in tags.keys():
                if tag not in ('JPEGThumbnail', 'TIFFThumbnail', 'Filename', 'EXIF MakerNote'):
                    exif_summary[tag] = str(tags[tag])
                    
            results["exif_data"] = exif_summary
            
            # Extract GPS
            gps_lat = tags.get('GPS GPSLatitude')
            gps_lat_ref = tags.get('GPS GPSLatitudeRef')
            gps_lon = tags.get('GPS GPSLongitude')
            gps_lon_ref = tags.get('GPS GPSLongitudeRef')
            
            if gps_lat and gps_lat_ref and gps_lon and gps_lon_ref:
                lat = ImageParser._convert_to_degrees(gps_lat)
                if gps_lat_ref.values[0] != 'N':
                    lat = 0 - lat
                    
                lon = ImageParser._convert_to_degrees(gps_lon)
                if gps_lon_ref.values[0] != 'E':
                    lon = 0 - lon
                    
                results["gps_coordinates"] = {"lat": lat, "lon": lon}
                results["analysis_summary"]["has_gps"] = True
                
            # Extract DateTime
            date_time = tags.get('Image DateTime') or tags.get('EXIF DateTimeOriginal')
            if date_time:
                # EXIF format is usually YYYY:MM:DD HH:MM:SS
                dt_str = str(date_time)
                try:
                    dt_iso = dt_str.replace(':', '-', 2).replace(' ', 'T')
                    results["timeline_events"].append({
                        "event_type": "image_creation",
                        "timestamp": dt_iso,
                        "description": f"Image {original_file_name} created or modified based on EXIF data."
                    })
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Error parsing Image stream {original_file_name}: {e}")
            
        return results
