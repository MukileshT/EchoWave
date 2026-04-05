; echowave Installer (Inno Setup)
#define AppName "echowave"
#define AppVersion "0.1.0"
#define AppPublisher "Mukilesh"
#define AppExeName "echowave-launcher.exe"

#ifndef OutputDir
#define OutputDir "Output"
#endif

#ifndef OutputBaseFilename
#define OutputBaseFilename "echowave-Setup"
#endif

[Setup]
AppId={{B51AA00A-4B56-4C7E-9CC5-8B6B7B1F6E55}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={pf}\{#AppName}
DefaultGroupName={#AppName}
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
DisableProgramGroupPage=yes
; Removed oversized setup icon to avoid resource update error
; SetupIconFile removed

[Files]
Source: "..\..\dist\echowave-Portable\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch echowave"; Flags: nowait postinstall skipifsilent
