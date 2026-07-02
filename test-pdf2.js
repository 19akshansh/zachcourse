import fs from "fs";
import { PDFParse } from "pdf-parse";
const pdfFile = fs.readFileSync("package.json");
async function test() {
  const parser = new PDFParse({ data: pdfFile });
  try {
    const result = await parser.getText();
    console.log("Success:", result.text.substring(0, 50));
    if (parser.destroy) await parser.destroy();
  } catch (e) {
    console.error(e.message);
  }
}
test();
