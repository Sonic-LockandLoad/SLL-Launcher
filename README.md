# Sonic: Lock & Load Launcher

This is an Electron-based launcher for [Sonic: Lock & Load](https://sonic-lockandload.github.io).

This launcher is designed to facilitate easy installation of the game, the
GZDoom engine, the DOOM II IWAD, user configuration, etc.

![Sonic: Lock & Load Launcher](screenshot.png)

## Features

+ Play Sonic: Lock & Load without the hassle of setting up DOOM II
+ See your Git, GZDoom, DOOM II IWAD and Sonic: Lock & Load status
+ Download Freedoom: Phase 2 using the standard browser download dialog
+ Download Sonic: Lock & Load directly, either through GitHub Releases (latest)
or `git clone` (unstable).
+ Cross-platform support (Windows, macOS, Linux)

## Future Additions

+ Allow the user to change their Sonic: Lock & Load version
+ Supply default configurations for specific use cases

## Installation

There is no installation candidate ready yet.

You can run the launcher from source:

```sh
git clone https://github.com/Sonic-LockandLoad/SLL-Launcher.git
cd SLL-Launcher
npm install
npm start
```

To build the launcher, run:

```sh
npx electron-builder
```

and the executable will be in the `out` directory. If you can't run `electron-builder`,
run `npm install` first and try again.

## Licence

This project is licensed under the GNU General Public License, either version 3
or any later version.
