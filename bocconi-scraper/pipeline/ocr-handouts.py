#!/usr/bin/env python3
"""OCR the scanned handout PDFs to text (cached per file).

Handouts are scanned/photographed notes, so pdftotext yields almost nothing.
This rasterizes each page (pdftoppm @ ~150 DPI) and runs tesseract (eng+ita).
Output: corpus/handouts_txt/h<id>.txt (pages separated by \\f). Re-runnable:
files with an existing non-empty .txt are skipped.

    python3 pipeline/ocr-handouts.py [workers]
"""
import json, os, subprocess, sys, tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CORPUS = os.path.join(ROOT, "corpus")
PDF_DIR = os.path.join(CORPUS, "handouts")
TXT_DIR = os.path.join(CORPUS, "handouts_txt")
DPI = 150
MAX_PAGES = 80  # bound worst-case time on very long scans

os.makedirs(TXT_DIR, exist_ok=True)


def ocr_one(entry):
    local = entry["local"]
    pdf = os.path.join(PDF_DIR, local)
    out = os.path.join(TXT_DIR, local.replace(".pdf", ".txt"))
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return (local, "cached", os.path.getsize(out))
    if not os.path.exists(pdf) or os.path.getsize(pdf) == 0:
        return (local, "missing-pdf", 0)
    try:
        with tempfile.TemporaryDirectory() as td:
            # Rasterize pages to PNG (bounded).
            subprocess.run(
                ["pdftoppm", "-r", str(DPI), "-l", str(MAX_PAGES), "-png", pdf, os.path.join(td, "p")],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            pages = sorted(f for f in os.listdir(td) if f.endswith(".png"))
            texts = []
            for pg in pages:
                r = subprocess.run(
                    ["tesseract", os.path.join(td, pg), "stdout", "-l", "eng+ita", "--psm", "6"],
                    capture_output=True, text=True,
                )
                texts.append(r.stdout)
        combined = "\f".join(texts)
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(combined)
        chars = len("".join(texts).split() and combined or "")
        return (local, f"ocr {len(pages)}p", len(combined))
    except Exception as e:  # noqa
        return (local, f"FAIL {str(e)[:60]}", 0)


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    manifest = json.load(open(os.path.join(CORPUS, "handouts_manifest.json")))
    todo = [e for e in manifest]
    print(f"OCR {len(todo)} handouts with {workers} workers (DPI {DPI}, max {MAX_PAGES}p/file)…", flush=True)
    done = 0
    with ProcessPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(ocr_one, e): e for e in todo}
        for fut in as_completed(futs):
            local, status, size = fut.result()
            done += 1
            print(f"[{done}/{len(todo)}] {local}: {status} ({size} chars)", flush=True)
    # Summary
    txts = [f for f in os.listdir(TXT_DIR) if f.endswith(".txt")]
    nonempty = [f for f in txts if os.path.getsize(os.path.join(TXT_DIR, f)) > 40]
    print(f"\nOCR_DONE: {len(txts)} txt files, {len(nonempty)} with meaningful text.", flush=True)


if __name__ == "__main__":
    main()
