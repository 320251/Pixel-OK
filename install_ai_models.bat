@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Run start.bat once before installing optional AI models.
    pause
    exit /b 1
)

call ".venv\Scripts\activate.bat"
echo Installing optional AI models. This can take a long time.
python -m pip install -r requirements-ai.txt
if %ERRORLEVEL% NEQ 0 (
    echo Demucs installation failed.
    pause
    exit /b 1
)

echo Demucs is installed.
pause
