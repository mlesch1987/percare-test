// Reine Datenprüfung, auch in Node ohne Browser testbar.
export function validateBackup(value){
 if(!value||value.format!=='percare-technical-test'||![1,2].includes(value.schema)||!Array.isArray(value.entries)||value.entries.length>10000)throw new Error('Keine unterstützte PerCare-Testsicherung.');
 const ids=new Set();
 const entries=value.entries.map(entry=>{
  if(!entry||typeof entry.id!=='string'||entry.id.length>100||!entry.id||ids.has(entry.id)||typeof entry.text!=='string'||!entry.text.trim()||entry.text.length>100000||typeof entry.createdAt!=='string'||!Number.isFinite(Date.parse(entry.createdAt)))throw new Error('Sicherung enthält ungültige oder doppelte Testeinträge.');
  if(entry.form!==undefined&&(!entry.form||entry.form.schema!==1||!Array.isArray(entry.form.fields)||!Array.isArray(entry.form.choices)||!Array.isArray(entry.form.sections)||JSON.stringify(entry.form).length>1000000))throw new Error('Ungültige Erfassungsdetails.');
  ids.add(entry.id);return {id:entry.id,text:entry.text,createdAt:entry.createdAt,...(entry.form?{form:JSON.parse(JSON.stringify(entry.form))}:{})};
 });return entries;
}
export function mergeEntries(existing,incoming){
 const merged=new Map(existing.map(entry=>[entry.id,entry]));let added=0;
 for(const entry of incoming){const old=merged.get(entry.id);if(old&&(old.text!==entry.text||old.createdAt!==entry.createdAt||JSON.stringify(old.form)!==JSON.stringify(entry.form)))throw new Error('Abbruch: Eine ID hat unterschiedliche Inhalte. Keine Daten übernommen.');if(!old){merged.set(entry.id,entry);added++;}}
 return {entries:[...merged.values()],added};
}
