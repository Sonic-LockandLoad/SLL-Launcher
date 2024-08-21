import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import simpleGit, { SimpleGit } from 'simple-git';
import { spawn } from 'child_process';

const git: SimpleGit = simpleGit();

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'renderer.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.loadFile(path.join(__dirname, 'index.html'));

    ipcMain.handle('log', (event, message) => {
        console.log(message);
    });

    ipcMain.handle('find-git', () => {
        return findExecutable('git');
    });

    ipcMain.handle('find-engine', () => {
        return findExecutable('gzdoom');
    });

    ipcMain.handle('find-iwad', () => {
        return findFileCaseInsensitive('DOOM2.WAD') || findFileCaseInsensitive('freedoom2.wad');
    });

    function findGameDir(): string | number {
        const filePath = path.join(__dirname, 'Sonic-LockandLoad');
        if (fs.existsSync(filePath)) {
            if (fs.readdirSync(filePath).length === 0) {
                console.log(`Directory ${filePath} is empty`);
                return -2;
            }
            else {
                if (!fs.existsSync(path.join(filePath, '.git'))) {
                    return -3;
                }
                else {
                    return filePath;
                }
            }
        }

        return -1;
    }

    function findGamePK3(): string | null {
        const filePath = path.join(__dirname, 'Sonic-LockandLoad.pk3');
        if (fs.existsSync(filePath)) {
            return filePath;
        }

        return null;
    }

    ipcMain.handle('find-game-files', (): string | number => {
        const gameFile = findGamePK3();
        const gameDir = findGameDir();

        if (gameFile) {
            return gameFile;
        }
        return gameDir;
    });

    ipcMain.handle('get-freedoom-link', async (): Promise<string | null> => {
        const releaseUrl = "https://api.github.com/repos/freedoom/freedoom/releases/latest";
        
        try {
            const response = await axios.get(releaseUrl, {
                headers: {
                    "Accept": "application/vnd.github.v3+json"
                }
            });

            const data = response.data;

            if (data.assets && data.assets.length > 0) {
                for (const asset of data.assets) {
                    if (asset.name.startsWith("freedoom-") && asset.name.endsWith(".zip")) {
                        const downloadUrl = await asset.browser_download_url;
                        return downloadUrl;
                    }
                }
            }

            console.error("Can't find Freedoom download link");
        }
        catch (error) {
            console.error(error);
        }

        return null;
    });

    ipcMain.handle('get-sll-link', async (): Promise<string | null> => {
        const releaseUrl = "https://api.github.com/repos/Sonic-LockandLoad/Sonic-LockandLoad/releases/latest";

        try {
            const response = await axios.get(releaseUrl, {
                headers: {
                    "Accept": "application/vnd.github.v3+json"
                }
            });

            const data = response.data;

            if (data.assets && data.assets.length > 0) {
                for (const asset of data.assets) {
                    if (asset.name.startsWith("Sonic-LockandLoad-") && asset.name.endsWith(".pk3")) {
                        const downloadUrl = await asset.browser_download_url;
                        return downloadUrl;
                    }
                }
            }

            console.error("Can't find Sonic: Lock & Load download link");
        }
        catch (error) {
            console.error(error);
        }

        return null;
    });

    ipcMain.handle('download-file', async (event, destination, url) => {
        const filePath = path.join(__dirname, destination);
        console.log(`Downloading ${url} to ${filePath}`);
        try {
            const writer = fs.createWriteStream(filePath);

            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
            });

            response.data.pipe(writer);

            writer.on('finish', () => {
                console.log(`Downloaded ${url} to ${filePath}`);
                event.sender.send('file-downloaded', filePath);
            });

            writer.on('error', (error) => {
                console.error(error);
                fs.unlinkSync(filePath);
                event.sender.send('file-error', error); 
            });
        }
        catch (error) {
            console.error(error);
            event.sender.send('file-error', error);
        }
    });

    ipcMain.handle('clone-repo', async (event, destination, url) => {
        const filePath = path.join(__dirname, destination);
        console.log(`Cloning ${url} to ${filePath}`);
        try {
            await git.clone(url, filePath).then(() => {
                console.log(`Cloned ${url} to ${filePath}`);
                event.sender.send('repo-cloned', filePath);
            });
        }
        catch (error) {
            console.error(error);
            event.sender.send('clone-error', error);
        }
    });

    ipcMain.handle('launch-game', async () => {
        const gzdoomExecutable = findExecutable('gzdoom');
        const doom2iwad = findFileCaseInsensitive('doom2.wad') || findFileCaseInsensitive('freedoom2.wad');
        const gameFile = findGamePK3() || findGameDir();

        if (gzdoomExecutable && doom2iwad && gameFile) {
            const execString = `${gzdoomExecutable} -iwad ${doom2iwad} -file ${gameFile}`;
            console.log(`Running command \`${execString}\``);
            spawn(gzdoomExecutable, ['-iwad', doom2iwad, '-file', `${gameFile}`]);
        }
        else {
            alert("You should never see this. If you see this, something has gone horribly wrong.");
        }
    });
}

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('message', (event, message) => {
    console.log(message);
});

ipcMain.on('close', (event) => {
    app.quit();
});

function findExecutable(name: string): string | null {
    const paths = process.env.PATH?.split(path.delimiter) || [];

    for (const dir of paths) {
        const fullPath = path.join(dir, name);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            return fullPath;
        }
    }

    return null;
}

function findFileCaseInsensitive(filename: string): string | null {
    const cwd = process.cwd();

    try {
        const files = fs.readdirSync(__dirname, { withFileTypes: true });
        const file = files.find(file => file.name.toLowerCase() === filename.toLowerCase());
        const fileExists = files.some(file => file.name.toLowerCase() === filename.toLowerCase());
        if (file && fileExists) {
            return file.name;
        }
    }
    catch (err) {
        return null;
    }

    return null;
}