const { log } = require("../utils/logger");

async function sendEmail({ to, subject, html, text }) {
    log(`[MOCK EMAIL] To: ${to} | Subject: "${subject}"`);
    return { success: true, messageId: `msg_${Date.now()}` };
}

module.exports = {
    sendEmail
};
