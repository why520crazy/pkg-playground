const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

async function main() {
    const toAppDirPath = path.resolve(__dirname, "../dist/app/node_modules/@app");
    if (!fsSync.existsSync(toAppDirPath)) {
        await fs.mkdir(toAppDirPath)
    }
    await fs.symlink(`../../b`, path.resolve(toAppDirPath, "./b"));
}

main();