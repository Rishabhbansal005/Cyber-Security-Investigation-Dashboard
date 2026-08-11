<#
.SYNOPSIS
    Automated Forensic Evidence Acquisition Script for CCID.
.DESCRIPTION
    This script is designed for field investigators to run on a compromised Windows machine.
    It collects specific forensic artifacts (Event Logs, Browser History, System Registry, and LNK files)
    that are compatible with the CCID parsing engine, and packages them into a ZIP archive.
.NOTES
    Must be run as Administrator.
#>

# Check for Administrator privileges
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "[-] Please run this script as Administrator." -ForegroundColor Red
    Pause
    Exit
}

$Hostname = $env:COMPUTERNAME
$Timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$OutputDir = "$env:USERPROFILE\Desktop\CCID_Evidence_${Hostname}_${Timestamp}"
$ZipFile = "$env:USERPROFILE\Desktop\CCID_Evidence_${Hostname}_${Timestamp}.zip"

Write-Host "[+] Starting CCID Evidence Acquisition on $Hostname" -ForegroundColor Green
Write-Host "[+] Creating temporary collection directory: $OutputDir"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# -------------------------------------------------------------------------
# 1. Windows Event Logs (.evtx)
# -------------------------------------------------------------------------
Write-Host "[*] Collecting Event Logs (Security, System, Application)..." -ForegroundColor Cyan
$EvtxDir = Join-Path $OutputDir "EventLogs"
New-Item -ItemType Directory -Force -Path $EvtxDir | Out-Null

$LogsToCopy = @("Security.evtx", "System.evtx", "Application.evtx")
foreach ($Log in $LogsToCopy) {
    $SourcePath = "C:\Windows\System32\winevt\Logs\$Log"
    if (Test-Path $SourcePath) {
        # Using wevtutil to properly export the log (since raw copy might fail if it's locked by the system)
        $DestPath = Join-Path $EvtxDir $Log
        Write-Host "    -> Exporting $Log"
        wevtutil epl $($Log.Replace(".evtx","")) $DestPath /overwrite:true
    } else {
        Write-Host "    [-] Could not find $Log" -ForegroundColor Yellow
    }
}

# -------------------------------------------------------------------------
# 2. Browser Forensics (Chrome & Edge History) & LNK Files
# -------------------------------------------------------------------------
Write-Host "[*] Collecting Browser History and LNK Files..." -ForegroundColor Cyan
$BrowserDir = Join-Path $OutputDir "BrowserHistory"
$LnkDir = Join-Path $OutputDir "LNK_Files"
New-Item -ItemType Directory -Force -Path $BrowserDir | Out-Null
New-Item -ItemType Directory -Force -Path $LnkDir | Out-Null

$UserDirs = Get-ChildItem -Path "C:\Users" -Directory

foreach ($UserDir in $UserDirs) {
    $Username = $UserDir.Name
    
    # Chrome History
    $ChromeHistory = Join-Path $UserDir.FullName "AppData\Local\Google\Chrome\User Data\Default\History"
    if (Test-Path $ChromeHistory) {
        Write-Host "    -> Copying Chrome History for $Username"
        Copy-Item -Path $ChromeHistory -Destination (Join-Path $BrowserDir "Chrome_History_$Username.sqlite") -Force
    }

    # Edge History
    $EdgeHistory = Join-Path $UserDir.FullName "AppData\Local\Microsoft\Edge\User Data\Default\History"
    if (Test-Path $EdgeHistory) {
        Write-Host "    -> Copying Edge History for $Username"
        Copy-Item -Path $EdgeHistory -Destination (Join-Path $BrowserDir "Edge_History_$Username.sqlite") -Force
    }

    # Recent LNK files
    $RecentPath = Join-Path $UserDir.FullName "AppData\Roaming\Microsoft\Windows\Recent"
    if (Test-Path $RecentPath) {
        Write-Host "    -> Copying Recent LNK files for $Username"
        $UserLnkDir = Join-Path $LnkDir $Username
        New-Item -ItemType Directory -Force -Path $UserLnkDir | Out-Null
        Copy-Item -Path "$RecentPath\*.lnk" -Destination $UserLnkDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# -------------------------------------------------------------------------
# 3. System Registry Hive (For USB Forensics)
# -------------------------------------------------------------------------
Write-Host "[*] Saving SYSTEM Registry Hive..." -ForegroundColor Cyan
$RegDir = Join-Path $OutputDir "Registry"
New-Item -ItemType Directory -Force -Path $RegDir | Out-Null
$SystemHivePath = Join-Path $RegDir "SYSTEM.hive"

# reg save bypasses file locking
reg save HKLM\SYSTEM $SystemHivePath /y | Out-Null
Write-Host "    -> Saved SYSTEM hive"

# -------------------------------------------------------------------------
# 4. Packaging
# -------------------------------------------------------------------------
Write-Host "[*] Compressing evidence into ZIP archive..." -ForegroundColor Cyan
Compress-Archive -Path "$OutputDir\*" -DestinationPath $ZipFile -Force

Write-Host "[*] Cleaning up temporary directory..." -ForegroundColor Cyan
Remove-Item -Path $OutputDir -Recurse -Force

Write-Host "[+] Acquisition Complete!" -ForegroundColor Green
Write-Host "[+] Evidence saved to: $ZipFile" -ForegroundColor Green
Write-Host "You can now upload this ZIP file to the CCID platform."
Pause
