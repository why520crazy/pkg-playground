const b = require("@app/b");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

module.exports = {
    getName() {
        return "a module";
    }
}

console.log(`a module required, b`, b);

// const filepath = path.resolve(__dirname, "../node_modules/assets/name.txt");
const filepath = path.resolve(__dirname, "../assets/name.txt");

console.log(filepath);
console.log(fs.readFileSync(filepath, "utf-8"));

async function main() {
    axios.get('http://baidu.com')
        .then(function (response) {
            // handle success
            console.log(`use axios response http://baidu.com success`);
        })
        .catch(function (error) {
            // handle error
            console.log(error);
        })
        .finally(function () {
            // always executed
        });

}

main();