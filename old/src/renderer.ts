import { ipcRenderer, shell } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

const appDataDir = ipcRenderer.invoke('get-root-path');

var summaryContents: string[] = [];

var isDownloading: boolean = false;
var canPlayGame: boolean = false;

ipcRenderer.on('download-complete', (event, message) => {
    console.log(message);
});

ipcRenderer.on('download-error', (event, message) => {
    console.log(message);
});

async function downloadGame(downloadLink?: string) {
    if (downloadLink) {
        await ipcRenderer.invoke('download-file', "./Sonic-LockandLoad.pk3", downloadLink);
    }
}

async function cloneGame(gitLink?: string) {
    if (gitLink) {
        await ipcRenderer.invoke('clone-repo', "Sonic-LockandLoad", gitLink);
    }
}

async function checkForEngine(): Promise<boolean> {
    const gzdoomPath = await ipcRenderer.invoke('find-engine');
    const gzdoomStatus = document.getElementById('gzdoom');
    const summary = document.getElementById('status-summary');

    if (gzdoomPath) {
        console.log(`Found gzdoom at ${gzdoomPath}`);
        if (gzdoomStatus) {
            gzdoomStatus.innerHTML = `✅ GZDoom found at ${gzdoomPath}`;
        }
        return true;
    }
    else {
        console.log('No gzdoom found');
        if (gzdoomStatus) {
            gzdoomStatus.innerHTML = '⛔ GZDoom not found';
        }
        if (summary) {
            if (process.platform === 'win32') {
                summaryContents.push(`GZDoom was not found on your system. Please download GZDoom and place it inside <code>${await appDataDir}</code>.`);
            }
            else if (process.platform === 'linux') {
                summaryContents.push(`GZDoom was not found on your system. Please install GZDoom using your package manager or <a href="#" onclick="shell.openPath('https://flathub.org/apps/org.zdoom.GZDoom')">install the Flatpak from Flathub</a>.`);
            }
            else if (process.platform === 'darwin') {
                summaryContents.push(`GZDoom was not found on your system. Please download GZDoom and place it inside your Applications folder.`);
            }
            else {
                summaryContents.push(`GZDoom was not found on your system. Please check to make sure you can run <code>gzdoom</code> from the command line.`);
            }
        }
    }

    return false;
}

async function checkForGit(): Promise<boolean> {
    const gitPath = await ipcRenderer.invoke('find-git');
    const gitStatus = document.getElementById('git');
    const summary = document.getElementById('status-summary');

    if (gitPath) {
        console.log(`Found git at ${gitPath}`);
        if (gitStatus) {
            gitStatus.innerHTML = `✅ Git found at ${gitPath}`;
            return true;
        }
    }
    else {
        console.log('No git found');
        if (gitStatus) {
            gitStatus.innerHTML = '⛔ Git not found';
        }
        if (summary) {
            summaryContents.push('Git was not found on your system on the PATH environment variable. Please download and install Git from <a href="#" onclick="require(\'electron\').shell.openExternal(\'https://git-scm.com/download\')">https://git-scm.com/</a>.');
        }
    }

    return false;
}

async function checkForIWAD(): Promise<boolean> {
    const iwadPath = await ipcRenderer.invoke('find-iwad');
    const iwadStatus = document.getElementById('iwad');
    const summary = document.getElementById('status-summary');

    if (iwadPath) {
        console.log(`Found iwad at ${path.join(await appDataDir, iwadPath)}`);
        let wadName = "DOOM II: Hell on Earth";
        if (iwadPath.includes("freedoom")) {
            wadName = "Freedoom: Phase 2";
        }
        if (iwadStatus) {
            if (await isValidIWAD(path.join(await appDataDir, iwadPath))) {
                iwadStatus.innerHTML = `✅ ${wadName} is present and valid`;
                return true;
            }
            else {
                iwadStatus.innerHTML = `⚠️ ${wadName} is present, but header is invalid`;
                summaryContents.push(`${wadName} (${iwadPath}) is present, but the <code>IWAD</code> header could not be found. This is likely not a DOOM IWAD.`);
            }
        }
    }
    else {
        if (iwadStatus) {
            iwadStatus.innerHTML = '⛔ DOOM II-compatible IWAD (DOOM2.WAD/freedoom2.wad) not found';
        }
        if (summary) {
            const configDir = await appDataDir;
            const configDirShort = configDir.replace(/\/home\/[^\/]+/, '~');
            console.log(`Executable dir: ${configDir}`);
            summaryContents.push(`DOOM II/Freedoom: Phase 2 was not found in the data folder. Please place your copy of <code>DOOM2.WAD</code> or <code>freedoom2.wad</code> in <code>${configDirShort}</code>. Click the "Open Data Folder" button below to open this folder.<br>
                                  <a href="#" onclick="require('electron').shell.openExternal('https://freedoom.github.io/download')">You can get Freedoom: Phase 1+2 from freedoom.github.io.</a> After your download, unzip the folder and place <code>freedoom2.wad</code> inside the data folder.`);
        }
    }

    return false;
}

async function isValidIWAD(iwadPath: string): Promise<boolean> {
    try {
        const fileHandle = await fs.open(iwadPath, 'r');
        const buffer = Buffer.alloc(4);
        await fileHandle.read(buffer, 0, 4, 0);
        await fileHandle.close();

        const header = buffer.toString('ascii');
        console.log(header);

        return header === 'IWAD';
    }
    catch (error) {
        console.error(error);
        return false;
    }
}

async function checkForGameFiles(): Promise<boolean> {
    const gameFiles = await ipcRenderer.invoke('find-game-files');
    const gameFilesStatus = document.getElementById('gamefiles');

    const gameFilesDir = gameFiles[0];
    const gameFilesCode = gameFiles[1];

    const gameFilesDirShort = gameFilesDir.replace(/\/home\/[^\/]+/, '~');

    if (isDownloading) {
        if (gameFilesStatus) {
            gameFilesStatus.innerHTML = '⏳ Sonic: Lock &amp; Load is being downloaded, please wait...';
        }
        return false;
    }

    if (gameFilesCode === -1) {
        if (gameFilesStatus) {
            gameFilesStatus.innerHTML = '⚠️ Sonic: Lock &amp; Load needs to be downloaded';
            summaryContents.push('Sonic: Lock &amp; Load\'s game files are not present and needs to be downloaded.<br>Please use one of the "Download Sonic: Lock &amp; Load" options under <strong>Manage Game</strong> to download it.');
        }
    }
    else if (gameFilesCode === -2) {
        if (gameFilesStatus) {
            gameFilesStatus.innerHTML = '⚠️ Sonic: Lock &amp; Load folder is empty';
            summaryContents.push('The Sonic: Lock &amp; Load folder is empty and needs to be redownloaded.<br>Please use one of the "Download Sonic: Lock &amp; Load" options under <strong>Manage Game</strong> to redownload it.');
        }
    }
    else if (gameFilesCode === -3) {
        if (gameFilesStatus) {
            gameFilesStatus.innerHTML = `⚠️ Sonic: Lock & Load folder present at ${gameFilesDirShort} but does not include GAMEINFO`;
            summaryContents.push(`The Sonic: Lock &amp; Load folder at ${gameFilesDirShort} does not include <code>GAMEINFO.txt</code>.<br>Is this really a version of Sonic: Lock &amp; Load? You may try to redownload the game using one of the "Download Sonic: Lock &amp; Load" options under <strong>Manage Game</strong>.`);
            return true;
        }
    }
    else {
        if (gameFilesStatus) {
            gameFilesStatus.innerHTML = `✅ Sonic: Lock &amp; Load is installed at ${gameFilesDirShort}`;
            return true;
        }
    }

    return false;
}

async function removeExistingGameFiles() {
    const gameFiles: [string, number] = await ipcRenderer.invoke('find-game-files');
    const gameFilesDir = gameFiles[0];
    const gameFilesCode = gameFiles[1];
    await ipcRenderer.invoke('log', `Game files are ${gameFilesDir}`);
    if (gameFilesCode !== -1) {
        console.log(`Removing ${gameFilesDir}`);
        await fs.rm(gameFilesDir, { recursive: true, force: true });
    }
}

async function updateSummary() {
    const summary = document.getElementById('status-summary');
    if (summary != null) {
        if (summaryContents.length > 0) {
            for (const content of summaryContents) {
                console.log(content);
                summary.innerHTML += `<p>${content}</p>`;
            }
        }
    }
}

async function setStatus() {
    const gitStatus = await checkForGit();
    const engineStatus = await checkForEngine();
    const iwadStatus = await checkForIWAD();
    const gameStatus = await checkForGameFiles();

    if (gitStatus && engineStatus && iwadStatus && gameStatus) {
        canPlayGame = true;
    }
    else {
        canPlayGame = false;
    }

    const openFolderButton = document.getElementById('open-folder') as HTMLButtonElement;

    if (openFolderButton) {
        openFolderButton.onclick = async () => {
            await shell.openPath(await appDataDir);
        }
    }

    const playButton = document.getElementById('play-game') as HTMLButtonElement;
    const downloadButton1 = document.getElementById('downloadGameFiles') as HTMLButtonElement;
    const downloadButton2 = document.getElementById('downloadGameFiles2') as HTMLButtonElement;

    if (playButton) {
        playButton.disabled = !canPlayGame;
    }

    if (downloadButton1 && downloadButton2) {
        downloadButton1.disabled = isDownloading;
        downloadButton2.disabled = isDownloading;
    }

    const gameVersionObj = document.getElementById('game-version');
    if (gameVersionObj) {
        gameVersionObj.innerHTML = await ipcRenderer.invoke('get-game-version') || "Indeterminate";
    }

    await updateSummary();
}

async function resetStatus() {
    const summary = document.getElementById('status-summary');
    if (summary) {
        summary.innerHTML = '';
    }
    summaryContents = [];
    const gzdoomStatus = document.getElementById('gzdoom');
    const iwadStatus = document.getElementById('iwad');
    const gameFilesStatus = document.getElementById('gamefiles');
    if (gzdoomStatus && iwadStatus && gameFilesStatus) {
        gzdoomStatus.innerHTML = '⏱️ Pending GZDoom executable location';
        iwadStatus.innerHTML = '⏱️ Pending DOOM II: Hell on Earth IWAD location';
        gameFilesStatus.innerHTML = '⏱️ Pending Sonic: Lock &amp; Load game files installation';
    }
    console.clear();
    await setStatus();
}

async function confirmOverwrite(): Promise<boolean> {
    const gameFiles = await ipcRenderer.invoke('find-game-files');
    const gameFilesDir = gameFiles[0];
    const gameFilesCode = gameFiles[1];
    
    // Game files exist
    if (gameFilesCode === 0) {
        let proceed: number = await ipcRenderer.invoke(
            'confirm-overwrite',
            `Sonic: Lock & Load already exists at ${gameFilesDir}. Downloading Sonic: Lock & Load will overwrite the existing files. Are you sure you want to continue?`,
            ['Yes, delete files and redownload', 'No, cancel']
        );
        if (proceed === 0) {
            return true;
        }
    }
    // Game files do not exist or are invalid
    else {
        return true;
    }

    // In the event valid game files were found but the user cancelled
    return false;
}

document.addEventListener('DOMContentLoaded', async (event) => {
    await resetStatus();

    const refreshButton = document.getElementById('status-refresh');
    if (refreshButton) {
        refreshButton.onclick = resetStatus;
    }

    const downloadGameLink = document.getElementById('downloadGameFiles');
    const downloadGameLink2 = document.getElementById('downloadGameFiles2');
    const downloadLink = await ipcRenderer.invoke('get-sll-link');
    if (downloadGameLink) {
        downloadGameLink.onclick = async () => {
            const overwrite: boolean = await confirmOverwrite();
            if (!overwrite) {
                return;
            }
            isDownloading = true;
            await removeExistingGameFiles();
            await resetStatus();
            await downloadGame(downloadLink);
        };
        ipcRenderer.on("file-downloaded", async () => {
            isDownloading = false;
            await resetStatus();
        });
    }
    if (downloadGameLink2) {
        downloadGameLink2.onclick = async () => {
            const overwrite: boolean = await confirmOverwrite();
            if (!overwrite) {
                return;
            }
            isDownloading = true;
            await removeExistingGameFiles();
            await resetStatus();
            await cloneGame("https://github.com/Sonic-LockandLoad/Sonic-LockandLoad.git");
        };
        ipcRenderer.on("repo-cloned", async () => {
            isDownloading = false;
            await resetStatus();
        });
    }

    const playButton = document.getElementById('play-game') as HTMLButtonElement;
    if (playButton) {
        playButton.onclick = async () => {
            if (canPlayGame) {
                await ipcRenderer.invoke('launch-game');
            }
        };
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === "Escape") {
        ipcRenderer.send('close');
    }
});