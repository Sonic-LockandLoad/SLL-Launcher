# Sonic: Lock & Load Launcher

This is an Electron-based launcher for [Sonic: Lock & Load](https://sonic-lockandload.github.io).

This launcher is designed to facilitate easy installation of the game, the
GZDoom engine, the DOOM II IWAD, user configuration, etc.

## Objectives

+ [X] Create a basic Electron app with a launcher-like GUI and structure
+ [X] Check for Git on the user's system
+ [X] Check for GZDoom on the user's system
  + [X] If it's not found, prompt the user to download and install it themselves
+ [X] Prompt the user to place their DOOM II IWAD next to the executable
+ [X] Interface with the [Sonic: Lock & Load repo on GitHub](https://github.com/Sonic-LockandLoad/Sonic-LockandLoad) and its [releases](https://github.com/Sonic-LockandLoad/Sonic-LockandLoad/releases)
+ [X] Install the game to a sensible location
+ [X] Allow the game to be launched
+ [ ] For Windows, create a Start Menu shortcut
+ [ ] For Linux, create a Desktop Entry and place it in `~/.local/share/applications`
+ [ ] Allow the user to change their Sonic: Lock & Load version
+ [ ] Supply default configurations for specific use cases

## Installation

There is no installation candidate ready yet.

You can run the launcher from source:

```sh
git clone https://github.com/Sonic-LockandLoad/SLL-Launcher.git
cd SLL-Launcher
npm install
npm start
```

## Licence

This project is licensed under the GNU General Public License, either version 3
or any later version.
