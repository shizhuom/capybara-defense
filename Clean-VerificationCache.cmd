@echo off
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Clean-VerificationCache.ps1"
if errorlevel 1 pause
