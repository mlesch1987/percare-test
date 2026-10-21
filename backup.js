// Reine Datenprüfung, auch in Node ohne Browser testbar.
export function validateBackup(value){
 if(!value||value.format!=='percare-technical-test'||value.schema!==1||!Array.isArray(value.entries)||value.entries.length>10000)throw new Error('Keine unterstützte PerCare-Testsicherung.');
 const ids=new Set();
 const entries=value.entries.map(entry=>{
  if(!entry||typeof entry.id!=='string'||entry.id.length>100||!entry.id||ids.has(entry.id)||typeof entry.text!=='string'||!entry.text.trim()||entry.text.length>1000||typeof entry.createdAt!=='string'||!Number.isFinite(Date.parse(entry.createdAt)))throw new Error('Sicherung enthält ungültige oder doppelte Testeinträge.');
  ids.add(entry.id);return {id:entry.id,text:entry.text,createdAt:entry.createdAt};
 });return entries;
}
export function mergeEntries(existing,incoming){
 const merged=new Map(existing.map(entry=>[entry.id,entry]));let added=0;
 for(const entry of incoming){const old=merged.get(entry.id);if(old&&(old.text!==entry.text||old.createdAt!==entry.createdAt))throw new Error('Abbruch: Eine ID hat unterschiedliche Inhalte. Keine Daten übernommen.');if(!old){merged.set(entry.id,entry);added++;}}
 return {entries:[...merged.values()],added};
}
