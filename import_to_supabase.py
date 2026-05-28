#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import afeka_courses_summer_2026.json into Supabase.

Insertion order (FK dependencies):
  1. courses        (PK: course_code)
  2. course_groups  (FK -> courses; self-FK parent_group_id -> parents first)
  3. group_sessions (FK -> course_groups; SERIAL PK -> delete + re-insert)
  4. prerequisites  (FK -> courses;       SERIAL PK -> delete + re-insert)

DB constraint on course_groups:
  (type = 'harlaa' AND parent_group_id IS NULL)
  OR (type != 'harlaa' AND parent_group_id IS NOT NULL)
  All parent/standalone groups (no '/' in group_id) are stored as type 'harlaa'.
  Child groups (have '/') keep their JSON course_type.

NOTE: 'status' is intentionally not imported.
NOTE: 'linked_courses' is not imported; parent-child is captured via parent_group_id.
"""

import json
import sys
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
SUPABASE_URL = "https://ljoagpaiztxjhbdvkctw.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqb2FncGFpenR4amhiZHZrY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzQ0MTUsImV4cCI6MjA5NTU1MDQxNX0"
    ".OxWsOjU-v5-6aiU3mLnzGras4gba9GWX1fo22PjzAz0"
)
JSON_PATH  = Path(__file__).parent / "afeka_courses_all.json"
BATCH_SIZE = 500   # rows per Supabase request

# Hebrew label required by the DB constraint for parent/standalone groups
PARENT_TYPE = "הרצאה"   # הרצאה  (stored as UTF-8 in DB)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def clean(val):
    """Return None for empty/whitespace values, otherwise stripped string."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def to_time(t):
    """Convert 'HH:MM' to 'HH:MM:SS' for PostgreSQL TIME type."""
    if not t:
        return None
    return t if t.count(":") == 2 else t + ":00"


def upsert_all(sb, table, rows):
    if not rows:
        print("  [skip] {}: nothing to upsert.".format(table))
        return 0
    total = 0
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i: i + BATCH_SIZE]
        sb.table(table).upsert(chunk).execute()
        total += len(chunk)
        print("  [ok] {}: {}/{} rows upserted".format(table, total, len(rows)))
    return total


def delete_by_ids(sb, table, col, ids):
    for i in range(0, len(ids), BATCH_SIZE):
        chunk = ids[i: i + BATCH_SIZE]
        sb.table(table).delete().in_(col, chunk).execute()


def insert_all(sb, table, rows):
    if not rows:
        print("  [skip] {}: nothing to insert.".format(table))
        return 0
    total = 0
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i: i + BATCH_SIZE]
        sb.table(table).insert(chunk).execute()
        total += len(chunk)
        print("  [ok] {}: {}/{} rows inserted".format(table, total, len(rows)))
    return total


# --------------------------------------------------------------------------- #
# Load JSON
# --------------------------------------------------------------------------- #
print("[*] Loading JSON ...")
with open(JSON_PATH, encoding="utf-8") as fh:
    raw = json.load(fh)
print("    {} records loaded.".format(len(raw)))

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# --------------------------------------------------------------------------- #
# 1. COURSES  (deduplicated by course_code)
# --------------------------------------------------------------------------- #
print("")
print("--- 1. courses ---")
courses_seen = {}   # code -> name
for row in raw:
    code = row["course_code"]
    if code not in courses_seen:
        courses_seen[code] = row["course_name"]

course_rows = [
    {"course_code": code, "course_name": name}
    for code, name in courses_seen.items()
]
upsert_all(sb, "courses", course_rows)

# --------------------------------------------------------------------------- #
# 2. COURSE_GROUPS  (deduplicated by group_id)
#
#   DB constraint forces:
#     parent/standalone (no '/' in group_id) -> type = PARENT_TYPE, parent_group_id = NULL
#     child groups (have '/')                -> type = JSON course_type, parent_group_id = base id
# --------------------------------------------------------------------------- #
print("")
print("--- 2. course_groups ---")

groups = {}
for row in raw:
    gid = row["group"]
    if gid in groups:
        continue

    is_child = "/" in gid

    if is_child:
        parent_id  = gid.rsplit("/", 1)[0]
        group_type = row["course_type"]
    else:
        parent_id  = None
        group_type = PARENT_TYPE

    groups[gid] = {
        "group_id":        gid,
        "course_code":     row["course_code"],
        "type":            group_type,
        "semester":        row["semester"],
        "lecturer":        clean(row["lecturer"]),
        "parent_group_id": parent_id,
        "is_scheduled":    bool(row["scheduled"]),
    }

parents  = [g for g in groups.values() if g["parent_group_id"] is None]

# Only keep children whose parent was actually found in the JSON.
# Some scraped datasets are missing parent rows, which would cause a FK violation.
parent_ids = {g["group_id"] for g in parents}
children_all = [g for g in groups.values() if g["parent_group_id"] is not None]
children = [g for g in children_all if g["parent_group_id"] in parent_ids]

orphans = [g for g in children_all if g["parent_group_id"] not in parent_ids]
if orphans:
    print("    [!] Skipping {} child group(s) whose parent is missing from the data:".format(len(orphans)))
    for o in orphans:
        print("        {} -> parent {} not found".format(o["group_id"], o["parent_group_id"]))

# Track which group_ids were actually inserted so sessions can be filtered too
inserted_group_ids = {g["group_id"] for g in parents} | {g["group_id"] for g in children}

print("    {} parent/standalone groups, {} child groups ({} orphans skipped).".format(
    len(parents), len(children), len(orphans)))

upsert_all(sb, "course_groups", parents)   # parents first (self-FK)
upsert_all(sb, "course_groups", children)

# --------------------------------------------------------------------------- #
# 3. GROUP_SESSIONS  (SERIAL PK -> delete existing, then insert fresh)
# --------------------------------------------------------------------------- #
print("")
print("--- 3. group_sessions ---")

all_group_ids = list(groups.keys())
print("    Deleting existing sessions for {} groups...".format(len(all_group_ids)))
delete_by_ids(sb, "group_sessions", "group_id", all_group_ids)

sessions = []
for row in raw:
    if (row["scheduled"] and row["day"] and row["start_time"] and row["end_time"]
            and row["group"] in inserted_group_ids):   # skip orphaned groups
        sessions.append({
            "group_id":   row["group"],
            "day":        row["day"],
            "start_time": to_time(row["start_time"]),
            "end_time":   to_time(row["end_time"]),
            "room":       clean(row["room"]),
        })

insert_all(sb, "group_sessions", sessions)

# --------------------------------------------------------------------------- #
# 4. PREREQUISITES  (SERIAL PK -> delete existing, then insert fresh)
#
#   JSON per prereq: { "required": "X", "alternative": "Y" }
#   Mapping:
#     array index i -> condition_group = i+1
#     required + alternative (if non-null and != required) share the same
#     condition_group, meaning they are OR alternatives.
#     Different condition_groups = AND requirements.
# --------------------------------------------------------------------------- #
print("")
print("--- 4. prerequisites ---")

all_course_codes = list(courses_seen.keys())
print("    Deleting existing prerequisites for {} courses...".format(len(all_course_codes)))
delete_by_ids(sb, "prerequisites", "course_code", all_course_codes)

prereq_rows = []
seen_prereq_courses = set()

for row in raw:
    code = row["course_code"]
    if code in seen_prereq_courses:
        continue
    seen_prereq_courses.add(code)

    for idx, prereq in enumerate(row.get("prerequisites", []), start=1):
        required    = prereq.get("required")
        alternative = prereq.get("alternative")

        if required:
            prereq_rows.append({
                "course_code":     code,
                "req_course_name": required,
                "condition_group": idx,
            })

        if alternative and alternative != required:
            prereq_rows.append({
                "course_code":     code,
                "req_course_name": alternative,
                "condition_group": idx,
            })

insert_all(sb, "prerequisites", prereq_rows)

# --------------------------------------------------------------------------- #
print("")
print("[DONE] Import complete!")
print("    courses:        {}".format(len(course_rows)))
print("    course_groups:  {}".format(len(groups)))
print("    group_sessions: {}".format(len(sessions)))
print("    prerequisites:  {}".format(len(prereq_rows)))
