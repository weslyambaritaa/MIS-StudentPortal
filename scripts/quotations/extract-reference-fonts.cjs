const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const library = process.env.REFERENCE_PDF_LIB || 'pdf-lib';
const { PDFDocument, PDFDict, PDFName, PDFRawStream } = require(library);
const { decodePDFRawStream } = require(library + '/cjs/core/streams/decode');
const fontkit = require('fontkit');

(async () => {
  const directory = join(__dirname, '../../app/be/internal-api/src/modules/quotations/templates/artwork');
  const families = { Calibri:'QuotationCalibri', 'Calibri-Bold':'QuotationCalibriBold', Aptos:'QuotationAptos' };
  const covered = Object.fromEntries(Object.keys(families).map(name=>[name,new Set()]));
  const manifest = [];
  for (const type of ['private','public','online','inhouse']) {
    const document = await PDFDocument.load(readFileSync(join(directory, `../${type}.pdf`)));
    for (const [, object] of document.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFDict)) continue;
      const name = object.get(PDFName.of('FontName'))?.toString().replace(/^\/[A-Z]+\+/, '');
      const file = object.get(PDFName.of('FontFile2'));
      if (!families[name] || !file) continue;
      const stream = document.context.lookup(file);
      if (!(stream instanceof PDFRawStream)) continue;
      const bytes = decodePDFRawStream(stream).decode();
      const font = fontkit.create(Buffer.from(bytes));
      const characters = font.characterSet.filter(code=>code>0&&!covered[name].has(code)&&font.hasGlyphForCodePoint(code));
      if (!characters.length) continue;
      const filename = `${type}-${name.toLowerCase()}.ttf`;
      writeFileSync(join(directory, filename), bytes);
      manifest.push({ family:families[name], file:filename, unicodeRange:characters.map(code=>`U+${code.toString(16).toUpperCase()}`).join(',') });
      characters.forEach(code=>covered[name].add(code));
      console.log('Extracted complementary font subset:', filename, characters.length, 'characters');
    }
  }
  for (const name of ['Calibri','Calibri-Bold']) {
    const missing = [...'0123456789'].filter(char=>!covered[name].has(char.codePointAt(0)));
    if (missing.length) throw new Error(`${name} is missing digits: ${missing.join('')}`);
  }
  writeFileSync(join(directory, 'fonts.json'), JSON.stringify(manifest,null,2));
})();
