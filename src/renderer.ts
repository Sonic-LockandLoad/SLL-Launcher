import { ipcRenderer } from "electron";

document.getElementById('download-button')?.addEventListener('click', () => {
    ipcRenderer.send('download-file', 'filename', 'url');
});

ipcRenderer.on('download-complete', (event, message) => {
    console.log(message);
});

ipcRenderer.on('download-error', (event, message) => {
    console.log(message);
});