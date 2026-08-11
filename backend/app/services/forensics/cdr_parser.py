import pandas as pd
from typing import Dict, Any, List
import io

class CDRParser:
    """
    Parses Call Detail Records (CDR) CSV files.
    Standardizes data to extract frequent callers and tower locations.
    """
    @staticmethod
    def parse_cdr(file_path: str, file_name: str) -> Dict[str, Any]:
        """
        Parses a CDR CSV file.
        Expects columns like: Date, Time, Calling_Number, Called_Number, Duration, Tower_Location, Cell_ID, IMEI
        """
        try:
            # We assume it's a CSV, try reading it
            df = pd.read_csv(file_path)
            
            # Normalize column names to lowercase and replace spaces with underscores
            df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
            
            # Try to map columns to standard names
            col_map = {
                "calling": "calling_number",
                "caller": "calling_number",
                "a_party": "calling_number",
                "called": "called_number",
                "b_party": "called_number",
                "duration": "duration",
                "tower": "tower_location",
                "location": "tower_location",
                "date": "date",
                "time": "time",
                "imei": "imei"
            }
            
            standard_df = pd.DataFrame()
            
            for standard_col, target in col_map.items():
                for actual_col in df.columns:
                    if standard_col in actual_col:
                        standard_df[target] = df[actual_col]
                        break
                        
            # If we don't have basic calling/called info, return raw stats
            if 'calling_number' not in standard_df.columns or 'called_number' not in standard_df.columns:
                return {
                    "file_name": file_name,
                    "status": "partial",
                    "error": "Could not map required columns (Calling Number, Called Number).",
                    "total_records": len(df),
                    "raw_columns": list(df.columns)
                }

            # Analysis: Frequent Callers
            frequent_callers = standard_df['called_number'].value_counts().head(10).to_dict()
            frequent_callers_list = [{"number": str(k), "count": int(v)} for k, v in frequent_callers.items()]
            
            # Analysis: Frequent Towers
            tower_locations = []
            if 'tower_location' in standard_df.columns:
                towers = standard_df['tower_location'].value_counts().head(10).to_dict()
                tower_locations = [{"location": str(k), "count": int(v)} for k, v in towers.items()]
                
            # Timeline Events
            timeline_events = []
            if 'date' in standard_df.columns:
                # Try to create a datetime column
                if 'time' in standard_df.columns:
                    datetime_col = pd.to_datetime(standard_df['date'].astype(str) + ' ' + standard_df['time'].astype(str), errors='coerce')
                else:
                    datetime_col = pd.to_datetime(standard_df['date'], errors='coerce')
                    
                # Get the first and last call
                if not datetime_col.isna().all():
                    first_call = datetime_col.min()
                    last_call = datetime_col.max()
                    
                    if pd.notna(first_call):
                        timeline_events.append({
                            "timestamp": first_call.isoformat(),
                            "description": f"First recorded call in CDR ({file_name})"
                        })
                    if pd.notna(last_call):
                        timeline_events.append({
                            "timestamp": last_call.isoformat(),
                            "description": f"Last recorded call in CDR ({file_name})"
                        })
                        
            return {
                "file_name": file_name,
                "status": "success",
                "total_records": len(df),
                "frequent_called_numbers": frequent_callers_list,
                "tower_locations": tower_locations,
                "timeline_events": timeline_events,
            }

        except Exception as e:
            return {
                "file_name": file_name,
                "status": "error",
                "error": str(e)
            }
