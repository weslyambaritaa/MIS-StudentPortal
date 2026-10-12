import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";

export type QuotationType = "PRIVATE" | "PUBLIC" | "INHOUSE" | "ONLINE";
export type QuotationPdfLine = { name: string; durationMinutes: number; amountStudent: number; pricePerPax: number; location: string };
export type QuotationPdfInput = {
  code: string; accountName: string; picName: string; picEmail: string; salesName: string;
  type: QuotationType; lines: QuotationPdfLine[]; date?: Date;
};

// Intentionally shared, as requested; edit this one value when bank details change.
export const BANK_TRANSFER_DETAILS = "Bank Permata - Account No. : 205129.014 (IDR)";
export const VAT_RATE: Record<QuotationType, number> = { PUBLIC: .11, ONLINE: .11, PRIVATE: .12, INHOUSE: .12 };

type Layout = {
  date: number; code: number; account: number; pic?: number; intro: number;
  tableTop: number; tableHeight: number; columns: number[]; capacity: number;
  clientPage: number; clientTop: number; confirmation: number; reschedule: number;
  bank: number; sales: number; weeks: number;
};
// Coordinates in PDF points, measured from the supplied master documents.
const layouts: Record<QuotationType, Layout> = {
  PRIVATE: { date:119.18, code:133.70, account:156.14, pic:169.58, intro:232.94,
    tableTop:315.18, tableHeight:140.52, columns:[90.024,325.9,410.2,482.1,565.22], capacity:2,
    clientPage:2, clientTop:96.98, confirmation:181.46, reschedule:208.22, bank:351.65, sales:547.27, weeks:1 },
  PUBLIC: { date:119.18, code:133.70, account:156.14, pic:169.58, intro:248.93,
    tableTop:330.18, tableHeight:73.87, columns:[90.024,352.0,520.58], capacity:1,
    clientPage:1, clientTop:623.86, confirmation:124.70, reschedule:151.58, bank:295.01, sales:513.07, weeks:1 },
  ONLINE: { date:96.74, code:111.14, account:133.70, intro:197.06,
    tableTop:282.18, tableHeight:95.36, columns:[90.024,317.0,392.0,466.0,565.22], capacity:1,
    clientPage:1, clientTop:581.02, confirmation:96.62, reschedule:123.50, bank:266.93, sales:484.99, weeks:2 },
  INHOUSE: { date:119.18, code:133.70, account:156.14, pic:169.58, intro:232.94,
    tableTop:315.18, tableHeight:66.52, columns:[90.024,325.9,410.2,477.8,565.22], capacity:1,
    clientPage:1, clientTop:618.70, confirmation:136.94, reschedule:163.82, bank:307.13, sales:502.75, weeks:2 },
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]!));
const money = (value: number) => Math.round(value).toLocaleString("en-US");
const days = (minutes: number) => Math.max(1, Math.ceil(minutes / 480));
const dateLabel = (date: Date) => new Intl.DateTimeFormat("en-GB", { timeZone:"Asia/Jakarta", day:"numeric", month:"numeric", year:"numeric" }).format(date).replace(/\b0(?=\d)/g, "");

async function asset(filename: string): Promise<Buffer> {
  for (const root of [join(__dirname,"templates"), join(process.cwd(),"src/modules/quotations/templates")]) {
    try { return await readFile(join(root,filename)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  throw new Error(`Quotation reference asset not found: ${filename}`);
}

const rectangle = (x:number,y:number,width:number,height:number) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white"/>`;
const rule = (x1:number,y1:number,x2:number,y2:number) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="black" stroke-width="0.5" fill="none"/>`;
function text(value:string,x:number,top:number,width:number,options:{bold?:boolean;aptos?:boolean;center?:boolean;wrapHeight?:number;role?:'name'|'value'}={}):string {
  const family = options.bold ? "bold" : options.aptos ? "aptos" : "";
  const attributes = options.wrapHeight
    ? `data-wrap-width="${width}" data-wrap-height="${options.wrapHeight}"`
    : `data-max-width="${width}"`;
  return `<text class="${family}" x="${x}" y="${top+8.03}" ${attributes}${options.center ? ' text-anchor="middle"' : ""}${options.role ? ` data-course-${options.role}=""` : ''}>${escapeHtml(value)}</text>`;
}
function replace(value:string,x:number,top:number,width:number,height=13.44,options:Parameters<typeof text>[4]={}):string {
  const centerX=options.center ? x+width/2 : x;
  return rectangle(x,top-1,width,height+1)+text(value,centerX,top,width,options);
}
const overlay = (content:string) => `<svg class="fields" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792">${content}</svg>`;

function identity(input:QuotationPdfInput,layout:Layout):string {
  let content=replace(`Jakarta, ${dateLabel(input.date ?? new Date())}`,90.024,layout.date,300,13.44,{bold:true});
  content+=replace(input.code,90.024,layout.code,300,13.44,{bold:true});
  content+=replace(input.accountName,132.0,layout.account,426,13.44,{bold:true});
  if(layout.pic!==undefined) content+=replace(input.picName,132.0,layout.pic,426);
  content+=replace(`${input.accountName}${input.type==='INHOUSE'?'':'.'}`,106.0,layout.intro,452,13.44,{bold:true});
  return content;
}
function client(input:QuotationPdfInput,layout:Layout):string {
  // Replace the complete client heading, including its old colon; preserve the original provider list.
  return rectangle(90.024,layout.clientTop-1,468,15.5)+`<text x="90.024" y="${layout.clientTop+8.03}" data-max-width="468"><tspan class="bold">${escapeHtml(input.accountName)}</tspan> will provide :</text>`;
}

function courseTable(input:QuotationPdfInput,lines:QuotationPdfLine[],top:number,height:number):string {
  const layout=layouts[input.type], xs=layout.columns;
  let content=`<g data-course-table="" data-table-top="${top}" data-master-height="${height}" data-columns="${xs.join(',')}"><rect data-table-mask="" x="${xs[0]}" y="${top}" width="${xs[xs.length-1]-xs[0]}" height="${height}" fill="white"/>`;
  let consumedHeight=0;
  for(let index=0;index<lines.length;index++) {
    // The Private master has unequal course rows (73.56pt and 66.96pt).
    const rowHeight=input.type==='PRIVATE'&&lines.length===2&&height===layout.tableHeight
      ? (index===0?73.56:66.96) : height/lines.length;
    const line=lines[index], rowTop=top+consumedHeight;
    consumedHeight+=rowHeight;
    content+=`<g data-course-row="" data-original-top="${rowTop}">`;
    const nameHeight=input.type==='ONLINE'?28:27;
    const nameOffset=input.type==='PUBLIC'?2.63:input.type==='ONLINE'?2.39:3.76;
    content+=text(line.name,xs[0]+5.64,rowTop+nameOffset,xs[1]-xs[0]-11,{aptos:input.type==='PRIVATE'||input.type==='INHOUSE',bold:input.type==='ONLINE',wrapHeight:nameHeight,role:'name'});
    let detailsTop=rowTop+(input.type==='PRIVATE'&&rowHeight>=73?43.96:36.64);
    if(input.type==='PUBLIC') {
      detailsTop=rowTop+35.51;
      content+='<g data-course-details="">';
      content+=text(`* Scheduled: TBA (${line.amountStudent} Pax)`,xs[0]+5.64,detailsTop,xs[1]-xs[0]-11);
      content+=text(`* Duration: ${days(line.durationMinutes)} Day${days(line.durationMinutes)>1?'s':''}`,xs[0]+5.64,detailsTop+13.44,xs[1]-xs[0]-11);
      content+=text(`* Location : ${line.location}`,xs[0]+5.64,detailsTop+26.88,xs[1]-xs[0]-11);
      content+='</g>';
      content+=text(`${money(line.pricePerPax)}/pax/${days(line.durationMinutes)} day${days(line.durationMinutes)>1?'s':''}`,(xs[1]+xs[2])/2,rowTop+rowHeight/2-4.425,xs[2]-xs[1]-10,{center:true,role:'value'});
    } else {
      content+='<g data-course-details="">';
      if(input.type==='ONLINE') {
        detailsTop=rowTop+42.71;
        content+=text('*Scheduled : TBA',xs[0]+5.64,detailsTop,xs[1]-xs[0]-11);
        content+=text(`* Duration: ${days(line.durationMinutes)} Day${days(line.durationMinutes)>1?'s':''}`,xs[0]+5.64,detailsTop+13.44,xs[1]-xs[0]-11);
        content+=text('* Time: 08.30 – 16.30',xs[0]+5.64,detailsTop+26.88,xs[1]-xs[0]-11);
        content+=text(`*Location: ${line.location}`,xs[0]+5.64,detailsTop+40.32,xs[1]-xs[0]-11);
      } else {
        content+=text(`* Duration: ${days(line.durationMinutes)} Day${days(line.durationMinutes)>1?'s':''}`,xs[0]+5.64,detailsTop,xs[1]-xs[0]-11,{aptos:true});
        content+=text(`* Location: ${line.location}`,xs[0]+5.64,detailsTop+13.44,xs[1]-xs[0]-11,{aptos:true});
      }
      content+='</g>';
      const values=input.type==='ONLINE'
        ? [`${line.amountStudent} Pax`,money(line.pricePerPax),money(line.amountStudent*line.pricePerPax)]
        : [String(line.amountStudent),money(line.amountStudent*line.pricePerPax),money(line.pricePerPax)];
      const numericOffset=input.type==='ONLINE'?-4.97:-3.34;
      // Use one complete Calibri digit family for the entire numeric field;
      // the Aptos subset in the supplied masters lacks several digits.
      values.forEach((value,col)=>{content+=text(value,(xs[col+1]+xs[col+2])/2,rowTop+rowHeight/2+numericOffset,xs[col+2]-xs[col+1]-10,{center:true,role:'value'});});
    }
    content+='</g>';
  }
  content+='<g data-table-grid="">';
  for(const x of xs)content+=rule(x,top,x,top+height);
  content+=rule(xs[0],top,xs[xs.length-1],top)+rule(xs[0],top+height,xs[xs.length-1],top+height);
  return content+'</g></g>';
}

function terms(input:QuotationPdfInput,layout:Layout):string {
  let content='';
  if(layout.clientPage===2)content+=client(input,layout);
  content+=replace(`Training confirmation should be made by ${input.accountName} in ${layout.weeks} week${layout.weeks>1?'s':''} before the training will be delivered;`,144.02,layout.confirmation,414.3,26.88,{wrapHeight:26.88});
  const separator=input.type==='ONLINE'?',':input.type==='INHOUSE'?' ,':'';
  content+=replace(`In case there is a schedule change from ${input.accountName}${separator} Training schedule’s alteration should be made latest 4 working day before the agreed schedule’s training date will be delivered.`,144.02,layout.reschedule,414.3,40.32,{wrapHeight:40.32});
  content+=replace(BANK_TRANSFER_DETAILS,90.024,layout.bank,468,13.44,{center:true,bold:true});
  content+=replace(input.salesName,90.024,layout.sales,350);
  return content;
}

async function stylesheet():Promise<string> {
  const faces=JSON.parse((await asset('artwork/fonts.json')).toString('utf8')) as {family:string;file:string;unicodeRange:string}[];
  const fonts=await Promise.all(faces.map(face=>asset(`artwork/${face.file}`)));
  // Complementary subsets keep all digits in their original font rather than
  // falling back to Arial whenever a master PDF did not contain a given digit.
  return fonts.map((buffer,i)=>`@font-face{font-family:${faces[i].family};src:url(data:font/ttf;base64,${buffer.toString('base64')}) format('truetype');unicode-range:${faces[i].unicodeRange};}`).join('\n')+'\n'+(await asset('quotation-style.css')).toString('utf8');
}
// Inline vectors preserve the master artwork and embedded logo. Prefix every
// definition/reference so fonts, clips, and images on different pages never collide.
const artwork = (svg:Buffer,prefix:string) => svg.toString('utf8')
  .replace(/<\?xml[^>]*\?>\s*/, '')
  .replace('<svg ', '<svg class="artwork" ')
  .replace(/id="([^"]+)"/g,(_,id:string)=>`id="${prefix}-${id}"`)
  .replace(/xlink:href="#([^"]+)"/g,(_,id:string)=>`xlink:href="#${prefix}-${id}"`)
  .replace(/url\(#([^)]*)\)/g,(_,id:string)=>`url(#${prefix}-${id})`);

function compactArtwork(svg:Buffer,prefix:string,layout:Layout):string {
  const vector=artwork(svg,prefix);
  const match=vector.match(/^([\s\S]*<\/defs>)([\s\S]*)<\/svg>\s*$/);
  if(!match)throw new Error('Quotation artwork is missing vector definitions');
  const [,head,body]=match, bottom=layout.tableTop+layout.tableHeight;
  // Retain the original header, VAT row, clauses and footer. Only the table
  // body is replaced; the content below it moves up by the measured shrinkage.
  return `${head}<defs>
    <clipPath id="${prefix}-top"><rect width="612" height="${layout.tableTop}"/></clipPath>
    <clipPath id="${prefix}-tail"><rect y="${bottom}" width="612" height="${730-bottom}"/></clipPath>
    <clipPath id="${prefix}-footer"><rect y="730" width="612" height="62"/></clipPath>
    </defs><g clip-path="url(#${prefix}-top)">${body}</g>
    <g data-master-tail=""><g clip-path="url(#${prefix}-tail)">${body}</g></g>
    <g clip-path="url(#${prefix}-footer)">${body}</g></svg>`;
}

export async function renderQuotationHtml(input:QuotationPdfInput):Promise<string> {
  if(!input.lines.length)throw new Error('A quotation PDF requires at least one course');
  const layout=layouts[input.type];
  if(!layout)throw new Error('Unsupported quotation type');
  const name=input.type.toLowerCase();
  const [template,styles,page1,page2]=await Promise.all([asset(`${name}.html`),stylesheet(),asset(`artwork/${name}-1.svg`),asset(`artwork/${name}-2.svg`)]);
  const firstLines=input.lines.slice(0,layout.capacity);
  let first=identity(input,layout)+courseTable(input,firstLines,layout.tableTop,layout.tableHeight);
  let tailFields=layout.clientPage===1?client(input,layout):'';
  if(input.type==='INHOUSE')tailFields+=rectangle(90.024,444.75,468,15.5)+`<text x="90.024" y="453.78" data-max-width="468">Onsite Training will be held at <tspan class="bold">${escapeHtml(input.accountName)}</tspan></text>`;
  first+=`<g data-master-tail-fields="">${tailFields}</g>`;
  const remaining=input.lines.slice(layout.capacity);
  const continuation:string[]=[];
  const continuationCapacity=input.type==='ONLINE'?4:5;
  for(let offset=0;offset<remaining.length;offset+=continuationCapacity) {
    const lines=remaining.slice(offset,offset+continuationCapacity);
    const height=(input.type==='ONLINE'?95.36:74)*lines.length;
    let fields=rectangle(89.5,layout.tableTop,476.5,732-layout.tableTop)+identity(input,layout)+courseTable(input,lines,layout.tableTop,height);
    fields+=`<g data-master-tail-fields="">${replace(`Price Excluding VAT ${Math.round(VAT_RATE[input.type]*100)}%`,90.024,layout.tableTop+height+4,layout.columns.at(-1)!-90.024,14,{bold:true,center:true})}</g>`;
    fields+=replace(String(continuation.length+2),315,733.54,18,14,{center:true});
    continuation.push(`<section class="page">${artwork(page1,`${name}-continued-${offset}`)}${overlay(fields)}</section>`);
  }
  let last=terms(input,layout);
  if(continuation.length)last+=replace(String(continuation.length+2),315,733.54,18,14,{center:true});
  const values:Record<string,string>={styles,artwork1:compactArtwork(page1,`${name}-first`,layout),fields1:overlay(first),artwork2:artwork(page2,`${name}-last`),fields2:overlay(last),continuationPages:continuation.join('')};
  return template.toString('utf8').replace(/{{(\w+)}}/g,(_,key:string)=>{
    if(!(key in values))throw new Error(`Unknown quotation template value: ${key}`);
    return values[key];
  });
}

export async function prepareQuotationPage(page:Page,input:QuotationPdfInput):Promise<void> {
    await page.setContent(await renderQuotationHtml(input),{waitUntil:'load'});
    await page.evaluate(async()=>{
      await document.fonts.ready;
      await Promise.all(Array.from(document.images,image=>image.decode()));
      for(const element of document.querySelectorAll<SVGTextElement>('text[data-wrap-width]')) {
        const value=element.textContent||'',width=Number(element.dataset.wrapWidth),height=Number(element.dataset.wrapHeight),x=element.getAttribute('x')!;
        const words=value.split(/\s+/);
        let fontSize=11.04, rows:string[]=[];
        while(fontSize>=6) {
          element.style.fontSize=`${fontSize}px`;
          rows=[];let row='';
          for(const word of words) {
            const candidate=row?`${row} ${word}`:word;
            element.textContent=candidate;
            if(row && element.getComputedTextLength()>width){rows.push(row);row=word;}else row=candidate;
          }
          if(row)rows.push(row);
          if(rows.length*Math.min(13.44,fontSize*(13.44/11.04))<=height+.1)break;
          fontSize-=.25;
        }
        element.textContent='';
        rows.forEach((row,index)=>{
          const span=document.createElementNS('http://www.w3.org/2000/svg','tspan');
          span.setAttribute('x',x);span.setAttribute('dy',index?String(Math.min(13.44,fontSize*(13.44/11.04))):'0');span.textContent=row;element.appendChild(span);
          if(span.getComputedTextLength()>width){span.setAttribute('textLength',String(width));span.setAttribute('lengthAdjust','spacingAndGlyphs');}
        });
      }
      for(const element of document.querySelectorAll<SVGTextElement>('text[data-max-width]')) {
        const width=Number(element.dataset.maxWidth);
        if(element.getComputedTextLength()>width){element.setAttribute('textLength',String(width));element.setAttribute('lengthAdjust','spacingAndGlyphs');}
      }
      for(const table of document.querySelectorAll<SVGGElement>('[data-course-table]')) {
        const top=Number(table.dataset.tableTop),masterHeight=Number(table.dataset.masterHeight),columns=table.dataset.columns!.split(',').map(Number);
        let currentTop=top;
        const boundaries=[top];
        for(const row of table.querySelectorAll<SVGGElement>('[data-course-row]')) {
          const originalTop=Number(row.dataset.originalTop);
          const name=row.querySelector<SVGTextElement>('[data-course-name]')!.getBBox();
          const details=row.querySelector<SVGGElement>('[data-course-details]')!,detailBounds=details.getBBox();
          const detailsTop=name.y+name.height+8;
          details.setAttribute('transform',`translate(0 ${detailsTop-detailBounds.y})`);
          const rowHeight=Math.max(48,detailsTop+detailBounds.height+6-originalTop);
          for(const value of row.querySelectorAll<SVGTextElement>('[data-course-value]')) {
            const bounds=value.getBBox(),baseline=Number(value.getAttribute('y'));
            value.setAttribute('y',String(originalTop+rowHeight/2+baseline-bounds.y-bounds.height/2));
          }
          row.setAttribute('transform',`translate(0 ${currentTop-originalTop})`);
          currentTop+=rowHeight;
          boundaries.push(currentTop);
        }
        const height=currentTop-top;
        table.dataset.renderedHeight=String(height);
        table.querySelector('[data-table-mask]')!.setAttribute('height',String(height));
        const grid=table.querySelector('[data-table-grid]')!;
        grid.replaceChildren();
        for(const d of [...columns.map(x=>`M${x} ${top}L${x} ${currentTop}`),...boundaries.map(y=>`M${columns[0]} ${y}L${columns[columns.length-1]} ${y}`)]) {
          const path=document.createElementNS('http://www.w3.org/2000/svg','path');
          path.setAttribute('d',d);path.setAttribute('stroke','black');path.setAttribute('stroke-width','.5');path.setAttribute('fill','none');grid.appendChild(path);
        }
        const section=table.closest('.page')!;
        for(const tail of section.querySelectorAll('[data-master-tail],[data-master-tail-fields]'))tail.setAttribute('transform',`translate(0 ${height-masterHeight})`);
      }
    });
}

export async function generateQuotationPdf(input:QuotationPdfInput):Promise<Buffer> {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    const page=await browser.newPage({javaScriptEnabled:false});
    await prepareQuotationPage(page,input);
    return Buffer.from(await page.pdf({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,margin:{top:0,right:0,bottom:0,left:0}}));
  } finally {await browser.close();}
}
