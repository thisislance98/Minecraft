
import fs from 'fs';
console.log("Hello console");
try {
    fs.writeFileSync('tests/hello.txt', 'Hello file');
    console.log("File written");
} catch (e) {
    console.error(e);
}
