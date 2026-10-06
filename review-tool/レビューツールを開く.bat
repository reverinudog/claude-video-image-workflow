@echo off
cd /d "%~dp0"
set PORT=5178
rem If the server is already running, just open the browser.
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if errorlevel 1 (
  rem Server runs in a minimized window. Close it to stop.
  start "review-tool server" /min cmd /k node server.mjs --port %PORT%
  timeout /t 2 >nul
)
start "" http://localhost:%PORT%
