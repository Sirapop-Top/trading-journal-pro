@echo off
title AlphaTrader Startup Launcher
echo =========================================
echo   ALPHATRADER SYSTEM LAUNCHER
echo =========================================
echo.
echo [*] Initializing AlphaTrader System...
echo [*] Checking server states and booting services...
echo.

:: Change directory to where the batch script is located
cd /d "%~dp0"

:: Start the servers (this script will auto-open the web browser)
python run_servers.py

if %errorlevel% neq 0 (
    echo.
    echo [!] Error: Failed to launch AlphaTrader.
    echo [!] Please ensure Python is installed and added to your system environment variables.
    echo.
    pause
)
