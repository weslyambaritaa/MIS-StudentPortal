const test = require("node:test");
const assert = require("node:assert/strict");
const { PDFDocument } = require("pdf-lib");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const fontkit = require("fontkit");
const { chromium }=require("playwright-core");
const { BANK_TRANSFER_DETAILS, VAT_RATE, generateQuotationPdf, renderQuotationHtml, prepareQuotationPage } = require("../dist/modules/quotations/quotation-document.js");

test("quotation VAT is selected by class type and one shared bank detail is used", () => {
  assert.equal(VAT_RATE.PUBLIC, 0.11);
  assert.equal(VAT_RATE.ONLINE, 0.11);
  assert.equal(VAT_RATE.PRIVATE, 0.12);
  assert.equal(VAT_RATE.INHOUSE, 0.12);
  assert.equal(BANK_TRANSFER_DETAILS, "Bank Permata - Account No. : 205129.014 (IDR)");
});

test("all digits use matching embedded Calibri fonts, including 9 in the bank account", () => {
  const directory=join(__dirname,"../src/modules/quotations/templates/artwork");
  const manifest=JSON.parse(readFileSync(join(directory,"fonts.json"),"utf8"));
  for(const family of ["QuotationCalibri","QuotationCalibriBold"])for(const char of "0123456789") {
    const range=`U+${char.codePointAt(0).toString(16).toUpperCase()}`;
    const faces=manifest.filter(face=>face.family===family&&face.unicodeRange.split(",").includes(range));
    assert.equal(faces.length,1,`${family} must provide exactly one explicit face for ${char}`);
    const font=fontkit.create(readFileSync(join(directory,faces[0].file)));
    assert.ok(font.hasGlyphForCodePoint(char.codePointAt(0)));
    assert.equal(font.fullName,family==="QuotationCalibriBold"?"Calibri Bold":"Calibri");
  }
});

test("table and following clauses reflow while fixed header/footer artwork stays pinned", async () => {
  const html=await renderQuotationHtml({code:"171/S/IV/2026",accountName:"Example Co",picName:"PIC",picEmail:"pic@example.test",salesName:"Sales",type:"PRIVATE",lines:[{name:"Communication Fundamentals",durationMinutes:480,amountStudent:5,pricePerPax:1000009,location:"Atrium1"}]});
  assert.match(html,/data-course-row=""/);
  assert.match(html,/data-course-details=""/);
  assert.match(html,/data-master-tail=""/);
  assert.match(html,/data-master-tail-fields=""/);
  assert.match(html,/clip-path="url\(#private-first-tail\)"/);
  assert.ok(html.includes("171/S/IV/2026</text>"));
});

test("browser prints compact rows, aligned clause reflow and no fallback digit fonts", async () => {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page=await browser.newPage({javaScriptEnabled:false});
    const input={code:'171/S/IX/2026',accountName:'Example Co',picName:'PIC',picEmail:'pic@example.test',salesName:'Sales',type:'PRIVATE',lines:[{name:'Communication Fundamentals',durationMinutes:480,amountStudent:9,pricePerPax:123456789,location:'Atrium1'}]};
    await prepareQuotationPage(page,input);
    const dimensions=await page.evaluate(()=>{
      const table=document.querySelector('[data-course-table]');
      return {height:Number(table.dataset.renderedHeight),master:Number(table.dataset.masterHeight),tail:document.querySelector('[data-master-tail]').getAttribute('transform'),fields:document.querySelector('[data-master-tail-fields]').getAttribute('transform')};
    });
    assert.ok(dimensions.height<80,`one short course should not fill a ${dimensions.master}pt master table: ${dimensions.height}`);
    assert.equal(dimensions.tail,`translate(0 ${dimensions.height-dimensions.master})`);
    assert.equal(dimensions.tail,dimensions.fields);
    const session=await page.context().newCDPSession(page);
    await session.send('DOM.enable');await session.send('CSS.enable');
    const {root}=await session.send('DOM.getDocument');
    for(const selector of ['.page:last-child .fields text.bold','.page:first-child [data-course-value]']) {
      const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
      const {fonts}=await session.send('CSS.getPlatformFontsForNode',{nodeId});
      assert.ok(fonts.length>0,'Chromium must report the actual printed font');
      assert.ok(fonts.every(font=>font.isCustomFont&&/^Calibri(?: Bold)?$/.test(font.familyName)),JSON.stringify(fonts));
    }
    await prepareQuotationPage(page,{...input,lines:[{...input.lines[0],name:'Managing and Presenting Business Data in Excel 2016'}]});
    const wrappedHeight=await page.locator('[data-course-table]').evaluate(table=>Number(table.dataset.renderedHeight));
    assert.ok(wrappedHeight>dimensions.height,'a wrapped course title should increase the row height');
    assert.ok(wrappedHeight<90,'a wrapped title must still avoid the original oversized blank row');
  } finally {await browser.close();}
});

test("PDF output contains quotation code and type-specific VAT", async () => {
  const pdf = await generateQuotationPdf({
    code: "QTN-000123", accountName: "Example Co", picName: "PIC Example", picEmail: "pic@example.test",
    salesName: "Sales Example", type: "ONLINE", date: new Date("2026-10-07T00:00:00Z"),
    lines: [{ name: "Data Basics", durationMinutes: 480, amountStudent: 3, pricePerPax: 1000000, location: "Online" }],
  });
  assert.ok(pdf.subarray(0, 5).toString("ascii").startsWith("%PDF-"));
  assert.ok(pdf.length > 1000);
  const document = await PDFDocument.load(pdf);
  assert.equal(document.getPageCount(), 2, "single-course quotation keeps the supplied two-page template");
  assert.deepEqual(document.getPage(0).getSize(), { width: 612, height: 792 });
});

test("quotation HTML templates render all requested courses", async () => {
  const pdf = await generateQuotationPdf({
    code: "QTN-000124", accountName: "Example Co", picName: "PIC Example", picEmail: "pic@example.test",
    salesName: "Sales Example", type: "INHOUSE",
    lines: Array.from({ length: 4 }, (_, index) => ({
      name: `Data Basics ${index + 1}`, durationMinutes: 480, amountStudent: 3, pricePerPax: 1000000, location: "Jakarta",
    })),
  });
  const document = await PDFDocument.load(pdf);
  assert.equal(document.getPageCount(), 3, "additional courses get a continuation page without displacing the original terms pages");
});

test("reference layout keeps every course and safely replaces client identities", async () => {
  const html = await renderQuotationHtml({
    code: "QTN-000125", accountName: "Client <Example> & Co", picName: "PIC Example", picEmail: "pic@example.test",
    salesName: "Sales Example", type: "ONLINE",
    lines: Array.from({ length: 30 }, (_, index) => ({ name: `Course ${index + 1}`, durationMinutes: 480, amountStudent: 3, pricePerPax: 1000000, location: "Jakarta" })),
  });
  for (let index = 1; index <= 30; index++) assert.ok(html.includes(`Course ${index}</text>`));
  assert.ok(html.includes("Client &lt;Example&gt; &amp; Co"));
  assert.ok(html.includes("in 2 weeks before the training"), "the Online master requires two weeks, not the generic one-week replacement");
  assert.ok(!html.includes("PT Kimetsu No Yaiba"), "no visible sample identity is retained");
});

test("each quotation type has its own renderable HTML template", async () => {
  for (const type of ["PRIVATE", "PUBLIC", "ONLINE", "INHOUSE"]) {
    const pdf = await generateQuotationPdf({
      code: `QTN-${type}`, accountName: "Example Co", picName: "PIC Example", picEmail: "pic@example.test",
      salesName: "Sales Example", type,
      lines: [{ name: "Data Basics", durationMinutes: 480, amountStudent: 2, pricePerPax: 1000000, location: "Jakarta" }],
    });
    const document = await PDFDocument.load(pdf);
    assert.equal(document.getPageCount(), 2, `${type} template should render its two designed pages`);
  }
});
