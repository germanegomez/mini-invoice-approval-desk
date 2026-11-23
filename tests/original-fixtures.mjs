// Deterministic two-page PDF and RGB PNG. All offsets are ASCII byte offsets.
import { deflateSync, crc32 } from "node:zlib";
const stream = label => {
  const text = `BT /F1 20 Tf 45 720 Td (${label}) Tj ET\n`;
  return `<< /Length ${text.length} >>\nstream\n${text}endstream`;
};
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Count 2 /Kids [3 0 R 4 0 R] >>",
  ...[6, 7].map(id => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 5 0 R >> >> /Contents ${id} 0 R >>`),
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  stream("Factura sintetica 123 - original"), stream("Renglon 2 - Papeleria 123"),
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, object] of objects.entries()) {
  offsets.push(pdf.length);
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const start = pdf.length;
pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, "0") + " 00000 n \n";
pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;

function chunk(type, data) {
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  const payload = Buffer.concat([Buffer.from(type), data]);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, checksum]);
}
const width = 320, height = 240;
const header = Buffer.alloc(13);
header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
header[8] = 8; header[9] = 2;
const pixels = Buffer.alloc((1 + width * 3) * height, 255);
for (let y = 0; y < height; y++) {
  const row = y * (1 + width * 3);
  pixels[row] = 0;
  if (y >= 24 && y < 45 || [90, 120, 150, 190].includes(y)) {
    pixels.fill(65, row + 61, row + 1 + (width - 20) * 3);
  }
}
const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header),
  chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
const samples = { pdf: Buffer.from(pdf), png };
export default samples;
