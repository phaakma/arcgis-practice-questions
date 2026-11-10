@echo off
rem Serves the mock exam app at http://localhost:8080 and opens it in the browser.
rem Requires Node.js (npx). Press Ctrl+C to stop the server.
cd /d "%~dp0"
npx --yes http-server . -p 8080 -c-1 -o
