@echo off
rem BehaviorTree.java Academy launcher (Windows)
cd /d "%~dp0"
echo Serving BehaviorTree.java Academy on http://localhost:8420 ...
start "" http://localhost:8420/
python -m http.server 8420
