# EchoWave (Offline Edition)

EchoWave is a collaborative music listening platform. This version runs fully offline and can be self-hosted on your local network.

Author: Mukilesh
GitHub: [MukileshT](https://github.com/MukileshT)

## Features

- Join or create 6-digit listening rooms
- Sync playback across multiple devices on the same network
- Stream local audio files from the server
- Share chat, room state, and playback controls in real time
- Optional spatial audio and queue management
- Windows launcher and installer support for easy sharing

## Quick Start

### Install

```bash
npm install
```

### Add Music

Edit [`apps/server/data/songs.json`](apps/server/data/songs.json) and add your local tracks using absolute file paths.

### Run

Start the backend:

```bash
cd apps/server
npm run dev
```

Start the frontend in a second terminal:

```bash
cd apps/client
npm run dev
```

Open the app at:

- `http://localhost:3000`
- or `http://<your-lan-ip>:3000` from other devices on the same network

### Build

To create the Windows launcher EXE:

```bash
npm run package:launcher
```

## Prerequisites

- **Node.js**: v20 or higher
- **npm**: (usually comes with Node.js)

## Production (Windows EXE launcher)

This creates a single Windows executable that installs dependencies, builds both apps, and starts the server/client together.

### Build the launcher

```bash
npm install
npm run package:launcher
```

This outputs `echowave-launcher.exe` in the repo root.

### Run

Double-click `echowave-launcher.exe` (keep it in the repo root). It will:

1. Install dependencies (first run only)
2. Build the server and client
3. Start both in production mode

## Windows Installer (for sharing)

If you want a real installer (Start Menu entry, optional desktop shortcut), build the portable bundle and then compile the installer with Inno Setup.

### 1) Build portable bundle

```bash
npm install
npm run package:launcher
```

Then create the portable zip by running the bundling step in PowerShell (already done in this repo):

```powershell
$repo=(Get-Location).Path
$outDir=Join-Path $repo "dist\EchoWave-Portable"
if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
New-Item -ItemType Directory -Path $outDir | Out-Null
robocopy $repo $outDir /E /XD node_modules .next .turbo .git dist apps\client\node_modules apps\server\node_modules apps\client\.next apps\server\storage /XF *.log *.tmp /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
Copy-Item -LiteralPath (Join-Path $repo "echowave-launcher.exe") -Destination $outDir -Force
Compress-Archive -Path $outDir\* -DestinationPath (Join-Path $repo "dist\EchoWave-Portable.zip") -Force
```

### 2) Build installer (Inno Setup)

Install Inno Setup 6, then run:

```powershell
tools\installer\build-installer.ps1
```

This produces `EchoWave-Setup.exe`. Share that file.

## Troubleshooting

- **Connection Refused**: Ensure the server is running on port 8080. Check the console for startup logs.
- **Music Not Playing**:
    - Verify the paths in `songs.json` are correct and accessible.
    - Check the server logs for "Song not found" or "Stream error".
- **Firewall**: If connecting from other devices, ensure your firewall allows traffic on ports 3000 and 8080 (or just allow Node.js).
