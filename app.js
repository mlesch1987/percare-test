import {setupCSV,readDocuments,validateDocuments,renderCSV} from './csv-ui.js';
import {validateBackup,mergeEntries} from './backup.js';
const VERSION='1.2.0';
const $=id=>document.getElementById(id);
let db,pendingRestore,registration,updating=false;
let currentSnapshot=null,formDirty=false;
document.addEventListener("percare:review",event=>{currentSnapshot=event.detail.snapshot;$("note").value=event.detail.text;formDirty=false;message("Protokolltext erstellt. Bitte prüfen und anschließend separat speichern.");});
document.addEventListener("percare:dirty",()=>{currentSnapshot=null;formDirty=true;$("note").value="";});
$('version').textContent=VERSION;
function message(text){$('status').textContent=text;}
function transaction(mode,operation){return new Promise((resolve,reject)=>{const tx=db.transaction('entries',mode);let result;try{result=operation(tx.objectStore('entries'));}catch(error){tx.abort();reject(error);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||new Error('Speicherung fehlgeschlagen.'));tx.onabort=()=>reject(tx.error||new Error('Vorgang abgebrochen.'));});}
async function readEntries(){let request;await transaction('readonly',store=>{request=store.getAll();});return request.result;}
async function render(){const entries=await readEntries();$('entries').replaceChildren();entries.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).forEach(entry=>{const li=document.createElement('li');const time=document.createElement('time');time.dateTime=entry.createdAt;time.textContent=new Date(entry.createdAt).toLocaleString('de-DE');li.append(time,document.createTextNode(entry.text));if(entry.form){const small=document.createElement('small');small.textContent='Erfassungsdetails sind in der vollständigen Sicherung enthalten. Medien sind nicht enthalten.';li.append(small);}$('entries').append(li);});$('storage').textContent=entries.length+' Testeintrag / Testeinträge in diesem lokalen Speicher.';}
function dirty(){return formDirty||Boolean($('note').value.trim());}
async function save(){const text=$('note').value.trim();if(!text)return;const entry={id:crypto.randomUUID(),createdAt:new Date().toISOString(),text,...(currentSnapshot?{form:currentSnapshot}:{})};$('save').disabled=true;try{await transaction('readwrite',store=>store.add(entry));$('note').value='';currentSnapshot=null;formDirty=false;await render();message('Lokal gespeichert. Für einen neuen Eintrag die Maske neu öffnen. Keine Übertragung an einen Server.');}catch(error){message('Nicht gespeichert: '+error.message+' Deine Eingabe bleibt erhalten.');}finally{$('save').disabled=false;}}
$('entry-form').addEventListener('submit',event=>{event.preventDefault();save();});
$('backup').addEventListener('click',async()=>{try{const entries=await readEntries();const now=new Date().toISOString();const backup={format:'percare-technical-test',schema:2,appVersion:VERSION,exportedAt:now,entries,documents:await readDocuments(db)};const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const name='PerCare-Sicherung-'+now.replace(/[:.]/g,'-')+'.json';const file=new File([blob],name,{type:'application/json'});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'PerCare Sicherung'});}else{const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}$('backup-status').textContent='Sicherungsdatei bereitgestellt ('+entries.length+' Testeinträge und '+backup.documents.filter(x=>x.id!=='active').length+' CSV-Versionen). Bitte prüfen, ob sie tatsächlich in „Dateien“ gespeichert wurde.';}catch(error){$('backup-status').textContent=error.name==='AbortError'?'Teilen abgebrochen. Keine neue Sicherung bestätigt.':'Sicherung fehlgeschlagen: '+error.message;}});
$('restore').addEventListener('change',async()=>{
 pendingRestore=null;$('confirm-restore').hidden=true;const file=$('restore').files[0];if(!file)return;
 try{
  if(file.size>20*1024*1024)throw new Error('Datei zu groß (maximal 20 MB).');const value=JSON.parse(await file.text());
  const incoming=validateBackup(value);if(value.schema===2&&!Array.isArray(value.documents))throw new Error('CSV-Sammlung in Sicherung fehlt.');const documents=await validateDocuments(value.schema===2?value.documents:[]);
  const preview=mergeEntries(await readEntries(),incoming);const local=await readDocuments(db);
  assertDocumentMerge(local,documents);
  pendingRestore={entries:incoming,documents};
  $('restore-info').textContent='Geprüft: '+incoming.length+' Testeinträge, davon '+preview.added+' neu; '+documents.filter(x=>x.id!=='active').length+' CSV-Versionen. Noch nichts übernommen.';
  $('confirm-restore').hidden=false;
 }catch(error){$('restore-info').textContent='Nicht übernommen: '+error.message;}
});
function assertDocumentMerge(local,incoming){
 const active=local.find(x=>x.id==='active');const other=incoming.find(x=>x.id==='active');
 if(active&&other&&active.sourceId!==other.sourceId)throw new Error('Unterschiedliche aktive CSV-Basen. Keine automatische Zusammenführung; bitte separat klären.');
 for(const doc of incoming){const old=local.find(x=>x.id===doc.id);if(old&&doc.id!=='active'&&old.raw!==doc.raw)throw new Error('CSV-Inhalt bei gleicher ID abweichend.');}
}
$('confirm-restore').addEventListener('click',async()=>{
 if(!pendingRestore)return;$('confirm-restore').disabled=true;
 try{
  const incoming=pendingRestore;
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['entries','documents'],'readwrite'),store=tx.objectStore('entries'),docs=tx.objectStore('documents');let problem;let localEntries,localDocs;
   const a=store.getAll(),b=docs.getAll();
   function merge(){if(!localEntries||!localDocs)return;try{
    mergeEntries(localEntries,incoming.entries);assertDocumentMerge(localDocs,incoming.documents);
    const ids=new Set(localEntries.map(x=>x.id)),docIds=new Set(localDocs.map(x=>x.id));
    incoming.entries.filter(x=>!ids.has(x.id)).forEach(entry=>store.add(entry));incoming.documents.filter(x=>!docIds.has(x.id)).forEach(doc=>docs.add(doc));
   }catch(error){problem=error;tx.abort();}}
   a.onsuccess=()=>{localEntries=a.result;merge();};b.onsuccess=()=>{localDocs=b.result;merge();};
   tx.oncomplete=resolve;tx.onerror=()=>reject(problem||tx.error);tx.onabort=()=>reject(problem||tx.error||new Error('Übernahme abgebrochen.'));
  });
  pendingRestore=null;$('confirm-restore').hidden=true;$('restore-info').textContent='Zusammengeführt und lokal gespeichert. Bestehende Einträge und CSV-Versionen bleiben erhalten.';await render();await renderCSV();
 }catch(error){$('restore-info').textContent='Nicht übernommen: '+error.message;}finally{$('confirm-restore').disabled=false;}
});

function offerUpdate(){if(registration?.waiting){$('apply-update').hidden=false;$('update-status').textContent='Update verfügbar. Erst Testnotiz speichern und Sicherung erstellen.';}}
$('check-update').addEventListener('click',async()=>{if(!registration){$('update-status').textContent='Offline- und Updatefunktion noch nicht bereit. Bitte online über HTTPS öffnen.';return;}try{await registration.update();if(registration.waiting)offerUpdate();else $('update-status').textContent='Updateprüfung angefordert. Falls eine neue Version geladen wird, erscheint hier die Freigabe.';}catch(error){$('update-status').textContent='Updateprüfung nicht möglich. Bestehende lokale Daten bleiben erhalten.';}});
$('apply-update').addEventListener('click',()=>{if(dirty()){$('update-status').textContent='Bitte die ungespeicherte Testnotiz zuerst speichern.';return;}if(registration?.waiting){updating=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}});
async function start(){try{db=await new Promise((resolve,reject)=>{const request=indexedDB.open('percare-technical-test',2);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains('entries'))database.createObjectStore('entries',{keyPath:'id'});if(!database.objectStoreNames.contains('documents'))database.createObjectStore('documents',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>message('Bitte andere PerCare-Testfenster schließen.');});await render();setupCSV(db);['save','backup','restore'].forEach(id=>$(id).disabled=false);db.onversionchange=()=>{db.close();['save','backup','restore','csv-file','csv-confirm'].forEach(id=>$(id).disabled=true);message('Speicheränderung in anderem Fenster. Bitte diese App neu öffnen.');};}catch(error){message('Lokaler Speicher nicht verfügbar: '+error.message);return;}
 if('serviceWorker'in navigator){try{navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload();});registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});offerUpdate();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate();});});}catch(error){$('update-status').textContent='Speicherung bereit; Offline-/Updatefunktion konnte nicht eingerichtet werden.';}}}
start();
