@echo off
title Pixel OK
setlocal
cd /d "%~dp0"

set PORT=8787

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PY_CMD=py -3
) else (
    set PY_CMD=python
)

if not exist ".venv\Scripts\python.exe" (
    echo Creating local Python environment...
    %PY_CMD% -m venv .venv
    if %ERRORLEVEL% NEQ 0 (
        echo Could not create the Python environment.
        pause
        exit /b 1
    )
    set CREATED_ENV=1
)

if not defined CREATED_ENV (
    set CREATED_ENV=0
)

call ".venv\Scripts\activate.bat"

echo Installing / checking dependencies...
if "%CREATED_ENV%"=="1" (
    python -m pip install --upgrade pip
)
python -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo Dependency installation failed.
    pause
    exit /b 1
)

echo Starting Pixel OK on http://127.0.0.1:%PORT%
start "" "http://127.0.0.1:%PORT%"
python app.py
pause
