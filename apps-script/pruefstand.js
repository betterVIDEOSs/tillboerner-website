// Prüfstand: lässt buchung.gs gegen einen nachgebauten Google-Kalender laufen. Aufruf: node apps-script/pruefstand.js apps-script/buchung.gs
const fs=require('fs'),vm=require('vm');const src=fs.readFileSync(process.argv[2],'utf8');
let JETZT=0; const RealDate=Date;
class D extends RealDate{constructor(...a){if(a.length===0)super(JETZT);else super(...a);}static now(){return JETZT;}}
const teile=(d,tz)=>{const f=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'});const o={};f.formatToParts(d).forEach(p=>o[p.type]=p.value);return o;};
const Utilities={formatDate(d,tz,fmt){const p=teile(d,tz);const wt={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[p.weekday];
  return fmt.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|u/g,(m,q)=>q!==undefined?q:({yyyy:p.year,MM:p.month,dd:p.day,HH:p.hour,mm:p.minute,u:String(wt)})[m]);},
 parseDate(s,tz){const [dt,t]=s.split(' ');const [y,mo,da]=dt.split('-').map(Number);const [h,mi]=t.split(':').map(Number);let g=RealDate.UTC(y,mo-1,da,h,mi);
  for(let i=0;i<3;i++){const p=teile(new RealDate(g),tz);const ist=RealDate.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);g-=ist-RealDate.UTC(y,mo-1,da,h,mi);}return new D(g);},
 getUuid:()=>'uuid-'+Math.random()};
const termine=[];const mails=[];const props={};const trigger=[];
const cache={};const CacheService={getScriptCache:()=>({get:k=>(cache[k]&&cache[k].bis>JETZT)?cache[k].v:null,put:(k,v,sek)=>{cache[k]={v,bis:JETZT+sek*1000};},remove:k=>{delete cache[k];}})};
const Calendar={Freebusy:{query(o){const a=new RealDate(o.timeMin).getTime(),b=new RealDate(o.timeMax).getTime();return {calendars:{primary:{busy:termine.filter(t=>!t.frei&&!t.abgesagt&&t.s<b&&t.e>a).map(t=>({start:new RealDate(t.s).toISOString(),end:new RealDate(t.e).toISOString()}))}}};}},Events:{insert(r,cal,opt){const t={id:'t'+termine.length,s:new RealDate(r.start.dateTime).getTime(),e:new RealDate(r.end.dateTime).getTime(),r,opt};termine.push(t);return {hangoutLink:r.conferenceData?'https://meet.google.com/abc-defg-hij':undefined,id:t.id};},
 list(cal,o){const a=new RealDate(o.timeMin).getTime(),b=new RealDate(o.timeMax).getTime();return {items:termine.filter(t=>t.r&&t.s<b&&t.e>a).map(t=>({id:t.id,status:'confirmed',start:t.r.start,hangoutLink:'https://meet.google.com/abc-defg-hij',attendees:t.r.attendees,extendedProperties:JSON.parse(JSON.stringify(t.r.extendedProperties))}))};},
 patch(r,cal,id){termine.find(t=>t.id===id).r.extendedProperties=r.extendedProperties;}}};
const ctx={Date:D,Utilities,CacheService,Calendar,JSON,Math,Number,String,parseInt,
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v;}})},
 MailApp:{sendEmail:(an,betreff,text,opt)=>mails.push({an,betreff,text,opt})},
 Session:{getEffectiveUser:()=>({getEmail:()=>'inhaber@example.com'})},
 ScriptApp:{getProjectTriggers:()=>trigger.map(f=>({getHandlerFunction:()=>f})),deleteTrigger(){},newTrigger:f=>({timeBased:()=>({everyMinutes:()=>({create:()=>trigger.push(f)})})})},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({text:t,setMimeType(){return this;}})}};
vm.createContext(ctx);vm.runInContext(src,ctx);
const berlin=(s)=>Utilities.parseDate(s,'Europe/Berlin').getTime();
const get=(q)=>JSON.parse(ctx.doGet({parameter:q||{}}).text);const post=(d)=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(d)}}).text);
let fehler=0;const pruef=(name,ok,info)=>{console.log((ok?'OK   ':'FEHLT')+' '+name+(ok?'':'  → '+JSON.stringify(info)));if(!ok)fehler++;};
// Donnerstag, 19.11.2026, 10:00 Uhr in Berlin
JETZT=berlin('2026-11-19 10:00');
termine.push({s:berlin('2026-11-20 14:00'),e:berlin('2026-11-20 15:00')});              // Dreh am Freitag
termine.push({s:berlin('2026-11-23 00:00'),e:berlin('2026-11-24 00:00'),frei:true});     // ganztägig, aber als „frei“ markiert
termine.push({s:berlin('2026-11-24 00:00'),e:berlin('2026-11-25 00:00')});               // ganztägig beschäftigt
let st=get({pruefen:'1'});pruef('Prüfaufruf meldet Dienst und Erinnerungen',st.ok&&st.meetDienst&&st.erinnerungen&&trigger.length===1,st);
get();pruef('Zeitplan wird nur einmal angelegt',trigger.length===1,trigger);
let tage=get().tage;const tag=d=>tage.find(t=>t.datum===d);
pruef('heute nichts mehr buchbar (12 Stunden Vorlauf)',tag('2026-11-19').zeiten.length===0,tag('2026-11-19'));
pruef('Samstag und Sonntag fehlen',!tag('2026-11-21')&&!tag('2026-11-22'),tage.map(t=>t.datum));
const fr=tag('2026-11-20').zeiten;pruef('Freitag: 14:00 und 15:00 gesperrt (Termin + Puffer), 13:00 und 16:00 frei',!fr.includes('14:00')&&!fr.includes('15:00')&&fr.includes('13:00')&&fr.includes('16:00'),fr);
pruef('erster und letzter Beginn 11:00 und 19:00',fr[0]==='11:00'&&fr[fr.length-1]==='19:00',fr);
pruef('„frei“ markierter Ganztagestermin sperrt nicht',tag('2026-11-23').zeiten.length===9,tag('2026-11-23'));
pruef('beschäftigter Ganztagestermin sperrt den Tag',tag('2026-11-24').zeiten.length===0,tag('2026-11-24'));
pruef('zwei Wochen Vorlauf: letzter Tag 3.12.',tage[tage.length-1].datum==='2026-12-03',tage[tage.length-1]);
const gut={name:'Maria Beispiel',email:'maria@beispiel.de',telefon:'',nachricht:'Imagefilm',website:'',datum:'2026-11-26',zeit:'16:00'};
pruef('falsche E-Mail wird abgelehnt',post({...gut,email:'maria'}).grund==='eingabe');
pruef('Bot-Falle: nichts wird eingetragen',post({...gut,website:'x'}).ok===true&&termine.length===3);
pruef('Zeit außerhalb des Fensters wird abgelehnt',post({...gut,zeit:'09:00'}).grund==='vergeben');
let b=post(gut);const neu=termine[3];
pruef('Buchung klappt und liefert Meet-Link',b.ok&&b.meet.startsWith('https://meet.google.com/'),b);
pruef('Termin steht richtig im Kalender (16:00–16:30 Berlin, Gast, Meet, Einladung)',neu&&neu.s===berlin('2026-11-26 16:00')&&neu.e-neu.s===1800000&&neu.r.attendees[0].email==='maria@beispiel.de'&&!!neu.r.conferenceData&&neu.opt.sendUpdates==='all'&&neu.opt.conferenceDataVersion===1,neu);
pruef('Mail an den Inhaber',mails.length===1&&mails[0].an==='inhaber@example.com'&&mails[0].text.includes('meet.google.com'),mails);
pruef('derselbe Termin ist danach vergeben',post(gut).grund==='vergeben');
pruef('gebuchte Zeit fehlt sofort in der Liste (Zwischenspeicher geleert)',!get().tage.find(t=>t.datum==='2026-11-26').zeiten.includes('16:00'));
JETZT=berlin('2026-11-25 15:50');ctx.erinnern();pruef('25 Stunden vorher: noch keine Erinnerung',mails.length===1,mails.slice(1));
JETZT=berlin('2026-11-25 16:05');ctx.erinnern();pruef('Erinnerung am Vortag geht an den Gast',mails.length===2&&mails[1].an==='maria@beispiel.de'&&mails[1].betreff.startsWith('Morgen um 16:00'),mails[1]);
ctx.erinnern();pruef('Vortags-Erinnerung nur einmal',mails.length===2);
JETZT=berlin('2026-11-26 15:05');ctx.erinnern();pruef('Erinnerung eine Stunde vorher',mails.length===3&&mails[2].betreff.startsWith('In einer Stunde')&&mails[2].text.includes('meet.google.com'),mails[2]);
ctx.erinnern();pruef('Stunden-Erinnerung nur einmal',mails.length===3);
JETZT=berlin('2026-11-26 10:00');const kurz=post({...gut,datum:'2026-11-27',zeit:'11:00',email:'kurz@beispiel.de'});JETZT=berlin('2026-11-26 12:00');ctx.erinnern();
pruef('Buchung für morgen: keine Vortags-Erinnerung',kurz.ok&&!mails.some(m=>m.an==='kurz@beispiel.de'&&m.betreff.startsWith('Morgen')),mails.filter(m=>m.an==='kurz@beispiel.de'));
JETZT=berlin('2026-11-30 10:00');let n=0;for(let i=0;i<10;i++){const r=post({...gut,datum:'2026-12-0'+(1+Math.floor(i/9)),zeit:(11+(i%9))+':00',email:'x'+i+'@beispiel.de'});if(r.ok)n++;else if(i<8)console.log('   ',i,r.grund);}
pruef('höchstens 8 Buchungen pro Tag',n===8,n);
// Sommerzeit: Termin im Juli
JETZT=berlin('2027-07-05 08:00');const so=get().tage.find(t=>t.datum==='2027-07-06');pruef('Sommerzeit: Dienstag im Juli beginnt um 11:00',so&&so.zeiten[0]==='11:00',so);
const c2={...ctx};delete ctx.Calendar;vm.runInContext('var Calendar=undefined',ctx);
console.log(fehler?('\n'+fehler+' Prüfungen fehlgeschlagen'):'\nalle Prüfungen bestanden');process.exit(fehler?1:0);
