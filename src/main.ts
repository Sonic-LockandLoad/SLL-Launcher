import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import os from 'os';

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

    ipcMain.handle('find-engine', () => {
        return findExecutable('gzdoom');
    });

    ipcMain.handle('find-iwad', () => {
        return findFileCaseInsensitive('DOOM2.WAD') || findFileCaseInsensitive('freedoom2.wad');
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

ipcMain.on('download-file', async (event, filename, url) => {
    const filePath = path.join(__dirname, filename);
    try {
        const writer = fs.createWriteStream(filePath);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });

        response.data.pipe(writer);

        writer.on('finish', () => {
            event.sender.send('download-complete', `Finished downloading ${filename}`);
        });

        writer.on('error', (error) => {
            event.sender.send('download-error', `Error downloading ${filename}: ${error}`);
        });
    }
    catch (error) {
        event.sender.send('download-error', `Error downloading ${filename}: ${error}`);
    }
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