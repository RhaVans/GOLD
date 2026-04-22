@echo off
setlocal enabledelayedexpansion
title Antigravity - Multi-Workspace Launcher
color 0B

echo.
echo  ============================================================
echo    Antigravity Multi-Workspace Launcher
echo    Launch all your workspaces + Phone Connect in one click
echo  ============================================================
echo.

:: ================================================================
::  CONFIGURATION - Edit the paths below to match your projects
:: ================================================================
::
::  Add or remove workspaces by editing the lines below.
::  Format:  set "WSn=<full path to project folder>"
::  Ports are assigned automatically: WS1=9000, WS2=9001, etc.
::  Maximum 4 workspaces (ports 9000-9003).
::
::  Leave a workspace BLANK or comment it out to skip it.
::  Example:  set "WS3="      (skipped)
::
:: ================================================================

set "WS1=J:\PROJECT GLOBAL PHONE CHAT"
set "WS2=J:\PROJECT SUCKEN"
set "WS3=J:\PROJECT ALBANIAN"
set "WS4=J:\PROJECT LOL"

:: ================================================================
::  Optional: Set to YES to also start the Phone Connect server
::  after launching all workspaces.
:: ================================================================

set "START_SERVER=YES"

:: ================================================================
::  Optional: Seconds to wait before starting the server
::  (gives Antigravity time to fully load)
:: ================================================================

set "WAIT_SECONDS=8"

:: ================================================================
::  DO NOT EDIT BELOW THIS LINE (unless you know what you're doing)
:: ================================================================

set LAUNCHED=0
set BASE_PORT=9000

:: --- Launch Workspace 1 ---
if defined WS1 (
    if exist "!WS1!" (
        set /a PORT=BASE_PORT+0
        echo  [!PORT!]  Launching: !WS1!
        start "Antigravity - WS1 [Port !PORT!]" cmd /k "cd /d ^"!WS1!^" && antigravity . --remote-debugging-port=!PORT!"
        set /a LAUNCHED+=1
    ) else (
        echo  [SKIP]  WS1 path not found: !WS1!
    )
)

:: --- Launch Workspace 2 ---
if defined WS2 (
    if exist "!WS2!" (
        set /a PORT=BASE_PORT+1
        echo  [!PORT!]  Launching: !WS2!
        start "Antigravity - WS2 [Port !PORT!]" cmd /k "cd /d ^"!WS2!^" && antigravity . --remote-debugging-port=!PORT!"
        set /a LAUNCHED+=1
    ) else (
        echo  [SKIP]  WS2 path not found: !WS2!
    )
)

:: --- Launch Workspace 3 ---
if defined WS3 (
    if exist "!WS3!" (
        set /a PORT=BASE_PORT+2
        echo  [!PORT!]  Launching: !WS3!
        start "Antigravity - WS3 [Port !PORT!]" cmd /k "cd /d ^"!WS3!^" && antigravity . --remote-debugging-port=!PORT!"
        set /a LAUNCHED+=1
    ) else (
        echo  [SKIP]  WS3 path not found: !WS3!
    )
)

:: --- Launch Workspace 4 ---
if defined WS4 (
    if exist "!WS4!" (
        set /a PORT=BASE_PORT+3
        echo  [!PORT!]  Launching: !WS4!
        start "Antigravity - WS4 [Port !PORT!]" cmd /k "cd /d ^"!WS4!^" && antigravity . --remote-debugging-port=!PORT!"
        set /a LAUNCHED+=1
    ) else (
        echo  [SKIP]  WS4 path not found: !WS4!
    )
)

echo.

if !LAUNCHED! EQU 0 (
    echo  [ERROR]  No workspaces were launched!
    echo           Edit this .bat file and set WS1, WS2, etc. to your project paths.
    echo.
    pause
    exit /b 1
)

echo  ------------------------------------------------------------
echo    %LAUNCHED% workspace(s) launched successfully
echo  ------------------------------------------------------------

:: --- Start Phone Connect Server ---
if /i "%START_SERVER%"=="YES" (
    echo.
    echo  Waiting %WAIT_SECONDS% seconds for Antigravity to initialize...
    echo.

    :: Countdown timer
    for /l %%i in (%WAIT_SECONDS%,-1,1) do (
        <nul set /p "=  Starting server in %%i... "
        echo.
        timeout /t 1 /noq >nul
    )

    echo.
    echo  [SERVER]  Starting Phone Connect server...
    echo  ------------------------------------------------------------
    echo.

    :: Navigate to Phone Connect directory and launch
    cd /d "%~dp0"

    if not exist ".env" (
        if exist ".env.example" (
            echo  [INFO]  .env not found. Creating from .env.example...
            copy .env.example .env >nul
        )
    )

    if not exist "venv\" (
        echo  [INFO]  Creating Python virtual environment...
        python -m venv venv
    )
    if exist "venv\Scripts\activate.bat" (
        call venv\Scripts\activate.bat
    )

    python launcher.py --mode web

    echo.
    echo  [INFO]  Server stopped. Press any key to exit.
    pause >nul
) else (
    echo.
    echo  [INFO]  Server auto-start is OFF.
    echo           Run start_ag_phone_connect.bat manually to connect.
    echo.
    pause
)
