import os
import json
from pathlib import Path

def load_env():
	cfg = {}
	cfg['TOOLBELT_LOG_DIR'] = os.getenv('TOOLBELT_LOG_DIR')
	cfg['TOOLBELT_PRIV_KEY'] = os.getenv('TOOLBELT_PRIV_KEY')
	cfg['TOOLBELT_PUB_RAW'] = os.getenv('TOOLBELT_PUB_RAW')
	cfg['FEATURE_OS_INTEGRATION'] = os.getenv('FEATURE_OS_INTEGRATION', 'false').lower() in ('1','true','yes')
	cfg['LUCY_CONSENT_PATH'] = os.getenv('LUCY_CONSENT_PATH') or str(Path.home() / '.lucy_consent.json')
	return cfg

def read_consent(path=None):
	p = path or load_env().get('LUCY_CONSENT_PATH')
	try:
		with open(p,'r',encoding='utf-8') as f:
			return json.load(f)
	except Exception:
		return {'os_integration': False}

def save_consent(obj, path=None):
	p = path or load_env().get('LUCY_CONSENT_PATH')
	try:
		with open(p,'w',encoding='utf-8') as f:
			json.dump(obj,f,indent=2)
		return True
	except Exception:
		return False
