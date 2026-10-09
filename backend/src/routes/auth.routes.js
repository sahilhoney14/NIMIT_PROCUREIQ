const express = require("express");
const router = express.Router();
const authController = require("../modules/auth/auth.controller");

router.get("/", authController.renderLogin);
router.get("/login", authController.renderLogin);
router.post("/login", authController.login);
router.get("/verify", authController.verify);
router.post("/logout", authController.logout);

module.exports = router;
