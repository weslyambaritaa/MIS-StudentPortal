const {readFileSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const PNG=require('@pdf-lib/upng').default;
const directory=join(__dirname,'../../.tmp-quotation-review');
const report=[];
const layouts={
  private:{date:119.18,code:133.70,account:156.14,pic:169.58,intro:232.94,table:[90,315.18,476,140.52],clientPage:2,client:96.98,confirmation:181.46,reschedule:208.22,bank:351.65,sales:547.27},
  public:{date:119.18,code:133.70,account:156.14,pic:169.58,intro:248.93,table:[90,330.18,431,73.87],clientPage:1,client:623.86,confirmation:124.70,reschedule:151.58,bank:295.01,sales:513.07},
  online:{date:96.74,code:111.14,account:133.70,intro:197.06,table:[90,282.18,476,95.36],clientPage:1,client:581.02,confirmation:96.62,reschedule:123.50,bank:266.93,sales:484.99},
  inhouse:{date:119.18,code:133.70,account:156.14,pic:169.58,intro:232.94,table:[90,315.18,476,66.52],clientPage:1,client:618.70,confirmation:136.94,reschedule:163.82,bank:307.13,sales:502.75},
};
const decode=name=>{const image=PNG.decode(readFileSync(join(directory,name)));return {...image,rgba:new Uint8Array(PNG.toRGBA8(image)[0])};};
const delta=(a,b,i,j)=>Math.abs(a[i]-b[j])+Math.abs(a[i+1]-b[j+1])+Math.abs(a[i+2]-b[j+2]);
const offsets=[[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
// Poppler hints PDF fonts; Chromium prints exported glyph paths. The resulting
// antialias shades differ at text edges, although the vector geometry is intact.
// Allow at most one grayscale level of average error after a one-pixel edge
// match. The separate clone/quotation check must remain pixel-identical outside
// the explicitly replaced data, so this is not a tolerance for shifted layout.
const referenceRasterTolerance=1/255;
const logoPixels=image=>{
  let count=0;
  for(let y=50;y<112;y++)for(let x=540;x<746;x++){
    const i=(y*image.width+x)*4;
    if(image.rgba[i]<245||image.rgba[i+1]<245||image.rgba[i+2]<245)count++;
  }
  return count;
};
for(const type of Object.keys(layouts))for(const page of [1,2]) {
  const source=decode(`${type}-${page}.png`),clone=decode(`${type}-clone-${page}.png`),generated=decode(`${type}-generated-${page}.png`),client=decode(`${type}-client-${page}.png`);
  if([clone,generated,client].some(image=>source.width!==image.width||source.height!==image.height))throw new Error(`Page dimensions differ: ${type} ${page}`);
  const l=layouts[type];let masks=[];
  if(page===1){masks=[[90,l.date-2,302,17],[90,l.code-2,302,17],[131,l.account-2,428,17],[105,l.intro-2,454,17],l.table];if(l.pic)masks.push([131,l.pic-2,428,17]);if(type==='inhouse')masks.push([89,443,470,19]);}
  // Content-based table height intentionally moves VAT and following clauses.
  // Header/logo/footer remain comparable to the unchanged master. Compact table
  // geometry and font fallback are checked separately by the browser tests.
  if(page===1)masks.push([89,l.table[1],478,730-l.table[1]]);
  if(page===l.clientPage)masks.push([89,l.client-2,470,19]);
  if(page===2)masks.push([143,l.confirmation-2,416,30],[143,l.reschedule-2,416,44],[89,l.bank-2,470,17],[89,l.sales-2,352,17]);
  masks=masks.map(([x,y,w,h])=>[(x-1)*4/3,(y-1)*4/3,(x+w+1)*4/3,(y+h+1)*4/3]);
  let raw=0,tolerant=0,staticDelta=0,staticClientDelta=0,staticCount=0;
  const changedBounds=[source.width,source.height,0,0];
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++) {
    const i=(y*source.width+x)*4,d=delta(source.rgba,clone.rgba,i,i);raw+=d;
    if(d){let forward=d,reverse=d;for(const [dx,dy] of offsets){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=source.width||ny>=source.height)continue;const j=(ny*source.width+nx)*4;forward=Math.min(forward,delta(source.rgba,clone.rgba,i,j));reverse=Math.min(reverse,delta(clone.rgba,source.rgba,i,j));if(!forward&&!reverse)break;}tolerant+=(forward+reverse)/2;}
    if(!masks.some(([left,top,right,bottom])=>x>=left&&x<=right&&y>=top&&y<=bottom)){const changed=delta(clone.rgba,generated.rgba,i,i);staticDelta+=changed;staticClientDelta+=delta(clone.rgba,client.rgba,i,i);staticCount++;if(changed){changedBounds[0]=Math.min(changedBounds[0],x);changedBounds[1]=Math.min(changedBounds[1],y);changedBounds[2]=Math.max(changedBounds[2],x);changedBounds[3]=Math.max(changedBounds[3],y);}}
  }
  const pixels=source.width*source.height;
  const item={type,page,layoutAdjustment:page===1?'compact-table-and-following-content':'none',normalizedPixelError:raw/(pixels*3*255),edgeTolerantPixelError:tolerant/(pixels*3*255),staticRegionPixelError:staticDelta/(staticCount*3*255),staticClientRegionPixelError:staticClientDelta/(staticCount*3*255),logoPixelCounts:[source,clone,generated,client].map(logoPixels)};
  report.push(item);console.log(JSON.stringify({...item,changedBounds:staticDelta?changedBounds:null}));
}
writeFileSync(join(directory,'visual-comparison.json'),JSON.stringify(report,null,2));
for(const item of report){
  if(item.edgeTolerantPixelError>referenceRasterTolerance)throw new Error(`Master artwork differs beyond raster edge tolerance: ${item.type} page ${item.page}`);
  if(item.staticRegionPixelError!==0||item.staticClientRegionPixelError!==0)throw new Error(`Quotation data changed static artwork: ${item.type} page ${item.page}`);
  if(item.logoPixelCounts.some(count=>count<item.logoPixelCounts[0]*.95))throw new Error(`Missing or incomplete logo: ${item.type} page ${item.page}`);
}
