import { app, dialog, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs, { ReadStream } from 'fs';
import axios from 'axios';
import simpleGit, { SimpleGit } from 'simple-git';
import { exec, spawn } from 'child_process';
import yauzl from 'yauzl';

const git: SimpleGit = simpleGit();

function getAppDataDir(): string {
    try {
        const executablePath = process.env.ARGV0 || app.getPath('exe');
        const execDirectory = path.dirname(executablePath);

        let directory = path.join(execDirectory, 'data');

        // On macOS, set it to the user's Application Support directory
        if (process.platform === 'darwin') {
            const applicationSupport = path.join(app.getPath('home'), 'Library', 'Application Support');
            directory = path.join(applicationSupport, 'SLL-Launcher');
        }

        // If running in a dev environment, set it to the dist folder
        const isDev = process.execPath.includes('electron');
        if (isDev) {
            directory = path.join(__dirname, '..', 'dist', 'data');
        }

        return path.resolve(directory);
    }
    catch (err) {
        console.error(`Failed to get app data directory: ${err}`);
        throw err;
    }
}

const appDataDir = getAppDataDir();

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

    ipcMain.handle('get-root-path', () => {
        return appDataDir;
    });

    if (!fs.existsSync(appDataDir)) {
        const result = dialog.showMessageBoxSync({
            type: 'question',
            title: 'Create App Data Directory?',
            message: `Config directory at ${appDataDir} does not exist. Create it? Selecting "No" will exit the app.`,
            buttons: ['Yes', 'No'],
        });

        if (result === 0) {
            try {
                fs.mkdirSync(appDataDir);
                console.log(`Config directory created at ${appDataDir}`);
            }
            catch (err) {
                console.log(`Config directory creation failed: ${err}`);
            }
        }
        else {
            app.quit();
        }
    }

    ipcMain.handle('confirm-overwrite', async (event, message, labels) => {
        return dialog.showMessageBoxSync({
            type: 'warning',
            title: 'Files Already Exist',
            message: message,
            buttons: labels,
        });
    });

    ipcMain.handle('find-git', () => {
        return findExecutable('git') || findExecutable('git.exe');
    });

    ipcMain.handle('find-engine', () => {
        return findGZDoom();
    });

    ipcMain.handle('find-iwad', () => {
        return findFileCaseInsensitive('DOOM2.WAD') || findFileCaseInsensitive('freedoom2.wad');
    });

    function findGameDir(): [string, number] {
        const filePath = path.join(appDataDir, 'Sonic-LockandLoad');
        if (fs.existsSync(filePath)) {
            if (fs.readdirSync(filePath).length === 0) {
                console.log(`Directory ${filePath} is empty`);
                return ["", -2];
            }
            else {
                if (!fs.existsSync(path.join(filePath, 'GAMEINFO.txt'))) {
                    return [filePath, -3];
                }
                else {
                    return [filePath, 0];
                }
            }
        }

        return ["", -1];
    }

    function findGamePK3(): [string, number] | null {
        const filePath = path.join(appDataDir, 'Sonic-LockandLoad.pk3');
        if (fs.existsSync(filePath)) {
            return [filePath, 0];
        }

        return null;
    }

    ipcMain.handle('find-game-files', (): [string, number] => {
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
        const filePath = path.join(appDataDir, destination);
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
        const filePath = path.join(appDataDir, destination);
        console.log(`Cloning ${url} to ${filePath}`);
        try {
            await git.clone(url, filePath, ["--depth", "1"]).then(() => {
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
        const gzdoomExecutable = findGZDoom();
        const doom2iwad = findFileCaseInsensitive('doom2.wad') || findFileCaseInsensitive('freedoom2.wad');
        const game = findGamePK3() || findGameDir();
        const gameFile = game[0].toString();

        if (gzdoomExecutable && doom2iwad && gameFile) {
            let execString = `${gzdoomExecutable} -iwad ${doom2iwad} -file ${gameFile}`;
            if (gzdoomExecutable === "Flatpak") {
                console.log('Running GZDoom from Flatpak');
                spawn("flatpak", ["run", "org.zdoom.GZDoom", "-iwad", doom2iwad, "-file", `${gameFile}`]);
            }
            else {
                console.log(`Running command \`${execString}\``);
                spawn(gzdoomExecutable, ['-iwad', doom2iwad, '-file', `${gameFile}`]);
            }
        }
        else {
            alert("You should never see this. If you see this, something has gone horribly wrong.");
        }
    });

    async function getGameInfoFromPK3(): Promise<string | null> {
        const gameFile = findGamePK3();
        if (!gameFile) {
            return null;
        }

        return new Promise<string | null>((resolve, reject) => {
            yauzl.open(gameFile[0], { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    console.error(err);
                    return reject(err);
                }

                let found = false;
                let data = "";

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    if (entry.fileName === "GAMEINFO.txt") {
                        found = true;
                        console.log(`Found GAMEINFO.txt in ${gameFile} at ${entry.fileName}`);

                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                console.error(err);
                                return reject(err);
                            }

                            readStream.on('data', (chunk) => {
                                data += chunk.toString();
                            });

                            readStream.on('end', () => {
                                console.log(`Done reading ${gameFile} at ${entry.fileName}`);
                                zipfile.close();
                                resolve(data);
                            });
                        });
                    } else {
                        zipfile.readEntry();
                    }
                });

                zipfile.on('end', () => {
                    if (!found) {
                        console.error(`GAMEINFO.txt not found in ${gameFile}`);
                        resolve(null);
                    }
                });

                zipfile.on('error', (err) => {
                    console.error('Error while processing ZIP file:', err);
                    reject(err);
                });
            });
        });
    }

    async function getGameInfoFromFolder(): Promise<string | null> {
        const gameFile = findGameDir();
        if (!gameFile || gameFile[1] != 0) {
            return null;
        }

        const gameInfo = fs.readFileSync(path.join(gameFile[0].toString(), 'GAMEINFO.txt'), 'utf-8')
        console.log(gameInfo);

        return new Promise<string | null>((resolve, reject) => {
            resolve(gameInfo);
        });
    }

    ipcMain.handle('get-game-version', async () => {
        const isPK3 = findGamePK3();
        const isDir = findGameDir();
        const game = isPK3 || isDir;

        if (game && isPK3) {
            const gameInfo: string = await getGameInfoFromPK3() || "";
            const version = await parseVersionFromGameInfo(gameInfo);
            if (version) return version;
        }
        if (game && isDir) {
            const gameInfo: string = await getGameInfoFromFolder() || "";
            const version = await parseVersionFromGameInfo(gameInfo);
            if (version) return version;
        }
        return null;
    });

    ipcMain.handle('get-engine-version', (event) => {
        return "g4.11.3"; // probably
    });
}


    async function parseVersionFromGameInfo(gameInfo: string): Promise<string | null> {
        if (gameInfo.length > 0) {
            // Extract the line that starts with "StartupTitle"
            const title = gameInfo.split('\n').find(line => line.startsWith('StartupTitle'));
            console.log("Found title: " + title);
            if (title) {
                const version = title.split('Sonic: Lock & Load ')[1].replace(/\\/g, '').slice(0, -2);
                if (version) {
                    console.log("Found version: " + version);
                    return version;
                }
            }
        }

        return null;
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

function findGZDoom(): string | null {
    const gzdoomInPath: string | null = findExecutable('gzdoom') || findExecutable('gzdoom.exe');

    if (!gzdoomInPath) {
        try {
            if (process.platform === 'win32') {
                return searchInDirRecursively(appDataDir, 'gzdoom.exe');
            }
            else if (process.platform === 'darwin') {
                const macGZDoom = searchInDir("/Applications", 'GZDoom.app') ||
                                searchInDir(path.join(app.getPath('home'), "Applications"), 'GZDoom.app');
                
                if (macGZDoom) {
                    return path.join(macGZDoom, 'Contents', 'MacOS', 'GZDoom');
                }
            }
            else { // Assume it's Linux
                const flatpakGZDoom = searchInDirRecursively("/var/lib/flatpak/app/", 'gzdoom');

                if (flatpakGZDoom) {
                    // Since Flatpak won't let us run it directly...
                    return "Flatpak";
                }

                return searchInDirRecursively(appDataDir, 'gzdoom');
            }
        }
        catch (err) {
            console.error(err);
        }
    }

    return gzdoomInPath;
}

function searchInDir(dir: string, filename: string): string | null {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    console.log(`Searching ${dir} for ${filename}`);
    for (const file of files) {
        console.log(`Checking ${file.name}`);
        if (file.name.toLowerCase() === filename.toLowerCase()) {
            console.log(`Found ${file.name}`);
            return path.join(dir, file.name);
        }
    }

    return null;
}

function searchInDirRecursively(dir: string, filename: string): string | null {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            const result = searchInDirRecursively(fullPath, filename);
            if (result) return result;
        }
        else if (file.name.toLowerCase() === filename.toLowerCase()) {
            return fullPath;
        }
    }

    return null;
}

function findFileCaseInsensitive(filename: string): string | null {
    try {
        const files = fs.readdirSync(appDataDir, { withFileTypes: true });
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