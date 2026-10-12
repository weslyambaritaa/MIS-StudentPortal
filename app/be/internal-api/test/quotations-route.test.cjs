const assert=require('node:assert/strict');
const test=require('node:test');
const express=require('express');

process.env.NODE_ENV='test';
process.env.SERVICE_SHARED_SECRET??='quotation-test-service-secret';
process.env.GATEWAY_SHARED_SECRET??='quotation-test-gateway-secret';
process.env.DB_HOST??='127.0.0.1';
process.env.DB_NAME??='mis-test';
process.env.DB_USER??='test';
process.env.DB_PASSWORD??='test';

const {sequelize}=require('../dist/database/sequelize');
const {RoleAccessMatrix,AuditTrail}=require('../dist/database/models');
const {quotationsRouter}=require('../dist/modules/quotations/quotations.route');
const {keycloakAccountProvisioner}=require('../dist/modules/accounts/keycloak-account-provisioner');
const {errorHandler}=require('../dist/middlewares/error-handler.middleware');
const {AppError}=require('../dist/errors/app-error');
const input={quotationCode:' 171/S/IV/2026 ',accountId:'account-1',picId:'pic-1',classType:'PRIVATE',lines:[{courseId:'course-1',amountStudent:5,pricePerPax:1000123,location:'Atrium1'}]};

async function scenario(run,{duplicate=false}={}) {
  const originals={query:sequelize.query,transaction:sequelize.transaction,matrix:RoleAccessMatrix.findOne,audit:AuditTrail.create,identity:keycloakAccountProvisioner.getIdentity};
  const calls=[],audits=[];
  let quote={id:'quote-1',quotation_code:'OLD-CODE',account_id:'account-1',pic_profile_id:'pic-1',created_by_subject:'sales-1',class_type:'PRIVATE',status:'WAITING',deleted_at:null};
  RoleAccessMatrix.findOne=async ({attributes})=>({[attributes[0]]:true});
  AuditTrail.create=async record=>{audits.push(record);return record;};
  sequelize.transaction=async callback=>callback({});
  // No actual Keycloak, SMTP or Cloudinary operation is allowed in these tests.
  keycloakAccountProvisioner.getIdentity=async()=>{throw new AppError(503,'Delivery intentionally disabled in test');};
  sequelize.query=async (sql,options)=>{
    calls.push({sql,replacements:options?.replacements});
    if(sql.includes('NEXT VALUE'))throw new Error('Quotation codes must never be generated automatically');
    if(sql.includes('WITH (UPDLOCK,HOLDLOCK)'))return duplicate?[{id:'other-quotation'}]:quote.quotation_code===options.replacements.code?[{id:quote.id}]:[];
    if(sql.startsWith('INSERT INTO [dbo].[quotation]')){quote={...quote,id:options.replacements.id,quotation_code:options.replacements.code};return [];}
    if(sql.startsWith('UPDATE [dbo].[quotation] SET [quotation_code]')){quote={...quote,quotation_code:options.replacements.code};return [];}
    if(sql.includes('SELECT q.*'))return [{...quote,pic_email:'pic@example.test'}];
    if(sql.startsWith('SELECT [course_id]'))return [{course_id:'course-1',amount_student:5,price:'1000123',location:'Atrium1'}];
    if(sql.includes('FROM [dbo].[account] a'))return [{id:'account-1',name:'Client',account_type:'CORPORATE'}];
    if(sql.includes('FROM [dbo].[pic_profile] pp'))return [{id:'pic-1',name:'PIC',email:'pic@example.test'}];
    if(sql.includes('FROM [dbo].[course]'))return [{id:'course-1',name:'Communication Fundamentals',duration_minutes:480}];
    return [];
  };
  const app=express();
  app.use(express.json());
  app.use((req,_res,next)=>{req.auth={userId:'sales-1',activeRole:'sales',roles:['sales']};next();});
  app.use('/quotations',quotationsRouter);
  app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try {await run({base:`http://127.0.0.1:${server.address().port}`,calls,audits});}
  finally {
    await new Promise(resolve=>server.close(resolve));
    sequelize.query=originals.query;sequelize.transaction=originals.transaction;RoleAccessMatrix.findOne=originals.matrix;AuditTrail.create=originals.audit;keycloakAccountProvisioner.getIdentity=originals.identity;
  }
}
const send=(base,path,method,body)=>fetch(`${base}${path}`,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('manual quotation code is required and validated before database writes',async()=>{
  await scenario(async({base,calls})=>{
    for(const quotationCode of [undefined,'   ','x'.repeat(31),'bad\ncode','bad\\code']) {
      const response=await send(base,'/quotations','POST',{...input,quotationCode});
      assert.equal(response.status,400);
    }
    assert.equal(calls.length,0);
  });
});
test('creation stores the manually entered code, including slashes, without consuming a sequence',async()=>{
  await scenario(async({base,calls,audits})=>{
    const response=await send(base,'/quotations','POST',input);
    assert.equal(response.status,503,'delivery is stubbed, not sent to a real PIC');
    assert.equal((await response.json()).item.quotation_code,'171/S/IV/2026');
    const insert=calls.find(call=>call.sql.startsWith('INSERT INTO [dbo].[quotation]'));
    assert.equal(insert.replacements.code,'171/S/IV/2026');
    assert.equal(audits[0].action,'CREATE');
    assert.ok(calls.some(call=>call.sql.includes('WITH (UPDLOCK,HOLDLOCK)')));
    assert.ok(!calls.some(call=>call.sql.includes('NEXT VALUE')));
  });
});
test('duplicate manual codes, including reserved codes, are rejected before creating or editing',async()=>{
  await scenario(async({base,calls})=>{
    for(const [path,method] of [['/quotations','POST'],['/quotations/quote-1','PUT']]) {
      const response=await send(base,path,method,input);
      assert.equal(response.status,409);
      assert.match((await response.json()).message,/already in use/);
    }
    assert.ok(!calls.some(call=>/^(INSERT|UPDATE|DELETE)/.test(call.sql)));
    assert.ok(calls.filter(call=>call.sql.includes('WITH (UPDLOCK,HOLDLOCK)')).every(call=>!call.sql.includes('deleted_at')));
  },{duplicate:true});
});
test('editing updates the manual code and audits the change without changing internal identity',async()=>{
  await scenario(async({base,calls,audits})=>{
    const response=await send(base,'/quotations/quote-1','PUT',input);
    assert.equal(response.status,503);
    const update=calls.find(call=>call.sql.startsWith('UPDATE [dbo].[quotation] SET [quotation_code]'));
    assert.equal(update.replacements.code,'171/S/IV/2026');
    assert.equal(update.replacements.id,'quote-1');
    assert.equal(JSON.parse(audits[0].data_before).quotation_code,'OLD-CODE');
    assert.equal(JSON.parse(audits[0].data_after).quotation_code,'171/S/IV/2026');
  });
});
test('editing with the unchanged manual code is permitted',async()=>{
  await scenario(async({base,calls})=>{
    const response=await send(base,'/quotations/quote-1','PUT',{...input,quotationCode:'OLD-CODE'});
    assert.equal(response.status,503);
    assert.ok(calls.some(call=>call.sql.startsWith('UPDATE [dbo].[quotation] SET [quotation_code]')));
  });
});
