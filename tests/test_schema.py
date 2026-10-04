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


@pytest.mark.parametrize("name", ["storyboard", "treatments"])
def test_demo_fixture_matches_schema(name):
    schema = load(SCHEMA_DIR / f"{name}.schema.json")
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(load(DEMO / f"{name}.json")), key=str)
    assert not errors, "\n".join(f"{list(e.path)}: {e.message}" for e in errors)


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q", *sys.argv[1:]]))
