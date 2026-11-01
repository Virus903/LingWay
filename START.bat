@echo off
cd /d "%~dp0"
dotnet run --project src\LingWay.Web --launch-profile http
pause
