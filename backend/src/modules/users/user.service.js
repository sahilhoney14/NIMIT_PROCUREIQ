const bcrypt = require("bcrypt");
const userRepo = require("./user.repository");

async function listUsers() {
    return userRepo.findAll();
}

async function getUserById(userId) {
    return userRepo.findById(userId);
}

async function createUser({ username, password, role }) {
    const passwordHash = await bcrypt.hash(password, 10);
    return userRepo.create({ username, passwordHash, role });
}

async function changePassword(userId, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    return userRepo.updatePassword(userId, passwordHash);
}

async function changeAccess(userId, isActive) {
    return userRepo.updateAccess(userId, isActive);
}

module.exports = {
    listUsers,
    getUserById,
    createUser,
    changePassword,
    changeAccess
};
