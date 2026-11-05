@echo off
cd /d "%~dp0"
title Love Museum
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
