"""
Report Generation Service using ReportLab.

Generates professional, enterprise-grade DFIR investigation reports.
"""
import io
from datetime import datetime
from typing import Dict, Any, List, Optional
from collections import defaultdict

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

# Corporate Color palette
DARK_BLUE = colors.HexColor("#0f172a")
TEAL = colors.HexColor("#0284c7")
LIGHT_GRAY = colors.HexColor("#f8fafc")
MID_GRAY = colors.HexColor("#475569")
BORDER_COLOR = colors.HexColor("#cbd5e1")
RED_ACCENT = colors.HexColor("#b91c1c")

SEVERITY_COLORS = {
    "critical": colors.HexColor("#dc2626"),
    "high": colors.HexColor("#ea580c"),
    "medium": colors.HexColor("#ca8a04"),
    "low": colors.HexColor("#16a34a"),
    "informational": colors.HexColor("#2563eb"),
}

RISK_COLORS = {
    "critical": colors.HexColor("#dc2626"),
    "high": colors.HexColor("#ea580c"),
    "medium": colors.HexColor("#ca8a04"),
    "low": colors.HexColor("#16a34a"),
}

def get_styles() -> Dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    styles = {}

    styles["cover_org"] = ParagraphStyle(
        "cover_org", parent=base["Title"],
        fontSize=14, textColor=MID_GRAY, spaceAfter=8, fontName="Helvetica-Bold", alignment=TA_CENTER, letterSpacing=2
    )
    styles["cover_super"] = ParagraphStyle(
        "cover_super", parent=base["Title"],
        fontSize=20, textColor=RED_ACCENT, spaceAfter=12, fontName="Helvetica-Bold", alignment=TA_CENTER
    )
    styles["cover_title"] = ParagraphStyle(
        "cover_title", parent=base["Title"],
        fontSize=32, textColor=DARK_BLUE, spaceAfter=8, fontName="Helvetica-Bold", alignment=TA_CENTER
    )
    styles["cover_subtitle"] = ParagraphStyle(
        "cover_subtitle", parent=base["Normal"],
        fontSize=16, textColor=MID_GRAY, spaceAfter=24, fontName="Helvetica", alignment=TA_CENTER
    )
    styles["h1"] = ParagraphStyle(
        "h1", parent=base["Heading1"],
        fontSize=18, textColor=DARK_BLUE, spaceBefore=20, spaceAfter=12, fontName="Helvetica-Bold",
        borderPadding=0,
    )
    styles["h2"] = ParagraphStyle(
        "h2", parent=base["Heading2"],
        fontSize=14, textColor=DARK_BLUE, spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold",
    )
    styles["h3"] = ParagraphStyle(
        "h3", parent=base["Heading3"],
        fontSize=12, textColor=TEAL, spaceBefore=12, spaceAfter=6, fontName="Helvetica-Bold",
    )
    styles["body"] = ParagraphStyle(
        "body", parent=base["Normal"],
        fontSize=10, textColor=colors.HexColor("#334155"), spaceAfter=8, leading=14, alignment=TA_JUSTIFY
    )
    styles["small"] = ParagraphStyle(
        "small", parent=base["Normal"],
        fontSize=9, textColor=MID_GRAY, leading=12
    )
    styles["label"] = ParagraphStyle(
        "label", parent=base["Normal"],
        fontSize=9, textColor=MID_GRAY, fontName="Helvetica-Bold", spaceAfter=2,
    )
    styles["disclaimer"] = ParagraphStyle(
        "disclaimer", parent=base["Normal"],
        fontSize=10, textColor=colors.HexColor("#dc2626"), alignment=TA_CENTER, fontName="Helvetica-Bold", spaceAfter=6
    )
    styles["bullet"] = ParagraphStyle(
        "bullet", parent=base["Normal"],
        fontSize=10, textColor=colors.HexColor("#334155"), leading=14, spaceAfter=4, leftIndent=12, bulletIndent=4
    )
    return styles

def create_header_footer(canvas, doc, case_number, investigator_name):
    """Draws the header and footer on each page."""
    canvas.saveState()
    
    # Header
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(MID_GRAY)
    canvas.drawString(2*cm, A4[1] - 1.5*cm, f"DFIR Investigation Report: {case_number}")
    
    canvas.setFont('Helvetica', 9)
    canvas.drawRightString(A4[0] - 2*cm, A4[1] - 1.5*cm, datetime.utcnow().strftime("%Y-%m-%d UTC"))
    
    # Header Line
    canvas.setStrokeColor(BORDER_COLOR)
    canvas.setLineWidth(0.5)
    canvas.line(2*cm, A4[1] - 1.7*cm, A4[0] - 2*cm, A4[1] - 1.7*cm)

    # Footer Line
    canvas.line(2*cm, 2*cm, A4[0] - 2*cm, 2*cm)
    
    # Footer
    canvas.setFont('Helvetica', 9)
    canvas.drawString(2*cm, 1.5*cm, f"Investigator: {investigator_name}")
    canvas.drawCentredString(A4[0]/2.0, 1.5*cm, f"- Page {doc.page} -")
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(RED_ACCENT)
    canvas.drawRightString(A4[0] - 2*cm, 1.5*cm, "CONFIDENTIAL")
    
    canvas.restoreState()


def generate_case_report(
    case: Dict[str, Any],
    evidence_list: List[Dict[str, Any]],
    findings: List[Dict[str, Any]],
    timeline_events: List[Dict[str, Any]],
    risk_assessment: Optional[Dict[str, Any]],
    investigator: Dict[str, Any],
    config: Dict[str, Any],
    memory_results: Optional[List[Dict[str, Any]]] = None,
    correlations: Optional[List[Dict[str, Any]]] = None,
) -> bytes:
    buffer = io.BytesIO()
    styles = get_styles()
    
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=3*cm, bottomMargin=3*cm,
        title=f"Investigation Report - {case.get('case_number', 'N/A')}"
    )

    story = []

    # Safe accessors for investigator (N/A fallback)
    inv_name = investigator.get("full_name") or "N/A"
    inv_email = investigator.get("email") or "N/A"
    inv_role = investigator.get("role") or "N/A"

    risk_level_str = risk_assessment.get("risk_level", "unknown").upper() if risk_assessment else "UNASSESSED"

    # ============================================================
    # 1. PROFESSIONAL COVER PAGE
    # ============================================================
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph("CONFIDENTIAL", styles["cover_super"]))
    story.append(Paragraph("CCID SECURITY OPERATIONS", styles["cover_org"]))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("DIGITAL FORENSICS & INCIDENT RESPONSE", ParagraphStyle("sub", fontSize=14, textColor=MID_GRAY, alignment=TA_CENTER, fontName="Helvetica-Bold", letterSpacing=1, spaceAfter=8)))
    story.append(Paragraph("INVESTIGATION REPORT", styles["cover_title"]))
    story.append(Spacer(1, 1.5*cm))

    case_meta = [
        ["CASE NUMBER", case.get("case_number", "N/A")],
        ["CASE TITLE", case.get("title", "N/A")],
        ["REPORT CLASSIFICATION", "CONFIDENTIAL"],
        ["CASE PRIORITY", _badge_text(case.get("priority", "N/A"))],
        ["RISK LEVEL", risk_level_str],
        ["LEAD INVESTIGATOR", inv_name],
        ["REPORT VERSION", "v1.0"],
        ["GENERATED DATE", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")],
    ]
    meta_table = Table(case_meta, colWidths=[6*cm, 8*cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), MID_GRAY),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("TEXTCOLOR", (1, 0), (1, -1), DARK_BLUE),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
    ]))
    story.append(meta_table)
    
    story.append(Spacer(1, 4*cm))
    story.append(Paragraph("Generated By:", ParagraphStyle("gen_by", fontSize=9, textColor=MID_GRAY, alignment=TA_CENTER)))
    story.append(Paragraph("Cyber Crime Investigation Dashboard", ParagraphStyle("gen_sys", fontSize=11, textColor=DARK_BLUE, fontName="Helvetica-Bold", alignment=TA_CENTER)))
    
    story.append(PageBreak())

    # ============================================================
    # 2. TABLE OF CONTENTS
    # ============================================================
    story.append(Paragraph("Table of Contents", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    sections = [
        "1. Executive Summary",
        "2. Case Overview",
        "3. Investigation Statistics",
        "4. Evidence Inventory",
        "5. Chain of Custody",
        "6. Investigation Findings",
        "7. MITRE ATT&CK Analysis",
        "8. Forensic Analysis Results",
        "9. Timeline Reconstruction",
        "10. Risk & Impact Assessment",
        "11. Investigation Intelligence & Correlations",
        "12. Aggregated Recommendations",
        "13. Conclusion",
        "14. Report Authorization",
        "15. Appendix"
    ]
    
    for sec in sections:
        story.append(Paragraph(sec, ParagraphStyle("toc", fontSize=11, fontName="Helvetica-Bold", spaceAfter=12, textColor=DARK_BLUE)))
    
    story.append(PageBreak())

    # ============================================================
    # 3. EXECUTIVE SUMMARY
    # ============================================================
    story.append(Paragraph("1. Executive Summary", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    critical_count = sum(1 for f in findings if f.get("severity") == "critical")
    high_count = sum(1 for f in findings if f.get("severity") == "high")
    
    narrative = (
        f"This digital forensics investigation was initiated in response to suspected security incidents or policy violations "
        f"documented under case {case.get('case_number', 'N/A')}. The primary objective was to conduct a thorough technical analysis "
        f"to determine the scope, impact, and root cause of the activity.\n\n"
        f"Forensic analysis of {len(evidence_list)} acquired digital evidence artifacts identified {len(findings)} technical findings. "
    )
    
    if critical_count > 0:
        narrative += f"Notably, the investigation uncovered {critical_count} Critical severity and {high_count} High severity findings that require immediate attention. "
    elif high_count > 0:
        narrative += f"The investigation uncovered {high_count} High severity findings that represent a significant risk. "
    else:
        narrative += "No Critical or High severity findings were identified during the analysis. "
        
    narrative += f"Based on the assessed likelihood and impact of these findings, the overall incident risk level is classified as {risk_level_str}.\n\n"
    narrative += "This document serves as the formal forensic report detailing the evidence acquired, the timeline of events reconstructed, and actionable recommendations for remediation."

    for p in narrative.split("\n\n"):
        story.append(Paragraph(p, styles["body"]))
        
    story.append(PageBreak())

    # ============================================================
    # 4. CASE OVERVIEW
    # ============================================================
    story.append(Paragraph("2. Case Overview", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    ov_data = [
        [Paragraph("<b>Case Number:</b>", styles["body"]), Paragraph(case.get("case_number", "N/A"), styles["body"])],
        [Paragraph("<b>Case Title:</b>", styles["body"]), Paragraph(case.get("title", "N/A"), styles["body"])],
        [Paragraph("<b>Incident Type:</b>", styles["body"]), Paragraph(case.get("incident_type", "N/A"), styles["body"])],
        [Paragraph("<b>Category:</b>", styles["body"]), Paragraph(case.get("category", "N/A"), styles["body"])],
        [Paragraph("<b>Priority:</b>", styles["body"]), Paragraph(_badge_text(case.get("priority", "N/A")), styles["body"])],
        [Paragraph("<b>Current Status:</b>", styles["body"]), Paragraph(_badge_text(case.get("status", "N/A")), styles["body"])],
        [Paragraph("<b>Lead Investigator:</b>", styles["body"]), Paragraph(inv_name, styles["body"])],
        [Paragraph("<b>Created Date:</b>", styles["body"]), Paragraph(_format_date(case.get("created_at")), styles["body"])],
        [Paragraph("<b>Last Updated Date:</b>", styles["body"]), Paragraph(_format_date(case.get("updated_at")), styles["body"])],
    ]
    ov_table = Table(ov_data, colWidths=[5*cm, 11*cm])
    ov_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(ov_table)
    
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("<b>Case Description:</b>", styles["body"]))
    story.append(Paragraph(case.get("description", "N/A"), styles["body"]))
    story.append(PageBreak())
    
    # ============================================================
    # 5. INVESTIGATION STATISTICS
    # ============================================================
    story.append(Paragraph("3. Investigation Statistics", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    # Calculate duration
    try:
        start_date = datetime.fromisoformat(case.get("created_at").replace("Z", "+00:00"))
        end_date = datetime.fromisoformat(case.get("updated_at").replace("Z", "+00:00"))
        duration_days = max(1, (end_date - start_date).days)
        duration_str = f"{duration_days} days"
    except Exception:
        duration_str = "N/A"

    stat_data = [
        [Paragraph("<b>Total Evidence Items</b>", styles["body"]), Paragraph(str(len(evidence_list)), styles["body"])],
        [Paragraph("<b>Total Findings</b>", styles["body"]), Paragraph(str(len(findings)), styles["body"])],
        [Paragraph("<b>Critical Findings</b>", styles["body"]), Paragraph(str(critical_count), styles["body"])],
        [Paragraph("<b>Timeline Events Logged</b>", styles["body"]), Paragraph(str(len(timeline_events)), styles["body"])],
        [Paragraph("<b>Risk Score</b>", styles["body"]), Paragraph(f"{risk_assessment.get('overall_risk_score', 'N/A')} / 25" if risk_assessment else "N/A", styles["body"])],
        [Paragraph("<b>Case Duration</b>", styles["body"]), Paragraph(duration_str, styles["body"])],
    ]
    stat_table = Table(stat_data, colWidths=[8*cm, 8*cm])
    stat_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(stat_table)
    story.append(PageBreak())

    # ============================================================
    # 6. EVIDENCE INVENTORY
    # ============================================================
    story.append(Paragraph("4. Evidence Inventory", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    if not evidence_list:
        story.append(Paragraph("No evidence items have been logged for this case.", styles["body"]))
    else:
        ev_data = [["Evidence No.", "File Details", "Hash / Status"]]
        for ev in evidence_list:
            sha256 = ev.get("hash_sha256", "N/A")
            short_hash = f"{sha256[:12]}...{sha256[-8:]}" if len(sha256) > 25 else sha256
            size_mb = f"{(ev.get('file_size', 0) / (1024*1024)):.2f} MB"
            
            ev_data.append([
                Paragraph(f"<b>{ev.get('evidence_number', 'EV-???')}</b>", styles["small"]),
                Paragraph(f"Name: {ev.get('original_file_name', 'N/A')}<br/>Type: {ev.get('evidence_type', 'digital')}<br/>Size: {size_mb}", styles["small"]),
                Paragraph(f"SHA256:<br/>{short_hash}<br/><br/>Status: <b>{'Verified' if ev.get('is_verified') else 'Pending'}</b>", styles["small"]),
            ])

        ev_table = Table(ev_data, colWidths=[3*cm, 8*cm, 5.5*cm])
        ev_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
        story.append(ev_table)
    story.append(PageBreak())

    # ============================================================
    # 7. CHAIN OF CUSTODY
    # ============================================================
    story.append(Paragraph("5. Chain of Custody", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    if not evidence_list:
        story.append(Paragraph("No evidence items logged.", styles["body"]))
    else:
        coc_data = [["Evidence No.", "Collection Date", "Collected By", "Current Custodian", "Verification"]]
        for ev in evidence_list:
            coc_data.append([
                Paragraph(ev.get("evidence_number", "EV-???"), styles["small"]),
                Paragraph(_format_date(ev.get("collection_date", ev.get("created_at"))), styles["small"]),
                Paragraph(ev.get("collected_by", "N/A"), styles["small"]),
                Paragraph(inv_name, styles["small"]), # Assuming investigator is custodian
                Paragraph("VERIFIED" if ev.get("is_verified") else "UNVERIFIED", ParagraphStyle("s", fontSize=8, textColor=colors.HexColor("#16a34a") if ev.get("is_verified") else colors.HexColor("#dc2626"), fontName="Helvetica-Bold")),
            ])
            
        coc_table = Table(coc_data, colWidths=[2.5*cm, 3.5*cm, 4*cm, 4*cm, 2.5*cm])
        coc_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ]))
        story.append(coc_table)
    story.append(PageBreak())

    # ============================================================
    # 8. INVESTIGATION FINDINGS
    # ============================================================
    story.append(Paragraph("6. Investigation Findings", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))

    if not findings:
        story.append(Paragraph("No findings have been recorded.", styles["body"]))
    else:
        for i, finding in enumerate(findings, 1):
            severity = finding.get("severity", "low")
            sev_color = SEVERITY_COLORS.get(severity, MID_GRAY)
            f_num = finding.get("finding_number", f"FN-{i:04d}")

            story.append(KeepTogether([
                Paragraph(f"{f_num} — {finding.get('title', 'N/A')}", styles["h2"]),
                Table(
                    [
                        [
                            Paragraph(f"<b>Finding ID:</b> {f_num}", styles["small"]),
                            Paragraph(f"<b>Severity:</b> {severity.upper()}", ParagraphStyle("b", textColor=sev_color, fontSize=9, fontName="Helvetica-Bold")),
                            Paragraph(f"<b>Status:</b> {finding.get('status', 'open').upper()}", styles["small"]),
                        ],
                        [
                            Paragraph(f"<b>Category:</b> {finding.get('category', 'N/A')}", styles["small"]),
                            Paragraph(f"<b>Linked Evidence:</b> {finding.get('evidence_id', 'N/A')[:8]}...", styles["small"]),
                            Paragraph(f"<b>MITRE:</b> {finding.get('mitre_technique', 'N/A')}", styles["small"]),
                        ]
                    ],
                    colWidths=[5.5*cm, 5.5*cm, 5.5*cm],
                    style=[
                        ("BACKGROUND", (0,0), (-1,-1), LIGHT_GRAY), 
                        ("GRID", (0,0), (-1,-1), 0.5, BORDER_COLOR),
                        ("TOPPADDING", (0,0), (-1,-1), 6), 
                        ("BOTTOMPADDING", (0,0), (-1,-1), 6)
                    ]
                ),
                Spacer(1, 8),
                Paragraph("<b>Description:</b>", styles["body"]),
                Paragraph(finding.get("description", "N/A"), styles["body"]),
                Spacer(1, 4),
                Paragraph("<b>Impact:</b>", styles["body"]),
                Paragraph(finding.get("impact", "N/A") if finding.get("impact") else "Impact not explicitly defined.", styles["body"]),
                Spacer(1, 4),
                Paragraph("<b>Recommendations:</b>", styles["body"]),
                Paragraph(finding.get("recommendations", "N/A") if finding.get("recommendations") else "No recommendations provided.", styles["body"]),
                Spacer(1, 16),
                HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceAfter=16)
            ]))
    story.append(PageBreak())

    # ============================================================
    # 9. MITRE ATT&CK ANALYSIS
    # ============================================================
    story.append(Paragraph("7. MITRE ATT&CK Analysis", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    if not findings:
        story.append(Paragraph("No findings exist to map to MITRE ATT&CK.", styles["body"]))
    else:
        m_data = [["Tactic", "Technique", "Technique ID", "Associated Finding"]]
        has_mitre = False
        
        for f in findings:
            tactic = f.get("mitre_tactic")
            technique = f.get("mitre_technique")
            if tactic and technique:
                has_mitre = True
                m_data.append([
                    Paragraph(tactic, styles["small"]),
                    Paragraph(technique, styles["small"]),
                    Paragraph(f.get("mitre_technique_id", "N/A"), styles["small"]),
                    Paragraph(f.get('finding_number', 'FN-XX'), styles["small"])
                ])
                
        if not has_mitre:
            story.append(Paragraph("No explicit MITRE ATT&CK mappings identified in the findings.", styles["body"]))
        else:
            m_table = Table(m_data, colWidths=[4*cm, 6*cm, 3*cm, 3.5*cm])
            m_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), DARK_BLUE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0,0), (-1,-1), "TOP"),
            ]))
            story.append(m_table)
    story.append(PageBreak())

    # ============================================================
    # 9. FORENSIC ANALYSIS RESULTS
    # ============================================================
    story.append(Paragraph("8. Forensic Analysis Results", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))

    if not memory_results:
        story.append(Paragraph("No automated memory analysis or network analysis results were recorded.", styles["body"]))
    else:
        story.append(Paragraph("<b>Memory Analysis (Volatility 3)</b>", styles["h2"]))
        for mem in memory_results:
            if mem.get('analysis_status') == 'completed':
                story.append(Paragraph(f"Evidence ID: {mem.get('evidence_id')[:8]}...", styles["small"]))
                summary = mem.get("analysis_summary", {})
                profile = mem.get("memory_profile", "Unknown")
                story.append(Paragraph(f"<b>Profile:</b> {profile}", styles["body"]))
                story.append(Paragraph(f"<b>Total Processes:</b> {summary.get('total_processes', 0)}", styles["body"]))
                story.append(Paragraph(f"<b>Suspicious Processes (malfind hits):</b> {summary.get('malfind_hits', 0)}", styles["body"]))
                
                malfind_hits = mem.get("suspicious_processes", [])
                if malfind_hits:
                    story.append(Spacer(1, 6))
                    story.append(Paragraph("<i>Top Suspicious Injections:</i>", styles["small"]))
                    for hit in malfind_hits[:3]:
                        story.append(Paragraph(f"• PID: {hit.get('PID')} ({hit.get('Process')}) - Protection: {hit.get('Protection')}", styles["bullet"]))
                story.append(Spacer(1, 12))
            else:
                story.append(Paragraph("Memory analysis pending or failed for an evidence item.", styles["body"]))

    story.append(PageBreak())

    # ============================================================
    # 10. TIMELINE RECONSTRUCTION
    # ============================================================
    story.append(Paragraph("9. Timeline Reconstruction", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))

    if not timeline_events:
        story.append(Paragraph("No timeline events recorded.", styles["body"]))
    else:
        t_data = [["Timestamp", "Marker", "Event Details"]]
        
        # Sort chronologically
        try:
            sorted_events = sorted(timeline_events, key=lambda x: x.get("event_time", ""))
        except Exception:
            sorted_events = timeline_events

        for event in sorted_events:
            event_type = event.get("event_type", "event").lower()
            if "detect" in event_type or "alert" in event_type: marker = "● Detection"
            elif "evidence" in event_type or "acquire" in event_type: marker = "● Collection"
            elif "analy" in event_type or "find" in event_type: marker = "● Analysis"
            else: marker = "● Event"

            t_data.append([
                Paragraph(f"<b>{_format_date(event.get('event_time'))}</b>", styles["small"]),
                Paragraph(f"<font color='{TEAL}'><b>{marker}</b></font>", styles["small"]),
                Paragraph(f"<b>{event.get('title', 'N/A')}</b><br/>{event.get('description', 'N/A')}<br/><i>Source: {event.get('source', 'Manual')}</i>", styles["small"]),
            ])

        t_table = Table(t_data, colWidths=[3.5*cm, 3*cm, 10*cm])
        t_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ]))
        story.append(t_table)
    story.append(PageBreak())

    # ============================================================
    # 11. RISK & IMPACT ASSESSMENT
    # ============================================================
    story.append(Paragraph("10. Risk & Impact Assessment", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))

    if not risk_assessment:
        story.append(Paragraph("No risk assessment has been completed for this case.", styles["body"]))
    else:
        r_level = risk_assessment.get("risk_level", "unknown")
        r_color = RISK_COLORS.get(r_level, MID_GRAY)
        l_score = risk_assessment.get("likelihood", 0)
        i_score = risk_assessment.get("impact", 0)

        # Risk Score Block
        story.append(Table(
            [
                ["Overall Risk Level", Paragraph(r_level.upper(), ParagraphStyle("rl", textColor=colors.white, fontName="Helvetica-Bold", alignment=TA_CENTER))],
                ["Likelihood", f"{l_score} / 5"],
                ["Impact", f"{i_score} / 5"],
                ["Risk Score", f"{risk_assessment.get('overall_risk_score', 'N/A')} / 25"],
            ],
            colWidths=[7*cm, 4*cm],
            style=[
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("BACKGROUND", (1, 0), (1, 0), r_color),
                ("BACKGROUND", (0, 0), (0, -1), LIGHT_GRAY),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        ))
        story.append(Spacer(1, 1*cm))
        
        # 5x5 Heatmap
        story.append(Paragraph("<b>Risk Heatmap</b> (Likelihood vs Impact)", styles["body"]))
        matrix_data = [["", "Impact 1", "Impact 2", "Impact 3", "Impact 4", "Impact 5"]]
        for row_l in range(5, 0, -1):
            row_data = [f"Likelihood {row_l}"]
            for col_i in range(1, 6):
                val = row_l * col_i
                if row_l == l_score and col_i == i_score:
                    cell_text = Paragraph("<b>[ X ]</b>", ParagraphStyle("x", alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=14))
                else:
                    cell_text = str(val)
                row_data.append(cell_text)
            matrix_data.append(row_data)
            
        m_style = [
            ("GRID", (0, 0), (-1, -1), 1, colors.white),
            ("BACKGROUND", (0, 0), (-1, 0), DARK_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BACKGROUND", (0, 1), (0, -1), DARK_BLUE),
            ("TEXTCOLOR", (0, 1), (0, -1), colors.white),
            ("ALIGN", (1, 1), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
        
        for r_idx in range(1, 6):
            row_l = 6 - r_idx
            for c_idx in range(1, 6):
                val = row_l * c_idx
                if val >= 20: bg = colors.HexColor("#fca5a5") # Red
                elif val >= 10: bg = colors.HexColor("#fde047") # Yellow
                elif val >= 5: bg = colors.HexColor("#86efac") # Green
                else: bg = colors.HexColor("#dcfce3") # Light Green
                
                # Darken the selected cell explicitly
                if row_l == l_score and c_idx == i_score:
                    m_style.append(("BOX", (c_idx, r_idx), (c_idx, r_idx), 2, DARK_BLUE))
                    
                m_style.append(("BACKGROUND", (c_idx, r_idx), (c_idx, r_idx), bg))
                
        matrix_table = Table(matrix_data, colWidths=[2.5*cm] + [2.2*cm]*5, rowHeights=[1*cm]*6)
        matrix_table.setStyle(TableStyle(m_style))
        story.append(matrix_table)
        
        story.append(Spacer(1, 1*cm))
        
        # Details
        story.append(Paragraph("<b>Threat Actors:</b>", styles["body"]))
        tas = risk_assessment.get("threat_actors", [])
        if tas:
            for t in tas: story.append(Paragraph(f"• {t}", styles["bullet"]))
        else:
            story.append(Paragraph("N/A", styles["bullet"]))
            
        story.append(Paragraph("<b>Affected Assets:</b>", styles["body"]))
        aas = risk_assessment.get("affected_assets", [])
        if aas:
            for a in aas: story.append(Paragraph(f"• {a}", styles["bullet"]))
        else:
            story.append(Paragraph("N/A", styles["bullet"]))
            
        story.append(Paragraph("<b>Mitigation Measures:</b>", styles["body"]))
        mms = risk_assessment.get("mitigation_measures", [])
        if mms:
            for m in mms: story.append(Paragraph(f"• {m}", styles["bullet"]))
        else:
            story.append(Paragraph("N/A", styles["bullet"]))
            
        story.append(Paragraph("<b>Analyst Notes:</b>", styles["body"]))
        story.append(Paragraph(risk_assessment.get("analyst_notes") or "N/A", styles["body"]))
            
    story.append(PageBreak())

    # ============================================================
    # 11. INVESTIGATION INTELLIGENCE & CORRELATIONS
    # ============================================================
    story.append(Paragraph("11. Investigation Intelligence & Correlations", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))

    if correlations:
        story.append(Paragraph(f"The automated correlation engine detected <b>{len(correlations)}</b> cross-source indicators.", styles["body"]))
        
        c_data = [["IOC", "Type", "Confidence", "Severity", "Enrichment"]]
        for c in correlations:
            ioc = str(c.get("ioc", ""))[:30]
            ioc_type = c.get("ioc_type", "unknown")
            conf = str(c.get("confidence_score", 0))
            sev = _badge_text(c.get("correlation_severity", ""))
            tc = c.get("enrichment_data", {}).get("threat_category", "Unknown")
            c_data.append([ioc, ioc_type, conf, sev, tc])
            
        c_table = Table(c_data, colWidths=[5*cm, 3*cm, 2.5*cm, 2.5*cm, 4*cm])
        c_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ]))
        story.append(c_table)
    else:
        story.append(Paragraph("No multi-source correlations were detected during this analysis.", styles["body"]))
        
    story.append(PageBreak())

    # ============================================================
    # 12. AGGREGATED RECOMMENDATIONS
    # ============================================================
    story.append(Paragraph("12. Aggregated Recommendations", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    immediate = []
    short_term = []
    long_term = []
    
    for f in findings:
        rec_text = f.get("recommendations")
        if rec_text:
            text_lower = rec_text.lower()
            if "immediate" in text_lower or "isolate" in text_lower or "block" in text_lower:
                immediate.append(rec_text)
            elif "monitor" in text_lower or "review" in text_lower or "short" in text_lower:
                short_term.append(rec_text)
            else:
                long_term.append(rec_text)
                
    # Fallback Playbook if no recommendations exist
    if not immediate and not short_term and not long_term:
        if risk_level_str in ["CRITICAL", "HIGH"]:
            immediate = ["Isolate affected systems from the network.", "Block identified malicious IP addresses/domains.", "Rotate compromised credentials immediately."]
            short_term = ["Review user activity logs for lateral movement.", "Conduct thorough anti-malware scans on adjacent network segments."]
            long_term = ["Implement robust Endpoint Detection and Response (EDR).", "Enhance network segmentation policies."]
        else:
            short_term = ["Monitor affected assets for anomalous activity.", "Review access control policies."]
            long_term = ["Conduct security awareness training for staff.", "Update standard operating procedures for incident response."]

    if immediate:
        story.append(Paragraph("<b>Immediate Actions:</b>", styles["body"]))
        for r in immediate: story.append(Paragraph(f"• {r}", styles["bullet"]))
        story.append(Spacer(1, 0.3*cm))
        
    if short_term:
        story.append(Paragraph("<b>Short-Term Actions:</b>", styles["body"]))
        for r in short_term: story.append(Paragraph(f"• {r}", styles["bullet"]))
        story.append(Spacer(1, 0.3*cm))
        
    if long_term:
        story.append(Paragraph("<b>Long-Term Actions:</b>", styles["body"]))
        for r in long_term: story.append(Paragraph(f"• {r}", styles["bullet"]))

    story.append(PageBreak())

    # ============================================================
    # 13. CONCLUSION
    # ============================================================
    story.append(Paragraph("13. Conclusion", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    conc_text = (
        "This concludes the technical forensic analysis and incident response procedures for this case. "
        f"The investigation securely acquired and analyzed {len(evidence_list)} evidence artifacts, resulting in the identification of {len(findings)} distinct findings. "
    )
    if risk_assessment:
        conc_text += f"The overall risk posture has been formally assessed as {risk_assessment.get('risk_level', 'Unknown').upper()}. "
        
    conc_text += (
        "It is imperative that the recommendations outlined in this report are reviewed by stakeholders and implemented promptly to mitigate residual risk "
        "and improve the organization's security posture. All digital evidence has been verified and will be retained according to standard chain of custody procedures."
    )
    story.append(Paragraph(conc_text, styles["body"]))
    story.append(PageBreak())

    # ============================================================
    # 14. REPORT AUTHORIZATION
    # ============================================================
    story.append(Paragraph("14. Report Authorization", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    story.append(Paragraph(
        "This Digital Forensics and Incident Response (DFIR) report is authorized and certified by the lead investigator. "
        "The findings presented within are based exclusively on the digital artifacts recovered and analyzed during the course of the investigation.",
        styles["body"]
    ))

    story.append(Spacer(1, 2*cm))
    story.append(Paragraph("_" * 40, styles["body"]))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(f"<b>Investigator:</b> {inv_name}", styles["body"]))
    story.append(Paragraph(f"<b>Role:</b> {inv_role.upper()}", styles["body"]))
    story.append(Paragraph(f"<b>Email:</b> {inv_email}", styles["body"]))
    story.append(Paragraph(f"<b>Authorization Date:</b> {datetime.utcnow().strftime('%Y-%m-%d')}", styles["body"]))
    story.append(PageBreak())

    # ============================================================
    # 15. APPENDIX
    # ============================================================
    story.append(Paragraph("15. Appendix", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK_BLUE, spaceAfter=12))
    
    story.append(Paragraph("<b>A. Evidence Hashes (SHA256)</b>", styles["h3"]))
    if not evidence_list:
        story.append(Paragraph("N/A", styles["body"]))
    else:
        for ev in evidence_list:
            sha256 = ev.get("hash_sha256", "N/A")
            story.append(Paragraph(f"{ev.get('original_file_name', 'Unknown')}:", styles["small"]))
            story.append(Paragraph(f"<font color='{MID_GRAY}'>{sha256}</font>", ParagraphStyle("h", fontSize=8, fontName="Courier", spaceAfter=8)))
            
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("<b>B. References & Notes</b>", styles["h3"]))
    story.append(Paragraph("• MITRE ATT&CK Framework: https://attack.mitre.org", styles["body"]))
    story.append(Paragraph("• Generated by Cyber Crime Investigation Dashboard (CCID) v1.0", styles["body"]))

    # Build the document with the header/footer callback
    cb = lambda c, d: create_header_footer(c, d, case.get("case_number", "N/A"), inv_name)
    doc.build(story, onFirstPage=cb, onLaterPages=cb)
    
    return buffer.getvalue()

def _format_date(date_val) -> str:
    if not date_val: return "N/A"
    if isinstance(date_val, datetime): return date_val.strftime("%Y-%m-%d %H:%M")
    if isinstance(date_val, str):
        try: return datetime.fromisoformat(date_val.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
        except Exception: return date_val
    return str(date_val)

def _badge_text(value: str) -> str:
    return value.upper().replace("_", " ") if value else "N/A"

def generate_65b_certificate(
    evidence: Dict[str, Any],
    case: Dict[str, Any],
    investigator: Dict[str, Any]
) -> bytes:
    """Generates a Section 65B Certificate under the Indian Evidence Act, 1872."""
    buffer = io.BytesIO()
    styles = get_styles()
    
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, rightMargin=2.5*cm, leftMargin=2.5*cm, topMargin=3*cm, bottomMargin=3*cm,
        title=f"Section 65B Certificate - {evidence.get('original_file_name', 'N/A')}"
    )

    story = []
    
    # Header
    story.append(Paragraph("CERTIFICATE UNDER SECTION 65B(4) OF THE INDIAN EVIDENCE ACT, 1872", styles["cover_super"]))
    story.append(Spacer(1, 1*cm))
    
    inv_name = investigator.get("full_name") or "N/A"
    inv_role = investigator.get("role") or "Investigator"
    
    # Body
    body_text = (
        f"I, <b>{inv_name}</b>, functioning as <b>{inv_role}</b>, hereby certify and state as follows:<br/><br/>"
        
        f"1. That the digital evidence marked as <b>{evidence.get('evidence_number', 'N/A')}</b> "
        f"(File Name: {evidence.get('original_file_name', 'N/A')}) pertaining to Case Number <b>{case.get('case_number', 'N/A')}</b> "
        f"was produced by a computer / electronic device which was used regularly to store or process information for the purposes "
        f"of activities regularly carried on over that period.<br/><br/>"
        
        f"2. That during the said period, information of the kind contained in the electronic record or of the kind from which "
        f"the information so contained is derived was regularly fed into the computer in the ordinary course of the said activities.<br/><br/>"
        
        f"3. That throughout the material part of the said period, the computer was operating properly or, if not, then in respect "
        f"of any period in which it was not operating properly or was out of operation during that part of the period, was not such "
        f"as to affect the electronic record or the accuracy of its contents.<br/><br/>"
        
        f"4. That the information contained in the electronic record reproduces or is derived from such information fed into the "
        f"computer in the ordinary course of the said activities.<br/><br/>"
        
        f"<b>Cryptographic Hash Details:</b><br/>"
        f"MD5: {evidence.get('hash_md5', 'N/A')}<br/>"
        f"SHA-1: {evidence.get('hash_sha1', 'N/A')}<br/>"
        f"SHA-256: {evidence.get('hash_sha256', 'N/A')}<br/><br/>"
        
        f"5. I state that the above details are true and correct to the best of my knowledge and belief, and this certificate "
        f"is issued for the purpose of submitting the electronic record as evidence in accordance with the provisions of "
        f"Section 65B of the Indian Evidence Act, 1872."
    )
    
    story.append(Paragraph(body_text, ParagraphStyle("b_body", parent=styles["body"], fontSize=12, leading=18)))
    story.append(Spacer(1, 3*cm))
    
    # Signature
    story.append(Paragraph("_" * 30, styles["body"]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(f"<b>Signature</b>", styles["body"]))
    story.append(Paragraph(f"Name: {inv_name}", styles["body"]))
    story.append(Paragraph(f"Designation: {inv_role}", styles["body"]))
    story.append(Paragraph(f"Date: {datetime.utcnow().strftime('%Y-%m-%d')}", styles["body"]))
    
    doc.build(story)
    return buffer.getvalue()
