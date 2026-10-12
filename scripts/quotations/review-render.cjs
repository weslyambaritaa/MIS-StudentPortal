const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require('playwright-core');
const { generateQuotationPdf } = require('../../app/be/internal-api/dist/modules/quotations/quotation-document');
const root = join(__dirname, '../..');
const directory = join(root, '.tmp-quotation-review');
const templates = join(root, 'app/be/internal-api/src/modules/quotations/templates');
const samples = {
  PRIVATE: { code:'171/S/IV/2026', date:new Date('2026-04-28T00:00:00Z'), picName:'Mr. Wesly Ambarita', salesName:'Wesly Yang', lines:[
    {name:'Managing and Presenting Business Data in Excel 2016',durationMinutes:480,amountStudent:10,pricePerPax:2400000,location:'Office – ETOJ, Setiabudi Atrium'},
    {name:'Data Management and Analysis in Excel 2016',durationMinutes:960,amountStudent:10,pricePerPax:4600000,location:'Office – ETOJ, Setiabudi Atrium'},
  ] },
  PUBLIC: {code:'095/S/III/2026',date:new Date('2026-04-13T00:00:00Z'),picName:'Ms. Putri Kusuma Putra',salesName:'Silvia Yang',lines:[{name:'Effective Root Cause Analysis',durationMinutes:960,amountStudent:3,pricePerPax:5500000,location:'ExecuTrain – Setiabudi Atrium'}]},
  ONLINE: {code:'285/S/VII/2026',date:new Date('2026-07-10T00:00:00Z'),picName:'PIC Example',salesName:'Silvia Yang',lines:[{name:'Microsoft Excel 365 Customized for PT Kimetsu No Yaiba',durationMinutes:480,amountStudent:25,pricePerPax:1029000,location:'ONLINE TEAMS'}]},
  INHOUSE: {code:'133/S/IV/2026',date:new Date('2026-04-13T00:00:00Z'),picName:'Ms. Gita Purnama',salesName:'Silvia Yang',lines:[{name:'Building Trust Through Active Listening for HR',durationMinutes:480,amountStudent:10,pricePerPax:2250000,location:'Office – SANF, Jakarta'}]},
};
(async()=>{
  mkdirSync(directory,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for(const [type,sample] of Object.entries(samples)) {
      const name=type.toLowerCase();
      const images=[1,2].map(number=>{
        const prefix=`${name}-${number}`;
        const svg=readFileSync(join(templates,`artwork/${name}-${number}.svg`),'utf8').replace(/<\?xml[^>]*\?>\s*/,'').replace('<svg ','<svg class="artwork" ').replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix}-${id}"`).replace(/xlink:href="#([^"]+)"/g,(_,id)=>`xlink:href="#${prefix}-${id}"`).replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#${prefix}-${id})`);
        return `<section class="page">${svg}</section>`;
      }).join('');
      const page=await browser.newPage();
      await page.setContent(`<style>${readFileSync(join(templates,'quotation-style.css'),'utf8')}</style>${images}`);
      await page.evaluate(async()=>{await Promise.all(Array.from(document.images,image=>image.decode()));});
      writeFileSync(join(directory,`${name}-clone.pdf`),await page.pdf({printBackground:true,preferCSSPageSize:true}));
      await page.close();
      writeFileSync(join(directory,`${name}-generated.pdf`),await generateQuotationPdf({...sample,type,accountName:'PT Kimetsu No Yaiba',picEmail:'pic@example.test'}));
      writeFileSync(join(directory,`${name}-client.pdf`),await generateQuotationPdf({type,code:'QTN-000099',date:new Date('2026-10-08T00:00:00Z'),accountName:'PT Executrain Nusantarajaya',picName:'roqi',picEmail:'weslyexecutrain@gmail.com',salesName:'Wesly Ambarita',lines:[{name:'Communication Fundamentals',durationMinutes:480,amountStudent:5,pricePerPax:1000000,location:'Setiabudi Atrium'}]}));
      console.log('Rendered source clone and quotation:',type);
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
