from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.services.osint_service import OsintService
from pydantic import BaseModel
from typing import List
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

router = APIRouter()

class FindingItem(BaseModel):
    entity: str
    type: str
    source: str
    severity: str
    time: str

class ReportRequest(BaseModel):
    findings: List[FindingItem]

@router.get("/search")
async def search_osint(query: str = Query(..., min_length=2, description="IP, Domain, or Hash to search")):
    """
    Query AlienVault OTX for threat intelligence on a given indicator.
    """
    osint_service = OsintService()
    result = await osint_service.search_indicator(query)
    
    if not result.get("success"):
        # We still return 200 with the error message so the frontend can display it cleanly
        return result
        
    return result


@router.get("/cve")
async def lookup_cve(cve_id: str = Query(..., description="CVE identifier, e.g. CVE-2021-44228")):
    """
    Look up CVE details using the cve.circl.lu public API.
    """
    osint_service = OsintService()
    result = await osint_service.get_cve_details(cve_id.strip())
    return result


@router.get("/domain")
async def check_domain_reputation(domain: str = Query(..., min_length=3, description="Domain name to check")):
    """
    Check domain reputation, WHOIS metadata, and known threat pulses via AlienVault OTX.
    """
    osint_service = OsintService()
    result = await osint_service.check_domain(domain.strip().lower())
    return result


@router.get("/ip-geo")
async def check_ip_geolocation(ip: str = Query(..., description="IPv4 or IPv6 address to geolocate")):
    """
    Get IP geolocation details including country, city, and ISP.
    """
    osint_service = OsintService()
    result = await osint_service.get_ip_geolocation(ip.strip())
    return result


@router.get("/nmap")
async def run_nmap_scan(
    target: str = Query(..., description="Target IP or Domain"),
    scan_type: str = Query("quick", description="Scan type: quick, full, or os")
):
    """Run an Nmap scan against a target."""
    osint_service = OsintService()
    result = await osint_service.run_nmap(target.strip(), scan_type)
    return result


@router.post("/report")
async def generate_pdf_report(request: ReportRequest):
    """Generate PDF report from OSINT findings."""
    buffer = io.BytesIO()
    
    # Create the document with standard margins
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=40, bottomMargin=40)
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    title_style.alignment = 1 # Center
    title_style.textColor = colors.HexColor("#0f172a")
    
    from reportlab.lib.styles import ParagraphStyle
    
    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor("#334155")
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Normal'],
        textColor=colors.whitesmoke,
        fontName='Helvetica-Bold',
        fontSize=10
    )
    
    # Header
    elements.append(Paragraph("CCID OSINT Intelligence Report", title_style))
    elements.append(Spacer(1, 6))
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    elements.append(Paragraph(f"<b>Generated on:</b> {timestamp}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Table Data
    data = [[
        Paragraph("Entity", header_style), 
        Paragraph("Type", header_style), 
        Paragraph("Severity", header_style), 
        Paragraph("Source", header_style)
    ]]
    
    for finding in request.findings:
        data.append([
            Paragraph(finding.entity, normal_style),
            Paragraph(finding.type, normal_style),
            Paragraph(finding.severity, normal_style),
            Paragraph(finding.source, normal_style)
        ])
        
    # Setup Table - adjusted widths to fit letter page neatly
    col_widths = [140, 200, 70, 130]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    
    # Table Styling (Professional Corporate Theme)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
    ]))
    
    elements.append(t)
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="application/pdf", headers={
        "Content-Disposition": "attachment; filename=osint_report.pdf"
    })

@router.get("/whois")
async def lookup_whois(domain: str = Query(..., description="Domain name for WHOIS lookup")):
    """Perform a WHOIS lookup on a domain."""
    osint_service = OsintService()
    result = await osint_service.lookup_whois(domain.strip().lower())
    return result


@router.get("/shodan")
async def lookup_shodan(ip: str = Query(..., description="IP address to lookup on Shodan")):
    """Perform a Shodan host lookup."""
    osint_service = OsintService()
    result = await osint_service.lookup_shodan(ip.strip())
    return result

@router.get("/socmint")
async def lookup_socmint(username: str = Query(..., description="Username to search across social media")):
    """Perform a SOCMINT lookup for a username."""
    from app.services.forensics.socmint_service import SocmintService
    result = await SocmintService.search_username(username.strip())
    return result

