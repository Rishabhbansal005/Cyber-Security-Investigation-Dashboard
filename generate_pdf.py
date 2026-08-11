from fpdf import FPDF
import os

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'CCID Command Center - Police Presentation Guide', 0, 1, 'C')
        self.ln(10)

    def chapter_title(self, title):
        self.set_font('Arial', 'B', 12)
        self.set_text_color(0, 51, 153)
        self.cell(0, 10, title, 0, 1, 'L')
        self.ln(2)

    def chapter_body(self, body):
        self.set_font('Arial', '', 11)
        self.set_text_color(0, 0, 0)
        self.multi_cell(0, 7, body)
        self.ln(5)

pdf = PDF()
pdf.add_page()
pdf.set_auto_page_break(auto=True, margin=15)

intro = (
    "Aapko apni presentation mein 'Speed', 'Automation', aur 'Actionable Intelligence' "
    "par focus karna hai. Police ke liye time aur accurate data sabse zyada matter karta hai."
)
pdf.chapter_body(intro)

pdf.chapter_title("1. Introduction: Problem aur Solution (Hook)")
body1 = (
    "Aapko kya bolna hai:\n"
    "\"Jai Hind Sir/Ma'am. Aaj kal cyber crimes (jaise UPI fraud, fake loan apps) bahut tezi se badh rahe hain, "
    "aur data itna zyada hota hai ki manual investigation mein bahut waqt lag jata hai. "
    "Isliye main aapke samne 'Command Center' present kar raha hu-ek aisa centralized system jo real-time mein "
    "cases ko track karta hai, data ko link karta hai aur instantly actionable reports deta hai.\""
)
pdf.chapter_body(body1)

pdf.chapter_title("2. Live Dashboard Ka Demo (The 'Wow' Factor)")
body2 = (
    "Aap apna laptop screen dikhayein aur explain karein:\n"
    "- The Live Stats (KPIs): 'Sir, ye hamara real-time stats engine hai. Ye batata hai ki kitne FIRs active hain, "
    "kitne Funds Freeze (block) kiye ja chuke hain, aur total kitne suspects under-radar hain.'\n"
    "- Urgent Broadcast (Red Banner): 'Upar ye jo red alert blink kar raha hai, ye ek Urgent Broadcast feature hai. "
    "Agar kisi specific area mein achanak se ek naya fraud pattern detect hota hai, toh sabhi officers ki screen "
    "par instantly alert chala jayega.'"
)
pdf.chapter_body(body2)

pdf.chapter_title("3. Suspect Link Analysis Engine (Aapka Sabse Strong Point)")
body3 = (
    "Graph wale section par point karein:\n"
    "\"Manual investigation mein ek bank account ko ek phone number se connect karne mein dino lag jate hain. "
    "Ye hamara 'Suspect Link Analysis Engine' hai. Jaise hi system mein koi details dali jati hain, ye engine "
    "khud apne aap dots connect kar leta hai.\n\n"
    "For example, is screen par aap dekh sakte hain ki isne ek Suspect (+91-9876543210) ko directly ek HDFC Bank Account, "
    "ek OnePlus Device, aur ek Crypto Wallet se link kar diya hai. Yani ki investigating officer ko bas ek jagah "
    "dekhna hai aur poori gang ka network map samne aa jayega.\""
)
pdf.chapter_body(body3)

pdf.chapter_title("4. Conclusion (Impact)")
body4 = (
    "Aapko kya bolna hai:\n"
    "\"In short Sir, ye tool aapki cyber cell ki team ko data entry operations se azaad karke sirf 'Action' par "
    "focus karne mein madad karega. Criminals advanced tech use kar rahe hain, isliye hamari police ko bhi aisi "
    "advanced 'Command Center' ki zarurat hai.\""
)
pdf.chapter_body(body4)

pdf.add_page()
pdf.chapter_title("Project Ki Current Limitations (Dikkat) - For Your Reference")
limitations = (
    "Police station mein present karne se pehle kuch technical aur practical limitations aapko pata honi chahiye:\n\n"
    "1. Dashboard Data Simulation (Mock Data):\n"
    "Jo dashboard par numbers live hue hain, wo frontend par simulate ho rahe hain. Agar koi officer pooche ki "
    "data kahan se aa raha hai, toh batayein ki ye UI presentation ke liye simulation hai, but backend ready hai.\n\n"
    "2. AI Copilot (API Limits):\n"
    "Aapke backend mein Groq AI (Llama-3) ki API key hai. Free tier mein rate limits hoti hain. Present karte waqt "
    "AI features ka 1 ya 2 solid demo dijiyega, over-use mat kijiyega varna error aa sakta hai.\n\n"
    "3. Live Cyber Crime Heatmap:\n"
    "Ye heatmap abhi static coordinates par based hai. Ye real-time FIR locations fetch nahi kar raha, ye sirf ek "
    "visual representation hai ki system kaisa dikhega jab original FIR API connect hogi.\n\n"
    "Overall: Ek prototype (PoC) ke taur par ye project excellent hai. In limitations ko 'Future Scope' ya "
    "'Under Development Phase 2' bol kar present kijiye."
)
pdf.chapter_body(limitations)

pdf_path = r"c:\Users\asus_pc\OneDrive\Desktop\CCID_Police_Presentation_Guide.pdf"
pdf.output(pdf_path, 'F')
print(f"PDF saved to {pdf_path}")
