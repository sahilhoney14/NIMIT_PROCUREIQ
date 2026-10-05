const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { verifyAdmin } = require("../middleware/auth.middleware");

router.get("/users", verifyAdmin, userController.getUsers);
router.post("/users", verifyAdmin, userController.createUser);
router.put("/users/:user_id/password", verifyAdmin, userController.updatePassword);
router.put("/users/:user_id/access", verifyAdmin, userController.updateAccess);

module.exports = router;
