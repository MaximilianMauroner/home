import hashlib
import io
import json
import sqlite3
import tempfile
import time
import unittest
import urllib.error
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from controller import (
    Config,
    Controller,
    DiscordMessageMissing,
    Store,
    chapter_number,
    inspect_cbz,
    normalized_title,
    parse_number_from_filename,
)


def write_cbz(path: Path, *, series: str = "Example", number: str = "1", payload: bytes = b"page") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    comic_info = f"<ComicInfo><Series>{series}</Series><Number>{number}</Number></ComicInfo>"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("ComicInfo.xml", comic_info)
        archive.writestr("001.jpg", b"\xff\xd8\xff" + payload)


class NormalizationTests(unittest.TestCase):
    def test_title_overrides_are_loaded_with_integer_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "config.json"
            config_path.write_text(json.dumps({
                "graphql_url": "http://example.invalid",
                "categories": [],
                "blocked_sources": [],
                "source_priority": [],
                "title_overrides": {"24": "My New Wife is Forcing Herself to Smile"},
                "title_aliases": {"Please Go Home, Akutsu-San!": "Please Go Home, Akutsu-san!"},
                "downloads_root": "/downloads",
                "library_root": "/library",
                "quarantine_root": "/quarantine",
                "state_root": "/state",
            }))
            config = Config.load(config_path)
            self.assertEqual(config.title_overrides, {24: "My New Wife is Forcing Herself to Smile"})
            self.assertEqual(
                config.title_aliases,
                {"pleasegohomeakutsusan": "Please Go Home, Akutsu-san!"},
            )
            self.assertEqual(config.discord_dashboard_interval_seconds, 900)

    def test_title_normalization(self):
        self.assertEqual(normalized_title("Frieren: Beyond Journey’s End"), "frierenbeyondjourneysend")
        self.assertEqual(normalized_title("A & B"), "aandb")

    def test_chapter_decimal_is_stable(self):
        self.assertEqual(chapter_number("33.10"), "33.1")
        self.assertEqual(chapter_number(0), "0")

    def test_filename_parsing(self):
        self.assertEqual(parse_number_from_filename("Ch.001.cbz"), "1")
        self.assertEqual(parse_number_from_filename("Chapter 33.5_extra.cbz"), "33.5")
        self.assertEqual(parse_number_from_filename("1-eng-li.cbz"), "1")
        self.assertEqual(parse_number_from_filename("_My New Wife is Forcing Herself to Smile 2.cbz"), "2")

    def test_filename_parsing_does_not_treat_a_bare_title_as_a_chapter(self):
        with self.assertRaises(ValueError):
            parse_number_from_filename("1984.cbz")


class ArchiveTests(unittest.TestCase):
    def test_record_file_can_participate_in_a_title_batch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "Chapter 1.cbz"
            archive.write_bytes(b"archive")
            controller = Controller.__new__(Controller)
            controller.store = Store(root / "state.sqlite3")
            try:
                controller.record_file(archive, "Example", "1", 1, "digest", "library", "active", commit=False)
                observer = sqlite3.connect(root / "state.sqlite3")
                try:
                    self.assertEqual(observer.execute("SELECT count(*) FROM files").fetchone()[0], 0)
                    controller.store.connection.commit()
                    self.assertEqual(observer.execute("SELECT count(*) FROM files").fetchone()[0], 1)
                finally:
                    observer.close()
            finally:
                controller.store.close()

    def make_ingest_controller(self, root: Path) -> Controller:
        controller = Controller.__new__(Controller)
        controller.store = Store(root / "state.sqlite3")
        controller.config = SimpleNamespace(
            downloads_root=root / "downloads",
            library_root=root / "library",
            quarantine_root=root / "quarantine",
        )
        return controller

    def test_ingest_moves_completed_archive_into_library(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "downloads" / "Example" / "Chapter 1.cbz"
            write_cbz(source)
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            controller = self.make_ingest_controller(root)
            try:
                self.assertEqual(controller.ingest(source, "Example", "1", 1, digest), "ingested")
                destination = root / "library" / "Example" / "Chapter 1.cbz"
                self.assertFalse(source.exists())
                self.assertTrue(destination.exists())
                self.assertEqual(
                    controller.store.connection.execute("SELECT path FROM files").fetchone()[0],
                    str(destination),
                )
            finally:
                controller.store.close()

    def test_ingest_removes_source_only_after_matching_existing_library_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "downloads" / "Example" / "Chapter 1.cbz"
            destination = root / "library" / "Example" / "Chapter 1.cbz"
            source.parent.mkdir(parents=True)
            destination.parent.mkdir(parents=True)
            comic_info = "<ComicInfo><Series>Example</Series><Number>1</Number></ComicInfo>"
            for path in (source, destination):
                with zipfile.ZipFile(path, "w") as archive:
                    archive.writestr("ComicInfo.xml", comic_info)
                    archive.writestr("001.jpg", b"\xff\xd8\xffpage")
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            controller = self.make_ingest_controller(root)
            try:
                controller.record_file(destination, "Example", "1", 1, digest, "library", "active")
                self.assertEqual(controller.ingest(source, "Example", "1", 1, digest), "duplicates_removed")
                self.assertFalse(source.exists())
                self.assertTrue(destination.exists())
            finally:
                controller.store.close()

    def test_ingest_uses_unique_quarantine_path_when_name_is_already_tracked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "downloads" / "Example" / "Chapter 1.cbz"
            existing = root / "library" / "Example" / "Chapter 1.cbz"
            occupied = root / "quarantine" / "Example" / "1" / "Chapter 1.cbz"
            for path, content in (
                (source, b"replacement"),
                (existing, b"existing"),
                (occupied, b"older quarantine"),
            ):
                write_cbz(path, payload=content)
            controller = self.make_ingest_controller(root)
            try:
                existing_digest = hashlib.sha256(existing.read_bytes()).hexdigest()
                occupied_digest = hashlib.sha256(occupied.read_bytes()).hexdigest()
                replacement_digest = hashlib.sha256(source.read_bytes()).hexdigest()
                controller.record_file(existing, "Example", "1", 1, existing_digest, "library", "active")
                controller.record_file(occupied, "Example", "1", 1, occupied_digest, "library", "quarantined")

                self.assertEqual(
                    controller.ingest(source, "Example", "1", 2, replacement_digest),
                    "ingested",
                )
                unique = occupied.with_name(f"Chapter 1_{existing_digest[:8]}.cbz")
                self.assertTrue(unique.exists())
                self.assertTrue(occupied.exists())
            finally:
                controller.store.close()


class ReconciliationTests(unittest.TestCase):
    def make_controller(self, root: Path) -> Controller:
        controller = Controller.__new__(Controller)
        controller.store = Store(root / "state.sqlite3")
        controller.config = SimpleNamespace(
            downloads_root=root / "downloads",
            library_root=root / "library",
            quarantine_root=root / "quarantine",
        )
        controller.store.connection.execute(
            "INSERT INTO providers(source_id,source_name) VALUES('source','Example Source')"
        )
        controller.store.connection.execute(
            """INSERT INTO titles(
                   manga_id,title,source_title,category,category_rank,source_id,
                   source_name,source_lang,in_library
               ) VALUES(1,'Example','Provider Example','Reading',0,'source','Example Source','en',1)"""
        )
        controller.store.connection.execute(
            """INSERT INTO chapters(
                   chapter_id,manga_id,chapter_number,chapter_name,source_order,
                   selected,state,updated_at
               ) VALUES(11,1,'1','1',1,1,'downloaded',0)"""
        )
        controller.store.connection.commit()
        return controller

    def test_manifest_is_read_only_and_apply_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "downloads" / "Example Source (en)" / "Provider Example" / "Chapter 1.cbz"
            write_cbz(source, series="Provider Example")
            controller = self.make_controller(root)
            try:
                before = controller.store.connection.total_changes
                manifest = controller.reconciliation_manifest()
                self.assertEqual(manifest["counts"], {"valid_missing_chapter": 1})
                self.assertEqual(controller.store.connection.total_changes, before)

                result = controller.apply_reconciliation(limit=10)
                self.assertEqual(result["applied"], 1)
                self.assertFalse(source.exists())
                self.assertIsNotNone(controller.verified_chapter_file(11))

                replay = controller.apply_manifest(manifest, limit=10)
                self.assertEqual(replay["applied"], 0)

                second = controller.apply_reconciliation(limit=10)
                self.assertEqual(second["applied"], 0)
            finally:
                controller.store.close()

    def test_invariant_repair_demotes_false_ingested_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            controller = self.make_controller(root)
            controller.store.connection.execute(
                "UPDATE chapters SET state='ingested' WHERE chapter_id=11"
            )
            controller.store.connection.commit()
            try:
                self.assertEqual(len(controller.repair_ingested_invariants()), 1)
                controller.repair_ingested_invariants(apply=True)
                row = controller.store.connection.execute(
                    "SELECT state,error_kind FROM chapters WHERE chapter_id=11"
                ).fetchone()
                self.assertEqual((row["state"], row["error_kind"]), ("downloaded", "missing_file"))
            finally:
                controller.store.close()

    def test_alias_normalization_uses_consistent_active_file_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            controller = self.make_controller(root)
            archive = root / "library" / "Canonical Example" / "Chapter 1.cbz"
            write_cbz(archive, series="Canonical Example")
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            controller.record_file(archive, "Canonical Example", "1", 1, digest, "library", "active")
            controller.store.connection.execute(
                "UPDATE titles SET title='Alias Example' WHERE manga_id=1"
            )
            controller.store.connection.execute(
                "UPDATE chapters SET state='ingested',file_path=?,sha256=? WHERE chapter_id=11",
                (str(archive), digest),
            )
            controller.store.connection.commit()
            try:
                aliases = controller.normalize_title_aliases()
                self.assertEqual(aliases[0]["canonical_title"], "Canonical Example")
                controller.normalize_title_aliases(apply=True)
                title = controller.store.connection.execute(
                    "SELECT title FROM titles WHERE manga_id=1"
                ).fetchone()[0]
                self.assertEqual(title, "Canonical Example")
                self.assertEqual(controller.repair_ingested_invariants(), [])
            finally:
                controller.store.close()

    def test_conflict_quarantine_preserves_active_chapter_record(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            controller = self.make_controller(root)
            active = root / "library" / "Example" / "Chapter 1.cbz"
            source = root / "downloads" / "Example Source (en)" / "Provider Example" / "Chapter 1.cbz"
            write_cbz(active, payload=b"active")
            write_cbz(source, series="Provider Example", payload=b"conflict")
            active_digest = hashlib.sha256(active.read_bytes()).hexdigest()
            controller.record_file(active, "Example", "1", 1, active_digest, "library", "active")
            try:
                manifest = controller.reconciliation_manifest()
                self.assertEqual(manifest["counts"], {"semantic_conflict": 1})
                result = controller.quarantine_manifest(manifest, limit=10)
                self.assertEqual(result["quarantined"], 1)
                self.assertFalse(source.exists())
                chapter = controller.store.connection.execute(
                    "SELECT state,file_path,sha256 FROM chapters WHERE chapter_id=11"
                ).fetchone()
                self.assertEqual((chapter["state"], chapter["file_path"], chapter["sha256"]), ("ingested", str(active), active_digest))
            finally:
                controller.store.close()


class DiscordDashboardTests(unittest.TestCase):
    def make_controller(self, root: Path) -> Controller:
        webhook = root / "webhook"
        webhook.write_text("https://discord.com/api/webhooks/id/token")
        controller = Controller.__new__(Controller)
        controller.store = Store(root / "state.sqlite3")
        controller.config = SimpleNamespace(
            discord_webhook_url_file=webhook,
            discord_thread_id="thread-123",
            discord_dashboard_interval_seconds=300,
        )
        controller.store.connection.execute(
            "INSERT INTO providers(source_id,source_name) VALUES('source','Example Source')"
        )
        controller.store.connection.execute(
            """INSERT INTO titles(manga_id,title,source_title,category,category_rank,source_id,source_name,source_lang,in_library)
               VALUES(1,'Example','Example','Prio',0,'source','Example Source','en',1)"""
        )
        controller.store.connection.execute(
            """INSERT INTO chapters(chapter_id,manga_id,chapter_number,chapter_name,source_order,selected,state,updated_at)
               VALUES(11,1,'1','1',1,1,'ingested',0),(12,1,'2','2',2,1,'queued',0)"""
        )
        controller.store.connection.execute(
            "INSERT INTO inflight(source_id,chapter_id,started_at,progress,progress_at) VALUES('source',12,0,0,0)"
        )
        controller.store.connection.commit()
        return controller

    def test_dashboard_creates_then_edits_one_message(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            controller.discord_request = Mock(side_effect=[{"id": "message-42"}, {}])
            try:
                self.assertTrue(controller.notify_progress_dashboard(force=True))
                first = controller.discord_request.call_args_list[0]
                self.assertEqual(first.args[0], "POST")
                self.assertIn("thread_id=thread-123", first.args[1])
                self.assertIn("wait=true", first.args[1])
                self.assertIn("with_components=true", first.args[1])
                payload = first.args[2]
                self.assertEqual(payload["flags"], 1 << 15)
                self.assertNotIn("embeds", payload)
                texts = "\n".join(
                    component["content"]
                    for component in payload["components"][0]["components"]
                    if component["type"] == 10
                )
                self.assertIn("**Example**\nChapter **2**", texts)
                self.assertIn("Chapter **2** · Example Source", texts)
                self.assertNotIn("Chapter **2** · 0%", texts)
                self.assertIn("▰▰▰▰▰▱▱▱▱▱ **50.0%** · 1/2", texts)
                self.assertIn("🟦 queued/downloading · 🟥 failed", texts)

                self.assertTrue(controller.notify_progress_dashboard(force=True))
                second = controller.discord_request.call_args_list[1]
                self.assertEqual(second.args[0], "PATCH")
                self.assertIn("/messages/message-42", second.args[1])
                self.assertIn("with_components=true", second.args[1])
            finally:
                controller.store.close()

    def test_missing_progress_dashboard_is_created_without_force(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            controller.discord_request = Mock(return_value={"id": "message-42"})
            try:
                self.assertTrue(controller.notify_progress_dashboard())
                self.assertEqual(controller.discord_request.call_args.args[0], "POST")
                self.assertEqual(
                    controller.store.get_meta("discord_dashboard_v2_message_id"),
                    "message-42",
                )
            finally:
                controller.store.close()

    def test_progress_bar_reports_complete_and_partial_counts(self):
        self.assertEqual(Controller.progress_bar(5, 10), "▰▰▰▰▰▱▱▱▱▱")
        self.assertEqual(Controller.progress_bar(10, 10), "▰" * 10)

    def test_completed_titles_dashboard_creates_then_edits_when_a_title_completes(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            controller.store.connection.execute(
                "UPDATE chapters SET state='ingested' WHERE chapter_id=12"
            )
            controller.store.connection.execute(
                "DELETE FROM inflight WHERE chapter_id=12"
            )
            controller.store.connection.execute(
                """INSERT INTO titles(
                       manga_id,title,source_title,category,category_rank,source_id,
                       source_name,source_lang,in_library
                   ) VALUES(2,'Second','Second','Later',1,'source','Example Source','en',1)"""
            )
            controller.store.connection.execute(
                """INSERT INTO chapters(
                       chapter_id,manga_id,chapter_number,chapter_name,source_order,
                       selected,state,updated_at
                   ) VALUES(21,2,'1','1',1,1,'discovered',0)"""
            )
            controller.store.connection.commit()
            controller.discord_request = Mock(side_effect=[{"id": "completed-42"}, {}])
            try:
                self.assertTrue(controller.notify_completed_titles_dashboard())
                first = controller.discord_request.call_args_list[0]
                self.assertEqual(first.args[0], "POST")
                self.assertIn("wait=true", first.args[1])
                first_text = "\n".join(
                    component["content"]
                    for component in first.args[2]["components"][0]["components"]
                    if component["type"] == 10
                )
                self.assertIn("## Prio · 1", first_text)
                self.assertIn("✅ **Example** · 2 chapters", first_text)
                self.assertNotIn("**Second**", first_text)

                self.assertFalse(controller.notify_completed_titles_dashboard())
                controller.store.connection.execute(
                    "UPDATE chapters SET state='ingested' WHERE chapter_id=21"
                )
                controller.store.connection.commit()
                self.assertTrue(controller.notify_completed_titles_dashboard())
                second = controller.discord_request.call_args_list[1]
                self.assertEqual(second.args[0], "PATCH")
                self.assertIn("/messages/completed-42", second.args[1])
                second_text = "\n".join(
                    component["content"]
                    for component in second.args[2]["components"][0]["components"]
                    if component["type"] == 10
                )
                self.assertIn("## Later · 1", second_text)
                self.assertIn("✅ **Second** · 1 chapter", second_text)
                self.assertIn("✅ 2 manga complete", second_text)
            finally:
                controller.store.close()

    def test_provider_dashboard_creates_then_edits_on_health_change(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            controller.store.connection.execute(
                "UPDATE providers SET source_name='Example' WHERE source_id='source'"
            )
            controller.store.connection.commit()
            controller.discord_request = Mock(side_effect=[{"id": "provider-42"}, {}])
            try:
                self.assertTrue(controller.notify_provider_dashboard())
                first = controller.discord_request.call_args_list[0]
                self.assertEqual(first.args[0], "POST")
                self.assertIn("# Provider uptime", json.dumps(first.args[2]))
                self.assertFalse(controller.notify_provider_dashboard())

                controller.store.connection.execute(
                    """UPDATE providers SET failure_level=1,paused_until=?,last_error='HTTP 429'
                       WHERE source_id='source'""",
                    (time.time() + 900,),
                )
                controller.store.connection.commit()
                self.assertTrue(controller.notify_provider_dashboard())
                second = controller.discord_request.call_args_list[1]
                self.assertEqual(second.args[0], "PATCH")
                self.assertIn("/messages/provider-42", second.args[1])
                self.assertIn("backing off", json.dumps(second.args[2]))
            finally:
                controller.store.close()

    def test_deleted_dashboard_rotates_the_whole_set_in_display_order(self):
        keys = {
            "completed": "discord_completed_titles_message_id",
            "progress": "discord_dashboard_v2_message_id",
            "provider": "discord_provider_dashboard_message_id",
        }
        for deleted in keys:
            with self.subTest(deleted=deleted), tempfile.TemporaryDirectory() as directory:
                controller = self.make_controller(Path(directory))
                for name, key in keys.items():
                    controller.store.set_meta(key, f"old-{name}")
                post_names = iter(("completed", "progress", "provider"))

                def request(method, url, payload, *_args):
                    if method == "PATCH" and f"old-{deleted}" in url:
                        raise DiscordMessageMissing()
                    if method == "POST":
                        return {"id": f"new-{next(post_names)}"}
                    if method == "DELETE":
                        old_id = next(
                            message_id
                            for message_id in (
                                "old-completed", "old-progress", "old-provider"
                            )
                            if message_id in url
                        )
                        self.assertIn(old_id, controller.pending_dashboard_deletes())
                    return {}

                controller.discord_request = Mock(side_effect=request)
                try:
                    self.assertEqual(
                        controller.notify_dashboards(force_all=True), (True, True, True)
                    )
                    posts = [
                        call for call in controller.discord_request.call_args_list
                        if call.args[0] == "POST"
                    ]
                    self.assertEqual(len(posts), 3)
                    self.assertIn("# Completed manga", json.dumps(posts[0].args[2]))
                    self.assertIn("# Suwayomi backfill", json.dumps(posts[1].args[2]))
                    self.assertIn("# Provider uptime", json.dumps(posts[2].args[2]))
                    for name, key in keys.items():
                        self.assertEqual(controller.store.get_meta(key), f"new-{name}")
                    deleted_urls = [
                        call.args[1] for call in controller.discord_request.call_args_list
                        if call.args[0] == "DELETE"
                    ]
                    self.assertEqual(len(deleted_urls), 3)
                    self.assertTrue(all(f"old-{name}" in " ".join(deleted_urls) for name in keys))
                    self.assertFalse(
                        any(f"new-{name}" in " ".join(deleted_urls) for name in keys)
                    )
                finally:
                    controller.store.close()

    def test_fresh_dashboard_set_is_created_completed_progress_provider(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            controller.discord_request = Mock(
                side_effect=[{"id": "completed"}, {"id": "progress"}, {"id": "provider"}]
            )
            try:
                self.assertEqual(controller.notify_dashboards(), (True, True, True))
                posts = controller.discord_request.call_args_list
                self.assertEqual([call.args[0] for call in posts], ["POST", "POST", "POST"])
                self.assertIn("# Completed manga", json.dumps(posts[0].args[2]))
                self.assertIn("# Suwayomi backfill", json.dumps(posts[1].args[2]))
                self.assertIn("# Provider uptime", json.dumps(posts[2].args[2]))
            finally:
                controller.store.close()

    def test_partial_dashboard_rotation_keeps_old_ids_and_cleans_new_messages(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            keys = (
                "discord_completed_titles_message_id",
                "discord_dashboard_v2_message_id",
                "discord_provider_dashboard_message_id",
            )
            for index, key in enumerate(keys):
                controller.store.set_meta(key, f"old-{index}")
            controller.discord_request = Mock(
                side_effect=[DiscordMessageMissing(), {"id": "new-completed"}, None, {}]
            )
            try:
                self.assertEqual(controller.notify_dashboards(force_all=True), (False, False, False))
                self.assertEqual(
                    [controller.store.get_meta(key) for key in keys],
                    ["old-0", "old-1", "old-2"],
                )
                cleanup = controller.discord_request.call_args_list[-1]
                self.assertEqual(cleanup.args[0], "DELETE")
                self.assertIn("new-completed", cleanup.args[1])
            finally:
                controller.store.close()

    def test_rotation_crash_keeps_each_created_message_in_durable_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            controller = self.make_controller(root)
            self.configure_existing_dashboard_set(controller)
            config = controller.config
            controller.discord_request = Mock(
                side_effect=[{"id": "new-completed"}, SystemExit("crash")]
            )
            try:
                with self.assertRaises(SystemExit):
                    controller.rotate_discord_dashboards()
                self.assertIn("new-completed", controller.pending_dashboard_deletes())
            finally:
                controller.store.close()

            recovery = Controller.__new__(Controller)
            recovery.store = Store(root / "state.sqlite3")
            recovery.config = config
            recovery.discord_request = Mock(return_value={})
            try:
                self.assertIn("new-completed", recovery.pending_dashboard_deletes())
                recovery.retry_dashboard_cleanup()
                self.assertEqual(recovery.pending_dashboard_deletes(), [])
                recovery.discord_request.assert_called_once()
                self.assertEqual(recovery.discord_request.call_args.args[0], "DELETE")
                self.assertIn("new-completed", recovery.discord_request.call_args.args[1])
            finally:
                recovery.store.close()

    def configure_existing_dashboard_set(self, controller, checked_at=10000):
        controller.store.set_meta("discord_completed_titles_message_id", "old-completed")
        controller.store.set_meta("discord_completed_titles_snapshot", "[]")
        controller.store.set_meta("discord_dashboard_v2_message_id", "old-progress")
        controller.store.set_meta("discord_dashboard_snapshot", "{}")
        controller.store.set_meta("discord_dashboard_updated_at", str(checked_at))
        controller.store.set_meta("discord_provider_dashboard_message_id", "old-provider")
        controller.store.set_meta(
            "discord_provider_dashboard_snapshot",
            json.dumps(controller.provider_dashboard_state(), ensure_ascii=False, sort_keys=True),
        )
        controller.store.set_meta("discord_dashboard_set_checked_at", str(checked_at))

    def test_normal_dashboard_cycle_only_patches_the_set_every_interval(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            self.configure_existing_dashboard_set(controller)
            controller.discord_request = Mock(return_value={})
            try:
                with patch("controller.time.time", return_value=10100):
                    self.assertEqual(controller.notify_dashboards(), (False, False, False))
                controller.discord_request.assert_not_called()

                with patch("controller.time.time", return_value=10301):
                    self.assertEqual(controller.notify_dashboards(), (True, True, True))
                self.assertEqual(
                    [call.args[0] for call in controller.discord_request.call_args_list],
                    ["PATCH", "PATCH", "PATCH"],
                )
                self.assertEqual(
                    controller.store.get_meta("discord_dashboard_set_checked_at"),
                    "10301",
                )
            finally:
                controller.store.close()

    def test_interval_check_detects_deleted_unchanged_completed_or_provider(self):
        for deleted in ("completed", "provider"):
            with self.subTest(deleted=deleted), tempfile.TemporaryDirectory() as directory:
                controller = self.make_controller(Path(directory))
                self.configure_existing_dashboard_set(controller)
                post_names = iter(("completed", "progress", "provider"))

                def request(method, url, _payload, *_args):
                    if method == "PATCH" and f"old-{deleted}" in url:
                        raise DiscordMessageMissing()
                    if method == "POST":
                        return {"id": f"new-{next(post_names)}"}
                    return {}

                controller.discord_request = Mock(side_effect=request)
                try:
                    with patch("controller.time.time", return_value=10301):
                        self.assertEqual(
                            controller.notify_dashboards(), (True, True, True)
                        )
                    posts = [
                        call for call in controller.discord_request.call_args_list
                        if call.args[0] == "POST"
                    ]
                    self.assertEqual(len(posts), 3)
                    self.assertEqual(
                        controller.store.get_meta(
                            "discord_completed_titles_message_id"
                        ),
                        "new-completed",
                    )
                    self.assertEqual(
                        controller.store.get_meta(
                            "discord_provider_dashboard_message_id"
                        ),
                        "new-provider",
                    )
                finally:
                    controller.store.close()

    def test_dashboard_cleanup_is_durable_across_transient_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            self.configure_existing_dashboard_set(controller)

            def fail_delete(method, _url, _payload, *_args):
                self.assertEqual(method, "DELETE")
                self.assertIn("obsolete", controller.pending_dashboard_deletes())
                controller.store.set_meta("discord_webhook_retry_after", "99999")
                return None

            controller.discord_request = Mock(side_effect=fail_delete)
            try:
                controller.queue_dashboard_cleanup(["obsolete"])
                controller.retry_dashboard_cleanup()
                self.assertEqual(controller.pending_dashboard_deletes(), ["obsolete"])
                self.assertEqual(
                    controller.store.get_meta("discord_webhook_retry_after"), "99999"
                )

                controller.store.set_meta("discord_webhook_retry_after", "0")
                controller.discord_request = Mock(return_value={})
                controller.retry_dashboard_cleanup()
                self.assertEqual(controller.pending_dashboard_deletes(), [])
                self.assertEqual(controller.discord_request.call_count, 1)
            finally:
                controller.store.close()

    def test_generic_discord_404_and_unknown_webhook_use_normal_backoff(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            try:
                for body in (b'{"code":10015,"message":"Unknown Webhook"}', b"not json"):
                    controller.store.set_meta("discord_webhook_retry_after", "0")
                    error = urllib.error.HTTPError(
                        "https://discord.invalid", 404, "Not Found", {}, io.BytesIO(body)
                    )
                    with patch("controller.urllib.request.urlopen", side_effect=error):
                        self.assertIsNone(
                            controller.discord_request(
                                "POST", "https://discord.invalid", {}, "failed", {}
                            )
                        )
                    self.assertGreater(
                        float(controller.store.get_meta("discord_webhook_retry_after")),
                        time.time(),
                    )
            finally:
                controller.store.close()

    def test_discord_unknown_message_code_is_the_only_missing_message_signal(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            error = urllib.error.HTTPError(
                "https://discord.invalid",
                404,
                "Not Found",
                {},
                io.BytesIO(b'{"code":10008,"message":"Unknown Message"}'),
            )
            try:
                with patch("controller.urllib.request.urlopen", side_effect=error):
                    with self.assertRaises(DiscordMessageMissing):
                        controller.discord_request(
                            "PATCH", "https://discord.invalid", {}, "failed", {}
                        )
                self.assertEqual(
                    controller.store.get_meta("discord_webhook_retry_after", "0"), "0"
                )
            finally:
                controller.store.close()

    def test_throughput_uses_successful_ingests_and_calculates_eta(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(Path(directory))
            controller.store.connection.executemany(
                "INSERT INTO events(created_at,level,event,detail) VALUES(?,'info','chapter_ingested','{}')",
                [(9400,), (9700,), (9900,)],
            )
            controller.store.connection.commit()
            try:
                with patch("controller.time.time", return_value=10000):
                    rate, eta = controller.throughput(1, 10)
                self.assertEqual(rate, 18)
                self.assertEqual(eta, 1800)
            finally:
                controller.store.close()


class DownloadRecoveryTests(unittest.TestCase):
    def test_store_migrates_existing_inflight_rows_with_progress_heartbeat(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.sqlite3"
            connection = sqlite3.connect(path)
            connection.execute(
                """CREATE TABLE inflight (
                       source_id TEXT PRIMARY KEY,
                       chapter_id INTEGER NOT NULL UNIQUE,
                       started_at REAL NOT NULL
                   )"""
            )
            connection.execute("INSERT INTO inflight VALUES('source',11,123.0)")
            connection.commit()
            connection.close()

            store = Store(path)
            try:
                row = store.connection.execute(
                    "SELECT progress,progress_at FROM inflight WHERE chapter_id=11"
                ).fetchone()
                self.assertEqual((row["progress"], row["progress_at"]), (0, 123.0))
            finally:
                store.close()

    def make_controller(self, directory):
        controller = Controller.__new__(Controller)
        controller.store = Store(Path(directory) / "state.sqlite3")
        controller.config = SimpleNamespace(
            download_stall_seconds=60,
            backoff_seconds=(900, 3600, 21600, 86400),
            chapter_backoff_seconds=(60, 3600, 86400),
            provider_failure_window_seconds=3600,
            provider_failure_threshold=2,
            provider_backoff_overrides={},
            provider_cap=4,
            provider_cooldown_seconds=60,
            blocked_sources=(),
            source_priority=("Example",),
            title_priority=(),
            state_root=Path(directory),
        )
        controller.store.connection.execute(
            "INSERT INTO providers(source_id,source_name) VALUES('source','Example')"
        )
        controller.store.connection.execute(
            """INSERT INTO titles(
                   manga_id,title,source_title,category,category_rank,source_id,
                   source_name,source_lang,in_library
               ) VALUES(1,'Example','Example','Reading',0,'source','Example','en',1)"""
        )
        controller.store.connection.execute(
            """INSERT INTO chapters(
                   chapter_id,manga_id,chapter_number,chapter_name,source_order,
                   selected,state,updated_at
               ) VALUES(11,1,'1','1',1,1,'queued',0)"""
        )
        controller.store.connection.commit()
        return controller

    @staticmethod
    def download_status(state="STARTED", progress=0.5):
        return {
            "downloadStatus": {
                "state": state,
                "queue": [{
                    "state": "QUEUED",
                    "tries": 0,
                    "progress": progress,
                    "chapter": {"id": 11},
                }],
            }
        }

    def test_stopped_downloader_is_restarted_and_given_a_fresh_heartbeat(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            old = time.time() - 3600
            controller.store.connection.execute(
                """INSERT INTO inflight(
                       source_id,chapter_id,started_at,progress,progress_at
                   ) VALUES('source',11,?,0.5,?)""",
                (old, old),
            )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(side_effect=[
                self.download_status(state="STOPPED"),
                {},
            ]))
            try:
                controller.reconcile_downloads()
                self.assertIn("startDownloader", controller.api.call.call_args_list[1].args[0])
                heartbeat = controller.store.connection.execute(
                    "SELECT progress_at FROM inflight WHERE chapter_id=11"
                ).fetchone()[0]
                self.assertGreater(heartbeat, time.time() - 10)
                event = controller.store.connection.execute(
                    "SELECT event FROM events ORDER BY id DESC LIMIT 1"
                ).fetchone()[0]
                self.assertEqual(event, "downloader_restarted")
            finally:
                controller.store.close()

    def test_download_flag_without_verified_file_does_not_mark_ingested(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.store.connection.execute(
                """INSERT INTO inflight(
                       source_id,chapter_id,started_at,progress,progress_at
                   ) VALUES('source',11,0,1,0)"""
            )
            controller.store.connection.commit()
            controller.inventory_title = Mock(return_value={"ingested": 0})
            controller.api = SimpleNamespace(call=Mock(side_effect=[
                {"downloadStatus": {"state": "STOPPED", "queue": []}},
                {"chapter": {"id": 11, "isDownloaded": True, "manga": {"id": 1, "title": "Example"}}},
            ]))
            try:
                controller.reconcile_downloads()
                chapter = controller.store.connection.execute(
                    "SELECT state,file_path,sha256,error_kind FROM chapters WHERE chapter_id=11"
                ).fetchone()
                self.assertEqual(
                    (chapter["state"], chapter["file_path"], chapter["sha256"], chapter["error_kind"]),
                    ("downloaded", None, None, "missing_file"),
                )
                self.assertIsNone(
                    controller.store.connection.execute(
                        "SELECT 1 FROM inflight WHERE chapter_id=11"
                    ).fetchone()
                )
            finally:
                controller.store.close()

    def test_download_flag_marks_ingested_only_with_verified_active_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            controller = self.make_controller(directory)
            archive = root / "library" / "Example" / "Chapter 1.cbz"
            write_cbz(archive)
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            controller.record_file(archive, "Example", "1", 1, digest, "library", "active")
            controller.store.connection.execute(
                "UPDATE chapters SET state='queued',file_path=NULL,sha256=NULL WHERE chapter_id=11"
            )
            controller.store.connection.execute(
                """INSERT INTO inflight(
                       source_id,chapter_id,started_at,progress,progress_at
                   ) VALUES('source',11,0,1,0)"""
            )
            controller.store.connection.commit()
            controller.inventory_title = Mock(return_value={"ingested": 0})
            controller.api = SimpleNamespace(call=Mock(side_effect=[
                {"downloadStatus": {"state": "STOPPED", "queue": []}},
                {"chapter": {"id": 11, "isDownloaded": True, "manga": {"id": 1, "title": "Example"}}},
            ]))
            try:
                controller.reconcile_downloads()
                chapter = controller.store.connection.execute(
                    "SELECT state,file_path,sha256,error_kind FROM chapters WHERE chapter_id=11"
                ).fetchone()
                self.assertEqual(chapter["state"], "ingested")
                self.assertEqual(chapter["file_path"], str(archive))
                self.assertEqual(chapter["sha256"], digest)
                self.assertIsNone(chapter["error_kind"])
            finally:
                controller.store.close()

    def test_failure_classification_separates_provider_policies(self):
        self.assertEqual(Controller.classify_failure("GraphQL HTTP 404"), ("not_found", True, False))
        self.assertEqual(Controller.classify_failure("HTTP 429 rate limited"), ("rate_limited", False, False))
        self.assertEqual(Controller.classify_failure("Cloudflare bypass failed"), ("waf_blocked", False, True))

    def test_restart_failure_is_recorded_without_losing_inflight_work(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            old = time.time() - 3600
            controller.store.connection.execute(
                """INSERT INTO inflight(
                       source_id,chapter_id,started_at,progress,progress_at
                   ) VALUES('source',11,?,0.25,?)""",
                (old, old),
            )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(side_effect=[
                self.download_status(state="STOPPED", progress=0.5),
                RuntimeError("start timed out"),
            ]))
            try:
                controller.reconcile_downloads()
                row = controller.store.connection.execute(
                    "SELECT progress FROM inflight WHERE chapter_id=11"
                ).fetchone()
                self.assertEqual(row["progress"], 0.5)
                event = controller.store.connection.execute(
                    "SELECT event FROM events ORDER BY id DESC LIMIT 1"
                ).fetchone()[0]
                self.assertEqual(event, "downloader_restart_failed")
            finally:
                controller.store.close()

    def test_failed_queue_item_is_deferred_without_restarting_or_pausing_provider(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.store.connection.execute(
                """INSERT INTO inflight(
                       source_id,chapter_id,started_at,progress,progress_at
                   ) VALUES('source',11,0,0,0)"""
            )
            controller.store.connection.commit()
            failed = self.download_status(state="STOPPED", progress=0)
            failed["downloadStatus"]["queue"][0]["state"] = "ERROR"
            failed["downloadStatus"]["queue"][0]["tries"] = 3
            controller.api = SimpleNamespace(call=Mock(side_effect=[failed, {}]))
            try:
                controller.reconcile_downloads()
                queries = [call.args[0] for call in controller.api.call.call_args_list]
                self.assertFalse(any("startDownloader" in query for query in queries))
                chapter = controller.store.connection.execute(
                    "SELECT state,failure_count,retry_after FROM chapters WHERE chapter_id=11"
                ).fetchone()
                self.assertEqual((chapter["state"], chapter["failure_count"]), ("failed", 1))
                self.assertGreater(chapter["retry_after"], time.time())
                provider = controller.store.connection.execute(
                    "SELECT failure_level,paused_until FROM providers WHERE source_id='source'"
                ).fetchone()
                self.assertEqual((provider["failure_level"], provider["paused_until"]), (0, 0))
            finally:
                controller.store.close()

    def test_known_broken_provider_uses_override_without_permanent_manual_pause(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.config.provider_backoff_overrides["Example"] = 86400
            controller.api = SimpleNamespace(call=Mock(return_value={}))
            try:
                controller.fail_provider("source", 11, "rate limited")
                provider = controller.store.connection.execute(
                    "SELECT failure_level,paused_until,manual_pause FROM providers WHERE source_id='source'"
                ).fetchone()
                self.assertEqual(provider["failure_level"], 1)
                self.assertGreater(provider["paused_until"], time.time() + 86000)
                self.assertEqual(provider["manual_pause"], 0)
            finally:
                controller.store.close()

    def test_dequeue_failure_still_records_local_backoff(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.api = SimpleNamespace(call=Mock(side_effect=RuntimeError("offline")))
            try:
                controller.fail_provider("source", 11, "download failed")
                chapter = controller.store.connection.execute(
                    "SELECT state,failure_count,retry_after FROM chapters WHERE chapter_id=11"
                ).fetchone()
                self.assertEqual((chapter["state"], chapter["failure_count"]), ("failed", 1))
                self.assertGreater(chapter["retry_after"], time.time())
                self.assertIsNone(
                    controller.store.connection.execute(
                        "SELECT 1 FROM inflight WHERE chapter_id=11"
                    ).fetchone()
                )
                event = controller.store.connection.execute(
                    "SELECT event FROM events WHERE event='chapter_dequeue_failed'"
                ).fetchone()
                self.assertIsNotNone(event)
            finally:
                controller.store.close()

    def test_next_reconciliation_dequeues_orphaned_remote_error(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.api = SimpleNamespace(call=Mock(side_effect=RuntimeError("offline")))
            try:
                controller.fail_provider("source", 11, "download failed")
                failed = self.download_status(state="STOPPED", progress=0)
                failed["downloadStatus"]["queue"][0]["state"] = "ERROR"
                failed["downloadStatus"]["queue"].append({
                    "state": "ERROR",
                    "tries": 3,
                    "progress": 0,
                    "chapter": {"id": 99},
                })
                controller.api = SimpleNamespace(call=Mock(side_effect=[failed, {}]))

                controller.reconcile_downloads()

                queries = [call.args[0] for call in controller.api.call.call_args_list]
                self.assertTrue(any("dequeueChapterDownloads" in query for query in queries))
                self.assertFalse(any("startDownloader" in query for query in queries))
                dequeue = next(
                    call for call in controller.api.call.call_args_list
                    if "dequeueChapterDownloads" in call.args[0]
                )
                self.assertEqual(dequeue.args[1], {"ids": [11]})
                self.assertIsNone(
                    controller.store.connection.execute(
                        "SELECT 1 FROM pending_dequeues WHERE chapter_id=11"
                    ).fetchone()
                )
                event = controller.store.connection.execute(
                    "SELECT event FROM events ORDER BY id DESC LIMIT 1"
                ).fetchone()[0]
                self.assertEqual(event, "orphaned_download_dequeued")
            finally:
                controller.store.close()

    def test_failed_tracked_dequeue_suppresses_same_cycle_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.store.connection.execute(
                """INSERT INTO inflight(
                       source_id,chapter_id,started_at,progress,progress_at
                   ) VALUES('source',11,0,0,0)"""
            )
            controller.store.connection.execute(
                "INSERT INTO providers(source_id,source_name) VALUES('healthy','Healthy')"
            )
            controller.store.connection.execute(
                """INSERT INTO titles(
                       manga_id,title,source_title,category,category_rank,source_id,
                       source_name,source_lang,in_library
                   ) VALUES(2,'Healthy','Healthy','Reading',1,'healthy','Healthy','en',1)"""
            )
            controller.store.connection.execute(
                """INSERT INTO chapters(
                       chapter_id,manga_id,chapter_number,chapter_name,source_order,
                       selected,state,updated_at
                   ) VALUES(22,2,'1','1',1,1,'queued',0)"""
            )
            controller.store.connection.execute(
                """INSERT INTO inflight(
                       source_id,chapter_id,started_at,progress,progress_at
                   ) VALUES('healthy',22,0,0,0)"""
            )
            controller.store.connection.commit()
            status = self.download_status(state="STOPPED", progress=0)
            status["downloadStatus"]["queue"][0]["state"] = "ERROR"
            status["downloadStatus"]["queue"].append({
                "state": "QUEUED", "tries": 0, "progress": 0.5, "chapter": {"id": 22}
            })
            controller.api = SimpleNamespace(
                call=Mock(side_effect=[status, RuntimeError("dequeue offline")])
            )
            try:
                controller.reconcile_downloads()
                queries = [call.args[0] for call in controller.api.call.call_args_list]
                self.assertFalse(any("startDownloader" in query for query in queries))
                self.assertIsNotNone(
                    controller.store.connection.execute(
                        "SELECT 1 FROM pending_dequeues WHERE chapter_id=11"
                    ).fetchone()
                )
                self.assertIsNotNone(
                    controller.store.connection.execute(
                        "SELECT 1 FROM inflight WHERE chapter_id=22"
                    ).fetchone()
                )
            finally:
                controller.store.close()

    def test_progress_updates_the_stall_heartbeat(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            old = time.time() - 3600
            controller.store.connection.execute(
                """INSERT INTO inflight(
                       source_id,chapter_id,started_at,progress,progress_at
                   ) VALUES('source',11,?,0.25,?)""",
                (old, old),
            )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(return_value=self.download_status(progress=0.5)))
            try:
                controller.reconcile_downloads()
                row = controller.store.connection.execute(
                    "SELECT progress,progress_at FROM inflight WHERE chapter_id=11"
                ).fetchone()
                self.assertEqual(row["progress"], 0.5)
                self.assertGreater(row["progress_at"], time.time() - 10)
            finally:
                controller.store.close()

    def test_stalled_download_enters_existing_failure_handling(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            old = time.time() - 3600
            controller.store.connection.execute(
                """INSERT INTO inflight(
                       source_id,chapter_id,started_at,progress,progress_at
                   ) VALUES('source',11,?,0.5,?)""",
                (old, old),
            )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(return_value=self.download_status(progress=0.5)))
            controller.fail_provider = Mock()
            try:
                controller.reconcile_downloads()
                controller.fail_provider.assert_called_once_with(
                    "source", 11, "download made no progress for 60 seconds"
                )
            finally:
                controller.store.close()

    def test_schedule_persists_queue_state_without_starting_downloader(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.store.connection.execute(
                "UPDATE chapters SET state='discovered' WHERE chapter_id=11"
            )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(return_value={}))
            controller.select_chapter_fallback = Mock(return_value=False)
            try:
                self.assertEqual(controller.schedule(), 1)
                query = controller.api.call.call_args.args[0]
                self.assertIn("enqueueChapterDownload", query)
                self.assertNotIn("startDownloader", query)
                row = controller.store.connection.execute(
                    "SELECT chapter_id,progress,progress_at FROM inflight"
                ).fetchone()
                self.assertEqual((row["chapter_id"], row["progress"]), (11, 0))
                self.assertGreater(row["progress_at"], time.time() - 10)
                self.assertTrue(controller.dashboard_title_started)
                self.assertEqual(
                    controller.store.get_meta("discord_dashboard_title_started_example"),
                    "1",
                )

                controller.store.connection.execute("DELETE FROM inflight")
                controller.store.connection.execute(
                    "UPDATE chapters SET state='discovered' WHERE chapter_id=11"
                )
                controller.store.connection.execute(
                    "UPDATE providers SET last_started=0 WHERE source_id='source'"
                )
                controller.store.connection.commit()
                self.assertEqual(controller.schedule(), 1)
                self.assertFalse(controller.dashboard_title_started)
            finally:
                controller.store.close()

    def test_schedule_skips_idle_providers_before_applying_cap(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.config.provider_cap = 1
            controller.store.connection.execute(
                "UPDATE chapters SET state='discovered' WHERE chapter_id=11"
            )
            for index in range(2):
                source_id = f"idle-{index}"
                controller.store.connection.execute(
                    "INSERT INTO providers(source_id,source_name,last_started) VALUES(?,?,?)",
                    (source_id, f"Idle {index}", -100 + index),
                )
            controller.store.connection.execute(
                "UPDATE providers SET last_started=0 WHERE source_id='source'"
            )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(return_value={}))
            controller.select_chapter_fallback = Mock(return_value=False)
            try:
                self.assertEqual(controller.schedule(), 1)
                queued = controller.store.connection.execute(
                    "SELECT chapter_id FROM inflight"
                ).fetchone()
                self.assertEqual(queued["chapter_id"], 11)
            finally:
                controller.store.close()

    def test_schedule_fills_cap_after_multiple_idle_providers(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.config.provider_cap = 3
            controller.store.connection.execute(
                "UPDATE chapters SET state='discovered' WHERE chapter_id=11"
            )
            for index in range(4):
                controller.store.connection.execute(
                    "INSERT INTO providers(source_id,source_name,last_started) VALUES(?,?,?)",
                    (f"idle-{index}", f"Idle {index}", -100 + index),
                )
            for index in range(2, 4):
                source_id = f"source-{index}"
                controller.store.connection.execute(
                    "INSERT INTO providers(source_id,source_name) VALUES(?,?)",
                    (source_id, f"Example {index}"),
                )
                controller.store.connection.execute(
                    """INSERT INTO titles(
                           manga_id,title,source_title,category,category_rank,source_id,
                           source_name,source_lang,in_library
                       ) VALUES(?,?,?,?,?,?,?,?,1)""",
                    (index, f"Example {index}", f"Example {index}", "Reading", index,
                     source_id, f"Example {index}", "en"),
                )
                controller.store.connection.execute(
                    """INSERT INTO chapters(
                           chapter_id,manga_id,chapter_number,chapter_name,source_order,
                           selected,state,updated_at
                       ) VALUES(?,?, '1','1',1,1,'discovered',0)""",
                    (10 + index, index),
                )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(return_value={}))
            controller.select_chapter_fallback = Mock(return_value=False)
            try:
                self.assertEqual(controller.schedule(), 3)
                sources = {
                    row[0]
                    for row in controller.store.connection.execute(
                        "SELECT source_id FROM inflight"
                    )
                }
                self.assertEqual(sources, {"source", "source-2", "source-3"})
            finally:
                controller.store.close()

    def test_failed_chapter_retries_when_only_alternate_is_manually_paused(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.store.connection.execute(
                "UPDATE chapters SET state='failed',retry_after=0 WHERE chapter_id=11"
            )
            controller.store.connection.execute(
                "INSERT INTO providers(source_id,source_name,manual_pause) VALUES('paused','Paused',1)"
            )
            controller.store.connection.execute(
                """INSERT INTO titles(
                       manga_id,title,source_title,category,category_rank,source_id,
                       source_name,source_lang,in_library
                   ) VALUES(2,'Example','Example','Reading',0,'paused','Paused','en',1)"""
            )
            controller.store.connection.execute(
                """INSERT INTO chapters(
                       chapter_id,manga_id,chapter_number,chapter_name,source_order,
                       selected,state,updated_at
                   ) VALUES(21,2,'1','1',1,0,'discovered',0)"""
            )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(return_value={}))
            try:
                self.assertEqual(controller.schedule(), 1)
                enqueue = controller.api.call.call_args
                self.assertIn("enqueueChapterDownload", enqueue.args[0])
                self.assertEqual(enqueue.args[1], {"id": 11})
                self.assertEqual(
                    controller.store.connection.execute(
                        "SELECT chapter_id FROM inflight"
                    ).fetchone()[0],
                    11,
                )
            finally:
                controller.store.close()

    def test_scheduler_does_not_requeue_chapter_pending_remote_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = self.make_controller(directory)
            controller.store.connection.execute(
                "UPDATE chapters SET state='failed',retry_after=0 WHERE chapter_id=11"
            )
            controller.store.connection.execute(
                """INSERT INTO pending_dequeues(chapter_id,source_id,created_at)
                   VALUES(11,'source',0)"""
            )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(return_value={}))
            try:
                self.assertEqual(controller.schedule(), 0)
                controller.api.call.assert_not_called()
                self.assertIsNone(
                    controller.store.connection.execute("SELECT 1 FROM inflight").fetchone()
                )
            finally:
                controller.store.close()


class ControllerBehaviorTests(unittest.TestCase):
    def test_health_requires_recent_loop_heartbeat_even_when_paused(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = Controller.__new__(Controller)
            controller.store = Store(Path(directory) / "state.sqlite3")
            controller.config = SimpleNamespace(heartbeat_max_age_seconds=60)
            try:
                controller.store.set_meta("paused", "1")
                self.assertFalse(controller.health()["healthy"])
                controller.store.set_meta("loop_heartbeat", str(time.time()))
                self.assertTrue(controller.health()["healthy"])
            finally:
                controller.store.close()

    def test_multi_source_scope_prefers_primary_and_uses_fallback_for_gaps(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "migrations.json").write_text(json.dumps([{
                "old_id": 1,
                "primary_id": 2,
                "gap_id": None,
                "fallback_ids": [1],
                "canonical_title": "Example",
            }]))
            controller = Controller.__new__(Controller)
            controller.store = Store(root / "state.sqlite3")
            controller.config = SimpleNamespace(
                state_root=root,
                categories=("Reading",),
                blocked_sources=(),
                source_priority=("Primary", "Fallback"),
                title_overrides={},
            )
            category = {
                "id": 1,
                "name": "Reading",
                "mangas": {"nodes": [
                    {
                        "id": 1, "title": "Old Example", "inLibrary": True, "sourceId": "fallback",
                        "source": {"id": "fallback", "name": "Fallback", "lang": "en"},
                        "chapters": {"nodes": [
                            {"id": 11, "chapterNumber": 1, "name": "1", "sourceOrder": 1, "isDownloaded": False},
                            {"id": 12, "chapterNumber": 2, "name": "2", "sourceOrder": 2, "isDownloaded": False},
                        ]},
                    },
                    {
                        "id": 2, "title": "New Example", "inLibrary": True, "sourceId": "primary",
                        "source": {"id": "primary", "name": "Primary", "lang": "en"},
                        "chapters": {"nodes": [
                            {"id": 21, "chapterNumber": 1, "name": "1", "sourceOrder": 1, "isDownloaded": False},
                        ]},
                    },
                ]},
            }
            controller.api = SimpleNamespace(call=lambda *_args, **_kwargs: {"categories": {"nodes": [category]}})
            try:
                controller.sync_scope()
                selected = list(controller.store.connection.execute(
                    "SELECT chapter_id FROM chapters WHERE selected=1 ORDER BY chapter_id"
                ))
                self.assertEqual([row[0] for row in selected], [12, 21])
            finally:
                controller.store.close()

    def test_scope_sync_deselects_chapters_when_title_leaves_scope(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            controller = Controller.__new__(Controller)
            controller.store = Store(root / "state.sqlite3")
            controller.config = SimpleNamespace(
                state_root=root,
                categories=("Reading",),
                blocked_sources=(),
                source_priority=("Example",),
                title_overrides={},
                title_aliases={},
            )
            controller.store.connection.execute(
                "INSERT INTO providers(source_id,source_name) VALUES('old','Old')"
            )
            controller.store.connection.execute(
                """INSERT INTO titles(
                       manga_id,title,source_title,category,category_rank,source_id,
                       source_name,source_lang,in_library
                   ) VALUES(99,'Old','Old','Reading',0,'old','Old','en',1)"""
            )
            controller.store.connection.execute(
                """INSERT INTO chapters(
                       chapter_id,manga_id,chapter_number,chapter_name,source_order,
                       selected,state,updated_at
                   ) VALUES(999,99,'1','1',1,1,'ingested',0)"""
            )
            controller.store.connection.commit()
            category = {
                "id": 1,
                "name": "Reading",
                "mangas": {"nodes": [{
                    "id": 1,
                    "title": "Current",
                    "inLibrary": True,
                    "sourceId": "current",
                    "source": {"id": "current", "name": "Example", "lang": "en"},
                    "chapters": {"nodes": []},
                }]},
            }
            controller.api = SimpleNamespace(
                call=lambda *_args, **_kwargs: {"categories": {"nodes": [category]}}
            )
            try:
                controller.sync_scope()
                stale = controller.store.connection.execute(
                    """SELECT t.in_library,c.selected FROM chapters c
                       JOIN titles t ON t.manga_id=c.manga_id WHERE c.chapter_id=999"""
                ).fetchone()
                self.assertEqual((stale["in_library"], stale["selected"]), (0, 0))
            finally:
                controller.store.close()

    def test_old_source_exclusions_are_applied_to_canonical_manifest(self):
        controller = Controller.__new__(Controller)
        controller.migration_records = Mock(return_value=[{
            "chapter_aliases": {},
            "excluded_chapter_ids": [10],
            "excluded_old_chapter_ids": [20],
        }])
        _, excluded = controller.chapter_corrections()
        self.assertEqual(excluded, {10, 20})

    def test_due_refresh_fetches_one_title_and_resyncs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            controller = Controller.__new__(Controller)
            controller.store = Store(root / "state.sqlite3")
            controller.config = SimpleNamespace(
                scope_refresh_seconds=60,
                provider_cooldown_seconds=20,
                backoff_seconds=(900, 3600, 21600, 86400),
            )
            controller.store.connection.execute(
                "INSERT INTO providers(source_id,source_name,last_started) VALUES('source','Example',0)"
            )
            controller.store.connection.execute(
                """INSERT INTO titles(manga_id,title,source_title,category,category_rank,source_id,source_name,source_lang,in_library)
                   VALUES(1,'Example','Example','Reading',0,'source','Example','en',1)"""
            )
            controller.store.connection.commit()
            controller.api = SimpleNamespace(call=Mock(return_value={}))
            controller.sync_scope = Mock(return_value={})
            try:
                self.assertEqual(controller.refresh_due_title(), 1)
                controller.api.call.assert_called_once()
                controller.sync_scope.assert_called_once()
                self.assertGreater(
                    controller.store.connection.execute("SELECT refreshed_at FROM titles WHERE manga_id=1").fetchone()[0],
                    time.time() - 10,
                )
                provider = controller.store.connection.execute(
                    "SELECT last_started,last_refresh_started FROM providers WHERE source_id='source'"
                ).fetchone()
                self.assertEqual(provider["last_started"], 0)
                self.assertGreater(provider["last_refresh_started"], time.time() - 10)
            finally:
                controller.store.close()

    def test_failed_chapter_switches_to_healthy_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            controller = Controller.__new__(Controller)
            controller.store = Store(Path(directory) / "state.sqlite3")
            controller.config = SimpleNamespace(source_priority=("Primary", "Fallback"), state_root=Path(directory))
            controller.migration_records = Mock(return_value=[{
                "primary_id": 1,
                "fallback_ids": [2],
                "canonical_title": "Example",
            }])
            for source_id, name, paused_until in [("primary", "Primary", time.time() + 900), ("fallback", "Fallback", 0)]:
                controller.store.connection.execute(
                    "INSERT INTO providers(source_id,source_name,paused_until) VALUES(?,?,?)",
                    (source_id, name, paused_until),
                )
            for manga_id, source_id, name in [(1, "primary", "Primary"), (2, "fallback", "Fallback")]:
                controller.store.connection.execute(
                    """INSERT INTO titles(manga_id,title,source_title,category,category_rank,source_id,source_name,source_lang,in_library)
                       VALUES(?, 'Example','Example','Reading',0,?,?, 'en',1)""",
                    (manga_id, source_id, name),
                )
            controller.store.connection.execute(
                """INSERT INTO chapters(chapter_id,manga_id,chapter_number,chapter_name,source_order,selected,state,updated_at)
                   VALUES(11,1,'1','1',1,1,'failed',0),(21,2,'1','1',1,0,'discovered',0)"""
            )
            controller.store.connection.commit()
            try:
                self.assertTrue(controller.select_chapter_fallback(11, "primary"))
                selected = controller.store.connection.execute(
                    "SELECT chapter_id FROM chapters WHERE selected=1"
                ).fetchone()[0]
                self.assertEqual(selected, 21)
            finally:
                controller.store.close()

    def test_store_waits_for_brief_database_contention(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory) / "state.sqlite3")
            try:
                self.assertEqual(store.connection.execute("PRAGMA busy_timeout").fetchone()[0], 30000)
            finally:
                store.close()

    def test_valid_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "Chapter 1.cbz"
            comic_info = "<ComicInfo><Series>Example</Series><Number>1</Number></ComicInfo>"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("ComicInfo.xml", comic_info)
                archive.writestr("001.jpg", b"\xff\xd8\xff" + b"x" * 32)
            series, number, pages, digest = inspect_cbz(path)
            self.assertEqual((series, number, pages), ("Example", "1", 1))
            self.assertEqual(digest, hashlib.sha256(path.read_bytes()).hexdigest())

    def test_archive_without_images_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "Chapter 1.cbz"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("ComicInfo.xml", "<ComicInfo />")
            with self.assertRaisesRegex(ValueError, "no image"):
                inspect_cbz(path)

    def test_archive_cache_is_invalidated_by_file_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "Chapter 1.cbz"

            def write_archive(payload: bytes) -> None:
                with zipfile.ZipFile(path, "w") as archive:
                    archive.writestr("ComicInfo.xml", "<ComicInfo><Series>Example</Series><Number>1</Number></ComicInfo>")
                    archive.writestr("001.jpg", b"\xff\xd8\xff" + payload)

            write_archive(b"first")
            controller = Controller.__new__(Controller)
            controller.store = Store(root / "state.sqlite3")
            try:
                self.assertFalse(controller.inspect_archive(path)[-1])
                self.assertTrue(controller.inspect_archive(path)[-1])
                write_archive(b"second payload")
                self.assertFalse(controller.inspect_archive(path)[-1])
            finally:
                controller.store.close()


if __name__ == "__main__":
    unittest.main()
