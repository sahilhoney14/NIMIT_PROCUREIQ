function validateLogin(req, res, next) {
    const { username, password } = req.body;
    if (!username || !password || String(username).trim() === "" || String(password).trim() === "") {
        return res.status(400).json({ success: false, message: "Username and password are required" });
    }
    next();
}

module.exports = {
    validateLogin
};
