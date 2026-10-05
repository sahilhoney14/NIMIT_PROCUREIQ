const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const poFolder = path.resolve(__dirname, "../../purchase-orders");
const headerImgPath = path.resolve(__dirname, "../../PO header.png");
const fontDir = path.resolve(__dirname, "../../fonts");

function generatePoPdf(po) {
    return new Promise((resolve, reject) => {
        try {
            fs.mkdirSync(poFolder, { recursive: true });
            const safeFileName = String(po.po_number || "PO").replace(/[\/\\:*?"<>|]/g, "_") + ".pdf";
            const outputPath = path.join(poFolder, safeFileName);
            const doc = new PDFDocument({ size: [612, 792], margin: 0 });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            doc.registerFont("Arial", path.join(fontDir, "ARIAL.TTF"));
            doc.registerFont("Arial-Bold", path.join(fontDir, "ARIALBD.TTF"));
            doc.registerFont("Calibri", path.join(fontDir, "CALIBRI.TTF"));
            doc.registerFont("Calibri-Bold", path.join(fontDir, "CALIBRIB.TTF"));

            function fmtDate(val) {
                if (!val) return "";
                const d = new Date(val);
                if (isNaN(d.getTime())) return String(val);
                return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
            }

            function fmtCur(val) {
                return Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            function line(x1, y1, x2, y2) {
                doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
            }

            function rect(x, y, w, h) {
                doc.rect(x, y, w, h).stroke();
            }

            doc.lineWidth(1);

            // Company letterhead image
            if (fs.existsSync(headerImgPath)) {
                doc.image(headerImgPath, 50.4, 54, {
                    width: 504.8,
                    height: 79
                });
            }

            // Top metadata frame
            const x0 = 50.4;
            const x1 = 92.4;
            const x2 = 293.2;
            const x3 = 345.5;
            const x4 = 425.4;
            const x5 = 555.2;

            const yTop = 138;
            const yMid = 149.2;
            const yBot = 160.4;

            rect(x0, yTop, x5 - x0, yBot - yTop);
            line(x0, yMid, x5, yMid);
            line(x2, yTop, x2, yBot);

            doc.font("Arial-Bold").fontSize(7.56);
            doc.text("P. O. NO. :", x0 + 2, yTop + 2, { lineBreak: false });
            doc.font("Arial").fontSize(7.56);
            doc.text(po.po_number || "", x0 + 44, yTop + 2, { lineBreak: false });

            doc.font("Arial-Bold").fontSize(7.56);
            doc.text("DATE :", x2 + 2, yTop + 2, { lineBreak: false });
            doc.font("Arial").fontSize(7.56);
            doc.text(fmtDate(po.created_at || new Date()), x2 + 35, yTop + 2, { lineBreak: false });

            doc.font("Arial-Bold").fontSize(7.56);
            doc.text("P. R. NO. :", x0 + 2, yMid + 2, { lineBreak: false });
            doc.font("Arial").fontSize(7.56);
            doc.text(po.pr_number || "", x0 + 44, yMid + 2, { lineBreak: false });

            doc.font("Arial-Bold").fontSize(7.56);
            doc.text("DATE :", x2 + 2, yMid + 2, { lineBreak: false });
            doc.font("Arial").fontSize(7.56);
            doc.text(fmtDate(po.pr_created_at || po.created_at || new Date()), x2 + 35, yMid + 2, { lineBreak: false });

            // Supplier details block
            const suppTop = 165.4;
            const suppBottom = 237.4;
            rect(x0, suppTop, x5 - x0, suppBottom - suppTop);

            doc.font("Calibri-Bold").fontSize(8.52);
            doc.text(po.vendor_name || "", x0 + 5, suppTop + 4, { width: x5 - x0 - 10 });
            doc.font("Calibri").fontSize(7.56);
            const address = po.office_address || po.factory_address || "";
            doc.text(address, x0 + 5, doc.y + 2, { width: x5 - x0 - 10 });

            // Table headers
            const tableHeaderY = 242.4;
            const headerH = 18;
            const tableBottom = 517.4;
            const totalY = 499.4;

            rect(x0, tableHeaderY, x5 - x0, tableBottom - tableHeaderY);
            line(x0, tableHeaderY + headerH, x5, tableHeaderY + headerH);

            // Vertical column lines
            line(x1, tableHeaderY, x1, totalY);
            line(x2, tableHeaderY, x2, totalY);
            line(x3, tableHeaderY, x3, totalY);
            line(x4, tableHeaderY, x4, totalY);

            doc.font("Calibri-Bold").fontSize(7.56);
            doc.text("SR. NO.", x0, tableHeaderY + 5, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text("DESCRIPTION", x1, tableHeaderY + 5, { width: x2 - x1, align: "center", lineBreak: false });
            doc.text("QTY", x2, tableHeaderY + 5, { width: x3 - x2, align: "center", lineBreak: false });
            doc.text("RATE (RS.)", x3, tableHeaderY + 5, { width: x4 - x3, align: "center", lineBreak: false });
            doc.text("AMOUNT (RS.)", x4, tableHeaderY + 5, { width: x5 - x4, align: "center", lineBreak: false });

            // Single line item row
            const itemTop = tableHeaderY + headerH + 1;
            const itemDesc = [
                po.item_name,
                po.make,
                po.model
            ].filter(Boolean).join(" / ");

            doc.font("Calibri").fontSize(7.56);
            doc.text("1", x0, itemTop + 2, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text(itemDesc, x1 + 3, itemTop + 2, { width: x2 - x1 - 6, align: "left", lineBreak: false });
            doc.text(Number(po.qty || 0).toFixed(2), x2, itemTop + 2, { width: x3 - x2, align: "center", lineBreak: false });
            doc.text(fmtCur(po.price_per_unit), x3, itemTop + 2, { width: x4 - x3, align: "center", lineBreak: false });
            doc.text(fmtCur(po.total_price), x4, itemTop + 2, { width: x5 - x4, align: "center", lineBreak: false });

            // Table total row
            line(x0, totalY, x5, totalY);
            doc.font("Calibri-Bold").fontSize(7.56).text("TOTAL:", x0, totalY + 2, { width: x4 - x0, align: "center", lineBreak: false });
            doc.text(fmtCur(po.total_price), x4, totalY + 2, { width: x5 - x4, align: "center", lineBreak: false });

            // Footer frame: terms & conditions (left) and signature block (right)
            const footerY = tableBottom;
            const footerBottom = 618.9;
            rect(x0, footerY, x5 - x0, footerBottom - footerY);
            const footerSplit = x3;
            line(footerSplit, footerY, footerSplit, footerBottom);
            line(x0, 531.4, footerSplit, 531.4);
            line(x1, 531.4, x1, 607.5);
            line(x2, 531.4, x2, 607.5);
            line(x0, 607.5, x5, 607.5);

            doc.font("Calibri-Bold").fontSize(7.56).text("TERMS & CONDITIONS :", x0, footerY + 1, { width: footerSplit - x0, align: "center", lineBreak: false });
            doc.font("Calibri").fontSize(7.56);
            doc.text("1", x0, 533, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text("2", x0, 543.6, { width: x1 - x0, align: "center", lineBreak: false });
            if (po.payment_terms_remarks) doc.text("3", x0, 554.2, { width: x1 - x0, align: "center", lineBreak: false });

            doc.text("DELIVERY : AT OUR OFFICE.", x1 + 3, 533, { width: x2 - x1 - 6, lineBreak: false });
            doc.text("TAX : EXTRA", x1 + 3, 543.6, { width: x2 - x1 - 6, lineBreak: false });
            if (po.payment_terms_remarks) doc.text(po.payment_terms_remarks, x1 + 3, 554.2, { width: x2 - x1 - 6, lineBreak: false });

            // Authorised signatory block
            const signX = footerSplit + 1.5;
            doc.font("Arial-Bold").fontSize(6.96);
            doc.text("FOR,", signX, footerY + 0.5, { lineBreak: false });
            doc.text("NIMIT ELECTRONICS AND EQUIPMENTS,", signX, footerY + 11.5, { width: x5 - signX - 3, lineBreak: false });
            doc.text("AUTHORISED SIGNATORY", signX, 597, { width: x5 - signX - 3, lineBreak: false });

            doc.end();
            stream.on("finish", () => resolve(outputPath));
            stream.on("error", reject);
        } catch (err) {
            reject(err);
        }
    });
}

function resolveDocumentPath(storedPath) {
    if (!storedPath) return null;
    // Check direct path
    if (path.isAbsolute(storedPath) && fs.existsSync(storedPath)) {
        return storedPath;
    }
    // Handle paths starting with ../purchase-orders or ../vendor
    const cleanRel = storedPath.replace(/^\.\.[\/\\]/, "");
    const candidate1 = path.resolve(__dirname, "../../", cleanRel);
    if (fs.existsSync(candidate1)) return candidate1;

    // Check relative to backend/
    const candidate2 = path.resolve(__dirname, "../", storedPath);
    if (fs.existsSync(candidate2)) return candidate2;

    const candidate3 = path.resolve(__dirname, "../../", storedPath);
    if (fs.existsSync(candidate3)) return candidate3;

    return candidate1;
}

module.exports = {
    poFolder,
    generatePoPdf,
    resolveDocumentPath
};
