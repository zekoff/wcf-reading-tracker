#!/usr/bin/env python3
"""Parse a WCF + Scripture Proofs PDF into public/wcf-content.json.

Requires poppler-utils (`pdftotext`) on PATH. Usage:

    python3 scripts/parse-wcf.py /path/to/WCFScripureProofs.pdf [output.json]

Body text is distinguished from footnote/proof-text by font height (the
PDF sets them in different point sizes), not by page position -- footnotes
in this typesetting can both continue across a page break *and* spill onto
a page that already shows the next chapter's heading, so page boundaries
turned out to be unreliable as a signal. See the inline comments below for
the specific heuristics this required.
"""
import re
import json
import statistics
import subprocess
import sys

word_re = re.compile(
    r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>'
)

SECTION_RE = re.compile(r'^(\d{1,2})\.$')
FOOTNOTE_RE = re.compile(r'^([a-z])\.$')
SUPERSCRIPT_MAX_HEIGHT = 9.0   # lone inline footnote markers: ~8.1pt
BODY_MIN_HEIGHT = 10.5         # main confession text: ~11.57pt
                               # footnote-register text (labels + proof quotes): ~9.16-9.83pt
LINE_Y_TOLERANCE = 2.0


class Word:
    __slots__ = ("xmin", "ymin", "xmax", "ymax", "text")
    def __init__(self, xmin, ymin, xmax, ymax, text):
        self.xmin, self.ymin, self.xmax, self.ymax, self.text = xmin, ymin, xmax, ymax, text
    @property
    def height(self):
        return self.ymax - self.ymin


def html_unescape(s):
    return (s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", '"').replace("&apos;", "'"))


def load_pages(pdf_path):
    content = subprocess.run(
        ["pdftotext", "-bbox", pdf_path, "-"],
        check=True, capture_output=True, text=True,
    ).stdout
    page_blocks = re.findall(r'<page width="[\d.]+" height="[\d.]+">(.*?)</page>', content, re.S)
    pages = []
    for block in page_blocks:
        words = []
        for m in word_re.finditer(block):
            xmin, ymin, xmax, ymax, text = m.groups()
            words.append(Word(float(xmin), float(ymin), float(xmax), float(ymax), html_unescape(text)))
        pages.append(words)
    return pages


def group_lines(words):
    lines = []
    current = []
    current_y = None
    for w in words:
        if current_y is None or abs(w.ymin - current_y) <= LINE_Y_TOLERANCE:
            current.append(w)
            current_y = w.ymin if current_y is None else current_y
        else:
            lines.append(current)
            current = [w]
            current_y = w.ymin
    if current:
        lines.append(current)
    return lines


HEADER_FRAGMENT_RE = re.compile(r'^CHAPTER \d+$')  # all-caps running header,
# distinct from the mixed-case "Chapter N" chapter-opening marker. Normally
# part of the same line as "THE CONFESSION OF FAITH", but on pages with a
# multi-column text frame (e.g. the canon book list) it can be emitted as
# its own separate run in the content stream.


def is_header_footer(line_words):
    text = " ".join(w.text for w in line_words)
    return "THE CONFESSION OF FAITH" in text or bool(HEADER_FRAGMENT_RE.match(text))


class Section:
    def __init__(self, number):
        self.number = number
        self.word_tokens = []
        self.footnote_slots = []


class Chapter:
    def __init__(self, number):
        self.number = number
        self.title_words = []
        self.sections = []


def append_word_with_dehyphenation(buffer, word_text):
    if buffer and buffer[-1].endswith("-") and len(buffer[-1]) > 1:
        buffer[-1] = buffer[-1][:-1] + word_text
    else:
        buffer.append(word_text)


def reconstruct_text(tokens):
    return " ".join(tokens).strip()


def parse(pdf_path):
    pages = load_pages(pdf_path)
    chapters = []
    current_chapter = None
    current_section = None

    # Footnote blocks are collected globally (not per-chapter / per-page)
    # because: (a) a chapter's trailing footnotes can be typeset at the
    # bottom of a page that already shows the *next* chapter's heading,
    # and (b) a single footnote can itself continue across a page break.
    # Body-vs-footnote register is classified purely by font height (body
    # ~11.57pt, footnote ~9.26pt) -- not by page position -- since that
    # turned out to be the only reliable signal in this typesetting.
    footnote_blocks = []
    current_footnote_tokens = None

    awaiting_title = False

    for words in pages:
        lines = group_lines(words)
        for line in lines:
            if not line or is_header_footer(line):
                continue

            first = line[0]

            if first.text == "Chapter" and len(line) >= 2 and re.match(r'^\d+$', line[1].text):
                if current_chapter is not None:
                    chapters.append(current_chapter)
                current_chapter = Chapter(int(line[1].text))
                current_section = None
                awaiting_title = True
                continue

            if awaiting_title:
                line_height = statistics.median(w.height for w in line)
                if line_height >= 12.5:
                    current_chapter.title_words.extend(w.text for w in line)
                    continue
                else:
                    awaiting_title = False

            # Exclude lone inline superscript markers before classifying --
            # on a short line they can otherwise drag the median below the
            # body threshold even though every other word is body-sized.
            non_super = [
                w for w in line
                if not (len(w.text) == 1 and w.text.isalpha() and w.text.islower()
                        and w.height < SUPERSCRIPT_MAX_HEIGHT)
            ]
            sample = non_super if non_super else line
            median_height = statistics.median(w.height for w in sample)
            is_body_register = median_height >= BODY_MIN_HEIGHT

            if is_body_register:
                sec_match = SECTION_RE.match(first.text)
                if sec_match and current_chapter is not None:
                    expected = len(current_chapter.sections) + 1
                    if int(sec_match.group(1)) == expected:
                        current_section = Section(expected)
                        current_chapter.sections.append(current_section)
                        process_body_words(line[1:], current_section)
                        continue
                if current_section is not None:
                    process_body_words(line, current_section)
                continue

            # footnote register
            fn_match = FOOTNOTE_RE.match(first.text)
            if fn_match:
                current_footnote_tokens = []
                footnote_blocks.append(current_footnote_tokens)
                for w in line[1:]:
                    append_word_with_dehyphenation(current_footnote_tokens, w.text)
                continue

            if current_footnote_tokens is not None:
                for w in line:
                    append_word_with_dehyphenation(current_footnote_tokens, w.text)

    if current_chapter is not None:
        chapters.append(current_chapter)

    return chapters, footnote_blocks


def process_body_words(line_words, section):
    for w in line_words:
        is_super = (
            len(w.text) == 1
            and w.text.isalpha()
            and w.text.islower()
            and w.height < SUPERSCRIPT_MAX_HEIGHT
        )
        if is_super:
            section.footnote_slots.append(None)
            continue
        append_word_with_dehyphenation(section.word_tokens, w.text)


# Hardcoded fix for WCF ch.1 sec.2's two/three-column Old/New Testament book
# list -- the source PDF lays it out in newspaper columns, which defeats
# the single-column line-grouping this parser relies on everywhere else.
# This list is fixed, well-known content, so it's transcribed directly
# rather than reconstructed from column-jumbled word order.
CH1_SEC2_OVERRIDE = (
    "Under the name of Holy Scripture, or the Word of God written, are now "
    "contained all the books of the Old and New Testament, which are these: "
    "Of the Old Testament: Genesis, Exodus, Leviticus, Numbers, Deuteronomy, "
    "Joshua, Judges, Ruth, I Samuel, II Samuel, I Kings, II Kings, "
    "I Chronicles, II Chronicles, Ezra, Nehemiah, Esther, Job, Psalms, "
    "Proverbs, Ecclesiastes, The Song of Songs, Isaiah, Jeremiah, "
    "Lamentations, Ezekiel, Daniel, Hosea, Joel, Amos, Obadiah, Jonah, "
    "Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi. "
    "Of the New Testament: The Gospels according to Matthew, Mark, Luke, "
    "John; The Acts of the Apostles; Paul’s Epistles to the Romans, "
    "Corinthians I, Corinthians II, Galatians, Ephesians, Philippians, "
    "Colossians, Thessalonians I, Thessalonians II, to Timothy I, "
    "to Timothy II, to Titus, to Philemon; The Epistle to the Hebrews; "
    "The Epistle of James; The first and second Epistles of Peter; "
    "The first, second, and third Epistles of John; The Epistle of Jude; "
    "The Revelation of John. All which are given by inspiration of God to "
    "be the rule of faith and life."
)


def build_wcf_content(chapters, footnote_blocks):
    footnote_texts = [reconstruct_text(toks) for toks in footnote_blocks]
    cursor = 0
    out_chapters = []
    for ch in chapters:
        title = " ".join(ch.title_words).strip()
        out_sections = []
        for sec in ch.sections:
            text = reconstruct_text(sec.word_tokens)
            if ch.number == 1 and sec.number == 2:
                text = CH1_SEC2_OVERRIDE
            footnotes = []
            for _ in sec.footnote_slots:
                if cursor < len(footnote_texts):
                    footnotes.append(footnote_texts[cursor])
                else:
                    footnotes.append("[[MISSING FOOTNOTE: ran out of blocks]]")
                cursor += 1
            out_sections.append({
                "number": sec.number,
                "text": text,
                "footnotes": footnotes,
            })
        out_chapters.append({
            "number": ch.number,
            "title": title,
            "sections": out_sections,
        })
    unused = len(footnote_texts) - cursor
    if unused:
        print(f"WARNING: {unused} footnote blocks were never consumed")
    return {"chapters": out_chapters}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    pdf_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "public/wcf-content.json"

    chapters, footnote_blocks = parse(pdf_path)
    content = build_wcf_content(chapters, footnote_blocks)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=2)
    print("wrote", out_path)
    print("chapters:", len(content["chapters"]))
    total_sections = sum(len(c["sections"]) for c in content["chapters"])
    total_footnotes = sum(len(s["footnotes"]) for c in content["chapters"] for s in c["sections"])
    print("total sections:", total_sections, "total footnotes:", total_footnotes)
