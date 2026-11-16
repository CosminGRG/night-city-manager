# Fixer

A mod manager for Cyberpunk 2077 on Windows.

Drop in the archives you download from Nexus (zip, 7z or rar) and Fixer works out where every file goes. Switch a mod on and its files go into the game; switch it off and exactly those files come back out. It never touches files it didn't put there, and it backs up anything a mod would overwrite.

It also:

- shows what each mod needs (Codeware, ArchiveXL, Input Loader...) and warns when something's missing
- tells you when a mod has a newer version on Nexus, and lets you switch between versions
- compiles REDmod mods when you launch, in your mod list order
- launches the game with Steam sign-in and the overlay working
- helps you find the mod that broke your game by switching half of them off at a time
- puts the logs people ask for (CET, redscript, RED4ext) one click away

## Install

1. Download the latest zip from [Releases](../../releases) or Nexus Mods.
2. Unzip it into its own folder somewhere you can write to, like `D:\Games\Fixer`. Not Program Files.
3. Run `Fixer Mod Manager.exe`. Windows may warn you because the app isn't signed: _More info → Run anyway_.

Put it on the same drive as the game if you can. Mods then install instantly and take no extra space.

Fixer keeps everything next to the exe: settings and logs in `data`, your extracted mods in `mods`. Nothing goes into AppData or the registry.

**Updating:** unzip the new version over the old one. Your mods and settings stay.

**Uninstalling:** _Actions → Purge all_ in Fixer, so your game is clean, then delete the folder.

## Privacy

Fixer asks Nexus Mods' public API about the mods in your library, using their mod IDs only, to find requirements and updates. No account, no login, nothing else is sent. You can turn it off in Settings.

## Something broke?

Troubleshoot -> Logs -> _Fixer's own log_. Attach that file when you report a problem.

## Building it yourself

You need Node.js and npm.

```
npm install
npm run dev        # run it with live reload
npm test           # tests
npm run build:win  # portable zip in dist\
```

## Licence

GPL-3.0-or-later, see [LICENSE](LICENSE). The open-source parts Fixer includes are listed in `THIRD-PARTY-NOTICES.txt` inside the zip. 7-Zip is bundled under its own licence.
