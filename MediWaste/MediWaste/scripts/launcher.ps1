# MedWaste VerifyPoint - launcher helpers (invoked by the .bat scripts).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\launcher.ps1 <command> [args]

param(
  [string]$Command = "help",
  [string]$Arg1 = ""
)

function Test-PortOpen {
  param([int]$Port)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ready = $async.AsyncWaitHandle.WaitOne(600)
    if (-not $ready) { $client.Close(); return $false }
    $client.EndConnect($async)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

switch ($Command.ToLower()) {
  "port-open" {
    if (Test-PortOpen -Port ([int]$Arg1)) { Write-Output "open" } else { Write-Output "closed" }
    exit 0
  }
  "free-port" {
    for ($p = 3000; $p -le 3010; $p++) {
      if (-not (Test-PortOpen -Port $p)) { Write-Output $p; exit 0 }
    }
    Write-Output 3000
    exit 0
  }
  default {
    Write-Output "commands: port-open <port> | free-port"
    exit 2
  }
}
