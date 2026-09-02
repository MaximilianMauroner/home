#!/usr/bin/env python3
"""Provider-friendly scheduler and verified Kavita ingester for Suwayomi."""

from __future__ import annotations

import argparse
import contextlib
import errno
import hashlib
import json
import os
import re
import shutil
import signal
import sqlite3
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree


SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS titles (
    manga_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    source_title TEXT,
    category TEXT NOT NULL,
    category_rank INTEGER NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_lang TEXT NOT NULL,
    in_library INTEGER NOT NULL,
    blocked_reason TEXT,
    refreshed_at REAL
);
CREATE TABLE IF NOT EXISTS chapters (
    chapter_id INTEGER PRIMARY KEY,
    manga_id INTEGER NOT NULL REFERENCES titles(manga_id) ON DELETE CASCADE,
    chapter_number TEXT NOT NULL,
    chapter_name TEXT NOT NULL,
    source_order INTEGER NOT NULL,
    selected INTEGER NOT NULL DEFAULT 0,
    downloaded INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'discovered',
    file_path TEXT,
    sha256 TEXT,
    last_error TEXT,
    error_kind TEXT,
    error_detail TEXT,
    failure_count INTEGER NOT NULL DEFAULT 0,
    retry_after REAL NOT NULL DEFAULT 0,
    updated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS chapters_schedule
ON chapters(selected, state, manga_id, source_order);
CREATE TABLE IF NOT EXISTS providers (
    source_id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    last_started REAL NOT NULL DEFAULT 0,
    last_refresh_started REAL NOT NULL DEFAULT 0,
    paused_until REAL NOT NULL DEFAULT 0,
    failure_level INTEGER NOT NULL DEFAULT 0,
    manual_pause INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);
CREATE TABLE IF NOT EXISTS provider_failures (
    source_id TEXT NOT NULL REFERENCES providers(source_id) ON DELETE CASCADE,
    chapter_id INTEGER NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
    failed_at REAL NOT NULL,
    PRIMARY KEY(source_id, chapter_id)
);
CREATE TABLE IF NOT EXISTS inflight (
    source_id TEXT PRIMARY KEY REFERENCES providers(source_id) ON DELETE CASCADE,
    chapter_id INTEGER NOT NULL UNIQUE REFERENCES chapters(chapter_id) ON DELETE CASCADE,
    started_at REAL NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    progress_at REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pending_dequeues (
    chapter_id INTEGER PRIMARY KEY REFERENCES chapters(chapter_id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES providers(source_id) ON DELETE CASCADE,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
    path TEXT PRIMARY KEY,
    canonical_title TEXT NOT NULL,
    chapter_number TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size INTEGER NOT NULL,
    page_count INTEGER NOT NULL,
    origin TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS files_identity
ON files(canonical_title, chapter_number, status);
CREATE TABLE IF NOT EXISTS archive_cache (
    path TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    mtime_ns INTEGER NOT NULL,
    series TEXT NOT NULL,
    chapter_number TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    validated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at REAL NOT NULL,
    level TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT NOT NULL
);
"""


SCOPE_QUERY = """
query Scope {
  categories {
    nodes {
      id name
      mangas {
        nodes {
          id title inLibrary sourceId initialized
          source { id name lang }
          chapters {
            nodes {
              id chapterNumber name sourceOrder isDownloaded
              isRead isBookmarked lastPageRead pageCount
            }
          }
        }
      }
    }
  }
}
"""

DOWNLOAD_QUERY = """
query Downloads {
  downloadStatus {
    state
    queue {
      state tries progress
      manga { id title sourceId source { id name lang } }
      chapter { id chapterNumber name isDownloaded pageCount }
    }
  }
}
"""

MANGAS_QUERY = """
query Candidates {
  mangas(first: 500) {
    nodes {
      id title inLibrary initialized sourceId
      source { id name lang }
      categories { nodes { id name } }
      chapters { nodes { id chapterNumber name sourceOrder isDownloaded isRead isBookmarked lastPageRead } }
    }
  }
}
"""


@dataclass(frozen=True)
class Config:
    graphql_url: str
    categories: tuple[str, ...]
    blocked_sources: tuple[str, ...]
    source_priority: tuple[str, ...]
    title_priority: tuple[str, ...]
    title_overrides: dict[int, str]
    title_aliases: dict[str, str]
    downloads_root: Path
    library_root: Path
    quarantine_root: Path
    state_root: Path
    discord_webhook_url_file: Path | None = None
    discord_thread_id: str | None = None
    discord_dashboard_interval_seconds: int = 900
    provider_cap: int = 4
    provider_cooldown_seconds: int = 60
    poll_seconds: int = 5
    scope_refresh_seconds: int = 43200
    download_stall_seconds: int = 900
    backoff_seconds: tuple[int, ...] = (900, 3600, 21600, 86400)
    chapter_backoff_seconds: tuple[int, ...] = (3600, 21600, 86400)
    provider_failure_window_seconds: int = 3600
    provider_failure_threshold: int = 2
    provider_backoff_overrides: dict[str, int] | None = None
    reconciliation_interval_seconds: int = 300
    reconciliation_batch_size: int = 100
    heartbeat_max_age_seconds: int = 60

    @classmethod
    def load(cls, path: Path) -> "Config":
        data = json.loads(path.read_text())
        return cls(
            graphql_url=data["graphql_url"],
            categories=tuple(data["categories"]),
            blocked_sources=tuple(data["blocked_sources"]),
            source_priority=tuple(data["source_priority"]),
            title_priority=tuple(data.get("title_priority", [])),
            title_overrides={int(manga_id): title for manga_id, title in data.get("title_overrides", {}).items()},
            title_aliases={
                normalized_title(alias): canonical
                for alias, canonical in data.get("title_aliases", {}).items()
            },
            downloads_root=Path(data["downloads_root"]),
            library_root=Path(data["library_root"]),
            quarantine_root=Path(data["quarantine_root"]),
            state_root=Path(data["state_root"]),
            discord_webhook_url_file=(
                Path(data["discord_webhook_url_file"])
                if data.get("discord_webhook_url_file")
                else None
            ),
            discord_thread_id=(str(data["discord_thread_id"]) if data.get("discord_thread_id") else None),
            discord_dashboard_interval_seconds=int(data.get("discord_dashboard_interval_seconds", 900)),
            provider_cap=int(data.get("provider_cap", 4)),
            provider_cooldown_seconds=int(data.get("provider_cooldown_seconds", 60)),
            poll_seconds=int(data.get("poll_seconds", 5)),
            scope_refresh_seconds=int(data.get("scope_refresh_seconds", 43200)),
            download_stall_seconds=int(data.get("download_stall_seconds", 900)),
            backoff_seconds=tuple(data.get("backoff_seconds", [900, 3600, 21600, 86400])),
            chapter_backoff_seconds=tuple(data.get("chapter_backoff_seconds", [3600, 21600, 86400])),
            provider_failure_window_seconds=int(data.get("provider_failure_window_seconds", 3600)),
            provider_failure_threshold=int(data.get("provider_failure_threshold", 2)),
            provider_backoff_overrides={
                str(source): int(seconds)
                for source, seconds in data.get("provider_backoff_overrides", {}).items()
            },
            reconciliation_interval_seconds=int(data.get("reconciliation_interval_seconds", 300)),
            reconciliation_batch_size=int(data.get("reconciliation_batch_size", 100)),
            heartbeat_max_age_seconds=int(data.get("heartbeat_max_age_seconds", 60)),
        )


class GraphQL:
    def __init__(self, url: str, timeout: int = 120):
        self.url = url
        self.timeout = timeout

    def call(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        body = json.dumps({"query": query, "variables": variables or {}}).encode()
        request = urllib.request.Request(
            self.url,
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "SuwayomiBackfill/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read(), parse_float=Decimal)
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")[:1000]
            raise RuntimeError(f"GraphQL HTTP {error.code}: {detail}") from error
        if payload.get("errors"):
            raise RuntimeError(f"GraphQL error: {payload['errors']}")
        return payload["data"]


class DiscordMessageMissing(Exception):
    """The persistent Discord message was deleted and must be recreated."""


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        # Maintenance/status commands may briefly overlap the long-running
        # controller. Wait for its small transaction instead of failing with
        # SQLITE_BUSY.
        self.connection = sqlite3.connect(path, timeout=30)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA busy_timeout=30000")
        self.connection.executescript(SCHEMA)
        columns = {row[1] for row in self.connection.execute("PRAGMA table_info(titles)")}
        if "source_title" not in columns:
            self.connection.execute("ALTER TABLE titles ADD COLUMN source_title TEXT")
        self.connection.execute("UPDATE titles SET source_title=title WHERE source_title IS NULL")
        chapter_columns = {
            row[1] for row in self.connection.execute("PRAGMA table_info(chapters)")
        }
        if "failure_count" not in chapter_columns:
            self.connection.execute(
                "ALTER TABLE chapters ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0"
            )
        if "retry_after" not in chapter_columns:
            self.connection.execute(
                "ALTER TABLE chapters ADD COLUMN retry_after REAL NOT NULL DEFAULT 0"
            )
        if "error_kind" not in chapter_columns:
            self.connection.execute("ALTER TABLE chapters ADD COLUMN error_kind TEXT")
        if "error_detail" not in chapter_columns:
            self.connection.execute("ALTER TABLE chapters ADD COLUMN error_detail TEXT")
        inflight_columns = {
            row[1] for row in self.connection.execute("PRAGMA table_info(inflight)")
        }
        if "progress" not in inflight_columns:
            self.connection.execute(
                "ALTER TABLE inflight ADD COLUMN progress REAL NOT NULL DEFAULT 0"
            )
        if "progress_at" not in inflight_columns:
            self.connection.execute(
                "ALTER TABLE inflight ADD COLUMN progress_at REAL NOT NULL DEFAULT 0"
            )
        self.connection.execute(
            "UPDATE inflight SET progress_at=started_at WHERE progress_at=0"
        )
        provider_columns = {
            row[1] for row in self.connection.execute("PRAGMA table_info(providers)")
        }
        if "last_refresh_started" not in provider_columns:
            self.connection.execute(
                "ALTER TABLE providers ADD COLUMN last_refresh_started REAL NOT NULL DEFAULT 0"
            )
        self.connection.commit()

    def close(self) -> None:
        self.connection.close()

    def event(self, level: str, event: str, detail: dict[str, Any] | str) -> None:
        text = detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False, sort_keys=True)
        self.connection.execute(
            "INSERT INTO events(created_at, level, event, detail) VALUES(?,?,?,?)",
            (time.time(), level, event, text),
        )
        self.connection.commit()
        print(json.dumps({"level": level, "event": event, "detail": detail}, ensure_ascii=False), flush=True)

    def get_meta(self, key: str, default: str | None = None) -> str | None:
        row = self.connection.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row["value"] if row else default

    def set_meta(self, key: str, value: str) -> None:
        self.connection.execute(
            "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )
        self.connection.commit()


def normalized_title(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).casefold()
    value = value.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "", value)


def chapter_number(value: Any) -> str:
    number = value if isinstance(value, Decimal) else Decimal(str(value))
    text = format(number, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def image_magic(data: bytes) -> bool:
    return (
        data.startswith(b"\xff\xd8\xff")
        or data.startswith(b"\x89PNG\r\n\x1a\n")
        or data.startswith((b"GIF87a", b"GIF89a"))
        or (len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP")
        or data.startswith((b"II*\x00", b"MM\x00*"))
    )


def inspect_cbz(path: Path) -> tuple[str, str, int, str]:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    with zipfile.ZipFile(path) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError(f"CRC failure in {bad}")
        image_names = [
            name for name in archive.namelist()
            if Path(name).suffix.casefold() in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}
        ]
        if not image_names:
            raise ValueError("archive contains no image files")
        for name in image_names:
            with archive.open(name) as image:
                if not image_magic(image.read(16)):
                    raise ValueError(f"unrecognized image data in {name}")
        series = path.parent.name
        number: str | None = None
        with contextlib.suppress(ValueError):
            number = parse_number_from_filename(path.name)
        with contextlib.suppress(KeyError, ElementTree.ParseError):
            root = ElementTree.fromstring(archive.read("ComicInfo.xml"))
            series = (root.findtext("Series") or series).strip()
            raw_number = root.findtext("Number")
            if raw_number:
                number = chapter_number(raw_number)
        if number is None:
            raise ValueError(f"cannot determine chapter number from {path.name}")
    return series, number, len(image_names), digest.hexdigest()


def canonicalize_cbz_series(path: Path, series: str) -> bool:
    """Atomically align ComicInfo series metadata with the canonical library title."""
    temporary = path.with_name(
        f".{path.name}.{os.getpid()}.{time.time_ns()}.metadata.partial"
    )
    try:
        with zipfile.ZipFile(path) as source:
            try:
                root = ElementTree.fromstring(source.read("ComicInfo.xml"))
            except KeyError:
                return False
            series_node = root.find("Series")
            current_series = (series_node.text or "").strip() if series_node is not None else ""
            if current_series == series:
                return False
            if series_node is None:
                series_node = ElementTree.SubElement(root, "Series")
            series_node.text = series
            comic_info = ElementTree.tostring(
                root,
                encoding="utf-8",
                xml_declaration=True,
            )
            with zipfile.ZipFile(temporary, "w") as destination:
                for item in source.infolist():
                    data = comic_info if item.filename == "ComicInfo.xml" else source.read(item)
                    destination.writestr(item, data)
        canonical_series, _, _, _ = inspect_cbz(temporary)
        if canonical_series != series:
            raise RuntimeError(f"failed to canonicalize ComicInfo metadata in {path}")
        shutil.copystat(path, temporary)
        os.replace(temporary, path)
        return True
    finally:
        temporary.unlink(missing_ok=True)


def parse_number_from_filename(name: str) -> str:
    match = re.search(r"(?:chapter|ch\.?)[ _.-]*([+-]?\d+(?:\.\d+)?)", name, re.IGNORECASE)
    if match:
        return chapter_number(match.group(1))

    stem = Path(name).stem
    match = re.fullmatch(r"([+-]?\d+(?:\.\d+)?)(?:-[a-z]{2,3}){1,2}", stem, re.IGNORECASE)
    if not match:
        match = re.search(r"\s([+-]?\d+(?:\.\d+)?)$", stem)
    if match:
        return chapter_number(match.group(1))
    raise ValueError(f"cannot determine chapter number from {name}")


def gql_id_list(values: Iterable[int]) -> str:
    return "[" + ",".join(str(int(value)) for value in values) + "]"


class Controller:
    def __init__(self, config: Config):
        self.config = config
        self.config.state_root.mkdir(parents=True, exist_ok=True)
        self.config.quarantine_root.mkdir(parents=True, exist_ok=True)
        self.api = GraphQL(config.graphql_url)
        self.store = Store(config.state_root / "state.sqlite3")
        self.running = True

    def close(self) -> None:
        self.store.close()

    def discord_webhook_url(
        self,
        *,
        wait: bool = False,
        message_id: str | None = None,
        with_components: bool = False,
    ) -> str | None:
        webhook_file = self.config.discord_webhook_url_file
        if not webhook_file or not webhook_file.exists():
            return None
        parts = urllib.parse.urlsplit(webhook_file.read_text().strip())
        path = parts.path.rstrip("/")
        if message_id:
            path += f"/messages/{urllib.parse.quote(message_id, safe='')}"
        query = dict(urllib.parse.parse_qsl(parts.query, keep_blank_values=True))
        if self.config.discord_thread_id:
            query["thread_id"] = self.config.discord_thread_id
        if wait:
            query["wait"] = "true"
        if with_components:
            query["with_components"] = "true"
        return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, urllib.parse.urlencode(query), parts.fragment))

    def discord_request(
        self,
        method: str,
        url: str,
        payload: dict[str, Any],
        failure_event: str,
        detail: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Send a webhook request without exposing its token in process arguments."""
        retry_after = float(self.store.get_meta("discord_webhook_retry_after", "0") or "0")
        if retry_after > time.time():
            return None
        body = json.dumps(payload, ensure_ascii=False).encode()
        try:
            request = urllib.request.Request(
                url,
                data=body,
                method=method,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "SuwayomiBackfill/1.0",
                },
            )
            with urllib.request.urlopen(request, timeout=15) as result:
                status = result.status
                response_body = result.read().decode()
            if status not in (200, 204):
                raise RuntimeError(f"Discord webhook HTTP {status}")
            response = json.loads(response_body) if response_body.strip() else {}
        except urllib.error.HTTPError as error:
            response_body = error.read().decode(errors="replace")
            error.close()
            with contextlib.suppress(json.JSONDecodeError):
                if json.loads(response_body).get("code") == 10008:
                    raise DiscordMessageMissing from error
            self.store.set_meta("discord_webhook_retry_after", str(time.time() + 900))
            self.store.event(
                "error",
                failure_event,
                {**detail, "error": f"Discord webhook HTTP {error.code}: {response_body[:500]}"},
            )
            return None
        except (json.JSONDecodeError, OSError, RuntimeError, urllib.error.URLError) as error:
            self.store.set_meta("discord_webhook_retry_after", str(time.time() + 900))
            self.store.event("error", failure_event, {**detail, "error": str(error)})
            return None
        self.store.set_meta("discord_webhook_retry_after", "0")
        return response

    def upsert_discord_dashboard(
        self,
        *,
        message_id: str | None,
        message_id_key: str,
        payload: dict[str, Any],
        failure_event: str,
    ) -> tuple[str, bool] | None:
        """Create or edit one dashboard; missing messages trigger set-level rotation."""
        if message_id:
            url = self.discord_webhook_url(message_id=message_id, with_components=True)
            if not url:
                return None
            response = self.discord_request(
                "PATCH", url, payload, failure_event, {"method": "PATCH"}
            )
            return (message_id, False) if response is not None else None

        url = self.discord_webhook_url(wait=True, with_components=True)
        if not url:
            return None
        response = self.discord_request(
            "POST", url, payload, failure_event, {"method": "POST"}
        )
        if response is None:
            return None
        new_message_id = str(response.get("id") or "")
        if not new_message_id:
            self.store.event(
                "error",
                failure_event,
                {"method": "POST", "error": "Discord returned no message id"},
            )
            return None
        self.store.set_meta(message_id_key, new_message_id)
        return new_message_id, True

    def send_discord(self, content: str, failure_event: str, detail: dict[str, Any]) -> bool:
        """Deliver one webhook message with a shared, persistent failure backoff."""
        webhook_url = self.discord_webhook_url()
        if not webhook_url:
            return False
        return self.discord_request("POST", webhook_url, {"content": content}, failure_event, detail) is not None

    @staticmethod
    def progress_bar(done: int, total: int, width: int = 10) -> str:
        filled = width if total and done >= total else int(done * width / total) if total else 0
        return "▰" * filled + "▱" * (width - filled)

    def throughput(self, done: int, total: int) -> tuple[float, float | None]:
        """Return rolling successful chapters/hour and ETA seconds."""
        now = time.time()
        first = self.store.connection.execute(
            "SELECT MIN(created_at) FROM events WHERE event='chapter_ingested'"
        ).fetchone()[0]
        if first is None:
            return 0.0, None
        window_start = max(now - 3600, float(first))
        completed = int(
            self.store.connection.execute(
                "SELECT COUNT(*) FROM events WHERE event='chapter_ingested' AND created_at>=?",
                (window_start,),
            ).fetchone()[0]
        )
        elapsed = max(300.0, now - window_start)
        rate = completed * 3600 / elapsed
        remaining = max(0, total - done)
        eta = remaining * 3600 / rate if rate > 0 and remaining else 0.0 if remaining == 0 else None
        return rate, eta

    @staticmethod
    def duration_text(seconds: float) -> str:
        minutes = max(0, round(seconds / 60))
        days, minutes = divmod(minutes, 24 * 60)
        hours, minutes = divmod(minutes, 60)
        if days:
            return f"{days}d {hours}h"
        if hours:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"

    def dashboard_rows(self) -> list[sqlite3.Row]:
        return list(
            self.store.connection.execute(
                """SELECT t.category,t.category_rank,t.title,COUNT(*) AS total,
                          SUM(CASE WHEN c.state='ingested' THEN 1 ELSE 0 END) AS done,
                          SUM(CASE WHEN c.state='queued' THEN 1 ELSE 0 END) AS queued,
                          SUM(CASE WHEN c.state='failed' THEN 1 ELSE 0 END) AS failed
                   FROM chapters c JOIN titles t ON t.manga_id=c.manga_id
                   WHERE c.selected=1 AND t.in_library=1 AND t.blocked_reason IS NULL
                   GROUP BY t.category,t.title ORDER BY t.category_rank,t.title"""
            )
        )

    def discord_dashboard_payload(self, previous: dict[str, int]) -> tuple[dict[str, Any], dict[str, int]]:
        rows = self.dashboard_rows()
        done = sum(int(row["done"] or 0) for row in rows)
        total = sum(int(row["total"] or 0) for row in rows)
        summary = (
            f"# Suwayomi backfill\n## {done * 100 / total:.1f}% complete\n"
            f"{self.progress_bar(done, total)}  **{done:,}/{total:,}**"
            if total else "# Suwayomi backfill\nNo selected chapters"
        )
        rate, eta = self.throughput(done, total)
        if eta is None:
            summary += f"\n⚡ **{rate:.1f} chapters/hour** · ETA unavailable"
        elif eta == 0:
            summary += f"\n⚡ **{rate:.1f} chapters/hour** · complete"
        else:
            summary += (
                f"\n⚡ **{rate:.1f} chapters/hour** · ETA **{self.duration_text(eta)}** "
                f"(<t:{int(time.time() + eta)}:R>)"
            )
        inflight = list(
            self.store.connection.execute(
                """SELECT t.title,c.chapter_number,p.source_name,i.progress
                   FROM inflight i JOIN chapters c ON c.chapter_id=i.chapter_id
                   JOIN titles t ON t.manga_id=c.manga_id
                   JOIN providers p ON p.source_id=i.source_id
                   ORDER BY t.title"""
            )
        )
        downloading = ["## Downloading now"]
        if inflight:
            for row in inflight:
                progress = float(row["progress"] or 0) * 100
                progress_text = f" · {progress:.0f}%" if progress > 0 else ""
                downloading.append(
                    f"**{row['title']}**\n"
                    f"Chapter **{row['chapter_number']}**{progress_text} · {row['source_name']}"
                )
        else:
            downloading.append("Nothing queued right now.")

        snapshot = {row["title"]: int(row["done"] or 0) for row in rows}
        active = [
            row for row in rows
            if int(row["done"] or 0) < int(row["total"] or 0)
            and (int(row["done"] or 0) or int(row["queued"] or 0) or int(row["failed"] or 0))
        ]
        series = ["## Series progress"]
        for row in active:
            title = row["title"]
            row_done = int(row["done"] or 0)
            row_total = int(row["total"] or 0)
            delta = row_done - int(previous.get(title, row_done))
            change = f" · **+{delta}**" if delta > 0 else ""
            flags = (f" · 🟦{row['queued']}" if row["queued"] else "") + (f" · 🟥{row['failed']}" if row["failed"] else "")
            percent = row_done * 100 / row_total if row_total else 0
            series.append(
                f"**{title}**\n{self.progress_bar(row_done, row_total)} "
                f"**{percent:.1f}%** · {row_done}/{row_total}{change}{flags}"
            )
        completed = sum(int(row["done"] or 0) == int(row["total"] or 0) and int(row["total"] or 0) > 0 for row in rows)
        series_text = "\n\n".join(series)
        if len(series_text) > 3900:
            series_text = series_text[:3880] + "\n…"
        return {
            "flags": 1 << 15,
            "components": [{
                "type": 17,
                "accent_color": 0x2ECC71,
                "components": [
                    {"type": 10, "content": summary},
                    {"type": 14, "divider": True, "spacing": 1},
                    {"type": 10, "content": "\n\n".join(downloading)},
                    {"type": 14, "divider": True, "spacing": 1},
                    {"type": 10, "content": series_text},
                    {"type": 14, "divider": True, "spacing": 1},
                    {
                        "type": 10,
                        "content": (
                            "-# 🟦 queued/downloading · 🟥 failed\n"
                            f"-# ✅ {completed} series complete · updated <t:{int(time.time())}:R>"
                        ),
                    },
                ],
            }],
            "allowed_mentions": {"parse": []},
        }, snapshot

    def notify_progress_dashboard(self, *, force: bool = False) -> bool:
        """Create one dashboard at download start and edit it as state changes."""
        message_id = self.store.get_meta("discord_dashboard_v2_message_id")
        last_update = float(self.store.get_meta("discord_dashboard_updated_at", "0") or "0")
        if not force and message_id and time.time() - last_update < self.config.discord_dashboard_interval_seconds:
            return False
        try:
            previous = json.loads(self.store.get_meta("discord_dashboard_snapshot", "{}") or "{}")
        except json.JSONDecodeError:
            previous = {}
        payload, snapshot = self.discord_dashboard_payload(previous)
        result = self.upsert_discord_dashboard(
            message_id=message_id,
            message_id_key="discord_dashboard_v2_message_id",
            payload=payload,
            failure_event="discord_dashboard_failed",
        )
        if result is None:
            return False
        message_id, created = result
        self.store.set_meta("discord_dashboard_snapshot", json.dumps(snapshot, ensure_ascii=False, sort_keys=True))
        self.store.set_meta("discord_dashboard_updated_at", str(time.time()))
        self.store.event("info", "discord_dashboard_updated", {"message_id": message_id, "created": created})
        return True

    def notify_milestones(self) -> None:
        """Send each 10% completion milestone once, persisted across restarts."""
        row = self.store.connection.execute(
            """SELECT COUNT(*) AS total,
                      SUM(CASE WHEN c.state='ingested' THEN 1 ELSE 0 END) AS ingested
               FROM chapters c JOIN titles t ON t.manga_id=c.manga_id
               WHERE c.selected=1 AND t.in_library=1 AND t.blocked_reason IS NULL"""
        ).fetchone()
        total = int(row["total"] or 0)
        ingested = int(row["ingested"] or 0)
        if total == 0:
            return
        progress = ingested * 100 / total
        for milestone in range(30, 101, 10):
            key = f"discord_milestone_{milestone}_sent"
            if progress < milestone or self.store.get_meta(key) == "1":
                continue
            if milestone == 100:
                content = f"✅ Suwayomi backfill complete: {ingested:,}/{total:,} canonical chapters imported."
            else:
                remaining = total - ingested
                content = (
                    f"📚 Suwayomi backfill reached {milestone}%: "
                    f"{ingested:,}/{total:,} canonical chapters imported, {remaining:,} remaining."
                )
            if not self.send_discord(content, "discord_milestone_failed", {"milestone": milestone}):
                return
            self.store.set_meta(key, "1")
            self.store.event("info", "discord_milestone_sent", {"milestone": milestone, "ingested": ingested, "total": total})

    def notify_completed_titles(self) -> None:
        """Send a one-time message when every selected chapter for a title is ingested."""
        completed = self.store.connection.execute(
            """SELECT MIN(t.manga_id) AS manga_id,t.title,COUNT(*) AS total
               FROM titles t JOIN chapters c ON c.manga_id=t.manga_id
               WHERE t.in_library=1 AND t.blocked_reason IS NULL AND c.selected=1
               GROUP BY t.title
               HAVING COUNT(*)=SUM(CASE WHEN c.state='ingested' THEN 1 ELSE 0 END)
               ORDER BY t.title"""
        )
        for row in completed:
            key = f"discord_title_group_{normalized_title(row['title'])}_sent"
            if self.store.get_meta(key) == "1":
                continue
            prior = self.store.connection.execute(
                """SELECT 1 FROM titles t JOIN meta m ON m.key='discord_title_'||t.manga_id||'_sent'
                   WHERE t.title=? AND m.value='1' LIMIT 1""",
                (row["title"],),
            ).fetchone()
            if prior:
                self.store.set_meta(key, "1")
                continue
            detail = {"manga_id": row["manga_id"], "title": row["title"], "chapters": row["total"]}
            content = f"✅ Series backfill complete: **{row['title']}** ({row['total']:,} canonical chapters)."
            if not self.send_discord(content, "discord_title_failed", detail):
                return
            self.store.set_meta(key, "1")
            self.store.event("info", "discord_title_sent", detail)

    def completed_title_rows(self) -> list[sqlite3.Row]:
        """Return fully imported canonical titles in dashboard category order."""
        return list(
            self.store.connection.execute(
                """SELECT t.category,t.category_rank,t.title,COUNT(*) AS total
                   FROM chapters c JOIN titles t ON t.manga_id=c.manga_id
                   WHERE c.selected=1 AND t.in_library=1 AND t.blocked_reason IS NULL
                   GROUP BY t.category,t.title
                   HAVING COUNT(*)=SUM(CASE WHEN c.state='ingested' THEN 1 ELSE 0 END)
                   ORDER BY t.category_rank,t.category,t.title"""
            )
        )

    def completed_titles_dashboard_payload(
        self, rows: list[sqlite3.Row]
    ) -> dict[str, Any]:
        grouped: dict[str, list[sqlite3.Row]] = {}
        for row in rows:
            grouped.setdefault(row["category"], []).append(row)

        components: list[dict[str, Any]] = [
            {"type": 10, "content": "# Completed manga"},
        ]
        if grouped:
            for category, titles in grouped.items():
                entries = [
                    f"✅ **{row['title']}** · {int(row['total']):,} "
                    f"{'chapter' if int(row['total']) == 1 else 'chapters'}"
                    for row in titles
                ]
                category_parts: list[str] = []
                current = f"## {category} · {len(titles)}"
                for entry in entries:
                    if len(current) + len(entry) + 1 > 3800:
                        category_parts.append(current)
                        current = f"## {category} · continued\n{entry}"
                    else:
                        current += f"\n{entry}"
                category_parts.append(current)
                components.append({"type": 14, "divider": True, "spacing": 1})
                components.extend(
                    {"type": 10, "content": content} for content in category_parts
                )
        else:
            components.append({"type": 10, "content": "No manga completed yet."})
        components.extend(
            [
                {"type": 14, "divider": True, "spacing": 1},
                {
                    "type": 10,
                    "content": (
                        f"-# ✅ {len(rows)} manga complete · "
                        f"updated <t:{int(time.time())}:R>"
                    ),
                },
            ]
        )
        return {
            "flags": 1 << 15,
            "components": [{"type": 17, "accent_color": 0x2ECC71, "components": components}],
            "allowed_mentions": {"parse": []},
        }

    def notify_completed_titles_dashboard(self, *, force: bool = False) -> bool:
        """Create one completed-manga message and edit it when the set changes."""
        rows = self.completed_title_rows()
        snapshot = json.dumps(
            [(row["category"], row["title"], int(row["total"])) for row in rows],
            ensure_ascii=False,
        )
        message_id = self.store.get_meta("discord_completed_titles_message_id")
        previous = self.store.get_meta("discord_completed_titles_snapshot")
        if message_id and previous == snapshot and not force:
            return False

        result = self.upsert_discord_dashboard(
            message_id=message_id,
            message_id_key="discord_completed_titles_message_id",
            payload=self.completed_titles_dashboard_payload(rows),
            failure_event="discord_completed_titles_dashboard_failed",
        )
        if result is None:
            return False
        message_id, created = result
        self.store.set_meta("discord_completed_titles_snapshot", snapshot)
        self.store.event(
            "info",
            "discord_completed_titles_dashboard_updated",
            {"message_id": message_id, "created": created, "completed": len(rows)},
        )
        return True

    def provider_dashboard_state(self) -> list[dict[str, Any]]:
        """Return stable, display-ready provider health states."""
        now = time.time()
        states: list[dict[str, Any]] = []
        for row in self.store.connection.execute("SELECT * FROM providers ORDER BY source_name"):
            if row["manual_pause"]:
                status = "manual"
            elif row["paused_until"] > now:
                status = "backoff"
            elif row["last_error"]:
                status = "probe_due"
            else:
                status = "healthy"
            states.append(
                {
                    "source_id": row["source_id"],
                    "source_name": row["source_name"],
                    "status": status,
                    "failure_level": int(row["failure_level"]),
                    "paused_until": int(row["paused_until"]),
                    "last_error": row["last_error"] or "",
                }
            )
        return states

    def provider_dashboard_payload(self, states: list[dict[str, Any]]) -> dict[str, Any]:
        icons = {"healthy": "🟢", "probe_due": "🟡", "backoff": "🟠", "manual": "🔴"}
        labels = {
            "healthy": "healthy",
            "probe_due": "probe due",
            "backoff": "backing off",
            "manual": "manual pause",
        }
        lines = ["# Provider uptime"]
        for state in states:
            detail = labels[state["status"]]
            if state["status"] == "backoff":
                detail += f" · retry <t:{state['paused_until']}:R>"
            elif state["status"] == "manual":
                detail += " · review required"
            lines.append(f"{icons[state['status']]} **{state['source_name']}** · {detail}")
        lines.append(
            f"\n-# 🟢 healthy · 🟡 probe due · 🟠 backoff · 🔴 manual · updated <t:{int(time.time())}:R>"
        )
        return {
            "flags": 1 << 15,
            "components": [{
                "type": 17,
                "accent_color": 0x3498DB,
                "components": [{"type": 10, "content": "\n".join(lines)}],
            }],
            "allowed_mentions": {"parse": []},
        }

    def notify_provider_dashboard(self, *, force: bool = False) -> bool:
        """Create one provider-status message and edit it when health changes."""
        states = self.provider_dashboard_state()
        snapshot = json.dumps(states, ensure_ascii=False, sort_keys=True)
        message_id = self.store.get_meta("discord_provider_dashboard_message_id")
        previous = self.store.get_meta("discord_provider_dashboard_snapshot")
        if message_id and previous == snapshot and not force:
            return False
        result = self.upsert_discord_dashboard(
            message_id=message_id,
            message_id_key="discord_provider_dashboard_message_id",
            payload=self.provider_dashboard_payload(states),
            failure_event="discord_provider_dashboard_failed",
        )
        if result is None:
            return False
        message_id, created = result
        self.store.set_meta("discord_provider_dashboard_snapshot", snapshot)
        self.store.event(
            "info",
            "discord_provider_dashboard_updated",
            {"message_id": message_id, "created": created},
        )
        return True

    def notify_dashboards(
        self, *, force_progress: bool = False, force_all: bool = False
    ) -> tuple[bool, bool, bool]:
        """Update persistent messages in their immutable Discord display order."""
        self.retry_dashboard_cleanup()
        id_keys = (
            "discord_completed_titles_message_id",
            "discord_dashboard_v2_message_id",
            "discord_provider_dashboard_message_id",
        )
        if not all(self.store.get_meta(key) for key in id_keys):
            return self.rotate_discord_dashboards()
        last_check = float(
            self.store.get_meta("discord_dashboard_set_checked_at", "0") or "0"
        )
        full_check = force_all or (
            time.time() - last_check >= self.config.discord_dashboard_interval_seconds
        )
        try:
            completed = self.notify_completed_titles_dashboard(force=full_check)
            progress = self.notify_progress_dashboard(
                force=full_check or force_progress
            )
            provider = self.notify_provider_dashboard(force=full_check)
        except DiscordMessageMissing:
            return self.rotate_discord_dashboards()
        if full_check and completed and progress and provider:
            self.store.set_meta("discord_dashboard_set_checked_at", str(time.time()))
        return completed, progress, provider

    def rotate_discord_dashboards(self) -> tuple[bool, bool, bool]:
        """Atomically replace the dashboard set while preserving Discord order."""
        completed_rows = self.completed_title_rows()
        completed_snapshot = json.dumps(
            [
                (row["category"], row["title"], int(row["total"]))
                for row in completed_rows
            ],
            ensure_ascii=False,
        )
        try:
            previous_progress = json.loads(
                self.store.get_meta("discord_dashboard_snapshot", "{}") or "{}"
            )
        except json.JSONDecodeError:
            previous_progress = {}
        progress_payload, progress_snapshot = self.discord_dashboard_payload(
            previous_progress
        )
        provider_states = self.provider_dashboard_state()
        provider_snapshot = json.dumps(
            provider_states, ensure_ascii=False, sort_keys=True
        )
        dashboards = (
            (
                "completed",
                self.completed_titles_dashboard_payload(completed_rows),
                "discord_completed_titles_dashboard_failed",
            ),
            ("progress", progress_payload, "discord_dashboard_failed"),
            (
                "provider",
                self.provider_dashboard_payload(provider_states),
                "discord_provider_dashboard_failed",
            ),
        )
        old_ids = {
            "completed": self.store.get_meta("discord_completed_titles_message_id"),
            "progress": self.store.get_meta("discord_dashboard_v2_message_id"),
            "provider": self.store.get_meta("discord_provider_dashboard_message_id"),
        }
        new_ids: dict[str, str] = {}
        for name, payload, failure_event in dashboards:
            url = self.discord_webhook_url(wait=True, with_components=True)
            if not url:
                self.queue_dashboard_cleanup(new_ids.values())
                self.retry_dashboard_cleanup()
                return False, False, False
            try:
                response = self.discord_request(
                    "POST", url, payload, failure_event, {"method": "POST"}
                )
            except DiscordMessageMissing:
                response = None
            message_id = str((response or {}).get("id") or "")
            if not message_id:
                self.queue_dashboard_cleanup(new_ids.values())
                self.retry_dashboard_cleanup()
                return False, False, False
            new_ids[name] = message_id
            # Until the complete set is atomically promoted below, every new
            # message is an orphan candidate and must survive a process crash.
            self.queue_dashboard_cleanup([message_id])

        now = time.time()
        pending_deletes = set(self.pending_dashboard_deletes())
        pending_deletes.update(
            message_id
            for message_id in old_ids.values()
            if message_id and message_id not in new_ids.values()
        )
        pending_deletes.difference_update(new_ids.values())
        values = {
            "discord_completed_titles_message_id": new_ids["completed"],
            "discord_completed_titles_snapshot": completed_snapshot,
            "discord_dashboard_v2_message_id": new_ids["progress"],
            "discord_dashboard_snapshot": json.dumps(
                progress_snapshot, ensure_ascii=False, sort_keys=True
            ),
            "discord_dashboard_updated_at": str(now),
            "discord_dashboard_set_checked_at": str(now),
            "discord_provider_dashboard_message_id": new_ids["provider"],
            "discord_provider_dashboard_snapshot": provider_snapshot,
            "discord_dashboard_pending_deletes": json.dumps(
                sorted(pending_deletes), ensure_ascii=False
            ),
        }
        with self.store.connection:
            self.store.connection.executemany(
                """INSERT INTO meta(key,value) VALUES(?,?)
                   ON CONFLICT(key) DO UPDATE SET value=excluded.value""",
                values.items(),
            )
        self.retry_dashboard_cleanup()
        self.store.event(
            "info", "discord_dashboards_rotated", {"message_ids": new_ids}
        )
        return True, True, True

    def active_dashboard_message_ids(self) -> set[str]:
        return {
            message_id
            for key in (
                "discord_completed_titles_message_id",
                "discord_dashboard_v2_message_id",
                "discord_provider_dashboard_message_id",
            )
            if (message_id := self.store.get_meta(key))
        }

    def pending_dashboard_deletes(self) -> list[str]:
        try:
            pending = json.loads(
                self.store.get_meta("discord_dashboard_pending_deletes", "[]") or "[]"
            )
        except json.JSONDecodeError:
            return []
        return [str(message_id) for message_id in pending if message_id]

    def queue_dashboard_cleanup(self, message_ids: Iterable[str]) -> None:
        """Durably record obsolete messages before attempting remote deletion."""
        active = self.active_dashboard_message_ids()
        pending = set(self.pending_dashboard_deletes())
        pending.update(
            str(message_id)
            for message_id in message_ids
            if message_id and str(message_id) not in active
        )
        self.store.set_meta(
            "discord_dashboard_pending_deletes",
            json.dumps(sorted(pending), ensure_ascii=False),
        )

    def retry_dashboard_cleanup(self) -> None:
        """Retry durable dashboard deletes without bypassing Discord backoff."""
        active = self.active_dashboard_message_ids()
        remaining = {
            message_id
            for message_id in self.pending_dashboard_deletes()
            if message_id not in active
        }
        self.store.set_meta(
            "discord_dashboard_pending_deletes",
            json.dumps(sorted(remaining), ensure_ascii=False),
        )
        for message_id in list(remaining):
            url = self.discord_webhook_url(message_id=message_id)
            if not url:
                continue
            try:
                response = self.discord_request(
                    "DELETE",
                    url,
                    {},
                    "discord_dashboard_cleanup_failed",
                    {"message_id": message_id},
                )
            except DiscordMessageMissing:
                response = {}
            if response is not None:
                remaining.discard(message_id)
                self.store.set_meta(
                    "discord_dashboard_pending_deletes",
                    json.dumps(sorted(remaining), ensure_ascii=False),
                )

    def migration_records(self) -> list[dict[str, Any]]:
        path = self.config.state_root / "migrations.json"
        if not path.exists():
            return []
        return json.loads(path.read_text())

    def canonical_titles(self) -> dict[int, str]:
        titles: dict[int, str] = {}
        for record in self.migration_records():
            title = record["canonical_title"]
            titles[int(record["primary_id"])] = title
            if record.get("gap_id"):
                titles[int(record["gap_id"])] = title
            for manga_id in record.get("fallback_ids", []):
                titles[int(manga_id)] = title
        titles.update(self.config.title_overrides)
        return titles

    def source_group_ranks(self) -> dict[int, int]:
        """Rank primary and fallback manga entries within each canonical source group."""
        ranks: dict[int, int] = {}
        for record in self.migration_records():
            ranks[int(record["primary_id"])] = 0
            fallbacks = list(record.get("fallback_ids", []))
            if record.get("gap_id") and int(record["gap_id"]) not in fallbacks:
                fallbacks.insert(0, int(record["gap_id"]))
            for rank, manga_id in enumerate(fallbacks, start=1):
                ranks[int(manga_id)] = rank
        return ranks

    def chapter_corrections(self) -> tuple[dict[int, str], set[int]]:
        aliases: dict[int, str] = {}
        excluded: set[int] = set()
        for record in self.migration_records():
            aliases.update({int(chapter_id): number for chapter_id, number in record.get("chapter_aliases", {}).items()})
            excluded.update(int(chapter_id) for chapter_id in record.get("excluded_chapter_ids", []))
            excluded.update(int(chapter_id) for chapter_id in record.get("excluded_old_chapter_ids", []))
        return aliases, excluded

    def sync_scope(self) -> dict[str, int]:
        data = self.api.call(SCOPE_QUERY)
        categories = {node["name"]: node for node in data["categories"]["nodes"]}
        now = time.time()
        canonical_titles = self.canonical_titles()
        source_group_ranks = self.source_group_ranks()
        chapter_aliases, excluded_chapter_ids = self.chapter_corrections()
        seen: set[int] = set()
        seen_chapters: set[int] = set()
        title_count = chapter_count = 0
        with self.store.connection:
            for rank, category_name in enumerate(self.config.categories):
                category = categories.get(category_name)
                if not category:
                    raise RuntimeError(f"missing category {category_name!r}")
                for manga in category["mangas"]["nodes"]:
                    if not manga["inLibrary"] or manga["id"] in seen:
                        continue
                    seen.add(manga["id"])
                    source = manga.get("source")
                    source_name = source["name"] if source else "Unavailable"
                    source_lang = source["lang"] if source else ""
                    blocked = "blocked source" if source_name in self.config.blocked_sources else None
                    canonical_title = canonical_titles.get(
                        manga["id"],
                        getattr(self.config, "title_aliases", {}).get(
                            normalized_title(manga["title"]),
                            manga["title"],
                        ),
                    )
                    self.store.connection.execute(
                        """INSERT INTO titles(manga_id,title,source_title,category,category_rank,source_id,source_name,source_lang,in_library,blocked_reason)
                           VALUES(?,?,?,?,?,?,?,?,?,?)
                           ON CONFLICT(manga_id) DO UPDATE SET title=excluded.title,category=excluded.category,
                           source_title=excluded.source_title,
                           category_rank=excluded.category_rank,source_id=excluded.source_id,source_name=excluded.source_name,
                           source_lang=excluded.source_lang,in_library=1,blocked_reason=excluded.blocked_reason""",
                        (manga["id"], canonical_title, manga["title"], category_name, rank, manga["sourceId"], source_name, source_lang, 1, blocked),
                    )
                    self.store.connection.execute(
                        """INSERT INTO providers(source_id,source_name) VALUES(?,?)
                           ON CONFLICT(source_id) DO UPDATE SET source_name=excluded.source_name""",
                        (manga["sourceId"], source_name),
                    )
                    groups: dict[str, list[dict[str, Any]]] = {}
                    for chapter in manga["chapters"]["nodes"]:
                        if chapter["id"] in excluded_chapter_ids:
                            continue
                        number = chapter_aliases.get(chapter["id"], chapter_number(chapter["chapterNumber"]))
                        groups.setdefault(number, []).append(chapter)
                    title_count += 1
                    chapter_count += sum(len(group) for group in groups.values())
                    for number, group in groups.items():
                        ordered = sorted(
                            group,
                            key=lambda item: (
                                not item["isDownloaded"],
                                item["sourceOrder"],
                                item["id"],
                            ),
                        )
                        for chapter in group:
                            seen_chapters.add(chapter["id"])
                            downloaded = int(chapter["isDownloaded"])
                            state = "downloaded" if downloaded else "discovered"
                            self.store.connection.execute(
                                """INSERT INTO chapters(chapter_id,manga_id,chapter_number,chapter_name,source_order,selected,downloaded,state,updated_at)
                                   VALUES(?,?,?,?,?,?,?,?,?)
                                   ON CONFLICT(chapter_id) DO UPDATE SET manga_id=excluded.manga_id,
                                   chapter_number=excluded.chapter_number,chapter_name=excluded.chapter_name,
                                   source_order=excluded.source_order,selected=excluded.selected,downloaded=excluded.downloaded,
                                   state=CASE
                                       WHEN excluded.downloaded=1 AND chapters.state!='ingested' THEN 'downloaded'
                                       WHEN chapters.state IN ('verified','ingested','failed','queued') THEN chapters.state
                                       ELSE excluded.state
                                   END,
                                   updated_at=excluded.updated_at""",
                                (
                                    chapter["id"], manga["id"], number, chapter["name"], chapter["sourceOrder"],
                                    0, downloaded, state, now,
                                ),
                            )
            if seen:
                placeholders = ",".join("?" for _ in seen)
                self.store.connection.execute(
                    f"UPDATE titles SET in_library=0 WHERE manga_id NOT IN ({placeholders})",
                    tuple(seen),
                )
                self.store.connection.execute(
                    """UPDATE chapters SET selected=0
                       WHERE manga_id IN (SELECT manga_id FROM titles WHERE in_library=0)"""
                )
                chapter_placeholders = ",".join("?" for _ in seen_chapters) or "NULL"
                self.store.connection.execute(
                    f"UPDATE chapters SET selected=0 WHERE manga_id IN ({placeholders}) "
                    f"AND chapter_id NOT IN ({chapter_placeholders})",
                    (*seen, *seen_chapters),
                )

                source_priority = {name: rank for rank, name in enumerate(self.config.source_priority)}
                canonical_groups: dict[tuple[str, str], list[sqlite3.Row]] = {}
                rows = self.store.connection.execute(
                    f"""SELECT c.*,t.title,t.source_name,p.manual_pause,p.paused_until
                        FROM chapters c JOIN titles t ON t.manga_id=c.manga_id
                        JOIN providers p ON p.source_id=t.source_id
                        WHERE t.manga_id IN ({placeholders}) AND c.chapter_id IN ({chapter_placeholders})
                        AND t.blocked_reason IS NULL""",
                    (*seen, *seen_chapters),
                )
                for row in rows:
                    canonical_groups.setdefault((row["title"], row["chapter_number"]), []).append(row)
                for group in canonical_groups.values():
                    winner = min(
                        group,
                        key=lambda row: (
                            row["manual_pause"] or row["paused_until"] > now,
                            row["state"] == "failed",
                            source_group_ranks.get(row["manga_id"], 0),
                            source_priority.get(row["source_name"], len(source_priority)),
                            not row["downloaded"],
                            row["source_order"],
                            row["chapter_id"],
                        ),
                    )
                    self.store.connection.execute(
                        "UPDATE chapters SET selected=1 WHERE chapter_id=?",
                        (winner["chapter_id"],),
                    )
        self.store.set_meta("scope_synced_at", str(now))
        duplicate_count = max(0, chapter_count - len(canonical_groups))
        result = {"titles": title_count, "raw_chapters": chapter_count, "duplicates": duplicate_count}
        self.store.event("info", "scope_synced", result)
        return result

    def refresh_due_title(self) -> int:
        """Refresh one due library entry while the historical backfill continues."""
        now = time.time()
        title = self.store.connection.execute(
            """SELECT t.manga_id,t.source_id,t.source_name FROM titles t JOIN providers p ON p.source_id=t.source_id
               WHERE t.in_library=1 AND t.blocked_reason IS NULL
               AND COALESCE(t.refreshed_at,0)<=? AND p.manual_pause=0 AND p.paused_until<=?
               AND p.last_refresh_started<=? AND NOT EXISTS(SELECT 1 FROM inflight i WHERE i.source_id=p.source_id)
               ORDER BY COALESCE(t.refreshed_at,0),t.category_rank,t.manga_id LIMIT 1""",
            (now - self.config.scope_refresh_seconds, now, now - self.config.provider_cooldown_seconds),
        ).fetchone()
        if not title:
            return 0
        with self.store.connection:
            self.store.connection.execute(
                "UPDATE providers SET last_refresh_started=? WHERE source_id=?", (now, title["source_id"])
            )
        try:
            self.api.call(
                "mutation Refresh($id:Int!){fetchMangaAndChapters(input:{id:$id,fetchManga:true,fetchChapters:true}){clientMutationId}}",
                {"id": title["manga_id"]},
            )
        except Exception as error:
            self.fail_refresh_provider(title["source_id"], str(error))
            return 0
        with self.store.connection:
            self.store.connection.execute(
                "UPDATE titles SET refreshed_at=? WHERE manga_id=?", (now, title["manga_id"])
            )
            self.store.connection.execute(
                "UPDATE providers SET failure_level=0,manual_pause=0,last_error=NULL WHERE source_id=?",
                (title["source_id"],),
            )
        self.sync_scope()
        self.store.event(
            "info", "title_refreshed", {"manga_id": title["manga_id"], "source": title["source_name"]}
        )
        return 1

    def fail_refresh_provider(self, source_id: str, error: str) -> None:
        row = self.store.connection.execute(
            "SELECT failure_level FROM providers WHERE source_id=?", (source_id,)
        ).fetchone()
        level = min((row["failure_level"] if row else 0) + 1, len(self.config.backoff_seconds))
        pause = self.config.backoff_seconds[level - 1]
        manual = int(level >= len(self.config.backoff_seconds))
        with self.store.connection:
            self.store.connection.execute(
                "UPDATE providers SET failure_level=?,paused_until=?,manual_pause=?,last_error=? WHERE source_id=?",
                (level, time.time() + pause, manual, f"library refresh failed: {error}", source_id),
            )
        self.store.event(
            "error", "provider_refresh_paused", {"source_id": source_id, "seconds": pause, "manual": bool(manual), "error": error}
        )

    def record_invalid_archive(
        self,
        path: Path,
        origin: str,
        error: Exception,
        stats: dict[str, int],
    ) -> None:
        """Quarantine invalid downloader output while leaving library files untouched."""
        stats["invalid"] += 1
        detail = {"path": str(path), "error": str(error)}
        if origin != "suwayomi":
            self.store.event("error", "invalid_cbz", detail)
            return
        try:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            quarantine = self.available_quarantine_path(
                self.config.quarantine_root / "invalid" / path.name,
                digest,
            )
            quarantine.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(path, quarantine)
            self.record_file(
                quarantine,
                "unknown",
                "unknown",
                0,
                digest,
                origin,
                "quarantined",
            )
        except OSError as quarantine_error:
            detail["quarantine_error"] = str(quarantine_error)
            self.store.event("error", "invalid_cbz_quarantine_failed", detail)
            return
        stats["quarantined"] += 1
        detail["quarantine"] = str(quarantine)
        self.store.event("warning", "invalid_cbz_quarantined", detail)

    def title_alias_map(self) -> dict[str, str | None]:
        candidates: dict[str, set[str]] = {}
        for row in self.store.connection.execute(
            "SELECT title,source_title FROM titles WHERE in_library=1 AND blocked_reason IS NULL"
        ):
            for value in (row["title"], row["source_title"]):
                key = normalized_title(value or "")
                if not key:
                    continue
                candidates.setdefault(key, set()).add(row["title"])
        return {
            key: next(iter(titles)) if len(titles) == 1 else None
            for key, titles in candidates.items()
        }

    def verified_chapter_file(self, chapter_id: int) -> sqlite3.Row | None:
        chapter = self.store.connection.execute(
            """SELECT c.chapter_number,t.title FROM chapters c
               JOIN titles t ON t.manga_id=c.manga_id WHERE c.chapter_id=?""",
            (chapter_id,),
        ).fetchone()
        if not chapter:
            return None
        for row in self.store.connection.execute(
            """SELECT * FROM files WHERE canonical_title=? AND chapter_number=?
               AND status='active' ORDER BY updated_at DESC""",
            (chapter["title"], chapter["chapter_number"]),
        ):
            path = Path(row["path"])
            if path.exists() and row["sha256"]:
                return row
        return None

    def repair_ingested_invariants(self, *, apply: bool = False) -> list[dict[str, Any]]:
        invalid: list[dict[str, Any]] = []
        rows = self.store.connection.execute(
            """SELECT c.chapter_id,c.state,c.file_path,c.sha256,c.chapter_number,t.title
               FROM chapters c JOIN titles t ON t.manga_id=c.manga_id
               WHERE c.selected=1 AND t.in_library=1 AND c.state='ingested'"""
        )
        for row in rows:
            verified = self.verified_chapter_file(row["chapter_id"])
            if verified and row["file_path"] == verified["path"] and row["sha256"] == verified["sha256"]:
                continue
            invalid.append({
                "chapter_id": row["chapter_id"],
                "title": row["title"],
                "chapter_number": row["chapter_number"],
                "file_path": row["file_path"],
                "reason": "missing_or_mismatched_active_file",
            })
            if apply:
                if verified:
                    self.store.connection.execute(
                        """UPDATE chapters SET file_path=?,sha256=?,last_error=NULL,error_kind=NULL,
                           error_detail=NULL,updated_at=? WHERE chapter_id=?""",
                        (verified["path"], verified["sha256"], time.time(), row["chapter_id"]),
                    )
                else:
                    self.store.connection.execute(
                        """UPDATE chapters SET state='downloaded',file_path=NULL,sha256=NULL,
                           last_error='ingested state had no verified active file',
                           error_kind='missing_file',error_detail=NULL,updated_at=? WHERE chapter_id=?""",
                        (time.time(), row["chapter_id"]),
                    )
        if apply:
            self.store.connection.commit()
        return invalid

    def normalize_title_aliases(self, *, apply: bool = False) -> list[dict[str, Any]]:
        pairs = list(self.store.connection.execute(
            """SELECT t.title AS alias_title,f.canonical_title,COUNT(*) AS matched_chapters
               FROM chapters c JOIN titles t ON t.manga_id=c.manga_id
               JOIN files f ON f.path=c.file_path AND f.status='active'
               WHERE c.selected=1 AND c.state='ingested' AND t.title!=f.canonical_title
               AND c.chapter_number=f.chapter_number
               GROUP BY t.title,f.canonical_title ORDER BY matched_chapters DESC"""
        ))
        targets: dict[str, set[str]] = {}
        for row in pairs:
            targets.setdefault(row["alias_title"], set()).add(row["canonical_title"])
        safe = [
            dict(row)
            for row in pairs
            if len(targets[row["alias_title"]]) == 1
        ]
        if apply:
            with self.store.connection:
                for row in safe:
                    self.store.connection.execute(
                        "UPDATE titles SET title=? WHERE title=?",
                        (row["canonical_title"], row["alias_title"]),
                    )
            self.store.event("info", "title_aliases_normalized", {"aliases": safe})
        return safe

    def reconciliation_manifest(self) -> dict[str, Any]:
        aliases = self.title_alias_map()
        entries: list[dict[str, Any]] = []
        counts: dict[str, int] = {}
        for path in sorted(self.config.downloads_root.rglob("*.cbz")):
            entry: dict[str, Any] = {"path": str(path), "size": path.stat().st_size}
            try:
                series, number, pages, digest = inspect_cbz(path)
            except (OSError, ValueError, zipfile.BadZipFile) as error:
                entry.update(classification="invalid_archive", error=str(error))
            else:
                canonical = aliases.get(normalized_title(series))
                entry.update(series=series, chapter_number=number, page_count=pages, sha256=digest)
                if not canonical:
                    entry["classification"] = "unknown_or_out_of_scope"
                else:
                    entry["canonical_title"] = canonical
                    chapter = self.store.connection.execute(
                        """SELECT c.chapter_id FROM chapters c JOIN titles t ON t.manga_id=c.manga_id
                           WHERE c.selected=1 AND t.in_library=1 AND t.title=? AND c.chapter_number=?
                           ORDER BY c.chapter_id LIMIT 1""",
                        (canonical, number),
                    ).fetchone()
                    active = list(self.store.connection.execute(
                        """SELECT path,sha256 FROM files WHERE canonical_title=?
                           AND chapter_number=? AND status='active'""",
                        (canonical, number),
                    ))
                    exact = next(
                        (row for row in active if row["sha256"] == digest and Path(row["path"]).exists()),
                        None,
                    )
                    if exact:
                        entry.update(classification="exact_existing_duplicate", existing_path=exact["path"])
                    elif active:
                        entry.update(
                            classification="semantic_conflict",
                            existing_paths=[row["path"] for row in active],
                        )
                    elif chapter:
                        entry.update(classification="valid_missing_chapter", chapter_id=chapter["chapter_id"])
                    else:
                        entry["classification"] = "unknown_or_out_of_scope"
            classification = entry["classification"]
            counts[classification] = counts.get(classification, 0) + 1
            entries.append(entry)
        return {"generated_at": time.time(), "total": len(entries), "counts": counts, "entries": entries}

    def apply_manifest(self, manifest: dict[str, Any], *, limit: int) -> dict[str, Any]:
        results: list[dict[str, Any]] = []
        for entry in manifest["entries"]:
            if len(results) >= limit:
                break
            if entry["classification"] != "valid_missing_chapter":
                continue
            path = Path(entry["path"])
            if not path.exists():
                continue
            series, number, pages, digest = inspect_cbz(path)
            if (number, digest) != (entry["chapter_number"], entry["sha256"]):
                results.append({"path": str(path), "outcome": "stale_manifest"})
                continue
            active = self.store.connection.execute(
                """SELECT 1 FROM files WHERE canonical_title=? AND chapter_number=?
                   AND status='active' LIMIT 1""",
                (entry["canonical_title"], number),
            ).fetchone()
            if active:
                results.append({"path": str(path), "outcome": "classification_changed"})
                continue
            outcome = self.ingest(path, entry["canonical_title"], number, pages, digest)
            verified = self.verified_chapter_file(entry["chapter_id"])
            if not verified:
                raise RuntimeError(f"reconciliation did not produce a verified file for {path}")
            results.append({"path": str(path), "outcome": outcome, "destination": verified["path"]})
        return {"planned": manifest["counts"], "applied": len(results), "results": results}

    def apply_reconciliation(self, *, limit: int) -> dict[str, Any]:
        return self.apply_manifest(self.reconciliation_manifest(), limit=limit)

    def quarantine_manifest(self, manifest: dict[str, Any], *, limit: int) -> dict[str, Any]:
        allowed = {
            "exact_existing_duplicate",
            "semantic_conflict",
            "invalid_archive",
            "unknown_or_out_of_scope",
        }
        results: list[dict[str, Any]] = []
        for entry in manifest["entries"]:
            if len(results) >= limit:
                break
            classification = entry["classification"]
            if classification not in allowed:
                continue
            source = Path(entry["path"])
            if not source.exists():
                continue
            digest = entry.get("sha256") or hashlib.sha256(source.read_bytes()).hexdigest()
            if entry.get("sha256"):
                _, number, pages, current_digest = inspect_cbz(source)
                if current_digest != digest:
                    results.append({"path": str(source), "outcome": "stale_manifest"})
                    continue
            else:
                number = entry.get("chapter_number") or "unknown"
                pages = int(entry.get("page_count") or 0)
            title = entry.get("canonical_title") or entry.get("series") or "unknown"
            destination = self.available_quarantine_path(
                self.config.quarantine_root
                / "reconciliation"
                / classification
                / title
                / str(number)
                / source.name,
                digest,
            )
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(source, destination)
            if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
                raise RuntimeError(f"quarantine digest mismatch for {source}")
            self.record_file(
                destination,
                title,
                str(number),
                pages,
                digest,
                "suwayomi",
                "quarantined",
            )
            results.append(
                {
                    "path": str(source),
                    "outcome": "quarantined",
                    "classification": classification,
                    "destination": str(destination),
                }
            )
        return {"planned": manifest["counts"], "quarantined": len(results), "results": results}

    def inventory(self, ingest_downloads: bool = True) -> dict[str, int]:
        stats = {"valid": 0, "invalid": 0, "invalid_deleted": 0, "ingested": 0, "unchanged": 0, "duplicates_removed": 0, "quarantined": 0}
        title_map = self.title_alias_map()
        roots = [(self.config.library_root, "library")]
        if ingest_downloads:
            roots.append((self.config.downloads_root, "suwayomi"))
        for root, origin in roots:
            if not root.exists():
                continue
            for path in sorted(root.rglob("*.cbz")):
                try:
                    series, number, pages, digest = inspect_cbz(path)
                except (OSError, ValueError, zipfile.BadZipFile) as error:
                    self.record_invalid_archive(path, origin, error, stats)
                    continue
                self.cache_archive(path, series, number, pages, digest)
                canonical = title_map.get(normalized_title(series))
                if not canonical:
                    continue
                stats["valid"] += 1
                if origin == "suwayomi":
                    outcome = self.ingest(path, canonical, number, pages, digest)
                    stats[outcome] += 1
                else:
                    self.record_file(path, canonical, number, pages, digest, origin, "active", commit=False)
        self.store.event("info", "inventory_complete", stats)
        return stats

    def inventory_title(self, manga_id: int) -> dict[str, int]:
        title = self.store.connection.execute(
            "SELECT title,source_title,source_name FROM titles WHERE manga_id=?",
            (manga_id,),
        ).fetchone()
        if not title:
            raise RuntimeError(f"unknown manga id {manga_id}")
        stats = {"valid": 0, "cached": 0, "invalid": 0, "invalid_deleted": 0, "ingested": 0, "unchanged": 0, "duplicates_removed": 0, "quarantined": 0}
        roots: list[tuple[Path, str]] = [(self.config.library_root / title["title"], "library")]
        expected = normalized_title(title["source_title"])
        for source_root in self.config.downloads_root.glob(f"{title['source_name']} (*)"):
            for path in source_root.iterdir():
                candidate = normalized_title(path.name)
                same_or_truncated = candidate == expected or (
                    min(len(candidate), len(expected)) >= 12
                    and (candidate.startswith(expected) or expected.startswith(candidate))
                )
                if path.is_dir() and same_or_truncated:
                    roots.append((path, "suwayomi"))
        for root, origin in roots:
            if not root.exists():
                continue
            for path in sorted(root.glob("*.cbz")):
                try:
                    _, number, pages, digest, cached = self.inspect_archive(path)
                except (OSError, ValueError, zipfile.BadZipFile) as error:
                    self.record_invalid_archive(path, origin, error, stats)
                    continue
                stats["valid"] += 1
                stats["cached"] += int(cached)
                if origin == "suwayomi":
                    stats[self.ingest(path, title["title"], number, pages, digest)] += 1
                else:
                    self.record_file(path, title["title"], number, pages, digest, origin, "active", commit=False)
        self.store.event("info", "title_inventory_complete", {"manga_id": manga_id, **stats})
        return stats

    def inspect_archive(self, path: Path) -> tuple[str, str, int, str, bool]:
        """Validate changed archives and reuse exact stat-matched prior results."""
        stat = path.stat()
        cached = self.store.connection.execute(
            "SELECT * FROM archive_cache WHERE path=? AND size=? AND mtime_ns=?",
            (str(path), stat.st_size, stat.st_mtime_ns),
        ).fetchone()
        if cached:
            return (
                cached["series"],
                cached["chapter_number"],
                cached["page_count"],
                cached["sha256"],
                True,
            )
        series, number, pages, digest = inspect_cbz(path)
        self.cache_archive(path, series, number, pages, digest, stat)
        return series, number, pages, digest, False

    def cache_archive(
        self,
        path: Path,
        series: str,
        number: str,
        pages: int,
        digest: str,
        stat: os.stat_result | None = None,
    ) -> None:
        stat = stat or path.stat()
        self.store.connection.execute(
            """INSERT INTO archive_cache(path,size,mtime_ns,series,chapter_number,sha256,page_count,validated_at)
               VALUES(?,?,?,?,?,?,?,?)
               ON CONFLICT(path) DO UPDATE SET size=excluded.size,mtime_ns=excluded.mtime_ns,
               series=excluded.series,chapter_number=excluded.chapter_number,sha256=excluded.sha256,
               page_count=excluded.page_count,validated_at=excluded.validated_at""",
            (str(path), stat.st_size, stat.st_mtime_ns, series, number, digest, pages, time.time()),
        )
        self.store.connection.commit()

    def record_file(
        self,
        path: Path,
        title: str,
        number: str,
        pages: int,
        digest: str,
        origin: str,
        status: str,
        *,
        commit: bool = True,
    ) -> None:
        self.store.connection.execute(
            """INSERT INTO files(path,canonical_title,chapter_number,sha256,size,page_count,origin,status,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?)
               ON CONFLICT(path) DO UPDATE SET canonical_title=excluded.canonical_title,
               chapter_number=excluded.chapter_number,sha256=excluded.sha256,size=excluded.size,
               page_count=excluded.page_count,origin=excluded.origin,status=excluded.status,updated_at=excluded.updated_at""",
            (str(path), title, number, digest, path.stat().st_size, pages, origin, status, time.time()),
        )
        if status == "active":
            self.store.connection.execute(
                """UPDATE chapters SET state='ingested',file_path=?,sha256=?,last_error=NULL,
                   error_kind=NULL,error_detail=NULL,failure_count=0,retry_after=0,updated_at=?
                   WHERE chapter_number=? AND manga_id IN (SELECT manga_id FROM titles WHERE title=?)""",
                (str(path), digest, time.time(), number, title),
            )
        if commit:
            self.store.connection.commit()

    def available_quarantine_path(self, path: Path, digest: str) -> Path:
        """Return a filesystem and database-safe path for a quarantined archive."""
        candidate = path
        index = 0
        while candidate.exists() or self.store.connection.execute(
            "SELECT 1 FROM files WHERE path=?", (str(candidate),)
        ).fetchone():
            suffix = f"_{digest[:8]}" if index == 0 else f"_{digest[:8]}_{index}"
            candidate = path.with_name(f"{path.stem}{suffix}{path.suffix}")
            index += 1
        return candidate

    def ingest(self, source: Path, title: str, number: str, pages: int, digest: str) -> str:
        if canonicalize_cbz_series(source, title):
            canonical_series, number, pages, digest = inspect_cbz(source)
            if canonical_series != title:
                raise RuntimeError(f"canonical series mismatch in {source}")
        destination_dir = self.config.library_root / title
        destination_dir.mkdir(parents=True, exist_ok=True)
        existing = list(
            self.store.connection.execute(
                "SELECT * FROM files WHERE canonical_title=? AND chapter_number=? AND status='active'",
                (title, number),
            )
        )
        for row in existing:
            existing_path = Path(row["path"])
            if row["sha256"] == digest and existing_path.exists():
                if existing_path != source and source.is_relative_to(self.config.downloads_root):
                    # The source archive was validated before ingest. Confirm the
                    # retained library archive still matches before removing it.
                    if self.inspect_archive(existing_path)[3] != digest:
                        continue
                    source.unlink()
                    self.store.connection.execute("DELETE FROM files WHERE path=?", (str(source),))
                    self.store.connection.execute("DELETE FROM archive_cache WHERE path=?", (str(source),))
                    self.store.connection.commit()
                    return "duplicates_removed"
                return "unchanged"
        destination = destination_dir / source.name
        if destination.exists():
            destination = destination_dir / f"{source.stem}_{digest[:8]}{source.suffix}"
        temporary = destination.with_name(
            f".{destination.name}.{os.getpid()}.{time.time_ns()}.partial"
        )
        try:
            os.replace(source, temporary)
        except OSError as error:
            if error.errno != errno.EXDEV:
                raise
            # Cross-filesystem moves cannot be atomic. Keep the source until a
            # complete copied archive has been validated byte-for-byte.
            shutil.copy2(source, temporary)
            _, copied_number, copied_pages, copied_digest = inspect_cbz(temporary)
            if (copied_number, copied_pages, copied_digest) != (number, pages, digest):
                temporary.unlink(missing_ok=True)
                raise RuntimeError(f"copied archive validation failed for {source}")
            source.unlink()
        os.replace(temporary, destination)
        self.store.connection.execute("DELETE FROM archive_cache WHERE path=?", (str(source),))
        self.store.connection.execute("DELETE FROM files WHERE path=?", (str(source),))
        self.store.connection.commit()
        self.cache_archive(destination, title, number, pages, digest)
        self.record_file(destination, title, number, pages, digest, "suwayomi", "active")
        if existing:
            winner = max([*existing, dict(path=str(destination), page_count=pages)], key=lambda row: (row["page_count"], row["path"]))
            for row in existing:
                old = Path(row["path"])
                if str(old) == winner["path"] or not old.exists():
                    continue
                quarantine = self.available_quarantine_path(
                    self.config.quarantine_root / title / number / old.name,
                    row["sha256"],
                )
                quarantine.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(old, quarantine)
                self.store.connection.execute(
                    "UPDATE files SET path=?,status='quarantined',updated_at=? WHERE path=?",
                    (str(quarantine), time.time(), str(old)),
                )
                self.store.connection.commit()
                self.store.event("warning", "semantic_conflict_quarantined", {"kept": winner["path"], "moved": str(quarantine)})
            if winner["path"] != str(destination):
                quarantine = self.available_quarantine_path(
                    self.config.quarantine_root / title / number / destination.name,
                    digest,
                )
                quarantine.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(destination, quarantine)
                self.store.connection.execute(
                    "UPDATE files SET path=?,status='quarantined',updated_at=? WHERE path=?",
                    (str(quarantine), time.time(), str(destination)),
                )
                self.store.connection.execute(
                    """UPDATE chapters SET state='ingested',file_path=?,sha256=?,last_error=NULL,
                       error_kind=NULL,error_detail=NULL,failure_count=0,retry_after=0,updated_at=?
                       WHERE chapter_number=? AND manga_id IN (
                           SELECT manga_id FROM titles WHERE title=?
                       )""",
                    (
                        winner["path"],
                        next(row["sha256"] for row in existing if row["path"] == winner["path"]),
                        time.time(),
                        number,
                        title,
                    ),
                )
                self.store.connection.commit()
                return "quarantined"
        return "ingested"

    def reconcile_downloads(self) -> None:
        data = self.api.call(DOWNLOAD_QUERY)["downloadStatus"]
        queue = {item["chapter"]["id"]: item for item in data["queue"]}
        inflight = list(self.store.connection.execute("SELECT * FROM inflight"))
        now = time.time()

        # Retry cleanup only for queue entries this controller durably marked
        # after its own dequeue failed. Untracked errors may belong to a user,
        # auto-download, or another client and must remain untouched.
        pending = list(self.store.connection.execute("SELECT * FROM pending_dequeues"))
        for row in pending:
            chapter_id = row["chapter_id"]
            item = queue.get(chapter_id)
            if item is None:
                with self.store.connection:
                    self.store.connection.execute(
                        "DELETE FROM pending_dequeues WHERE chapter_id=?", (chapter_id,)
                    )
                continue
            try:
                self.api.call(
                    "mutation Dequeue($ids:[Int!]!){ dequeueChapterDownloads(input:{ids:$ids}){ clientMutationId } }",
                    {"ids": [chapter_id]},
                )
            except Exception as error:
                self.store.event(
                    "warning",
                    "orphaned_download_dequeue_failed",
                    {"chapter_id": chapter_id, "error": str(error)},
                )
            else:
                queue.pop(chapter_id, None)
                with self.store.connection:
                    self.store.connection.execute(
                        "DELETE FROM pending_dequeues WHERE chapter_id=?", (chapter_id,)
                    )
                self.store.event(
                    "info", "orphaned_download_dequeued", {"chapter_id": chapter_id}
                )

        # A failed queue stops Suwayomi. Consume those errors before deciding
        # whether a stopped downloader contains useful work to restart.
        failed_ids = {
            row["chapter_id"]
            for row in inflight
            if (item := queue.get(row["chapter_id"])) and item["state"] == "ERROR"
        }
        for row in inflight:
            if row["chapter_id"] not in failed_ids:
                continue
            item = queue[row["chapter_id"]]
            dequeued = self.fail_provider(
                row["source_id"],
                row["chapter_id"],
                f"Suwayomi error after {item['tries']} tries",
            )
            if dequeued:
                queue.pop(row["chapter_id"], None)
        if failed_ids:
            inflight = list(self.store.connection.execute("SELECT * FROM inflight"))

        tracked_queue = [row for row in inflight if row["chapter_id"] in queue]
        remote_errors = any(item["state"] == "ERROR" for item in queue.values())
        if tracked_queue and str(data["state"]).upper() == "STOPPED" and not remote_errors:
            try:
                self.api.call(
                    "mutation StartDownloader { startDownloader(input:{}){ clientMutationId } }"
                )
            except Exception as error:
                self.store.event(
                    "warning",
                    "downloader_restart_failed",
                    {"tracked": len(tracked_queue), "error": str(error)},
                )
            else:
                with self.store.connection:
                    self.store.connection.execute(
                        "UPDATE inflight SET progress_at=?", (now,)
                    )
                self.store.event(
                    "warning",
                    "downloader_restarted",
                    {"tracked": len(tracked_queue)},
                )
                inflight = list(self.store.connection.execute("SELECT * FROM inflight"))

        for row in inflight:
            item = queue.get(row["chapter_id"])
            if item:
                progress = float(item.get("progress") or 0)
                if progress > float(row["progress"]):
                    with self.store.connection:
                        self.store.connection.execute(
                            "UPDATE inflight SET progress=?,progress_at=? WHERE chapter_id=?",
                            (progress, now, row["chapter_id"]),
                        )
                    continue
                progress_at = float(row["progress_at"] or row["started_at"])
                if now - progress_at >= self.config.download_stall_seconds:
                    self.fail_provider(
                        row["source_id"],
                        row["chapter_id"],
                        f"download made no progress for {self.config.download_stall_seconds} seconds",
                    )
                continue
            chapter = self.api.call(
                "query Chapter($id:Int!){ chapter(id:$id){ id isDownloaded manga { id title } } }",
                {"id": row["chapter_id"]},
            )["chapter"]
            if chapter["isDownloaded"]:
                self.inventory_title(chapter["manga"]["id"])
                verified = self.verified_chapter_file(row["chapter_id"])
                if verified:
                    self.store.connection.execute(
                        """UPDATE chapters SET state='ingested',downloaded=1,file_path=?,sha256=?,
                           last_error=NULL,error_kind=NULL,error_detail=NULL,failure_count=0,
                           retry_after=0,updated_at=? WHERE chapter_id=?""",
                        (verified["path"], verified["sha256"], time.time(), row["chapter_id"]),
                    )
                else:
                    self.store.connection.execute(
                        """UPDATE chapters SET state='downloaded',downloaded=1,file_path=NULL,sha256=NULL,
                           last_error='Suwayomi reports downloaded but no verified file was found',
                           error_kind='missing_file',error_detail=NULL,updated_at=? WHERE chapter_id=?""",
                        (time.time(), row["chapter_id"]),
                    )
                self.store.connection.execute("DELETE FROM inflight WHERE chapter_id=?", (row["chapter_id"],))
                if verified:
                    self.store.connection.execute(
                        "UPDATE providers SET failure_level=0,last_error=NULL WHERE source_id=?",
                        (row["source_id"],),
                    )
                    self.store.connection.execute(
                        "DELETE FROM provider_failures WHERE source_id=?", (row["source_id"],)
                    )
                self.store.connection.commit()
                self.store.event(
                    "info" if verified else "warning",
                    "chapter_ingested" if verified else "chapter_download_missing_file",
                    {"chapter_id": row["chapter_id"]},
                )
            else:
                self.fail_provider(row["source_id"], row["chapter_id"], "download left queue without a file")

    @staticmethod
    def classify_failure(error: str) -> tuple[str, bool, bool]:
        text = error.casefold()
        if " 404" in text or "http 404" in text or "not found" in text:
            return "not_found", True, False
        if "empty chapter" in text or "no pages" in text:
            return "empty_chapter", True, False
        if " 429" in text or "rate limit" in text or "too many requests" in text:
            return "rate_limited", False, False
        if "cloudflare" in text or "bypass" in text:
            return "waf_blocked", False, True
        if "start" in text and "timeout" in text:
            return "downloader_timeout", False, False
        if "no progress" in text or "stall" in text:
            return "download_stalled", False, False
        if "without a file" in text or "missing file" in text:
            return "missing_file", False, False
        return "provider_error", False, False

    def fail_provider(self, source_id: str, chapter_id: int, error: str) -> bool:
        now = time.time()
        error_kind, terminal_chapter, manual_provider = self.classify_failure(error)
        provider = self.store.connection.execute(
            "SELECT source_name,failure_level FROM providers WHERE source_id=?", (source_id,)
        ).fetchone()
        chapter = self.store.connection.execute(
            "SELECT failure_count FROM chapters WHERE chapter_id=?", (chapter_id,)
        ).fetchone()
        chapter_backoffs = tuple(
            getattr(self.config, "chapter_backoff_seconds", (3600, 21600, 86400))
        )
        failure_count = int(chapter["failure_count"] if chapter else 0) + 1
        chapter_pause = (
            365 * 86400
            if terminal_chapter
            else chapter_backoffs[min(failure_count - 1, len(chapter_backoffs) - 1)]
        )
        dequeued = True
        try:
            self.api.call(
                "mutation Dequeue($ids:[Int!]!){ dequeueChapterDownloads(input:{ids:$ids}){ clientMutationId } }",
                {"ids": [chapter_id]},
            )
        except Exception as dequeue_error:
            dequeued = False
            # Local recovery must not depend on Suwayomi being reachable. A
            # later reconciliation can clean up an orphaned remote queue item.
            self.store.event(
                "warning",
                "chapter_dequeue_failed",
                {
                    "source_id": source_id,
                    "chapter_id": chapter_id,
                    "error": str(dequeue_error),
                },
            )
        with self.store.connection:
            if dequeued:
                self.store.connection.execute(
                    "DELETE FROM pending_dequeues WHERE chapter_id=?", (chapter_id,)
                )
            else:
                self.store.connection.execute(
                    """INSERT INTO pending_dequeues(chapter_id,source_id,created_at) VALUES(?,?,?)
                       ON CONFLICT(chapter_id) DO UPDATE SET
                           source_id=excluded.source_id,created_at=excluded.created_at""",
                    (chapter_id, source_id, now),
                )
            self.store.connection.execute("DELETE FROM inflight WHERE chapter_id=?", (chapter_id,))
            self.store.connection.execute(
                """UPDATE chapters SET state='failed',last_error=?,error_kind=?,error_detail=?,
                   failure_count=?,retry_after=?,updated_at=? WHERE chapter_id=?""",
                (error, error_kind, error[:1000], failure_count, now + chapter_pause, now, chapter_id),
            )
            self.store.connection.execute(
                """INSERT INTO provider_failures(source_id,chapter_id,failed_at) VALUES(?,?,?)
                   ON CONFLICT(source_id,chapter_id) DO UPDATE SET failed_at=excluded.failed_at""",
                (source_id, chapter_id, now),
            )
        fallback_selected = self.select_chapter_fallback(chapter_id, source_id)

        window = int(getattr(self.config, "provider_failure_window_seconds", 3600))
        threshold = int(getattr(self.config, "provider_failure_threshold", 2))
        distinct_failures = self.store.connection.execute(
            "SELECT COUNT(*) FROM provider_failures WHERE source_id=? AND failed_at>=?",
            (source_id, now - window),
        ).fetchone()[0]
        overrides = getattr(self.config, "provider_backoff_overrides", None) or {}
        override = overrides.get(provider["source_name"] if provider else "")
        if manual_provider or override or distinct_failures >= threshold:
            level = min(
                int(provider["failure_level"] if provider else 0) + 1,
                len(self.config.backoff_seconds),
            )
            pause = int(override or self.config.backoff_seconds[level - 1])
            # Known rate-limited/broken sources are probed periodically instead
            # of becoming permanently manual after repeated daily failures.
            manual = int(manual_provider or (not override and level >= len(self.config.backoff_seconds)))
            with self.store.connection:
                self.store.connection.execute(
                    """UPDATE providers SET failure_level=?,paused_until=?,manual_pause=?,last_error=?
                       WHERE source_id=?""",
                    (level, now + pause, manual, error, source_id),
                )
            self.store.event(
                "error",
                "provider_paused",
                {
                    "source_id": source_id,
                    "chapter_id": chapter_id,
                    "seconds": pause,
                    "manual": bool(manual),
                    "distinct_failures": distinct_failures,
                    "error": error,
                },
            )
            return dequeued
        self.store.event(
            "error",
            "chapter_retry_deferred",
            {
                "source_id": source_id,
                "chapter_id": chapter_id,
                "seconds": chapter_pause,
                "failure_count": failure_count,
                "fallback_selected": fallback_selected,
                "error": error,
            },
        )
        return dequeued

    def select_chapter_fallback(self, chapter_id: int, failed_source_id: str) -> bool:
        """Immediately select the best healthy alternate for a failed canonical chapter."""
        failed = self.store.connection.execute(
            """SELECT c.chapter_number,t.title FROM chapters c JOIN titles t ON t.manga_id=c.manga_id
               WHERE c.chapter_id=?""",
            (chapter_id,),
        ).fetchone()
        if not failed:
            return False
        now = time.time()
        ranks = self.source_group_ranks()
        source_priority = {name: rank for rank, name in enumerate(self.config.source_priority)}
        candidates = list(self.store.connection.execute(
            """SELECT c.*,t.source_id,t.source_name,p.manual_pause,p.paused_until
               FROM chapters c JOIN titles t ON t.manga_id=c.manga_id
               JOIN providers p ON p.source_id=t.source_id
               WHERE t.in_library=1 AND t.blocked_reason IS NULL AND t.title=? AND c.chapter_number=?
               AND c.chapter_id!=? AND t.source_id!=?""",
            (failed["title"], failed["chapter_number"], chapter_id, failed_source_id),
        ))
        healthy = [row for row in candidates if not row["manual_pause"] and row["paused_until"] <= now]
        if not healthy:
            return False
        winner = min(
            healthy,
            key=lambda row: (
                ranks.get(row["manga_id"], 0),
                source_priority.get(row["source_name"], len(source_priority)),
                row["state"] not in ("ingested", "downloaded", "discovered"),
                not row["downloaded"],
                row["source_order"],
                row["chapter_id"],
            ),
        )
        with self.store.connection:
            self.store.connection.execute("UPDATE chapters SET selected=0 WHERE chapter_id=?", (chapter_id,))
            self.store.connection.execute("UPDATE chapters SET selected=1 WHERE chapter_id=?", (winner["chapter_id"],))
        self.store.event(
            "warning",
            "chapter_fallback_selected",
            {
                "title": failed["title"],
                "chapter_number": failed["chapter_number"],
                "failed_source_id": failed_source_id,
                "fallback_source": winner["source_name"],
                "fallback_chapter_id": winner["chapter_id"],
            },
        )
        return True

    def schedule(self, once: bool = False, source_name: str | None = None) -> int:
        self.dashboard_title_started = False
        now = time.time()
        active = self.store.connection.execute("SELECT COUNT(*) AS count FROM inflight").fetchone()["count"]
        available = max(0, self.config.provider_cap - active)
        scheduled = 0
        if available == 0:
            return 0
        providers = list(
            self.store.connection.execute(
                """SELECT p.* FROM providers p
                   WHERE p.manual_pause=0 AND p.paused_until<=?
                   AND p.last_started<=?
                   AND NOT EXISTS (SELECT 1 FROM inflight i WHERE i.source_id=p.source_id)
                   ORDER BY p.last_started ASC""",
                (now, now - self.config.provider_cooldown_seconds),
            )
        )
        candidates = [provider for provider in providers if not source_name or provider["source_name"] == source_name]
        for provider in candidates:
            if provider["source_name"] in self.config.blocked_sources:
                continue
            priority_case = (
                "CASE "
                + " ".join(
                    f"WHEN lower(t.title)=lower(?) THEN {rank}"
                    for rank, _ in enumerate(self.config.title_priority)
                )
                + f" ELSE {len(self.config.title_priority)} END"
                if self.config.title_priority
                else "CASE WHEN 1 THEN 0 END"
            )
            chapter = self.store.connection.execute(
                f"""SELECT c.chapter_id,c.state,t.title FROM chapters c
                   JOIN titles t ON t.manga_id=c.manga_id
                   WHERE t.source_id=? AND t.in_library=1 AND t.blocked_reason IS NULL
                   AND c.selected=1 AND c.state IN ('discovered','failed') AND c.retry_after<=?
                   AND NOT EXISTS (
                       SELECT 1 FROM pending_dequeues d WHERE d.chapter_id=c.chapter_id
                   )
                   ORDER BY CASE c.state WHEN 'failed' THEN 0 ELSE 1 END,
                            t.category_rank,{priority_case},t.manga_id,
                            c.source_order ASC,c.chapter_id
                   LIMIT 1""",
                (provider["source_id"], now, *self.config.title_priority),
            ).fetchone()
            if not chapter:
                continue
            if chapter["state"] == "failed":
                if self.select_chapter_fallback(chapter["chapter_id"], provider["source_id"]):
                    continue
            self.api.call(
                "mutation Enqueue($id:Int!){ enqueueChapterDownload(input:{id:$id}){ clientMutationId } }",
                {"id": chapter["chapter_id"]},
            )
            with self.store.connection:
                self.store.connection.execute(
                    """INSERT OR REPLACE INTO inflight(
                           source_id,chapter_id,started_at,progress,progress_at
                       ) VALUES(?,?,?,0,?)""",
                    (provider["source_id"], chapter["chapter_id"], now, now),
                )
                self.store.connection.execute(
                    "UPDATE chapters SET state='queued',updated_at=? WHERE chapter_id=?",
                    (now, chapter["chapter_id"]),
                )
                self.store.connection.execute(
                    "UPDATE providers SET last_started=? WHERE source_id=?",
                    (now, provider["source_id"]),
                )
            scheduled += 1
            started_key = f"discord_dashboard_title_started_{normalized_title(chapter['title'])}"
            if self.store.get_meta(started_key) != "1":
                self.store.set_meta(started_key, "1")
                self.dashboard_title_started = True
            self.store.event("info", "chapter_queued", {"source": provider["source_name"], "chapter_id": chapter["chapter_id"]})
            if once or scheduled >= available:
                break
        return scheduled

    def plan(self) -> dict[str, Any]:
        rows = list(
            self.store.connection.execute(
                """SELECT t.category,t.source_name,COUNT(DISTINCT t.manga_id) AS titles,
                   COUNT(c.chapter_id) AS chapters,
                   SUM(CASE WHEN c.selected=1 THEN 1 ELSE 0 END) AS canonical,
                   SUM(CASE WHEN c.state='ingested' THEN 1 ELSE 0 END) AS ingested
                   FROM titles t LEFT JOIN chapters c ON c.manga_id=t.manga_id
                   WHERE t.in_library=1 GROUP BY t.category,t.source_name
                   ORDER BY t.category_rank,t.source_name"""
            )
        )
        blocked = list(
            self.store.connection.execute(
                "SELECT manga_id,title,category,source_name,blocked_reason FROM titles WHERE in_library=1 AND blocked_reason IS NOT NULL"
            )
        )
        return {"groups": [dict(row) for row in rows], "blocked": [dict(row) for row in blocked]}

    def status(self) -> dict[str, Any]:
        states = {
            row["state"]: row["count"]
            for row in self.store.connection.execute(
                """SELECT c.state,COUNT(*) AS count FROM chapters c
                   JOIN titles t ON t.manga_id=c.manga_id
                   WHERE c.selected=1 AND t.in_library=1 AND t.blocked_reason IS NULL
                   GROUP BY c.state"""
            )
        }
        providers = [dict(row) for row in self.store.connection.execute("SELECT * FROM providers ORDER BY source_name")]
        return {
            "paused": self.store.get_meta("paused", "0") == "1",
            "states": states,
            "providers": providers,
            "invalid_ingested": len(self.repair_ingested_invariants()),
            "loop_heartbeat": float(self.store.get_meta("loop_heartbeat", "0") or "0"),
            "last_reconciliation": float(self.store.get_meta("last_reconciliation", "0") or "0"),
        }

    def health(self) -> dict[str, Any]:
        database = "ok"
        try:
            self.store.connection.execute("SELECT 1").fetchone()
        except sqlite3.Error as error:
            database = str(error)
        heartbeat = float(self.store.get_meta("loop_heartbeat", "0") or "0")
        paused = self.store.get_meta("paused", "0") == "1"
        age = max(0.0, time.time() - heartbeat) if heartbeat else None
        max_age = int(getattr(self.config, "heartbeat_max_age_seconds", 60))
        healthy = database == "ok" and age is not None and age <= max_age
        return {
            "healthy": healthy,
            "database": database,
            "paused": paused,
            "heartbeat_age_seconds": age,
            "heartbeat_max_age_seconds": max_age,
        }

    def run(self, once: bool = False, source_name: str | None = None) -> None:
        self.store.set_meta("paused", self.store.get_meta("paused", "0") or "0")
        while self.running:
            now = time.time()
            self.store.set_meta("loop_heartbeat", str(now))
            if self.store.get_meta("paused", "0") == "1":
                time.sleep(self.config.poll_seconds)
                if once:
                    return
                continue
            try:
                last_reconciliation = float(self.store.get_meta("last_reconciliation", "0") or "0")
                if now - last_reconciliation >= self.config.reconciliation_interval_seconds:
                    result = self.apply_reconciliation(limit=self.config.reconciliation_batch_size)
                    self.store.set_meta("last_reconciliation", str(time.time()))
                    self.store.event(
                        "info",
                        "download_reconciliation_complete",
                        {"applied": result["applied"], "planned": result["planned"]},
                    )
                self.reconcile_downloads()
                self.refresh_due_title()
                self.schedule(once=once, source_name=source_name)
                self.notify_dashboards(force_progress=self.dashboard_title_started)
                self.notify_milestones()
                self.notify_completed_titles()
            except Exception as error:  # keep the daemon alive while preserving the failure
                self.store.event("error", "controller_loop_error", str(error))
            if once:
                return
            time.sleep(self.config.poll_seconds)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=Path("/config/config.json"))
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("sync-scope")
    sub.add_parser("inventory")
    inventory_title = sub.add_parser("inventory-title")
    inventory_title.add_argument("manga_id", type=int)
    sub.add_parser("plan")
    sub.add_parser("status")
    sub.add_parser("dashboard")
    sub.add_parser("audit")
    reconcile = sub.add_parser("reconcile")
    reconcile.add_argument("--apply", action="store_true")
    reconcile.add_argument("--limit", type=int, default=10)
    reconcile.add_argument("--output", type=Path)
    reconcile.add_argument("--input", type=Path)
    reconcile.add_argument("--quarantine", action="store_true")
    repair = sub.add_parser("repair-invariants")
    repair.add_argument("--apply", action="store_true")
    aliases = sub.add_parser("normalize-aliases")
    aliases.add_argument("--apply", action="store_true")
    sub.add_parser("health")
    run = sub.add_parser("run")
    run.add_argument("--once", action="store_true")
    run.add_argument("--source")
    sub.add_parser("pause")
    resume = sub.add_parser("resume")
    resume.add_argument("--source")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    config = Config.load(args.config)
    controller = Controller(config)
    signal.signal(signal.SIGTERM, lambda *_: setattr(controller, "running", False))
    signal.signal(signal.SIGINT, lambda *_: setattr(controller, "running", False))
    try:
        if args.command == "sync-scope":
            print(json.dumps(controller.sync_scope(), indent=2))
        elif args.command == "inventory":
            print(json.dumps(controller.inventory(), indent=2))
        elif args.command == "inventory-title":
            print(json.dumps(controller.inventory_title(args.manga_id), indent=2))
        elif args.command == "plan":
            controller.sync_scope()
            print(json.dumps(controller.plan(), indent=2))
        elif args.command == "status":
            print(json.dumps(controller.status(), indent=2))
        elif args.command == "dashboard":
            completed_updated, progress_updated, provider_updated = (
                controller.notify_dashboards(force_all=True)
            )
            print(
                "updated"
                if progress_updated or completed_updated or provider_updated
                else "unchanged"
            )
        elif args.command == "audit":
            controller.sync_scope()
            inventory = controller.inventory()
            print(json.dumps({"inventory": inventory, "status": controller.status(), "plan": controller.plan()}, indent=2))
        elif args.command == "reconcile":
            if args.input and not args.apply:
                raise RuntimeError("--input requires --apply")
            if args.quarantine and not args.apply:
                raise RuntimeError("--quarantine requires --apply")
            if args.apply and args.quarantine:
                manifest = (
                    json.loads(args.input.read_text())
                    if args.input
                    else controller.reconciliation_manifest()
                )
                result = controller.quarantine_manifest(
                    manifest,
                    limit=max(0, args.limit),
                )
            elif args.apply and args.input:
                result = controller.apply_manifest(
                    json.loads(args.input.read_text()),
                    limit=max(0, args.limit),
                )
            elif args.apply:
                result = controller.apply_reconciliation(limit=max(0, args.limit))
            else:
                result = controller.reconciliation_manifest()
            text = json.dumps(result, indent=2, ensure_ascii=False)
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(text + "\n")
                print(json.dumps({"output": str(args.output), "total": result.get("total"), "counts": result.get("counts") or result.get("planned")}))
            else:
                print(text)
        elif args.command == "repair-invariants":
            invalid = controller.repair_ingested_invariants(apply=args.apply)
            print(json.dumps({"apply": args.apply, "count": len(invalid), "chapters": invalid}, indent=2))
        elif args.command == "normalize-aliases":
            aliases = controller.normalize_title_aliases(apply=args.apply)
            print(json.dumps({"apply": args.apply, "count": len(aliases), "aliases": aliases}, indent=2))
        elif args.command == "health":
            result = controller.health()
            print(json.dumps(result, indent=2))
            return 0 if result["healthy"] else 1
        elif args.command == "pause":
            controller.store.set_meta("paused", "1")
            controller.api.call("mutation { stopDownloader(input:{}) { clientMutationId } }")
            print("paused")
        elif args.command == "resume":
            controller.store.set_meta("paused", "0")
            if args.source:
                controller.store.connection.execute("UPDATE providers SET manual_pause=1")
                controller.store.connection.execute(
                    """UPDATE providers SET manual_pause=0,paused_until=0
                       WHERE source_name=?""",
                    (args.source,),
                )
            else:
                controller.store.connection.execute(
                    "UPDATE providers SET manual_pause=0 WHERE paused_until<=?",
                    (time.time(),),
                )
            controller.store.connection.commit()
            print(f"resumed {args.source}" if args.source else "resumed")
        elif args.command == "run":
            controller.run(once=args.once, source_name=args.source)
        return 0
    finally:
        controller.close()


if __name__ == "__main__":
    sys.exit(main())
