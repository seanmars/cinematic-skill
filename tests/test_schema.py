#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest>=8", "jsonschema>=4.21"]
# ///
"""Fixture projects must satisfy the skill's JSON Schemas. Run: uv run tests/test_schema.py"""
import json
import pathlib
import sys

import pytest
from jsonschema import Draft202012Validator

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "skills" / "cinematic-video" / "schema"
DEMO = ROOT / "fixtures" / "demo"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def assert_valid(name, instance):
    schema = load(SCHEMA_DIR / f"{name}.schema.json")
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(instance), key=str)
    assert not errors, "\n".join(f"{list(e.path)}: {e.message}" for e in errors)


@pytest.mark.parametrize("name", ["storyboard", "treatments"])
def test_demo_fixture_matches_schema(name):
    assert_valid(name, load(DEMO / f"{name}.json"))


# One example per studio state file, shaped the way its single writer writes it.
STATE_EXAMPLES = {
    "gate": {
        "gateId": "003-storyboard",
        "stage": "storyboard",
        "openedAt": "2026-10-04T05:00:00.000Z",
        "autoContinue": False,
        "payload": {"summary": "12 shots, 30s"},
        "deliveredAt": "2026-10-04T05:10:00.000Z",
    },
    "reply": {
        "decision": "mix",
        "notes": "Warmer grade than A.",
        "changes": ["shots[s3].duration"],
        "choice": {"id": "A", "mix": [{"option": "C", "element": "structure"}]},
    },
    "progress": {
        "shots": {
            "s1": {"status": "done", "stills": ["qa/stills/s1-0.9.png"]},
            "s2": {"status": "building", "stills": []},
        }
    },
    "settings": {"autoContinue": ["audio", "gauntlet"]},
    "intake": {
        "slug": "a-kettle-that-sings",
        "submittedAt": "2026-10-04T05:00:00.000Z",
        "brief": "A kettle that sings the morning news",
        "specs": "15s, 1080x1920, 30fps",
        "profile": None,
        "brand": "D:/brand/kettle",
        "assets": ["D:/assets/kettle.png"],
    },
    "assignment": {
        "slug": "lunelle-promo",
        "sessionId": "baf24fd7-416c-4f59-806f-d89f9bf237db",
        "assignedAt": "2026-10-04T05:00:00.000Z",
        "reason": "intake",
    },
    "session": {
        "sessionId": "baf24fd7-416c-4f59-806f-d89f9bf237db",
        "shortId": "baf24f",
        "startedAt": "2026-10-04T05:00:00.000Z",
        "heartbeatAt": "2026-10-04T05:00:05.000Z",
        "online": True,
        "project": None,
        "activity": [
            {
                "tool": "Agent",
                "summary": "storyboard critic",
                "startedAt": "2026-10-04T05:00:01.000Z",
                "endedAt": None,
            }
        ],
    },
}


@pytest.mark.parametrize("name", sorted(STATE_EXAMPLES))
def test_state_file_example_matches_schema(name):
    assert_valid(name, STATE_EXAMPLES[name])


def test_gate_id_names_a_known_stage():
    schema = load(SCHEMA_DIR / "gate.schema.json")
    gate = {**STATE_EXAMPLES["gate"], "gateId": "3-storyboard"}
    assert not Draft202012Validator(schema).is_valid(gate)


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q", *sys.argv[1:]]))
