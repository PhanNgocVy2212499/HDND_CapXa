@echo off
chcp 65001 >nul
title Cai dat thu vien - HDND Xa

echo ============================================
echo  CAI DAT THU VIEN CAN THIET DE CHAY DU AN
echo ============================================
echo.

REM 1. Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [LOI] Chua cai Node.js ^>= 18. Tai tai: https://nodejs.org
  pause
  exit /b 1
)
echo [1/3] Node.js:
node -v
npm -v
echo.

REM 2. Cai backend
echo [2/3] Dang cai thu vien backend...
cd /d "%~dp0backend"
if not exist package.json (
  echo [LOI] Khong tim thay backend\package.json
  pause
  exit /b 1
)
call npm install
if %errorlevel% neq 0 (
  echo [LOI] Cai backend that bai. Thu xoa node_modules va cai lai.
  pause
  exit /b 1
)
echo  --^> Xong backend.
echo.

REM Tu dong tao .env neu chua co
if not exist .env (
  if exist .env.example (
    echo  --^> Chua co .env, dang copy tu .env.example...
    copy .env.example .env >nul
    echo  --^> Da tao backend\.env. NHO MO LEN DIEN 4 BIEN FIREBASE that.
  )
)
echo.

REM 3. Cai frontend
echo [3/3] Dang cai thu vien frontend...
cd /d "%~dp0frontend"
if not exist package.json (
  echo [LOI] Khong tim thay frontend\package.json
  pause
  exit /b 1
)
call npm install
if %errorlevel% neq 0 (
  echo [LOI] Cai frontend that bai.
  pause
  exit /b 1
)
echo  --^> Xong frontend.
echo.

echo ============================================
echo  CAI DAT XONG!
echo  Chay backend : cd backend ^&^& npm run dev
echo  Chay frontend: cd frontend ^&^& npm run dev
echo ============================================
pause
