import {parseCSV,csvDigest,validateDocuments} from './csv.js';
const $=id=>document.getElementById(id);
let database,pending;
export function readDocuments(db){return new Promise((resolve,reject)=>{const tx=db.transaction('documents','readonly');const request=tx.objectStore('documents').getAll();tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);});}
function appendText(parent,tag,text){const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;}
export async function renderCSV(){
 if(!database)return;const docs=await readDocuments(database);const active=docs.find(x=>x.id==='active');const doc=docs.find(x=>x.id===active?.sourceId);const panel=$('csv-current');panel.replaceChildren();
 if(!doc){appendText(panel,'p','Noch keine CSV lokal importiert.');return;}
 const parsed=parseCSV(doc.raw);
 appendText(panel,'h3','Lokal bestätigte Basis: '+doc.name);
 appendText(panel,'p',parsed.rows.length+' Tageszeilen · '+parsed.first+' bis '+parsed.last);
 appendText(panel,'p','Letzter dokumentierter Vollabsatz: '+(parsed.lastFull?parsed.lastFull.date+' · '+parsed.lastFull.fields[2]:'nicht eindeutig dokumentiert'));
 appendText(panel,'p','Aktueller Darmstatus wird daraus nicht automatisch abgeleitet. Testeinträge werden nicht mit der CSV zusammengeführt.');
 appendText(panel,'small','Originaltext einschließlich BOM und historischer Zusätze bleibt lokal erhalten. '+docs.filter(x=>x.id!=='active').length+' CSV-Version(en) in der vollständigen Sicherung.');
 const details=document.createElement('details');appendText(details,'summary','Letzte dokumentierte Tage ansehen');
 parsed.rows.slice(-7).reverse().forEach(row=>{const article=document.createElement('article');appendText(article,'h4',row.fields[0]+' · '+row.date);row.fields.forEach((value,i)=>{if(i>1&&value)appendText(article,'p',parsedHeader[i]+': '+value);});details.append(article);});panel.append(details);
}
const parsedHeader=['Tage','Datum','Vollabsatz','Köddel / Teilabsatz','Verstopfung','Urin (Originalfeld, Datum gegebenenfalls abweichend)','Bemerkung','Gewicht','Medikamente'];
export function setupCSV(db){
 database=db;$('csv-file').disabled=false;
 $('csv-file').addEventListener('change',async()=>{
  pending=null;$('csv-confirm').hidden=true;$('csv-approval').checked=false;$('csv-replace').checked=false;$('csv-preview').replaceChildren();
  const file=$('csv-file').files[0];if(!file)return;
  try{
   if(file.size>10000000)throw new Error('Datei zu groß (maximal 10 MB).');
   const raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer());const parsed=parseCSV(raw);const id=await csvDigest(raw);
   const docs=await readDocuments(db),active=docs.find(x=>x.id==='active');pending={id,raw,name:file.name,importedAt:new Date().toISOString()};
   const preview=$('csv-preview');appendText(preview,'h3','Prüfvorschau – noch nicht gespeichert');
   appendText(preview,'p',file.name+' · '+parsed.rows.length+' Tageszeilen · '+parsed.first+' bis '+parsed.last);
   appendText(preview,'p','Neun Spalten, Datumsformat, Sortierung und eindeutige Tage geprüft. UTF-8-BOM: '+(parsed.bom?'vorhanden':'fehlt'));
   appendText(preview,'p','Letzter dokumentierter Vollabsatz: '+(parsed.lastFull?parsed.lastFull.date+' · '+parsed.lastFull.fields[2]:'nicht gefunden'));
   appendText(preview,'p','Die historische Lücke 17.12.25 ist zulässig. Leere Felder bleiben leer.');
   const details=document.createElement('details');appendText(details,'summary',parsed.warnings.length+' Prüfhinweise'+' – unveränderte Originalangaben');
   parsed.warnings.forEach(text=>appendText(details,'p',text));preview.append(details);
   $('csv-replace-wrap').hidden=!active||active.sourceId===id;
   $('csv-confirm').hidden=false;$('csv-message').textContent=active?.sourceId===id?'Diese CSV ist bereits die aktive lokale Basis. Erneutes Bestätigen erzeugt keine zweite Kopie.':'Bitte Hinweise prüfen und die Basis ausdrücklich bestätigen.';
  }catch(error){$('csv-message').textContent='Nicht importiert: '+error.message;}
 });
 $('csv-confirm').addEventListener('click',async()=>{
  if(!pending)return;if(!$('csv-approval').checked){$('csv-message').textContent='Bitte zuerst bestätigen, dass dies deine zuletzt geprüfte vollständige Basis ist.';return;}
  $('csv-confirm').disabled=true;
  try{
   const chosen=pending;
   await new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents');let problem;const request=store.get('active');request.onsuccess=()=>{try{if(request.result&&request.result.sourceId!==chosen.id&&!$('csv-replace').checked)throw new Error('Bitte den Wechsel der aktiven Basis ausdrücklich bestätigen.');const old=store.get(chosen.id);old.onsuccess=()=>{if(!old.result)store.add(chosen);store.put({id:'active',sourceId:chosen.id});};}catch(error){problem=error;tx.abort();}};tx.oncomplete=resolve;tx.onerror=()=>reject(problem||tx.error);tx.onabort=()=>reject(problem||tx.error||new Error('Import abgebrochen.'));});
   pending=null;$('csv-confirm').hidden=true;$('csv-message').textContent='Original-CSV lokal gespeichert. Keine Änderung der Datei, kein CSV-Export und keine Übertragung an GitHub.';await renderCSV();
  }catch(error){$('csv-message').textContent='Nicht importiert: '+error.message;}finally{$('csv-confirm').disabled=false;}
 });renderCSV().catch(error=>{$('csv-message').textContent=error.message;});
}
export {validateDocuments};
