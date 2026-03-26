#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║                 USNCO EXAM PARSER  v5.1                      ║
╠══════════════════════════════════════════════════════════════╣
║  Pixel-content-aware cropping + robust answer key parsing    ║
║                                                              ║
║  FIXED: Bottom-capping now works for ALL layout types        ║
║         (2x2, 4row, vertical) to prevent footer bleeding     ║
║                                                              ║
║  Answer key strategies (tried in order):                     ║
║    1. Table format  "1. D"  — exam PDFs (60/60)              ║
║    2. Prose format  "or D." — annotated solutions PDFs       ║
║       (best-effort; always prefer the exam PDF for keys)     ║
║                                                              ║
║  USAGE:  python usnco_parser.py                              ║
║  REQUIREMENTS:                                               ║
║    pip install pdfplumber Pillow pypdfium2 numpy             ║
║                                                              ║
║  BATCH FILE FORMAT (one exam per line):                      ║
║    /path/to/exam.pdf, 2025, Local                            ║
║    /path/to/exam.pdf, 2024, National                         ║
║    # Lines starting with # are ignored                       ║
╚══════════════════════════════════════════════════════════════╝
"""

import os, re, sys, json
from pathlib import Path
from collections import defaultdict
import pdfplumber
from PIL import Image
import numpy as np

try:
    import pypdfium2 as pdfium
    PDFIUM_AVAILABLE = True
except ImportError:
    PDFIUM_AVAILABLE = False

# ═══════════════════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

DPI   = 200
SCALE = DPI / 72.0

COL_LEFT  = {'x0': 25,  'x1': 300}
COL_RIGHT = {'x0': 300, 'x1': 585}

LEFT_Q_X_MAX  = 72
RIGHT_Q_X_MIN = 305
RIGHT_Q_X_MAX = 380

MARGIN_PX    = 10
BG_THRESHOLD = 245

NON_CONTENT_PHRASES = [
    'end of test', 'end of exam', 'property of acs',
    'not for use as usnco', 'distributed by the american chemical',
    'page 3', 'page 4', 'page 5', 'page 6', 'page 7',
]

TOPIC_MAP = {
    range(1,  7):  "Stoichiometry & Solutions",
    range(7,  13): "Descriptive & Laboratory",
    range(13, 19): "States of Matter",
    range(19, 25): "Thermodynamics",
    range(25, 31): "Kinetics",
    range(31, 37): "Equilibrium",
    range(37, 43): "Oxidation-Reduction",
    range(43, 49): "Atomic Structure & Periodicity",
    range(49, 55): "Bonding & Molecular Structure",
    range(55, 61): "Organic & Biochemistry",
}

def get_topic(n):
    for r, t in TOPIC_MAP.items():
        if n in r: return t
    return "Unknown"

def pts_to_px(v): return int(v * SCALE)
def px_to_pts(v): return v / SCALE

# ═══════════════════════════════════════════════════════════════════════════════
#  INDEX.JSON  — merge, never replace
# ═══════════════════════════════════════════════════════════════════════════════

def load_index(idx_path):
    """Load existing index.json, returning a dict keyed by (year, exam_type)."""
    if not os.path.exists(idx_path):
        return {}
    try:
        with open(idx_path) as f:
            data = json.load(f)
        return {
            (e['year'], e['exam_type']): e
            for e in data.get('exams', [])
        }
    except Exception:
        return {}

def save_index(idx_path, existing: dict, new_entries: list):
    """
    Merge new_entries into existing index and write.
    new_entries is a list of dicts with keys: year, exam_type, folder.
    Existing entries with the same (year, exam_type) are overwritten.
    """
    merged = dict(existing)  # copy
    for entry in new_entries:
        key = (entry['year'], entry['exam_type'])
        merged[key] = entry
    # Sort by year then exam_type for stable output
    exams = sorted(merged.values(), key=lambda e: (e['year'], e['exam_type']))
    with open(idx_path, 'w') as f:
        json.dump({"exams": exams}, f, indent=2)
    print(f"\n  Index ({len(exams)} total exams) → {idx_path}")


# ═══════════════════════════════════════════════════════════════════════════════
#  BATCH FILE PARSING
# ═══════════════════════════════════════════════════════════════════════════════

def parse_batch_file(txt_path):
    """
    Parse a txt file where each non-comment line is:
        /path/to/exam.pdf, YEAR, ExamType

    Returns a list of (pdf_path, year, exam_type) tuples.
    Skips blank lines and lines starting with #.
    """
    entries = []
    with open(txt_path) as f:
        for lineno, raw in enumerate(f, 1):
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            parts = [p.strip().strip('"').strip("'") for p in line.split(',')]
            if len(parts) < 3:
                print(f"  ⚠️  Line {lineno}: expected 'path, year, type' — skipping: {line!r}")
                continue
            pdf_path  = parts[0]
            year_str  = parts[1]
            exam_type = parts[2]
            if not Path(pdf_path).exists():
                print(f"  ⚠️  Line {lineno}: file not found — skipping: {pdf_path!r}")
                continue
            if not Path(pdf_path).suffix.lower() == '.pdf':
                print(f"  ⚠️  Line {lineno}: not a PDF — skipping: {pdf_path!r}")
                continue
            try:
                year = int(year_str)
            except ValueError:
                print(f"  ⚠️  Line {lineno}: invalid year {year_str!r} — skipping")
                continue
            entries.append((pdf_path, year, exam_type))
    return entries


# ═══════════════════════════════════════════════════════════════════════════════
#  ANSWER KEY EXTRACTION  — dual strategy
# ═══════════════════════════════════════════════════════════════════════════════

def extract_answer_key(pdf_path):
    answers = {}

    with pdfplumber.open(pdf_path) as pdf:
        page_order = [pdf.pages[-1]] + list(pdf.pages[:-1])
        for page in page_order:
            text = page.extract_text() or ''
            for ns, ans in re.findall(r'\b(\d{1,2})\.\s+([A-D])\b', text):
                n = int(ns)
                if 1 <= n <= 60:
                    answers[n] = ans
            if len(answers) >= 55:
                return answers

    if len(answers) >= 40:
        return answers

    with pdfplumber.open(pdf_path) as pdf:
        full_text = ' '.join(
            (page.extract_text() or '').replace('\n', ' ')
            for page in pdf.pages
        )

    parts = re.split(r'(?<!\w)(\d{1,2})\. (?=[A-Z])', full_text)

    sections: dict[int, str] = {}
    i = 1
    while i + 1 < len(parts):
        n = int(parts[i])
        if 1 <= n <= 60:
            sections[n] = parts[i + 1]
        i += 2

    PROSE_PATTERNS = [
        r'correct answer is\s+[^A-D\n]{0,50}?\b([A-D])\b',
        r'\bthe answer is\s+[^A-D\n]{0,50}?\b([A-D])\b',
        r'answer choice\s+([A-D])\b',
        r'answer is\s+[^A-D\n]{0,50}?\b([A-D])\b',
        r',\s*or\s+([A-D])\s*[,\.]',
        r'\bor\s+([A-D])\s*[,\.]',
        r'\bThis is\s+([A-D])\s*\.',
        r'\bthe correct(?:\s+\w+){0,3}\s+is\s+([A-D])\b',
        r'\bcorresponds to answer\s+([A-D])\b',
    ]

    prose_answers: dict[int, str] = {}
    for n, body in sections.items():
        for pat in PROSE_PATTERNS:
            m = re.search(pat, body, re.IGNORECASE)
            if m:
                prose_answers[n] = m.group(1)
                break

    for n, ans in prose_answers.items():
        if n not in answers:
            answers[n] = ans

    return answers


def report_key_quality(answers, source_label):
    found   = len(answers)
    missing = [n for n in range(1, 61) if n not in answers]
    if found >= 58:
        print(f"        {found}/60 answers from {source_label}")
    elif found >= 40:
        print(f"        ⚠️  {found}/60 answers from {source_label}")
        if missing:
            print(f"           Missing: {missing}")
        print(f"           Tip: if this is a solutions/annotated PDF, use the")
        print(f"           exam PDF instead (key is on its last page).")
    else:
        print(f"        ✗  Only {found}/60 answers found from {source_label}.")
        print(f"           This PDF may not contain a usable answer key.")
        print(f"           Re-run and choose option 1 to use the exam PDF's")
        print(f"           built-in key (last page).")


# ═══════════════════════════════════════════════════════════════════════════════
#  PIXEL CONTENT DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

def content_bbox(img, x0, y0, x1, y1):
    W, H = img.size
    x0, y0, x1, y1 = max(0,int(x0)), max(0,int(y0)), min(W,int(x1)), min(H,int(y1))
    if x1 <= x0 or y1 <= y0:
        return None
    gray = np.array(img.crop((x0, y0, x1, y1)).convert('L'))
    mask = gray < BG_THRESHOLD
    if not mask.any():
        return None
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    return (
        max(0, x0 + cols[0]  - MARGIN_PX),
        max(0, y0 + rows[0]  - MARGIN_PX),
        min(W, x0 + cols[-1] + 1 + MARGIN_PX),
        min(H, y0 + rows[-1] + 1 + MARGIN_PX),
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  PAGE ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

def analyse_pages(pdf_path):
    page_words, content_ceil = {}, {}
    with pdfplumber.open(pdf_path) as pdf:
        for pi in range(2, min(9, len(pdf.pages))):
            words = pdf.pages[pi].extract_words()
            page_words[pi] = words
            lines: dict[int, list[str]] = defaultdict(list)
            for w in words:
                lines[round(w['top'] / 2) * 2].append(w['text'].lower())
            ceil = next(
                (float(y) - 2 for y in sorted(lines)
                 if any(p in ' '.join(lines[y]) for p in NON_CONTENT_PHRASES)),
                780.0,
            )
            content_ceil[pi] = ceil
    return page_words, content_ceil


# ═══════════════════════════════════════════════════════════════════════════════
#  QUESTION NUMBER POSITIONS
# ═══════════════════════════════════════════════════════════════════════════════

def find_question_positions(pdf_path):
    questions = {}
    with pdfplumber.open(pdf_path) as pdf:
        for pi in range(2, min(9, len(pdf.pages))):
            for w in pdf.pages[pi].extract_words():
                t = w['text']
                if not (t.endswith('.') and t[:-1].isdigit()): continue
                n = int(t[:-1])
                if not (1 <= n <= 60): continue
                x0 = w['x0']
                is_left  = x0 < LEFT_Q_X_MAX
                is_right = RIGHT_Q_X_MIN <= x0 <= RIGHT_Q_X_MAX
                if (is_left or is_right) and n not in questions:
                    questions[n] = {
                        'page': pi,
                        'y':    w['top'],
                        'col':  'left' if is_left else 'right',
                    }
    return dict(sorted(questions.items()))


# ═══════════════════════════════════════════════════════════════════════════════
#  CHOICE LABEL POSITIONS
# ═══════════════════════════════════════════════════════════════════════════════

def find_choice_positions(page_words, question_positions):
    result = {}
    for pi, words in page_words.items():
        choices = [
            {'letter': w['text'][1], 'x': w['x0'], 'y': w['top']}
            for w in words if w['text'] in ['(A)', '(B)', '(C)', '(D)']
        ]
        page_qs = {n: i for n, i in question_positions.items() if i['page'] == pi}
        for col in ('left', 'right'):
            cx = COL_LEFT if col == 'left' else COL_RIGHT
            col_qs = sorted(
                [(n, i) for n, i in page_qs.items() if i['col'] == col],
                key=lambda x: x[1]['y'],
            )
            for k, (n, info) in enumerate(col_qs):
                y_end = col_qs[k+1][1]['y'] if k+1 < len(col_qs) else 9999
                qc = [c for c in choices
                      if cx['x0'] <= c['x'] <= cx['x1']
                      and info['y'] <= c['y'] <= y_end]
                if len(qc) != 4: continue
                cm = {c['letter']: {'x': c['x'], 'y': c['y']} for c in qc}
                u  = len(set(round(c['y']) for c in qc))
                result[n] = {
                    'layout':  '4row' if u == 1 else '2x2' if u == 2 else 'vertical',
                    'choices': cm,
                }
    return result


# ═══════════════════════════════════════════════════════════════════════════════
#  RASTERISATION
# ═══════════════════════════════════════════════════════════════════════════════

def rasterize_pages(pdf_path, first=3, last=9):
    doc = pdfium.PdfDocument(str(pdf_path))
    return {
        p: doc[p].render(scale=SCALE).to_pil().convert('RGB')
        for p in range(first - 1, min(last, len(doc)))
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  CROP HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _q_bot_px(n, q_nums, q_pos, content_ceil):
    info = q_pos[n]
    pi, col = info['page'], info['col']
    y = content_ceil.get(pi, 780.0)
    for m in q_nums[q_nums.index(n) + 1:]:
        nxt = q_pos[m]
        if nxt['page'] == pi and nxt['col'] == col:
            y = nxt['y'] - 3
            break
    return pts_to_px(y)


# ═══════════════════════════════════════════════════════════════════════════════
#  QUESTION CROPS
# ═══════════════════════════════════════════════════════════════════════════════

def compute_question_crops(q_pos, choice_data, page_images, content_ceil):
    q_nums = sorted(q_pos.keys())
    crops  = {}
    for n in q_nums:
        info = q_pos[n]
        pi, col = info['page'], info['col']
        cx = COL_LEFT if col == 'left' else COL_RIGHT
        y_top = info['y'] - 3
        if n in choice_data:
            y_bot = min(c['y'] for c in choice_data[n]['choices'].values()) - 3
        else:
            y_bot = px_to_pts(_q_bot_px(n, q_nums, q_pos, content_ceil))
        if pi not in page_images: continue
        bbox = content_bbox(
            page_images[pi],
            pts_to_px(cx['x0']), pts_to_px(max(y_top, 0)),
            pts_to_px(cx['x1']), pts_to_px(y_bot),
        )
        if bbox:
            crops[n] = {'page': pi, 'box': bbox}
    return crops


# ═══════════════════════════════════════════════════════════════════════════════
#  CHOICE CROPS  —  FIXED: Bottom-capping for ALL layouts
# ═══════════════════════════════════════════════════════════════════════════════

def compute_choice_crops(q_pos, choice_data, page_images, content_ceil):
    q_nums    = sorted(q_pos.keys())
    all_crops = {}

    for n in q_nums:
        if n not in choice_data: continue
        info = q_pos[n]
        pi, col = info['page'], info['col']
        layout, choices = choice_data[n]['layout'], choice_data[n]['choices']
        cx = COL_LEFT if col == 'left' else COL_RIGHT
        if pi not in page_images: continue

        img   = page_images[pi]
        q_bot = _q_bot_px(n, q_nums, q_pos, content_ceil)
        L     = ['A', 'B', 'C', 'D']

        def reg(lx0, ly0_pts, lx1, ly1_px):
            return content_bbox(
                img,
                pts_to_px(lx0), pts_to_px(ly0_pts),
                pts_to_px(lx1), int(ly1_px),
            )

        crops = {}
        
        # ── UNIVERSAL BOTTOM CAP ──────────────────────────────────────────────
        # Prevent bleeding into footer/next question for ALL layout types.
        # Cap at ~3 line-heights below the lowest choice label.
        line_height_px = pts_to_px(14)
        max_choice_y = max(choices[l]['y'] for l in L)
        safe_bottom = min(q_bot, pts_to_px(max_choice_y) + int(line_height_px * 3))
        # ──────────────────────────────────────────────────────────────────────

        if layout == '2x2':
            by_y  = sorted(L, key=lambda l: choices[l]['y'])
            row1  = sorted(by_y[:2], key=lambda l: choices[l]['x'])
            row2  = sorted(by_y[2:], key=lambda l: choices[l]['x'])
            r1_top = min(choices[l]['y'] for l in row1) - 3
            r2_top = min(choices[l]['y'] for l in row2) - 3
            x_mid  = min(choices[row1[1]]['x'], choices[row2[1]]['x']) - 3
            for letter, lx0, lx1, ly0, ly1 in [
                (row1[0], cx['x0'], x_mid,   r1_top, pts_to_px(r2_top)),
                (row1[1], x_mid,   cx['x1'], r1_top, pts_to_px(r2_top)),
                (row2[0], cx['x0'], x_mid,   r2_top, safe_bottom),  # ← uses safe_bottom
                (row2[1], x_mid,   cx['x1'], r2_top, safe_bottom),  # ← uses safe_bottom
            ]:
                bbox = reg(lx0, ly0, lx1, ly1)
                if bbox: crops[letter] = {'page': pi, 'box': bbox}

        elif layout == '4row':
            by_x = sorted(L, key=lambda l: choices[l]['x'])
            ry   = min(choices[l]['y'] for l in L) - 3
            # Use the universal safe_bottom here
            for k, letter in enumerate(by_x):
                lx0 = max(choices[by_x[k]]['x'] - 3, cx['x0'])
                lx1 = (min(choices[by_x[k+1]]['x'] - 3, cx['x1'])
                       if k + 1 < 4 else cx['x1'])
                bbox = reg(lx0, ry, lx1, safe_bottom)  # ← uses safe_bottom
                if bbox: crops[letter] = {'page': pi, 'box': bbox}

        elif layout == 'vertical':
            by_y = sorted(L, key=lambda l: choices[l]['y'])
            for k, letter in enumerate(by_y):
                ly0 = choices[letter]['y'] - 3
                # Last choice uses safe_bottom instead of raw q_bot
                if k + 1 < 4:
                    ly1 = pts_to_px(choices[by_y[k+1]]['y'] - 3)
                else:
                    ly1 = safe_bottom  # ← uses safe_bottom
                bbox = reg(cx['x0'], ly0, cx['x1'], ly1)
                if bbox: crops[letter] = {'page': pi, 'box': bbox}

        if crops:
            all_crops[n] = crops

    return all_crops


# ═══════════════════════════════════════════════════════════════════════════════
#  SAVE
# ═══════════════════════════════════════════════════════════════════════════════

def save_crops(crops, page_images, out_dir, prefix, is_choices=False):
    saved = {}
    for n, val in sorted(crops.items()):
        if is_choices:
            saved[n] = {}
            for letter, info in val.items():
                if info['page'] not in page_images: continue
                fname = f"{prefix}_q{n:02d}_{letter}.png"
                page_images[info['page']].crop(info['box']).save(
                    os.path.join(out_dir, fname), 'PNG')
                saved[n][letter] = fname
        else:
            if val['page'] not in page_images: continue
            fname = f"{prefix}_q{n:02d}.png"
            page_images[val['page']].crop(val['box']).save(
                os.path.join(out_dir, fname), 'PNG')
            saved[n] = fname
    return saved


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def parse_exam(exam_pdf, year, exam_type, base_output_dir):
    folder = f"USNCO_{year}_{exam_type.capitalize()}"
    out    = os.path.join(base_output_dir, folder)
    os.makedirs(out, exist_ok=True)
    prefix = f"{year}_{exam_type.lower().replace(' ', '_')}"

    print(f"\n{'━'*62}")
    print(f"  {year} USNCO {exam_type} Exam  →  {folder}")
    print(f"{'━'*62}")

    print("  [1/6] Analysing pages...")
    page_words, content_ceil = analyse_pages(exam_pdf)
    for pi, ceil in sorted(content_ceil.items()):
        print(f"        page {pi+1}: content ceiling = {ceil:.0f} pt")

    print("  [2/6] Locating question numbers...")
    q_pos   = find_question_positions(exam_pdf)
    missing = [n for n in range(1, 61) if n not in q_pos]
    print(f"        {len(q_pos)}/60 found" +
          (f"  ⚠️  Missing: {missing}" if missing else ""))

    print("  [3/6] Locating A/B/C/D labels...")
    choice_data = find_choice_positions(page_words, q_pos)
    lc = {}
    for v in choice_data.values():
        lc[v['layout']] = lc.get(v['layout'], 0) + 1
    print(f"        {len(choice_data)}/60  "
          f"(2x2:{lc.get('2x2',0)} "
          f"4row:{lc.get('4row',0)} "
          f"vertical:{lc.get('vertical',0)})")

    print("  [4/6] Extracting answer key...")
    answers = extract_answer_key(exam_pdf)
    report_key_quality(answers, 'exam PDF (last page)')

    print("  [5/6] Rasterising pages...")
    page_images = rasterize_pages(exam_pdf)
    print(f"        {len(page_images)} pages")

    print("  [6/6] Cropping (pixel-content-aware)...")
    q_crops = compute_question_crops(q_pos, choice_data, page_images, content_ceil)
    c_crops = compute_choice_crops(q_pos, choice_data, page_images, content_ceil)
    q_files = save_crops(q_crops, page_images, out, prefix, is_choices=False)
    c_files = save_crops(c_crops, page_images, out, prefix, is_choices=True)
    n_c     = sum(len(v) for v in c_files.values())
    print(f"        {len(q_files)} question + {n_c} choice = {len(q_files)+n_c} PNGs")

    questions_meta = [
        {
            "number":    n,
            "topic":     get_topic(n),
            "answer":    answers.get(n, "?"),
            "year":      year,
            "exam_type": exam_type,
            "image":     q_files.get(n, ""),
            "layout":    choice_data[n]['layout'] if n in choice_data else None,
            "choices": {
                l: c_files.get(n, {}).get(l, "")
                for l in ['A', 'B', 'C', 'D']
            },
        }
        for n in range(1, 61)
    ]

    meta = {"year": year, "exam_type": exam_type, "questions": questions_meta}
    with open(os.path.join(out, f"{prefix}_metadata.json"), 'w') as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    print(f"\n  ✅  Done! → {out}/\n")
    return meta, out


# ═══════════════════════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════════════════════

def prompt(msg, default=None):
    val = input(f"  {msg}{f' [{default}]' if default else ''}: ").strip()
    return val if val else default

def prompt_file(msg, extensions=('.pdf', '.txt')):
    while True:
        path = input(f"  {msg}: ").strip().strip('"').strip("'")
        if not path: return None
        p = Path(path)
        if p.exists() and p.suffix.lower() in extensions: return str(p)
        print(f"    ✗  Not found or wrong type ({'/'.join(extensions)}): {path}")

def collect_exams_interactively():
    """Prompt the user one exam at a time. Returns list of (pdf, year, type)."""
    exams = []
    while True:
        print("─" * 62)
        exam_pdf = prompt_file("Exam PDF path (Enter to finish)", extensions=('.pdf',))
        if not exam_pdf: break

        m         = re.search(r'(19|20)\d{2}', Path(exam_pdf).stem)
        year_str  = prompt("Exam year", default=m.group() if m else None)
        exam_type = prompt("Exam type (Local / National)", default="Local")

        try:
            year = int(year_str)
        except (ValueError, TypeError):
            print("  ✗  Invalid year"); continue

        exams.append((exam_pdf, year, exam_type))
    return exams

def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║                 USNCO EXAM PARSER  v5.1                      ║
║                                                              ║
║  FIXED: Bottom-capping now works for ALL layout types        ║
╚══════════════════════════════════════════════════════════════╝

Outputs per question:
  • Question stem image   →  2025_local_q07.png
  • Per-choice images     →  2025_local_q07_A.png  _B  _C  _D
  • JSON metadata         →  2025_local_metadata.json

index.json is updated (not replaced) on every run.
""")

    # ── Choose input mode ────────────────────────────────────────────────────
    print("  How would you like to provide exam paths?")
    print("    1) Enter them one by one interactively")
    print("    2) Load from a .txt batch file")
    mode = prompt("Choice", default="1")

    exams = []   # list of (pdf_path, year, exam_type)

    if mode == "2":
        txt = prompt_file("Batch .txt file path", extensions=('.txt',))
        if not txt:
            print("  No file provided — exiting.")
            return
        exams = parse_batch_file(txt)
        if not exams:
            print("  No valid entries found in batch file — exiting.")
            return
        print(f"\n  Loaded {len(exams)} exam(s) from batch file.")
    else:
        exams = collect_exams_interactively()
        if not exams:
            print("  No exams entered — exiting.")
            return

    # ── Base output directory ────────────────────────────────────────────────
    default_base = os.path.join(os.path.dirname(exams[0][0]), "usnco_results")
    base = prompt("Base output directory", default=default_base)
    os.makedirs(base, exist_ok=True)

    # ── Load existing index so we can merge into it ──────────────────────────
    idx_path      = os.path.join(base, "index.json")
    existing_idx  = load_index(idx_path)
    new_entries   = []

    # ── Parse each exam ──────────────────────────────────────────────────────
    for exam_pdf, year, exam_type in exams:
        try:
            meta, path = parse_exam(exam_pdf, year, exam_type, base)
            new_entries.append({
                "year":      meta["year"],
                "exam_type": meta["exam_type"],
                "folder":    os.path.basename(path),
            })
        except Exception as e:
            print(f"\n  ✗  Error parsing {exam_pdf}: {e}")
            import traceback; traceback.print_exc()

    # ── Merge & write index ──────────────────────────────────────────────────
    if new_entries:
        save_index(idx_path, existing_idx, new_entries)
        print(f"\n  ALL DONE — {len(new_entries)} exam(s) parsed this run\n")


# ═══════════════════════════════════════════════════════════════════════════════
#  STARTUP CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    missing = []
    for pkg, imp in [('pdfplumber','pdfplumber'), ('Pillow','PIL'),
                     ('numpy','numpy'), ('pypdfium2','pypdfium2')]:
        try:
            __import__(imp)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"  ✗  Missing packages: {', '.join(missing)}")
        print(f"     Run: pip install {' '.join(missing)}")
        sys.exit(1)
    main()