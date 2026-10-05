function log(message) {
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    console.log(`[${timestamp}] ${message}`);
}

module.exports = {
    log
};
