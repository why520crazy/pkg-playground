const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

async function main() {
    const replacedPath = path.resolve(__dirname, "../node_modules/@atinc/devkit-cli/lib/on-premises-build/pkg-handler.js");
    const toPath = path.resolve(__dirname, "./pkg-handler.js");
    const newContent = await fs.readFile(toPath, "utf-8");
    await fs.writeFile(replacedPath, newContent);
}
main();