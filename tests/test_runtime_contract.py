import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from app.db import SessionLocal
from app.generated.runtime_contract import Toolcall, Workflownode
from app.models import Run as RunModel
from app.runtime import RUN_TERMINAL, RUN_TRANSITIONS, transition_run


def test_runtime_contract_schema_is_valid_and_generated_types_are_current():
    root = Path(__file__).resolve().parents[1]
    schema = json.loads((root / "project/docs/schemas/runtime-contract.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    assert __import__("subprocess").run(
        ["python", "scripts/generate_contract_types.py", "--check"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    ).returncode == 0


@pytest.mark.parametrize(
    ("current", "allowed"),
    [(key, target) for key, targets in RUN_TRANSITIONS.items() for target in targets],
)
def test_run_state_machine_declares_documented_transitions(current, allowed):
    assert allowed in RUN_TRANSITIONS[current]


@pytest.mark.parametrize("terminal", sorted(RUN_TERMINAL))
def test_terminal_run_states_have_no_outgoing_transitions(terminal):
    assert terminal not in RUN_TRANSITIONS


def test_tool_and_workflow_contract_types_expose_state_literals():
    assert Toolcall.__annotations__["status"].__args__
    assert Workflownode.__annotations__["status"].__args__
    assert set(RUN_TERMINAL) == {"completed", "failed", "cancelled", "timed_out", "budget_exceeded"}
    assert "succeeded" in {"succeeded", "rejected", "expired", "permanently_failed", "timed_out"}


def test_transition_run_is_idempotent_for_same_state_and_rejects_terminal_change():
    with SessionLocal() as db:
        run = db.query(RunModel).first()
        if run is None:
            pytest.skip("seeded run unavailable")
        run.status = "accepted"
        db.commit()
        assert transition_run(db, run, "accepted") is True
        run.status = "completed"
        with pytest.raises(ValueError, match="INVALID_STATE_TRANSITION"):
            transition_run(db, run, "running")
