The tray icon is a separate small program (`tray.mjs`, built from `AuraTrack7-Server/tray`). Start it after you log in, the same way as the hub:

- Linux (desktops with a tray): add `node /path/to/tray.mjs` to your desktop's startup programs.
- macOS: add it to Login Items, or copy `install-macos.sh` and change the label and the file.
- Windows: put a shortcut to `node.exe "C:\path\to\tray.mjs"` in `shell:startup`.

It only talks to the hub on this computer. If your desktop has no tray, use the status page: http://localhost:8420/status
