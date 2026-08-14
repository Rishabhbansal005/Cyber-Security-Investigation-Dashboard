"""Generate synthetic cybercrime complaint text for prototype training. No real PII."""
from __future__ import annotations

import csv
import random
from pathlib import Path

from ml.complaint_classifier.preprocess import load_categories

TEMPLATES: dict[str, list[str]] = {
    "Financial Fraud": [
        "Someone cheated me of {amt} rupees through an online payment request.",
        "A caller asked me to share OTP and transferred {amt} from my bank account.",
        "I lost {amt} after a person posed as a bank manager and asked for KYC.",
        "Fraudster collected {amt} claiming to process a refund that never came.",
        "I was tricked into paying {amt} on a fake government portal.",
    ],
    "UPI Fraud": [
        "I sent {amt} to {upi} after they said they would reverse a UPI collect request.",
        "Unknown UPI {upi} received {amt} from my PhonePe account.",
        "Scammer asked me to enter UPI PIN and {amt} was debited to {upi}.",
        "Fake UPI payment screenshot was used; I transferred {amt} to {upi}.",
        "Google Pay collect request from {upi} took {amt} from me.",
    ],
    "Phishing": [
        "I clicked {url} thinking it was my bank and entered login details.",
        "Email from fake support asked me to verify at {url}.",
        "SMS with {url} said my KYC would expire. I submitted Aadhaar there.",
        "WhatsApp message contained {url} to claim a parcel. It stole my password.",
        "Phishing page {url} looked like Income Tax e-filing.",
    ],
    "Job/Employment Scam": [
        "WhatsApp job offer asked {amt} as registration fees then they blocked me.",
        "They promised a work from home job and took {amt} for a kit that never arrived.",
        "HR on Telegram asked for {amt} security deposit for joining.",
        "Fake interview call demanded {amt} for training materials.",
        "Employment agent took {amt} for a government job that does not exist.",
    ],
    "Investment Scam": [
        "Instagram account {handle} offered crypto investment. I sent {amt} to {upi}.",
        "They promised high returns and I transferred {amt} to {upi}. Then no reply.",
        "WhatsApp investment group asked {amt} for a trading package.",
        "Person on {handle} showed fake profits. I paid {amt}.",
        "Online share trading tip asked {amt} via UPI {upi}.",
    ],
    "Social Media Scam": [
        "Instagram profile {handle} asked me to pay {amt} for a giveaway.",
        "Facebook friend request led to a scam and I lost {amt}.",
        "Telegram channel {handle} collected {amt} for a prize.",
        "Someone impersonated a celebrity on Instagram and asked for {amt}.",
        "WhatsApp status advertised a scheme; I paid {amt} to {upi}.",
    ],
    "Account Takeover": [
        "My Instagram was hacked after I entered password on {url}.",
        "Email {email} was taken over and used to reset my bank password.",
        "They changed my SIM and accessed my UPI. Lost {amt}.",
        "Gmail OTP was stolen and my shopping account was hijacked.",
        "WhatsApp was taken over using a verification code I shared.",
        "Someone accessed my WhatsApp and asked {amt} rupees from our family group. After getting the money he blocked me and deleted all the chats.",
        "My WhatsApp was hacked. The person messaged my family group asking for {amt} then blocked everyone and deleted the data.",
        "Unknown person logged into my WhatsApp, impersonated me in family group, took {amt}, then logged out and wiped chats.",
    ],
    "Identity Theft": [
        "Someone used my PAN and Aadhaar to open a loan. Amount {amt}.",
        "Fake KYC with my photo was used to create a wallet.",
        "My documents leaked and a SIM was issued in my name.",
        "Fraudulent credit card application used my identity for {amt}.",
        "Impersonator used my email {email} to apply for a loan.",
    ],
    "Online Shopping Scam": [
        "I ordered a phone online, paid {amt} to {upi}, seller disappeared.",
        "Fake Amazon-like site {url} took {amt} and never shipped.",
        "COD scam: they asked prepaid {amt} for a laptop.",
        "Instagram shop {handle} took {amt} for clothes that never came.",
        "WhatsApp seller sent fake tracking after I paid {amt}.",
    ],
    "Sextortion": [
        "A person on Instagram {handle} threatened to leak photos unless I pay {amt}.",
        "Video call was recorded and they demanded {amt} via {upi}.",
        "Blackmail message from {phone} asked {amt} or they would share images.",
        "Unknown account threatened to post morphed photos. Demanded {amt}.",
        "Telegram user {handle} extorted {amt} after a private chat.",
    ],
    "Cyberbullying/Harassment": [
        "Repeated abusive messages from {phone} on WhatsApp.",
        "Instagram {handle} is posting defamatory comments about me.",
        "Someone created a fake profile to harass me at school/work.",
        "Threatening calls from {phone} every night.",
        "Group chat is sharing my photos to bully me.",
    ],
    "Other": [
        "My website was defaced and I need help investigating.",
        "Unknown malware on office PC after opening an attachment.",
        "Ransomware note appeared but I have backups. Need guidance.",
        "Unauthorized WiFi access in my society. Need logging advice.",
        "Complaint about a data leak notice I received from a company.",
    ],
}

UPI = ["fraud123@upi", "paytm.help@ybl", "kycverify@okicici", "refund.desk@apl", "joboffer@paytm"]
URLS = [
    "https://example-login-security.com/verify",
    "http://bank-kyc-update.xyz/login",
    "https://parcel-track-in.net/claim",
    "http://192.168.1.10/otp",
    "https://tax-refund-gov.in.fake/pay",
]
HANDLES = ["invest_guru", "jobs_official", "crypto_king", "shop_deals", "support_desk"]
EMAILS = ["helpdesk@mail.test", "hr@jobs-offer.test", "verify@secure-bank.test"]
PHONES = ["9876543210", "9123456789", "9988776655", "9001122334"]
HINDI_TEMPLATES: dict[str, list[str]] = {
    "Financial Fraud": [
        "Mere account se {amt} rupaye nikal gaye OTP share karne ke baad.",
        "Bank wale bolke KYC ke naam pe {amt} rupaye cheat ho gaya.",
        "मेरे खाते से {amt} रुपये OTP देने के बाद कट गए।",
    ],
    "UPI Fraud": [
        "Maine Google Pay pe {amt} rupaye {upi} ko bhej diye collect request reverse karne ke chakkar mein.",
        "PhonePe se {upi} ko {amt} chale gaye UPI PIN daalte hi.",
        "मैंने {upi} पर {amt} रुपये भेज दिए, कहा reverse हो जाएगा।",
    ],
    "Phishing": [
        "SMS mein {url} aaya KYC expire bolke, maine login daal diya.",
        "Fake bank page {url} pe password de diya.",
        "लिंक {url} पर क्लिक करके नेट बैंकिंग डिटेल दे दी।",
    ],
    "Job/Employment Scam": [
        "WhatsApp pe job bola, {amt} rupaye registration ke naam pe le liye phir block.",
        "Work from home ke liye {amt} security deposit maanga.",
        "नौकरी के नाम पर {amt} रुपये लेकर ब्लॉक कर दिया।",
    ],
    "Investment Scam": [
        "Instagram {handle} pe crypto returns dikhaya, {amt} {upi} pe bhej diye.",
        "Trading tip ke naam pe {amt} UPI se kat gaya.",
    ],
    "Social Media Scam": [
        "Instagram {handle} ne giveaway bolke {amt} maang liye.",
        "Facebook pe friend request ke baad paise kat gaye.",
    ],
    "Account Takeover": [
        "Mera WhatsApp OTP de diya, account hijack ho gaya.",
        "Instagram hack ho gaya {url} pe password daalne ke baad.",
        "Kisi ne mera WhatsApp access kar liya, family group se {amt} maange, paise milte hi block karke chats delete kar diye.",
        "WhatsApp hack hua, ghar walon se {amt} rupaye maange phir account se nikal gaye.",
    ],
    "Identity Theft": [
        "Kisi ne mere Aadhaar PAN se loan nikal liya {amt} ka.",
        "Mere documents se SIM nikal li gayi.",
    ],
    "Online Shopping Scam": [
        "Online phone order kiya {amt} {upi} pe, maal nahi aaya.",
        "Instagram shop ne {amt} leke block kar diya.",
    ],
    "Sextortion": [
        "Video call record karke {amt} maang rahe hain {upi} pe.",
        "Photos leak karne ki dhamki, {amt} do.",
    ],
    "Cyberbullying/Harassment": [
        "WhatsApp pe {phone} se gali galoch aa raha hai baar baar.",
        "Fake profile bana ke harass kar rahe hain.",
    ],
    "Other": [
        "Office computer pe malware aa gaya attachment kholne ke baad.",
        "Website hack ho gayi, madad chahiye.",
    ],
}


def _fill(template: str, rng: random.Random) -> str:
    return template.format(
        amt=rng.choice([2000, 5000, 12000, 25000, 50000, 80000, 150000]),
        upi=rng.choice(UPI),
        url=rng.choice(URLS),
        handle=rng.choice(HANDLES),
        email=rng.choice(EMAILS),
        phone=rng.choice(PHONES),
    )


def generate_rows(n_per_class: int = 80, seed: int = 42) -> list[tuple[str, str]]:
    rng = random.Random(seed)
    labels = load_categories()
    rows: list[tuple[str, str]] = []
    for label in labels:
        tpls = TEMPLATES[label]
        for i in range(n_per_class):
            base = _fill(rng.choice(tpls), rng)
            noise = rng.choice([
                " Please help.",
                " Happened yesterday.",
                " I have screenshots.",
                " Incident in Delhi.",
                " I already reported to 1930.",
                "",
            ])
            rows.append((base + noise, label))
        for ht in HINDI_TEMPLATES.get(label, []):
            for _ in range(max(12, n_per_class // 4)):
                rows.append((_fill(ht, rng) + rng.choice([" Kripya madad karein.", " Kal hua.", " Screenshot hai.", ""]), label))
    rng.shuffle(rows)
    return rows


def main():
    out = Path(__file__).resolve().parent / "complaints_synthetic.csv"
    rows = generate_rows()
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["complaint_text", "crime_category"])
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out}")


if __name__ == "__main__":
    main()
