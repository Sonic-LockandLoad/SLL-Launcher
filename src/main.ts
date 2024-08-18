import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'renderer.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.loadFile(path.join(__dirname, 'index.html'));
}

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
