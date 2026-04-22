@echo off
setlocal enabledelayedexpansion
title Antigravity - Bridge Connector

:: ============================================================
::  bridge_connector.bat
::  Portable Antigravity Bridge Connector
::
::  HOW TO USE:
::    1. Edit ORIGIN_PATH below to point to your main project
::       (the folder containing launcher.py, venv, .env, etc.)
::    2. Copy this .bat file into ANY project folder you want
::       to use as a workspace.
::    3. Double-click (or run from that folder) — the IDE will
::       open in THAT folder, backend runs from ORIGIN_PATH.
::
::  WORKSPACE_PATH = the folder this .bat FILE lives in (auto-detected via %~dp0)
::  ORIGIN_PATH    = your fixed backend/logic project folder
:: ============================================================


:: ============================================================
::  [STEP 0]  CONFIGURATION
::  !! EDIT THIS PATH to point to your main project !!
:: ============================================================

set "ORIGIN_PATH=J:\PROJECT GLOBAL PHONE CHAT"

:: %~dp0 = the directory this .bat file lives in (drive + path).
:: This is ALWAYS correct regardless of how the script is launched
:: (double-click, terminal, Task Scheduler, etc.).
:: Strip the trailing backslash so paths don't double up later.
set "WORKSPACE_PATH=%~dp0"
if "%WORKSPACE_PATH:~-1%"=="\" set "WORKSPACE_PATH=%WORKSPACE_PATH:~0,-1%"

:: Remote debugging port for Antigravity IDE
set "DEBUG_PORT=9000"


:: ============================================================
::  BANNER
:: ============================================================

color 0B
echo.
echo  ============================================================
echo    Antigravity - Bridge Connector
echo  ============================================================
echo    WORKSPACE : %WORKSPACE_PATH%
echo    ORIGIN    : %ORIGIN_PATH%
echo    DEBUG PORT: %DEBUG_PORT%
echo  ============================================================
echo.


:: ============================================================
::  [STEP 1]  PROCESS CLEANUP
::  Kill orphaned processes from any previous run to avoid port
::  conflicts and zombie tunnels.
:: ============================================================

echo  [1/5]  Cleaning up orphaned processes...
taskkill /f /im node.exe        >nul 2>&1
taskkill /f /im ngrok.exe       >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1
taskkill /f /im pinggy.exe      >nul 2>&1

:: Also free the debug port in case a previous IDE instance left it open
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%DEBUG_PORT% ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo     Done.
echo.


:: ============================================================
::  [STEP 2]  VALIDATE PATHS
:: ============================================================

echo  [2/5]  Validating paths...

if not exist "%WORKSPACE_PATH%" (
    echo  [ERROR]  WORKSPACE_PATH does not exist:
    echo           %WORKSPACE_PATH%
    echo.
    pause
    exit /b 1
)

if not exist "%ORIGIN_PATH%" (
    echo  [ERROR]  ORIGIN_PATH does not exist:
    echo           %ORIGIN_PATH%
    echo           Edit ORIGIN_PATH at the top of this script.
    echo.
    pause
    exit /b 1
)

echo     OK.
echo.


:: ============================================================
::  [STEP 3]  LAUNCH ANTIGRAVITY IDE (in the WORKSPACE folder)
::  We open a separate window so the IDE and backend run in
::  parallel. The IDE is pointed at WORKSPACE_PATH so the agent
::  enters the correct project, not the origin folder.
:: ============================================================

echo  [3/5]  Launching Antigravity IDE...
echo         Target workspace: %WORKSPACE_PATH%
echo.

start "Antigravity IDE [%WORKSPACE_PATH%]" cmd /c ^
    "cd /d "%WORKSPACE_PATH%" && antigravity "%WORKSPACE_PATH%" --remote-debugging-port=%DEBUG_PORT% && pause"

:: Brief pause so the IDE has a moment to start its debug server
:: before the backend tries to connect to it.
timeout /t 3 /nobreak >nul


:: ============================================================
::  [STEP 4]  BACKEND SETUP (from ORIGIN_PATH)
::  All backend logic lives in the origin project.
::  Switch there now for dependency checks and env validation.
:: ============================================================

echo  [4/5]  Switching to ORIGIN for backend setup...
cd /d "%ORIGIN_PATH%"
echo         CWD is now: %CD%
echo.

:: -- 4a. Check Node.js --
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR]  Node.js not found in PATH.
    echo           Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo         [OK] Node.js found.

:: -- 4b. Check Python --
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR]  Python not found in PATH.
    echo           Please install Python from https://python.org
    pause
    exit /b 1
)
echo         [OK] Python found.

:: -- 4c. Install Node dependencies if needed --
if not exist "node_modules" (
    echo         [INFO] node_modules missing — running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR]  npm install failed.
        pause
        exit /b 1
    )
)

:: -- 4d. Verify / create .env from .env.example --
if not exist ".env" (
    echo.
    echo  [WARNING]  .env file not found in ORIGIN_PATH.
    if exist ".env.example" (
        echo             Creating .env from .env.example...
        copy ".env.example" ".env" >nul
        echo             [SUCCESS] .env created.
        echo             [ACTION]  Open %ORIGIN_PATH%\.env and fill in your keys,
        echo                       then re-run this script.
        echo.
        pause
        exit /b 0
    ) else (
        echo  [ERROR]  Neither .env nor .env.example found in:
        echo           %ORIGIN_PATH%
        pause
        exit /b 1
    )
)
echo         [OK] .env configuration found.
echo.


:: ============================================================
::  [STEP 5]  LAUNCH BACKEND (Python launcher from ORIGIN_PATH)
::  Activate venv (create if missing), then run launcher.py.
:: ============================================================

echo  [5/5]  Starting backend (Phone Connect server)...
echo.

:: Create venv if it doesn't exist yet
if not exist "venv\" (
    echo         [INFO] Creating Python virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo  [ERROR]  Failed to create venv.
        pause
        exit /b 1
    )
)

:: Activate the virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else (
    echo  [WARNING]  venv\Scripts\activate.bat not found.
    echo             Proceeding with system Python — this may cause issues.
)

:: Launch the backend
python launcher.py --mode web
set LAUNCHER_EXIT=%errorlevel%

echo.
if %LAUNCHER_EXIT% neq 0 (
    echo  [ERROR]  launcher.py exited with code %LAUNCHER_EXIT%.
    echo           Check the output above for details.
) else (
    echo  [INFO]   Backend stopped cleanly.
)

echo.
echo  Press any key to close this window...
pause >nul
exit /b %LAUNCHER_EXIT%
