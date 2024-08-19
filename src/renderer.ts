import { ipcMain, ipcRenderer } from "electron";
import { promises as fs } from 'fs';
import path from 'path';

var summaryContents: string[] = [];

ipcRenderer.on('download-complete', (event, message) => {
    console.log(message);
});

ipcRenderer.on('download-error', (event, message) => {
    console.log(message);
});

function downloadNothing() {
    const nothing = "This file contains nothing of value. Have a nice day! :D";
    const nothingBlob = new Blob([nothing], { type: 'text/plain' });
    const nothingLink = document.createElement('a');
    nothingLink.href = URL.createObjectURL(nothingBlob);
    nothingLink.download = 'nothing.txt';
    document.body.appendChild(nothingLink);
    nothingLink.click();
}

async function checkForEngine() {
    const gzdoomPath = await ipcRenderer.invoke('find-engine');
    const gzdoomStatus = document.getElementById('gzdoom');
    const summary = document.getElementById('status-summary');

    if (gzdoomPath) {
        console.log(`Found gzdoom at ${gzdoomPath}`);
        if (gzdoomStatus) {
            gzdoomStatus.innerHTML = `🟢 GZDoom found at ${gzdoomPath}`;
        }
    }
    else {
        console.log('No gzdoom found');
        if (gzdoomStatus) {
            gzdoomStatus.innerHTML = '🔴 GZDoom not found';
        }
        if (summary) {
            summaryContents.push('GZDoom was not found on your system on the PATH environment variable. Please install GZDoom yourself.');
        }
    }
}

async function checkForIWAD() {
    const iwadPath = await ipcRenderer.invoke('find-iwad');
    const iwadStatus = document.getElementById('iwad');
    const summary = document.getElementById('status-summary');

    if (iwadPath) {
        console.log(`Found iwad at ${path.join(__dirname, iwadPath)}`);
        let wadName = "DOOM II: Hell on Earth";
        if (iwadPath.includes("freedoom")) {
            wadName = "Freedoom: Phase 2";
        }
        if (iwadStatus) {
            if (await isValidIWAD(path.join(__dirname, iwadPath))) {
                iwadStatus.innerHTML = `🟢 ${wadName} is present and valid`;
            }
            else {
                iwadStatus.innerHTML = `🟡 ${wadName} is present, but header is invalid`;
                summaryContents.push(`${wadName} (${iwadPath}) is present, but the <code>IWAD</code> header could not be found. This is likely not a DOOM IWAD.`);
            }
        }
    }
    else {
        if (iwadStatus) {
            iwadStatus.innerHTML = '🔴 DOOM II-compatible IWAD (DOOM2.WAD/freedoom2.wad) not found';
        }
        if (summary) {
            const freedoomDownloadLink = await ipcRenderer.invoke('get-freedoom-link');
            const executableDir = __dirname;
            console.log(`Executable dir: ${executableDir}`);
            summaryContents.push(`DOOM II/Freedoom: Phase 2 was not found next to the Sonic: Lock &amp; Load Launcher.<br>
                                  Please place your copy of DOOM2.WAD or freedoom2.wad next to the executable.<br>
                                  <a href="${freedoomDownloadLink}" download>Click here to get the latest version of Freedoom.</a>`);
        }
    }
}

async function isValidIWAD(iwadPath: string) {
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

async function checkForGameFiles() {
    const gameFilesDir = await ipcRenderer.invoke('find-game-files');
    const gameFilesStatus = document.getElementById('gamefiles');

    if (gameFilesDir === -1) {
        if (gameFilesStatus) {
            gameFilesStatus.innerHTML = '🔴 Sonic: Lock &amp; Load needs to be downloaded';
            summaryContents.push('Sonic: Lock &amp; Load needs to be downloaded. Please download it using the link provided: [placeholder]');
        }
    }
    else if (gameFilesDir === -2) {
        if (gameFilesStatus) {
            gameFilesStatus.innerHTML = '🟡 Sonic: Lock &amp; Load folder is empty';
            summaryContents.push('The Sonic: Lock &amp; Load folder is empty. Please download it using the link provided: [placeholder]. This will overwrite the existing folder.');
        }
    }
    else if (gameFilesDir === -3) {
        if (gameFilesStatus) {
            gameFilesStatus.innerHTML = '🟡 Sonic: Lock & Load is installed but is not a Git repository';
            summaryContents.push('The Sonic: Lock &amp; Load folder is not a Git repository. Did you download it manually instead of with <code>git clone</code>?');
        }
    }
    else {
        if (gameFilesStatus) {
            gameFilesStatus.innerHTML = '🟢 Sonic: Lock &amp; Load is installed';
        }
    }
}

async function setStatus() {
    await checkForEngine();
    await checkForIWAD();
    await checkForGameFiles();
    const summary = document.getElementById('status-summary');
    if (summary != null) {
        if (summaryContents.length > 0) {
            for (const content of summaryContents) {
                console.log(content);
                summary.innerHTML += `<p>${content}</p>`;
            }
        }
        else {
            summary.innerHTML = 'Nothing to report. This area will fill with information if something goes wrong.';
        }
    }
}

async function resetStatus() {
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

document.addEventListener('DOMContentLoaded', async (event) => {
    await setStatus();

    const refreshButton = document.getElementById('status-refresh');
    if (refreshButton) {
        refreshButton.onclick = resetStatus;
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === "Escape") {
        ipcRenderer.send('close');
    }
});