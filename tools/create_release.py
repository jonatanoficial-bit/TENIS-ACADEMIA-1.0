#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import json
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
BUILD_INFO = ROOT / 'build' / 'build-info.json'
TZ = ZoneInfo('America/Sao_Paulo')


def load_build_info():
    return json.loads(BUILD_INFO.read_text(encoding='utf-8'))


def save_build_info(payload):
    BUILD_INFO.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    current = load_build_info()
    version = sys.argv[1] if len(sys.argv) > 1 else current.get('version', '0.1.0')
    now = datetime.now(TZ)
    build_stamp = now.strftime('%Y%m%d-%H%M%S')
    current['version'] = version
    current['build'] = build_stamp
    current['builtAt'] = now.isoformat()
    save_build_info(current)

    archive_base = ROOT.parent / f"ace-academy-manager_v{version}_build-{build_stamp}"
    out_path = shutil.make_archive(str(archive_base), 'zip', ROOT)
    print(out_path)


if __name__ == '__main__':
    main()
