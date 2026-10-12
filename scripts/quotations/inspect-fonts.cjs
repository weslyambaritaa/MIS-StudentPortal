const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const fontkit = require('fontkit');
const root = join(__dirname, '../../app/be/internal-api/src/modules/quotations/templates/artwork');
const faces=JSON.parse(readFileSync(join(root,'fonts.json'),'utf8'));
for (const family of ['QuotationCalibri','QuotationCalibriBold','QuotationAptos']) {
  const subsets=faces.filter(face=>face.family===family).map(face=>({face,font:fontkit.create(readFileSync(join(root,face.file)))}));
  const missing=[...'0123456789'].filter(char=>!subsets.some(({face,font})=>face.unicodeRange.split(',').includes(`U+${char.codePointAt(0).toString(16).toUpperCase()}`)&&font.hasGlyphForCodePoint(char.codePointAt(0))));
  console.log(family,'missing digits:',missing.join('')||'none',family==='QuotationAptos'?'(numeric fields use complete Calibri instead)':'');
}
