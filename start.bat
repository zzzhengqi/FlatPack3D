@echo off
chcp 65001 >nul
rem FlatPack3D: double-click to start the local server and open the browser.
rem Needs Node.js 22+ (https://nodejs.org). Falls back to Python if Node is missing.
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node scripts\serve.js 8137 --open
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8137/
  python -m http.server 8137
  goto :eof
)
echo Node.js or Python is required. Please install Node.js 22+ from https://nodejs.org
pause
