import { ipcRenderer } from "electron";

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

document.addEventListener('keydown', (event) => {
    if (event.key === "Escape") {
        ipcRenderer.send('close');
    }
});