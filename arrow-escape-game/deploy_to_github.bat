@echo off
setlocal enabledelayedexpansion
title GitHub Pages Deployer - Arrow Escape Game
color 0b

echo ========================================================
echo        ARROW ESCAPE GAME - 1-CLICK GITHUB DEPLOY
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Check if git is installed
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Git aapke computer me install nahi hai.
    echo.
    echo Koi baat nahi! Sabse aasan tarika:
    echo 1. Browser me kholiye: https://github.com/new
    echo 2. Repo name daliye: arrow-escape
    echo 3. "uploading an existing file" par click karke is folder ki files drag kar dijiye!
    echo.
    pause
    exit /b
)

echo [*] Git mil gaya hai! Initializing repository...
echo.

:: 2. Initialize and commit
if not exist .git (
    git init
)
git add .
git commit -m "Arrow Escape Game - 1000 Levels Release"
git branch -M main

echo.
echo ========================================================
echo   AB GITHUB PAR REPO KA LINK DALIYE
echo ========================================================
echo.
echo 1. https://github.com/new par jaiye aur repo banaiye (e.g. arrow-escape)
echo 2. Repo ka URL copy karke yahan paste kijiye:
echo    (Jaise: https://github.com/anshm/arrow-escape.git)
echo.
set /p REPO_URL="Repo URL Paste kijiye: "

if "%REPO_URL%"=="" (
    echo [!] URL khali nahi ho sakta! Dobara chalao.
    pause
    exit /b
)

git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo.
echo [*] Pushing files to GitHub...
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo      [SUCCESS] FILES GITHUB PAR UPLOAD HO GAYI HAIN!
    echo ========================================================
    echo.
    echo Bas aakhri 1 step bacha hai live link ke liye:
    echo 1. Apne GitHub repo me Settings me jaiye
    echo 2. Left side me 'Pages' par click kijiye
    echo 3. Branch me 'main' aur folder '/ (root)' select karke Save daba dijiye!
    echo.
    echo 1 minute me aapka LIVE LINK ready ho jayega!
) else (
    echo.
    echo [!] Push karne me error aaya. Shayad login mang raha ho ya URL galat ho.
)

echo.
pause
