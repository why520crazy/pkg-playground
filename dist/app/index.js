// const { hello } = require("@app/a");

// console.log(hello("hello"));

require("./a/index");
require("./b/index");

console.log(`__dirname: ${__dirname} \n__filename: ${__filename}\nprocess.cwd: ${process.cwd()}\nprocess.execPath: ${process.execPath}`);