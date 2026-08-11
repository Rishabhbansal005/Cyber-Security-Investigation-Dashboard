import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.core.supabase_client import get_supabase_admin

db = get_supabase_admin()

import uuid

cases_data = [
    {
        "case_number": f"CCID-2026-{uuid.uuid4().hex[:6].upper()}",
        "title": "Operation Red Wire (Ransomware)",
        "description": "State-sponsored actors deploying ransomware on regional healthcare network.",
        "status": "active",
        "priority": "critical"
    },
    {
        "case_number": f"CCID-2026-{uuid.uuid4().hex[:6].upper()}",
        "title": "DarkWeb Data Breach - TechCorp",
        "description": "500GB of proprietary source code found on dark web forums.",
        "status": "open",
        "priority": "high"
    },
    {
        "case_number": f"CCID-2026-{uuid.uuid4().hex[:6].upper()}",
        "title": "Insider Exfiltration - Delta Bank",
        "description": "Unauthorized transfer of VIP customer PII by a senior executive.",
        "status": "active",
        "priority": "high"
    },
    {
        "case_number": f"CCID-2026-{uuid.uuid4().hex[:6].upper()}",
        "title": "DDoS Extortion - Govt Portal",
        "description": "Botnet targeting payment gateways of state services.",
        "status": "active",
        "priority": "medium"
    }
]

# Get a valid user ID for created_by
user_res = db.table("users").select("id").limit(1).execute()
if not user_res.data:
    print("No users found to set as created_by.")
    sys.exit(1)
user_id = user_res.data[0]["id"]

for case in cases_data:
    case["created_by"] = user_id

# Insert cases
print("Inserting cases...")
cases_res = db.table("cases").insert(cases_data).execute()
inserted_cases = cases_res.data

if not inserted_cases:
    print("Failed to insert cases.")
    sys.exit(1)

risk_data = [
    {
        "case_id": inserted_cases[0]["id"],
        "likelihood": 5,
        "impact": 5,
        "overall_risk_score": 25,
        "risk_level": "critical",
        "threat_actors": ["Lazarus Group", "APT-41", "Unknown Ransomware Affiliate"],
        "affected_assets": ["Healthcare DB Servers", "Backup SAN", "VPN Gateway"],
        "mitigation_measures": ["Isolate Network", "Deploy EDR", "Initiate IR Playbook"],
        "analyst_notes": "Immediate containment required to prevent loss of life-saving medical systems."
    },
    {
        "case_id": inserted_cases[1]["id"],
        "likelihood": 4,
        "impact": 3,
        "overall_risk_score": 12,
        "risk_level": "high",
        "threat_actors": ["DarkSide", "Initial Access Brokers"],
        "affected_assets": ["Source Code Repos", "Developer Workstations"],
        "mitigation_measures": ["Revoke VPN Certs", "Rotate Passwords", "Audit Source Control"],
        "analyst_notes": "Data is already leaked. Focus on preventing further access."
    },
    {
        "case_id": inserted_cases[2]["id"],
        "likelihood": 3,
        "impact": 4,
        "overall_risk_score": 12,
        "risk_level": "high",
        "threat_actors": ["Malicious Insider"],
        "affected_assets": ["Customer DB", "Employee Endpoint"],
        "mitigation_measures": ["Revoke Access", "Seize Device", "Inform Legal"],
        "analyst_notes": "High risk of reputational damage. Legal hold placed on all internal comms."
    },
    {
        "case_id": inserted_cases[3]["id"],
        "likelihood": 2,
        "impact": 2,
        "overall_risk_score": 4,
        "risk_level": "low",
        "threat_actors": ["Script Kiddies", "Hacktivist Group"],
        "affected_assets": ["Web Server Front-end"],
        "mitigation_measures": ["Enable WAF", "Rate Limiting", "Contact ISP"],
        "analyst_notes": "Minor impact so far. Standard DDoS mitigation is holding."
    }
]

print("Inserting risk assessments...")
db.table("risk_assessments").insert(risk_data).execute()
print("Successfully added 4 cases and 4 risk assessments!")
