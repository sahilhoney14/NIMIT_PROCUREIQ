# ProcureIQ Service Stopper
Write-Host "Stopping ProcureIQ services on ports 3000, 3001, 3002, 3003..." -ForegroundColor Cyan

$ports = @(3000, 3001, 3002, 3003)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $pidToKill = $conn.OwningProcess
            if ($pidToKill -and $pidToKill -ne 0) {
                Write-Host "Killing process $pidToKill listening on port $port..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
    } else {
        Write-Host "Port $port is already clear." -ForegroundColor Gray
    }
}

Write-Host "All ProcureIQ services stopped." -ForegroundColor Green
