import subprocess
from pathlib import Path


def test_typesync_idempotent():
    # File hierarchy: fks/repo/shared/python/tests/test_typesync.py
    # Generator:      fks/repo/shared/scripts/typesync/generate.py
    # parents[0]=tests, 1=python, 2=shared, 3=repo
    script = Path(__file__).parents[2] / "scripts" / "typesync" / "generate.py"
    script = script.resolve()
    subprocess.check_call(["python", str(script)])
    result = subprocess.run(["python", str(script), "--check"], capture_output=True)
    assert result.returncode == 0, f"typesync not idempotent. stdout={result.stdout.decode()} stderr={result.stderr.decode()}"
