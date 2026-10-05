function sanitizeFolderName(name) {
    if (!name) return "unnamed_vendor";
    return String(name)
        .trim()
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/\s+/g, " ")
        .replace(/[.\s]+$/, ""); // Strip trailing dots and spaces to prevent Windows directory errors
}

function getFileExtension(filename, defaultExt = ".pdf") {
    if (!filename) return defaultExt;
    const parts = filename.split(".");
    return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : defaultExt;
}

module.exports = {
    sanitizeFolderName,
    getFileExtension
};
