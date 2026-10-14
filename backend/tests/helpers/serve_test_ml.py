"""Service HTTP réel, limité aux artefacts éphémères du lanceur de tests."""
import os
import socket
import sys
from pathlib import Path

root = Path(os.environ['FITS_ISOLATED_ROOT']).resolve()
assert root.parent == Path('/private/tmp') and root.name.startswith('fits-isolated-')
assert (root / 'ISOLATED_TEST_ONLY').read_text() == 'fits-test-v1'
assert Path(os.environ['ML_MODELS_DIR']).resolve() == root / 'models'
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'ml-service'))
import uvicorn
from app import app

with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    (root / 'ml-port').write_text(str(sock.getsockname()[1]))
    uvicorn.Server(uvicorn.Config(app, log_level='warning', workers=1)).run(sockets=[sock])
