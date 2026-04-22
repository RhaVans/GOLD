@echo off
title Antigravity - Debug Mode Launcher
echo ===================================================
echo   Antigravity - Debug Mode Launcher
echo ===================================================
echo.
echo This will launch Antigravity with remote debugging
echo enabled so Phone Connect can control it.
echo.

set /p "PORT_NUM=Debug port (default 9000): "
if "%PORT_NUM%"=="" set PORT_NUM=9000

echo.
echo [LAUNCHING] antigravity . --remote-debugging-port=%PORT_NUM%
echo.

antigravity . --remote-debugging-port=%PORT_NUM%

echo.
echo [INFO] Antigravity closed. Press any key to exit.
pause >nul
