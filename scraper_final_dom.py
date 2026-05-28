"""
Afeka Course Scraper - FINAL (DOM-based)
=========================================
Combines:
  - Playwright for navigation + HTML fetching
  - BeautifulSoup DOM traversal for parsing (no Regex on HTML)

Navigation flow (per course):
  1. Course list -> click button[data-progname=S_LOOK_FOR_NOSE][data-arguments=-N{code}]
  2. -> click each "פרטים נוספים" button (one per group)
  3. -> parse detail page -> page.go_back() -> repeat for next group

Run: python scraper_final_dom.py
Output: afeka_courses_summer_2026.json + .csv
"""

import json, csv, time
from tqdm import tqdm
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE        = "https://yedionpub.afeka.ac.il/yedion/fireflyweb.aspx"
ENTRY       = BASE + "?prgname=Enter_Search"
HEB_LETTERS = list("בגדהוזחטיכלמנסעפצקרשת")  # א is default
ENG_LETTERS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def cell_value(text: str) -> str:
    """Strip label prefix from a cell like 'סמסטר:קיץ' -> 'קיץ'."""
    if ":" in text:
        return text.split(":", 1)[1].strip()
    return text.strip()


# ─────────────────────────────────────────────────────────────────────────────
# PARSER — pure BeautifulSoup DOM traversal, zero Regex
# ─────────────────────────────────────────────────────────────────────────────

def parse_course_html(html: str) -> list[dict]:
    """
    Parse one course detail HTML page (reached via פרטים נוספים).
    Returns one dict per schedule row.
    """
    soup = BeautifulSoup(html, "html.parser")
    results = []

    # ── Top-level container ───────────────────────────────────────────────────
    top_container = soup.find("div", class_="fcontainer")
    if not top_container:
        return []

    top_rows = top_container.find_all("div", class_="row", recursive=False)

    # ── 1. Course code + name ─────────────────────────────────────────────────
    course_code, course_name = "", ""
    for row in top_rows:
        col = row.find("div", class_="col")
        if col:
            strong = col.find("strong")
            text = strong.get_text(strip=True) if strong else col.get_text(strip=True)
            parts = text.split(None, 1)
            if len(parts) == 2 and parts[0].isdigit():
                course_code = parts[0]
                course_name = parts[1]
                break

    # ── 2. Course type ────────────────────────────────────────────────────────
    course_type = ""
    for row in top_rows:
        col = row.find("div", class_="col")
        if col and "סוג קורס" in col.get_text():
            course_type = cell_value(col.get_text(strip=True))
            break

    # ── 3. Group — first non-zero "קבוצה" value ───────────────────────────────
    group = ""
    for row in top_rows:
        col = row.find("div", class_="col")
        if col:
            text = col.get_text(strip=True)
            if "קבוצה" in text and ":" in text:
                value = cell_value(text)
                if value and value != "0":
                    # Normalize whitespace around "/" (e.g. "264013005/   1" -> "264013005/1")
                    group = "/".join(part.strip() for part in value.split("/"))
                    break

    # ── 4. Schedule rows (מערכת שעות) ────────────────────────────────────────
    schedule_rows = []
    for h2 in soup.find_all("h2"):
        if "מערכת שעות" in h2.get_text():
            master = h2.find_parent("div", class_="MasterTable")
            if not master:
                continue
            ncontainer = master.find("div", class_="ncontainer")
            if not ncontainer:
                continue
            data_rows = ncontainer.find_all("div", class_="row")
            for row in data_rows[1:]:   # skip header row
                cols = row.find_all("div", class_="col")
                if len(cols) < 6:
                    continue
                day = cell_value(cols[1].get_text(strip=True))
                if not day:
                    continue  # skip rows with no actual schedule data
                schedule_rows.append({
                    "semester":   cell_value(cols[0].get_text(strip=True)),
                    "day":        day,
                    "start_time": cell_value(cols[2].get_text(strip=True)),
                    "end_time":   cell_value(cols[3].get_text(strip=True)),
                    "lecturer":   cell_value(cols[4].get_text(strip=True)),
                    "room":       cell_value(cols[5].get_text(strip=True)),
                })
            break

    # ── 5. Prerequisites (תנאי קדם) ──────────────────────────────────────────
    prerequisites = []
    for h2 in soup.find_all("h2"):
        if "תנאי קדם" in h2.get_text() and "תנאי קשר" not in h2.get_text():
            master = h2.find_parent("div", class_="MasterTable")
            if not master:
                continue
            ncontainer = master.find("div", class_="ncontainer")
            if not ncontainer:
                continue
            data_rows = ncontainer.find_all("div", class_="row")
            for row in data_rows[1:]:   # skip header row
                cols = row.find_all("div", class_="col")
                if len(cols) < 4:
                    continue
                required    = cell_value(cols[2].get_text(strip=True))
                alternative = cell_value(cols[3].get_text(strip=True))
                if required:
                    prerequisites.append({
                        "required":    required,
                        "alternative": alternative if alternative else None,
                    })
            break

    # ── 6. Linked courses from תנאי קשר table ────────────────────────────────
    linked_courses = []
    for h2 in soup.find_all("h2"):
        if "תנאי קשר" in h2.get_text():
            master = h2.find_parent("div", class_="MasterTable")
            if not master:
                continue
            ncontainer = master.find("div", class_="ncontainer")
            if not ncontainer:
                continue
            data_rows = ncontainer.find_all("div", class_="row")
            for row in data_rows[1:]:   # skip header row
                cols = row.find_all("div", class_="col")
                if not cols:
                    continue
                # The link is in the last col
                anchor = cols[-1].find("a")
                if not anchor:
                    continue
                href = anchor.get("href", "")
                # href: fireflyweb.aspx?prgname=S_CourseDetails&arguments=-N40130,-N3,-N22,-N261001321,-N1
                if "arguments=" not in href:
                    continue
                args_str = href.split("arguments=", 1)[1]
                for part in args_str.split(","):
                    part = part.strip()
                    if part.startswith("-N26"):
                        group_id = part[2:]   # strip the leading "-N"
                        if group_id and group_id not in linked_courses:
                            linked_courses.append(group_id)
                        break
            break

    # ── 7. Availability status ────────────────────────────────────────────────
    page_text = soup.get_text()
    if "הקורס מלא" in page_text:
        status = "מלא"
    elif "בקורס זה קיימת רשימת המתנה" in page_text:
        status = "רשימת המתנה"
    else:
        status = "פנוי"

    # ── 8. One JSON object per schedule row (or one unscheduled record) ───────
    if schedule_rows:
        for sched in schedule_rows:
            results.append({
                "course_code":    course_code,
                "course_name":    course_name,
                "course_type":    course_type,
                "group":          group,
                "scheduled":      True,
                "semester":       sched["semester"],
                "day":            sched["day"],
                "start_time":     sched["start_time"],
                "end_time":       sched["end_time"],
                "lecturer":       sched["lecturer"],
                "room":           sched["room"],
                "status":         status,
                "prerequisites":  prerequisites,
                "linked_courses": linked_courses,
            })
    else:
        # Course exists but not yet scheduled for this semester
        results.append({
            "course_code":    course_code,
            "course_name":    course_name,
            "course_type":    course_type,
            "group":          group,
            "scheduled":      False,
            "semester":       None,
            "day":            None,
            "start_time":     None,
            "end_time":       None,
            "lecturer":       None,
            "room":           None,
            "status":         status,
            "prerequisites":  prerequisites,
            "linked_courses": linked_courses,
        })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# POST-PROCESSING — link lectures to practice sessions
# ─────────────────────────────────────────────────────────────────────────────

def link_courses(courses: list[dict]) -> list[dict]:
    """
    Practice session groups contain '/' (e.g. "264013005/1").
    Find the matching lecture (group = prefix before '/') and
    add the practice session's group to lecture's linked_courses.
    """
    # Build lookup: (course_code, group) -> record
    lookup = {(c["course_code"], c["group"]): c for c in courses}

    for c in courses:
        if "/" in c["group"]:
            prefix = c["group"].split("/")[0]
            lecture = lookup.get((c["course_code"], prefix))
            if lecture and c["group"] not in lecture["linked_courses"]:
                lecture["linked_courses"].append(c["group"])

    return courses


# ─────────────────────────────────────────────────────────────────────────────
# NAVIGATION HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def ni(page, ms=600):
    try:
        page.wait_for_load_state("networkidle", timeout=12000)
    except PWTimeout:
        pass
    time.sleep(ms / 1000)


def load_summer_page(page):
    page.goto(ENTRY, wait_until="networkidle", timeout=30000)
    ni(page, 800)
    page.locator("select").nth(0).select_option(label="קיץ")
    ni(page, 300)
    page.get_by_text("סינון סמסטר").click()
    ni(page, 800)


def get_courses_for_letter(page, letter=None) -> dict:
    load_summer_page(page)
    if letter is not None:
        try:
            print(f"[DEBUG] Selecting letter: '{letter}' from dropdown...")
            # CRITICAL: Use label instead of value!
            page.locator("select").nth(2).select_option(label=letter)
            ni(page, 200)
        except Exception as e:
            print(f"[DEBUG] ❌ Failed to select letter '{letter}': {e}")
            return {}

    page.get_by_text("חיפוש קורס לפי שם קורס").click()
    ni(page, 800)

    soup = BeautifulSoup(page.content(), "html.parser")
    result = {}

    for row in soup.find_all("div", class_="row"):
        cols = row.find_all("div", class_="col")
        if len(cols) < 2:
            continue
        col0 = cols[0].get_text(strip=True)
        col1 = cols[1].get_text(strip=True)
        if not col0.startswith("קוד קורס:"):
            continue
        code = col0.replace("קוד קורס:", "").strip()
        name = col1.replace("שם קורס:", "").strip()
        if code.isdigit() and name:
            result[code] = name

    return result


def process_course(page, code: str, name: str) -> list[dict]:
    print(f"\n[DEBUG] ---> Starting: {name} (Code: {code})")
    all_rows = []

    # Direct navigation to bypass search button and go_back() issues!
    course_url = f"{BASE}?prgname=S_LOOK_FOR_NOSE&arguments=-N{code}"
    page.goto(course_url, wait_until="networkidle", timeout=30000)
    ni(page, 800)

    group_count = page.get_by_text("פרטים נוספים").count()
    print(f"[DEBUG] Found {group_count} 'פרטים נוספים' buttons for {name}.")

    if group_count == 0:
        print(f"[DEBUG] ❌ No groups found! Page title is: {page.title()}")
        return []

    for i in range(group_count):
        try:
            page.get_by_text("פרטים נוספים").nth(i).click()
            ni(page, 600)

            rows = parse_course_html(page.content())
            all_rows.extend(rows)

            # Safely reload the course page instead of using go_back()
            page.goto(course_url, wait_until="networkidle")
            ni(page, 600)
        except Exception as e:
            print(f"[DEBUG] ❌ Error in group {i}: {e}")
            page.goto(course_url, wait_until="networkidle")

    return all_rows


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def run():
    all_codes = {}
    all_rows  = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
            locale="he-IL"
        )
        page = ctx.new_page()

        # ── Step 1: Collect all course codes ─────────────────────────
        print("\n[1/3] Collecting course codes...")

        courses = get_courses_for_letter(page, letter=None)
        all_codes.update(courses)
        print(f"  alef (default): {len(courses)}")

        for letter in tqdm(HEB_LETTERS, desc=" כגבrew ", ncols=70):
            try:
                c = get_courses_for_letter(page, letter)
                all_codes.update(c)
                if c: tqdm.write(f"  {letter}: {len(c)}")
            except Exception as e:
                tqdm.write(f"  skip {letter}: {e}")

        for letter in tqdm(ENG_LETTERS, desc="English", ncols=70):
            try:
                c = get_courses_for_letter(page, letter)
                all_codes.update(c)
                if c: tqdm.write(f"  {letter}: {len(c)}")
            except Exception as e:
                tqdm.write(f"  skip {letter}: {e}")

        print(f"\n  -> {len(all_codes)} unique courses")

        # ── Step 2: Visit each course via correct navigation flow ─────
        print("\n[2/3] Fetching course details...")

        print("\n[DEBUG] --- Grouping check ---")
        from collections import defaultdict
        letter_groups: dict = defaultdict(list)
        for code, name in all_codes.items():
            clean_name = name.strip()
            first = clean_name[0] if clean_name else "א"
            letter_groups[first].append((code, clean_name))

        for l, c in letter_groups.items():
            print(f"[DEBUG] Letter '{l}' has {len(c)} courses in memory.")
        print("[DEBUG] ----------------------\n")

        ordered_letters = [None] + list(HEB_LETTERS) + list(ENG_LETTERS)
        alef_char       = "א"
        seen = set()

        for letter_key in ordered_letters:
            lookup_char  = alef_char if letter_key is None else letter_key
            course_pairs = letter_groups.get(lookup_char, [])
            if not course_pairs:
                continue

            tqdm.write(f"\n  Letter {lookup_char}: {len(course_pairs)} courses")

            # Prime the session for this specific letter
            get_courses_for_letter(page, letter=letter_key)

            for code, name in tqdm(course_pairs, desc=f"  {lookup_char}", ncols=70):
                try:
                    rows = process_course(page, code, name)
                    for r in rows:
                        key = (r["course_code"], r["group"], r["day"], r["start_time"])
                        if key not in seen:
                            seen.add(key)
                            all_rows.append(r)
                    if rows:
                        tqdm.write(f"    ok {name}: {len(rows)} rows")
                except Exception as e:
                    tqdm.write(f"    skip {code} {name}: {e}")

        print(f"\n  -> {len(all_rows)} total rows")

        # ── Step 3: Post-processing ───────────────────────────────────
        print("\n[3/3] Linking lectures <-> practice sessions...")
        all_rows = link_courses(all_rows)

        browser.close()

    return all_rows


def save(courses):
    print(f"\nSaving {len(courses)} records...")

    with open("afeka_courses_summer_2026.json", "w", encoding="utf-8") as f:
        json.dump(courses, f, ensure_ascii=False, indent=2)
    print("  ok afeka_courses_summer_2026.json")

    if courses:
        keys = ["course_code", "course_name", "course_type", "group",
                "scheduled", "semester", "day", "start_time", "end_time",
                "lecturer", "room", "status", "prerequisites", "linked_courses"]
        with open("afeka_courses_summer_2026.csv", "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
            w.writeheader()
            for c in courses:
                c_copy = dict(c)
                c_copy["prerequisites"]  = json.dumps(c["prerequisites"],  ensure_ascii=False)
                c_copy["linked_courses"] = json.dumps(c["linked_courses"], ensure_ascii=False)
                w.writerow(c_copy)
        print("  ok afeka_courses_summer_2026.csv")

        scheduled   = [c for c in courses if c["scheduled"]]
        unscheduled = [c for c in courses if not c["scheduled"]]
        print(f"\nScheduled: {len(scheduled)} | Unscheduled (no time slots yet): {len(unscheduled)}")

        print("\nSample:")
        for c in courses[:3]:
            print(json.dumps(
                {k: c[k] for k in ["course_code", "course_name", "group", "scheduled", "day", "start_time", "room"]},
                ensure_ascii=False
            ))


if __name__ == "__main__":
    print("=" * 62)
    print("   Afeka - Summer 2026  |  DOM-based Scraper")
    print("=" * 62)
    courses = run()
    save(courses)
    print(f"\nDone! Total records: {len(courses)}")
