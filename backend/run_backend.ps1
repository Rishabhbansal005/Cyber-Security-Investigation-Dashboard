while ($true) {
    Write-Host "Starting CCID Backend Server..." -ForegroundColor Green
    python -m uvicorn app.main:app --reload
    Write-Host "Server crashed or stopped. Restarting in 3 seconds..." -ForegroundColor Red
    Start-Sleep -Seconds 3
}
