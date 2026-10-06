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
                if (!val) return "-";
                if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
                    const parts = val.slice(0, 10).split("-");
                    return `${parts[2]}.${parts[1]}.${parts[0]}`;
                }
                const d = new Date(val);
                if (isNaN(d.getTime())) return String(val);
                return d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, ".");
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

            // 1. Company letterhead image
            if (fs.existsSync(headerImgPath)) {
                doc.image(headerImgPath, 50.4, 54, {
                    width: 504.8,
                    height: 79
                });
            }

            const ML = 85.6;
            const MR = 524;
            const MW = MR - ML;

            // 2. Title box
            const titleY = 192.2;
            const titleH = 21.9;
            rect(ML, titleY, MW, titleH);
            doc.font("Arial-Bold")
                .fontSize(15.24)
                .text("PURCHASE ORDER", ML, titleY + 3.5, {
                    width: MW,
                    align: "center",
                    lineBreak: false
                });

            // 3. Vendor block (left) and PO reference block (right)
            const vendorY = 214.1;
            const vendorH = 84;
            rect(ML, vendorY, MW, vendorH);

            const splitX = 316.3; // Matches lower table column 2 border cleanly
            const colDivider = 416; // Divider between Label and Value in PO table

            line(splitX, vendorY, splitX, vendorY + vendorH);
            line(colDivider, vendorY, colDivider, vendorY + vendorH);

            // Left: Vendor details
            doc.font("Arial-Bold").fontSize(9).text("TO,", ML + 4, vendorY + 4, { lineBreak: false });
            const vendorName = String(po.vendor_name || "").trim();
            const vendorAddress = String(po.vendor_address || "").trim();
            const vendorGst = String(po.vendor_gst || po.gst_number || "").trim();

            let vendorTextY = vendorY + 16;
            if (vendorName) {
                doc.font("Arial-Bold").fontSize(8.5).text(vendorName, ML + 4, vendorTextY, { width: splitX - ML - 8, lineBreak: false });
                vendorTextY += 12;
            }
            if (vendorAddress) {
                doc.font("Arial").fontSize(8).text(vendorAddress, ML + 4, vendorTextY, { width: splitX - ML - 8, lineGap: 1 });
                const addrH = doc.heightOfString(vendorAddress, { width: splitX - ML - 8, lineGap: 1 });
                vendorTextY += addrH + 4;
            }
            if (vendorGst) {
                doc.font("Arial-Bold").fontSize(8.5).text(`GST: ${vendorGst}`, ML + 4, vendorTextY, { width: splitX - ML - 8, lineBreak: false });
            }

            // Right: Order References Table (6 rows x 14pt height = 84pt)
            const companyGst = process.env.GST_NUMBER || "24AAHPS5083K1ZO";
            const rowH = 14;
            const refRows = [
                { label: "REF. P.O. NO.", val: po.po_number || "-", boldVal: true },
                { label: "P.O. DATE",      val: fmtDate(po.po_date || po.created_at) },
                { label: "REF. P.R. NO.", val: po.pr_number || "-" },
                { label: "P.R. DATE",      val: fmtDate(po.pr_date || po.created_at) },
                { label: "GST NO.",        val: companyGst },
                { label: "VENDOR CODE",    val: po.vendor_code || "-" }
            ];

            refRows.forEach((r, idx) => {
                const currentY = vendorY + idx * rowH;
                if (idx > 0) {
                    line(splitX, currentY, MR, currentY);
                }
                const textY = currentY + 3.2;
                // Label
                doc.font("Arial-Bold").fontSize(8.2).text(r.label, splitX + 4, textY, { width: colDivider - splitX - 6, lineBreak: false });
                // Value
                doc.font(r.boldVal ? "Arial-Bold" : "Arial").fontSize(8.2).text(r.val, colDivider + 4, textY, { width: MR - colDivider - 6, lineBreak: false });
            });

            // 4. Attention Box
            const attnY = 298.1;
            const attnH = 21.5;
            rect(ML, attnY, MW, attnH);
            doc.font("Arial-Bold").fontSize(9).text(`ATTN. : ${po.vendor_name || ""}`, ML, attnY + 5.5, {
                width: MW,
                align: "center",
                lineBreak: false
            });

            // 5. Item Table
            const tableHeaderY = 319.6;
            const headerH = 16;
            const x0 = 85.6;
            const x1 = 147.6;
            const x2 = 316.3;
            const x3 = 350.3;
            const x4 = 428.4;
            const x5 = 524;
            const totalY = 509.7;
            const totalH = 14;
            const tableBottom = totalY + totalH;

            rect(x0, tableHeaderY, x5 - x0, tableBottom - tableHeaderY);
            line(x1, tableHeaderY, x1, tableBottom);
            line(x2, tableHeaderY, x2, tableBottom);
            line(x3, tableHeaderY, x3, tableBottom);
            line(x4, tableHeaderY, x4, tableBottom);
            line(x0, tableHeaderY + headerH, x5, tableHeaderY + headerH);

            doc.font("Calibri-Bold").fontSize(7.56);
            doc.text("SR. NO.", x0, tableHeaderY + 4, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text("Model Number", x1, tableHeaderY + 4, { width: x2 - x1, align: "center", lineBreak: false });
            doc.text("Qty", x2, tableHeaderY + 4, { width: x3 - x2, align: "center", lineBreak: false });
            doc.text("Unit Rate", x3, tableHeaderY + 4, { width: x4 - x3, align: "center", lineBreak: false });
            doc.text("Total", x4, tableHeaderY + 4, { width: x5 - x4, align: "center", lineBreak: false });

            // Item row
            const itemTop = tableHeaderY + headerH;
            const itemDesc = [po.item_name, po.make, po.model].filter(Boolean).join(" / ");
            doc.font("Calibri").fontSize(7.56);
            doc.text("1", x0, itemTop + 4, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text(itemDesc, x1 + 4, itemTop + 4, { width: x2 - x1 - 8, align: "left", lineBreak: false });
            doc.text(Number(po.qty || 0).toFixed(2), x2, itemTop + 4, { width: x3 - x2, align: "center", lineBreak: false });
            doc.text(fmtCur(po.price_per_unit), x3, itemTop + 4, { width: x4 - x3, align: "center", lineBreak: false });
            doc.text(fmtCur(po.total_price), x4, itemTop + 4, { width: x5 - x4, align: "center", lineBreak: false });

            // Total row
            line(x0, totalY, x5, totalY);
            doc.font("Calibri-Bold").fontSize(7.56).text("TOTAL:", x0, totalY + 3.5, { width: x4 - x0, align: "center", lineBreak: false });
            doc.text(fmtCur(po.total_price), x4, totalY + 3.5, { width: x5 - x4, align: "center", lineBreak: false });

            // 6. Footer: Terms & conditions (left) and signature block (right)
            const footerY = tableBottom;
            const footerBottom = 618.9;
            rect(x0, footerY, x5 - x0, footerBottom - footerY);
            const footerSplit = x3;
            line(footerSplit, footerY, footerSplit, footerBottom);
            line(x0, footerY + 14, footerSplit, footerY + 14);
            line(x1, footerY + 14, x1, 607.5);
            line(x0, 607.5, x5, 607.5);

            doc.font("Calibri-Bold").fontSize(7.56).text("TERMS & CONDITIONS :", x0, footerY + 3.5, { width: footerSplit - x0, align: "center", lineBreak: false });
            doc.font("Calibri").fontSize(7.56);
            doc.text("1", x0, footerY + 19, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text("2", x0, footerY + 31, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text("DELIVERY : AT OUR OFFICE.", x1 + 4, footerY + 19, { width: footerSplit - x1 - 8, lineBreak: false });
            doc.text("TAX : EXTRA", x1 + 4, footerY + 31, { width: footerSplit - x1 - 8, lineBreak: false });
            if (po.payment_terms_remarks) {
                doc.text("3", x0, footerY + 43, { width: x1 - x0, align: "center", lineBreak: false });
                doc.text(po.payment_terms_remarks, x1 + 4, footerY + 43, { width: footerSplit - x1 - 8, lineBreak: false });
            }

            // Signature block
            const signX = footerSplit + 6;
            doc.font("Arial-Bold").fontSize(7).text("FOR,", signX, footerY + 2, { lineBreak: false });
            doc.text("NIMIT ELECTRONICS AND EQUIPMENTS,", signX, footerY + 13, { width: x5 - signX - 4, lineBreak: false });
            doc.text("AUTHORISED SIGNATORY", signX, 595, { width: x5 - signX - 4, lineBreak: false });

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
