const multer = require("multer");

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

function getVendorDocuments() {
    return memoryUpload.fields([
        { name: "gst_document", maxCount: 1 },
        { name: "pan_document", maxCount: 1 },
        { name: "msme_document", maxCount: 1 },
        { name: "itr_last_year_document", maxCount: 1 },
        { name: "itr_second_last_year_document", maxCount: 1 },
        { name: "itr_third_last_year_document", maxCount: 1 }
    ]);
}

const uploadExcel = memoryUpload.single("file");

module.exports = {
    memoryUpload,
    getVendorDocuments,
    uploadExcel
};
