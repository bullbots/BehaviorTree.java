#!/usr/bin/env bash
# BehaviorTree.java Academy launcher (Linux/macOS)
cd "$(dirname "$0")"
echo "Serving BehaviorTree.java Academy on http://localhost:8420 ..."
( sleep 1; xdg-open http://localhost:8420/ 2>/dev/null || open http://localhost:8420/ 2>/dev/null ) &
python3 -m http.server 8420 2>/dev/null || python -m http.server 8420
