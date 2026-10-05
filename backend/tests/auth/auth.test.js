const assert = require("assert");
const bcrypt = require("bcrypt");

describe("Auth Module Tests", () => {
    it("should hash and verify passwords correctly", async () => {
        const plain = "Password@123";
        const hash = await bcrypt.hash(plain, 10);
        const match = await bcrypt.compare(plain, hash);
        assert.strictEqual(match, true);
    });
});
