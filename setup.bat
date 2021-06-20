@echo off
>nul 2>nul call npm -v && echo Node JS installed && npm i
if errorlevel 1 echo ERROR: NPM not installed please go to https://nodejs.org/ and download Node JS
pause
