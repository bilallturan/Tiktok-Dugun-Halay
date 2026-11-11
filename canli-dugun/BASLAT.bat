@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem 0) Node.js var mi? Paketler kurulu mu? (ilk acilista otomatik kurar)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurup tekrar dene.
  echo.
  pause
  exit /b
)
if not exist node_modules (
  echo  Ilk acilis: gerekli paketler kuruluyor, 1-2 dakika surebilir...
  call npm install --no-audit --no-fund
)
title Canli Dugun

rem 1) Sunucu (ayri pencerede; kapatirsan sistem durur)
start "Canli Dugun - SUNUCU (kapatma)" cmd /k node server.js
timeout /t 2 /nobreak >nul

rem 2) Sahne penceresi: kenarliksiz, dikey 9:16. TikTok LIVE Studio'da BU pencereyi yakala.
rem    Ayri profil + autoplay izni: muzik tiklamadan baslar.
set "SAHNE=http://localhost:3000/?clean"
set "PROFIL=%~dp0.sahne-tarayici"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
start "" "%CHROME%" --app="%SAHNE%" --user-data-dir="%PROFIL%" --window-size=608,1080 --window-position=0,0 --autoplay-policy=no-user-gesture-required --no-first-run --no-default-browser-check

rem 3) Kontrol paneli (normal tarayicinda; bunu YAYINA VERME)
start "" "http://localhost:3000/"
