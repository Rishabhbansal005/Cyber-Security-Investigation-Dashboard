"""Flags, ELA preview, and officer case-note text for image authenticity assist."""
from __future__ import annotations

import base64
import hashlib
import io
from typing import Any, Dict, List

import numpy as np
from PIL import Image


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def ela_data_url(raw: bytes, scale: int = 18, img: Image.Image | None = None) -> str:
    """Error level analysis as a PNG data URL (bright = more JPEG re-save difference)."""
    if img is None:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    else:
        img = img.convert("RGB")
    work = img.copy()
    work.thumbnail((640, 640))
    buf = io.BytesIO()
    work.save(buf, format="JPEG", quality=90)
    buf.seek(0)
    resaved = Image.open(buf).convert("RGB")
    a = np.asarray(work, dtype=np.int16)
    b = np.asarray(resaved, dtype=np.int16)
    diff = np.clip(np.abs(a - b) * scale, 0, 255).astype(np.uint8)
    out = Image.fromarray(diff)
    png = io.BytesIO()
    out.save(png, format="PNG")
    return "data:image/png;base64," + base64.b64encode(png.getvalue()).decode("ascii")


def build_flags(result: Dict[str, Any]) -> List[Dict[str, str]]:
    fmt = ((result.get("file_facts") or {}).get("format") or "").upper()
    has_exif = bool((result.get("camera_diary") or {}).get("has_exif"))
    concern = result.get("concern_level") or "low"
    flags: List[Dict[str, str]] = []
    if concern == "high":
        flags.append({
            "level": "alert",
            "en": "Old fake-face test lit up. Officer should look at this photo (still not court proof).",
            "hi": "Purana fake-face test chalu hua. Officer is photo ko dhyan se dekhein (yeh court proof nahi).",
        })
    elif concern == "low":
        flags.append({
            "level": "info",
            "en": "Old GAN test found nothing. This does NOT mean the photo is real. New AI / morph / swap often look green.",
            "hi": "Purana GAN test kuch nahi mila. Iska matlab photo asli nahi. Nayi AI / morph / swap aksar green aati hai.",
        })
    ai = result.get("ai_screen") or {}
    if ai.get("available"):
        ai_level = ai.get("concern_level")
        ai_pct = ai.get("ai_generated_probability")
        ai_s = f"{round(float(ai_pct) * 100, 1)}%" if ai_pct is not None else "n/a"
        if ai_level == "high":
            flags.append({
                "level": "alert",
                "en": f"AI vs real screen lit up ({ai_s}). Treat as a lead, not proof. Ask for the gallery original.",
                "hi": f"AI vs real screen chalu ({ai_s}). Lead hai, proof nahi. Gallery original maango.",
            })
        elif ai_level == "medium":
            flags.append({
                "level": "warn",
                "en": f"AI vs real screen is mixed ({ai_s}). Do not record generated or genuine.",
                "hi": f"AI vs real mixed ({ai_s}). Generated ya genuine mat likho.",
            })
        elif ai_level == "low":
            flags.append({
                "level": "info",
                "en": f"AI vs real screen did not fire ({ai_s}). ChatGPT / Flux / new tools can still look clean.",
                "hi": f"AI vs real nahi chala ({ai_s}). ChatGPT / Flux / naye tools clean dikh sakte hain.",
            })
    else:
        flags.append({
            "level": "info",
            "en": "AI vs real model is not trained yet. Only the old GAN-face screen ran.",
            "hi": "AI vs real model abhi train nahi. Sirf purana GAN-face screen chala.",
        })
    if not has_exif and fmt == "PNG":
        flags.append({
            "level": "warn",
            "en": "PNG with no phone diary — common for AI export, screenshot, or computer save. Ask for original gallery JPEG.",
            "hi": "PNG + phone diary nahi — AI save, screenshot, ya computer file ho sakti hai. Gallery se original JPEG maango.",
        })
    elif not has_exif:
        flags.append({
            "level": "warn",
            "en": "No camera diary (phone / time / GPS). Typical after WhatsApp. Ask for the original from the phone gallery.",
            "hi": "Camera diary nahi (phone / time / GPS). WhatsApp ke baad aam hai. Phone gallery se original maango.",
        })
    else:
        flags.append({
            "level": "ok",
            "en": "Camera diary is present. Check that the phone and time match the complainant's story.",
            "hi": "Camera diary mili. Phone aur time complainant ki baat se match karte hain ya nahi, check karo.",
        })
    if fmt in ("JPEG", "JPG") and has_exif:
        flags.append({
            "level": "ok",
            "en": "Looks more like a phone camera file (JPEG + diary) than a typical AI PNG.",
            "hi": "Phone camera file jaisi lagti hai (JPEG + diary), typical AI PNG nahi.",
        })
    return flags


def case_note(result: Dict[str, Any], role: str = "exhibit") -> Dict[str, str]:
    name = result.get("filename") or "file"
    digest = result.get("sha256") or ""
    fmt = ((result.get("file_facts") or {}).get("format") or "?")
    has_exif = bool((result.get("camera_diary") or {}).get("has_exif"))
    concern = result.get("concern_level") or ""
    gan = result.get("aggregate_manipulated_probability")
    gan_s = f"{round(float(gan) * 100, 1)}%" if gan is not None else "n/a"
    ai = result.get("ai_screen") or {}
    ai_p = ai.get("ai_generated_probability")
    if ai.get("available") and ai_p is not None:
        ai_line = f"AI vs real screen: {ai.get('concern_level')} ({round(float(ai_p) * 100, 1)}%)."
        ai_line_hi = f"AI vs real screen: {ai.get('concern_level')} ({round(float(ai_p) * 100, 1)}%)."
    else:
        ai_line = "AI vs real screen: not loaded."
        ai_line_hi = "AI vs real screen: load nahi hua."
    who = {
        "victim": "Victim original",
        "disputed": "Disputed / misused photo",
        "exhibit": "Exhibit",
    }.get(role, "Exhibit")
    who_hi = {
        "victim": "Peedit ki original photo",
        "disputed": "Galat use wali photo",
        "exhibit": "Exhibit",
    }.get(role, "Exhibit")
    en = (
        f"{who}: {name}\n"
        f"SHA-256: {digest}\n"
        f"Type: {fmt}. Camera diary: {'yes' if has_exif else 'no'}.\n"
        f"Old GAN-face screen: {concern} ({gan_s}).\n"
        f"{ai_line}\n"
        "Note: This is screening assist only. It does not prove AI, morph, or a real camera photo. "
        "Do not write 'AI generated proved' in the FIR from this tool alone."
    )
    hi = (
        f"{who_hi}: {name}\n"
        f"SHA-256: {digest}\n"
        f"Type: {fmt}. Camera diary: {'haan' if has_exif else 'nahi'}.\n"
        f"Purana GAN-face screen: {concern} ({gan_s}).\n"
        f"{ai_line_hi}\n"
        "Ye sirf madad hai. Isse AI / morph / asli camera prove nahi hota. "
        "Sirf is tool se FIR mein 'AI generated proved' mat likhein."
    )
    return {"en": en, "hi": hi}


def compare_summary(victim: Dict[str, Any], disputed: Dict[str, Any]) -> Dict[str, Any]:
    same = (victim.get("sha256") or "") == (disputed.get("sha256") or "") and bool(victim.get("sha256"))
    v_exif = bool((victim.get("camera_diary") or {}).get("has_exif"))
    d_exif = bool((disputed.get("camera_diary") or {}).get("has_exif"))
    if same:
        en = "Both files are the same (same fingerprint). This is not two different pictures."
        hi = "Dono files ek hi hain (same fingerprint). Yeh do alag photos nahi."
        next_en = "Ask why the complainant believes a second copy is being misused if the file is identical."
        next_hi = "Agar file same hai to poochho dusri copy kaise misuse ho rahi hai."
    else:
        en = (
            "These are two different files. "
            + ("Victim file has a camera diary. " if v_exif else "Victim file has NO camera diary — ask for gallery original. ")
            + ("Disputed file has a camera diary." if d_exif else "Disputed file has NO camera diary (WhatsApp/AI/screenshot possible).")
        )
        hi = (
            "Yeh do alag files hain. "
            + ("Peedit wali mein camera diary hai. " if v_exif else "Peedit wali mein camera diary NAHI — gallery original maango. ")
            + ("Disputed wali mein diary hai." if d_exif else "Disputed wali mein diary NAHI (WhatsApp/AI/screenshot ho sakti).")
        )
        next_en = (
            "Save both hashes. Take platform URL/screenshots. Do not conclude AI from the GAN score. "
            "Human review: is it the same person? Then NCRP/impersonation process."
        )
        next_hi = (
            "Dono hash save karo. Platform URL/screenshot lo. GAN score se AI mat conclude karo. "
            "Insaan dekhe: same person hai? Phir NCRP/impersonation."
        )
    return {
        "same_file": same,
        "summary_en": en,
        "summary_hi": hi,
        "next_en": next_en,
        "next_hi": next_hi,
    }
