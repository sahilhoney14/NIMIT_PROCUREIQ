const { log } = require("../utils/logger");

async function notifyUser(userId, message, type = "INFO") {
    log(`[NOTIFICATION] User ${userId} [${type}]: ${message}`);
    return { success: true };
}

module.exports = {
    notifyUser
};
