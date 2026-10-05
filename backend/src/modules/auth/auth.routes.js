const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");
const { validateLogin } = require("./auth.validation");

router.get("/login", authController.renderLogin);
router.post("/login", validateLogin, authController.login);
router.get("/verify", authController.verify);
router.get("/logout", authController.logout);
router.post("/logout", authController.logout);

module.exports = router;
