const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");

const files = [
    "frontend/admin/index.html",
    "frontend/procurement-manager/index.html"
];

for (const rel of files) {
    const fullPath = path.join(rootDir, rel);
    if (!fs.existsSync(fullPath)) continue;

    let content = fs.readFileSync(fullPath, "utf8");

    // Regex to match and remove <div class="finance-card-right">[\s\S]*?<\/div>
    const regex = /\s*<div class="finance-card-right">[\s\S]*?<\/div>/g;

    const matches = content.match(regex);
    console.log(`Found ${matches ? matches.length : 0} finance-card-right instances in ${rel}`);

    if (matches && matches.length > 0) {
        content = content.replace(regex, "");
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`Successfully removed finance-card-right from ${rel}`);
    }
}

console.log("Done!");
