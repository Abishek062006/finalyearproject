"""
Sanity tests for research/replay/run_replay_study.py — the batch runner
that turns whatever's in research/replay/cases/ into a report. These use a
throwaway temp directory, NOT the real cases/ folder (that has its own
smoke-tested synthetic example, covered in test_research.py), so a bad case
built here can never affect the real folder's contents.
"""
import json

import research  # noqa: F401 — sys.path bootstrap
from research.replay import run_replay_study

GOOD_CSV = "session,condition,value,n\n1,A,0.6,5\n1,B,0.4,5\n2,A,0.8,5\n2,B,0.4,5\n3,A,0.9,5\n3,B,0.3,5\n4,A,0.9,5\n4,B,0.3,5\n"


def _write_case(dir_path, name, csv_text=GOOD_CSV, meta: dict | None = None, meta_text: str | None = None):
    (dir_path / f"{name}.csv").write_text(csv_text)
    if meta_text is not None:
        (dir_path / f"{name}.json").write_text(meta_text)
    elif meta is not None:
        (dir_path / f"{name}.json").write_text(json.dumps(meta))
    # else: no metadata file at all


def test_a_well_formed_case_is_included(tmp_path, monkeypatch):
    monkeypatch.setattr(run_replay_study, "CASES_DIR", tmp_path)
    _write_case(tmp_path, "good_case", meta={"is_synthetic": True, "citation": "test case", "reference_winner": "A"})

    rows = run_replay_study.run_all()
    assert len(rows) == 1
    assert rows[0]["case"] == "good_case"
    assert rows[0]["winner"] == "A"
    assert rows[0]["agrees_with_reference"] is True


def test_a_case_missing_metadata_is_skipped_not_crashed(tmp_path, monkeypatch):
    monkeypatch.setattr(run_replay_study, "CASES_DIR", tmp_path)
    _write_case(tmp_path, "no_meta")  # csv only, no .json at all
    assert run_replay_study.run_all() == []


def test_invalid_json_metadata_is_skipped_not_crashed(tmp_path, monkeypatch):
    monkeypatch.setattr(run_replay_study, "CASES_DIR", tmp_path)
    _write_case(tmp_path, "bad_json", meta_text="{not valid json")
    assert run_replay_study.run_all() == []


def test_metadata_missing_is_synthetic_flag_is_skipped(tmp_path, monkeypatch):
    monkeypatch.setattr(run_replay_study, "CASES_DIR", tmp_path)
    _write_case(tmp_path, "no_flag", meta={"citation": "test"})
    assert run_replay_study.run_all() == []


def test_metadata_missing_citation_is_skipped(tmp_path, monkeypatch):
    monkeypatch.setattr(run_replay_study, "CASES_DIR", tmp_path)
    _write_case(tmp_path, "no_citation", meta={"is_synthetic": True})
    assert run_replay_study.run_all() == []


def test_a_malformed_csv_is_skipped_not_crashed(tmp_path, monkeypatch):
    monkeypatch.setattr(run_replay_study, "CASES_DIR", tmp_path)
    _write_case(tmp_path, "bad_csv", csv_text="not,even,the right,columns\n1,2,3,4\n", meta={"is_synthetic": True, "citation": "test"})
    assert run_replay_study.run_all() == []


def test_one_bad_case_does_not_take_down_a_good_one(tmp_path, monkeypatch):
    monkeypatch.setattr(run_replay_study, "CASES_DIR", tmp_path)
    _write_case(tmp_path, "good_case", meta={"is_synthetic": True, "citation": "test case", "reference_winner": "A"})
    _write_case(tmp_path, "bad_case")  # no metadata

    rows = run_replay_study.run_all()
    assert len(rows) == 1
    assert rows[0]["case"] == "good_case"


def test_real_case_without_a_reference_winner_still_reports_a_verdict(tmp_path, monkeypatch):
    monkeypatch.setattr(run_replay_study, "CASES_DIR", tmp_path)
    _write_case(tmp_path, "no_reference", meta={"is_synthetic": False, "citation": "a real paper, hypothetically"})

    rows = run_replay_study.run_all()
    assert len(rows) == 1
    assert rows[0]["winner"] == "A"
    assert rows[0]["agrees_with_reference"] is None  # nothing to agree/disagree with


def test_markdown_report_flags_when_no_real_cases_exist_yet(tmp_path):
    rows = [{
        "case": "synthetic_one", "is_synthetic": True, "citation": "made up",
        "total_sessions": 4, "session_of_decision": 3, "winner": "A",
        "reference_winner": "A", "agrees_with_reference": True, "sessions_saved": 1,
    }]
    out_path = tmp_path / "summary.md"
    run_replay_study.write_markdown(rows, out_path)
    text = out_path.read_text()
    assert "No real published cases yet" in text
    assert "SYNTHETIC" in text


def test_markdown_report_summarizes_agreement_once_real_cases_exist(tmp_path):
    rows = [
        {
            "case": "real_one", "is_synthetic": False, "citation": "a real paper",
            "total_sessions": 10, "session_of_decision": 6, "winner": "A",
            "reference_winner": "A", "agrees_with_reference": True, "sessions_saved": 4,
        },
        {
            "case": "real_two", "is_synthetic": False, "citation": "another real paper",
            "total_sessions": 8, "session_of_decision": None, "winner": None,
            "reference_winner": "B", "agrees_with_reference": False, "sessions_saved": None,
        },
    ]
    out_path = tmp_path / "summary.md"
    run_replay_study.write_markdown(rows, out_path)
    text = out_path.read_text()
    assert "No real published cases yet" not in text
    assert "1/2 real cases" in text  # 1 of 2 agreed with its reference verdict
