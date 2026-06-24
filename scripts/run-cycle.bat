@echo off
REM DealerHunt — self-updating scrape cycle for the Windows scraper box.
REM Point Windows Task Scheduler at THIS file (e.g. every 30 minutes). It pulls the latest code,
REM installs any new deps, then runs one scrape cycle. New parser fixes deploy themselves — you
REM never have to remote in to update again.

cd /d "%~dp0.."

echo [%date% %time%] Pulling latest code...
git pull --rebase --autostash origin main

echo [%date% %time%] Installing deps (fast when unchanged)...
call npm install --no-audit --no-fund --silent

echo [%date% %time%] Running scrape cycle...
call npm run scrape:ci

echo [%date% %time%] Cycle done.
