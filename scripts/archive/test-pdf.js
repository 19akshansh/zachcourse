import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const pdfFile = fs.readFileSync("package.json");
console.log(typeof PDFParse);
try {
  const parser = new PDFParse({ data: pdfFile });
  parser.getText().then(res => { console.log("Text:", res.substring(0, 50)); });
} catch (e) {
  console.error("error", e);
}
