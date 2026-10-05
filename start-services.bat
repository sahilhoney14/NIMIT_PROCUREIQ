@echo off
title ProcureIQ Unified Server
echo ===================================================
echo           Starting ProcureIQ Server
echo ===================================================
echo Access the application at: http://localhost:3000
echo.

cd /d %~dp0backend
node server.js
pause
