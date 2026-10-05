const express = require("express");
const router = express.Router();
const userController = require("./user.controller");
const { verifyAdmin } = require("../../middleware/auth.middleware");
const { validateCreateUser, validateChangePassword, validateChangeAccess } = require("./user.validation");

router.get("/users", verifyAdmin, userController.getUsers);
router.post("/users", verifyAdmin, validateCreateUser, userController.createUser);
router.put("/users/:user_id/password", verifyAdmin, validateChangePassword, userController.updatePassword);
router.put("/users/:user_id/access", verifyAdmin, validateChangeAccess, userController.updateAccess);

module.exports = router;
