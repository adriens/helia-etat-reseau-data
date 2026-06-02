"""Sync Helia maintenance data between live site and this data repository.

Logic:
  - New IDs (scraped, not in active/)  → write to active/<id>.json
  - Gone IDs (in active/, not scraped) → move to archive/<year>/<id>.json
  - Unchanged IDs                      → no-op (preserves first-seen scraped_at)

Outputs to GITHUB_OUTPUT when available:
  changed     true | false
  pr_title    semantic commit title
  pr_body     markdown PR body
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from helia_etat_reseaux.scraper import scrape_maintenances


@dataclass
class AddedInfo:
    id: str
    communes: list[str]
    timestamp_debut: str


@dataclass
class ArchivedInfo:
    id: str
    year: str
    communes: list[str]
    timestamp_debut: str


def _pr_title(added: list[AddedInfo], archived: list[ArchivedInfo]) -> str:
    if added and not archived:
        return f"feat(active): +{len(added)} maintenance(s)"
    years = sorted({a.year for a in archived})
    scope = "archive/" + ",".join(years)
    if archived and not added:
        return f"chore({scope}): -{len(archived)} maintenance(s)"
    return f"chore(sync): +{len(added)} active, -{len(archived)} → {scope}"


def _fmt_communes(communes: list[str], max_n: int = 4) -> str:
    if len(communes) <= max_n:
        return ", ".join(communes)
    return ", ".join(communes[:max_n]) + f" (+{len(communes) - max_n})"


def _pr_body(added: list[AddedInfo], archived: list[ArchivedInfo]) -> str:
    lines = []
    if added:
        lines.append(f"## Ajouts `active/` (+{len(added)})\n")
        for a in added:
            date = a.timestamp_debut[:10]
            lines.append(f"- `{a.id}` — {_fmt_communes(a.communes)} — début {date}")
    if archived:
        lines.append(f"\n## Archivages `archive/` (-{len(archived)})\n")
        for a in archived:
            date = a.timestamp_debut[:10]
            lines.append(f"- `{a.id}` — {_fmt_communes(a.communes)} — début {date} → archive/{a.year}")
    lines.append("\n🤖 sync automatique helia-etat-reseau-data")
    return "\n".join(lines)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("."))
    args = parser.parse_args()

    active_dir = args.data_dir / "active"
    archive_dir = args.data_dir / "archive"
    active_dir.mkdir(parents=True, exist_ok=True)
    archive_dir.mkdir(parents=True, exist_ok=True)

    current = {m.id: m for m in scrape_maintenances()}
    existing = {f.stem: f for f in active_dir.glob("*.json")}

    added: list[AddedInfo] = []
    archived: list[ArchivedInfo] = []

    for mid, m in current.items():
        if mid not in existing:
            (active_dir / f"{mid}.json").write_text(m.model_dump_json(indent=2))
            added.append(AddedInfo(id=mid, communes=m.communes_concernees, timestamp_debut=m.timestamp_debut))

    for mid, fpath in existing.items():
        if mid not in current:
            data = json.loads(fpath.read_text())
            year = data["timestamp_debut"][:4]
            year_dir = archive_dir / year
            year_dir.mkdir(parents=True, exist_ok=True)
            fpath.rename(year_dir / fpath.name)
            archived.append(ArchivedInfo(
                id=mid,
                year=year,
                communes=data["communes_concernees"],
                timestamp_debut=data["timestamp_debut"],
            ))

    changed = bool(added or archived)
    print(f"active={len(current)}  +{len(added)} new  -{len(archived)} archived")

    gh_output = os.environ.get("GITHUB_OUTPUT")
    if gh_output:
        title = _pr_title(added, archived) if changed else ""
        body = _pr_body(added, archived) if changed else ""
        with open(gh_output, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")
            f.write(f"pr_title={title}\n")
            # multiline body via heredoc syntax
            delimiter = "EOF_PR_BODY"
            f.write(f"pr_body<<{delimiter}\n{body}\n{delimiter}\n")


if __name__ == "__main__":
    main()
