import os
from fastapi.testclient import TestClient
import importlib


def test_health():
	tb = importlib.import_module('src.toolbelt.server')
	client = TestClient(tb.app)
	r = client.get('/health')
	assert r.status_code == 200
	assert r.json().get('status') == 'ok'


def test_cursor_click_logs_and_token(tmp_path, monkeypatch):
	# Ensure logs are written to an isolated temp logs dir
	logdir = tmp_path / 'logs'
	logdir.mkdir()
	monkeypatch.setenv('TOOLBELT_LOG_DIR', str(logdir))
	# Import module after env override so LOG_DIR is respected
	tb = importlib.reload(importlib.import_module('src.toolbelt.server'))
	client = TestClient(tb.app)
	r = client.post('/cursor/click', json={'x': None, 'y': None, 'button': 'left'})
	assert r.status_code == 200
	j = r.json()
	assert j.get('ok') is True
	assert 'decision_token' in j
