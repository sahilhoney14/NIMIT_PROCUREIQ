const fs = require("fs");
const path = require("path");

const STORAGE_ROOT = path.resolve(__dirname, "../../storage");

function getStoragePath(subfolder, filename) {
    const dir = path.join(STORAGE_ROOT, subfolder);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return filename ? path.join(dir, filename) : dir;
}

function saveFile(subfolder, filename, buffer) {
    const target = getStoragePath(subfolder, filename);
    fs.writeFileSync(target, buffer);
    return target;
}

function fileExists(subfolder, filename) {
    return fs.existsSync(getStoragePath(subfolder, filename));
}

module.exports = {
    STORAGE_ROOT,
    getStoragePath,
    saveFile,
    fileExists
};
