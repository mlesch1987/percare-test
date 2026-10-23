export const CSV_HEADER='Tage;Datum;kompletter Kotabsatz;Koeddel statt Kot (teilweise Kotabsatz);Verstopfung;Haeufigkeit Urinabsatz;Bemerkung;Gewicht;Medikamente';
const weekdays=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
export function csvDate(value){
 const m=/^(\d{2})\.(\d{2})\.(\d{2})$/.exec(value);if(!m)throw new Error('Datum muss TT.MM.JJ entsprechen: '+value);
 const date=new Date(Date.UTC(2000+Number(m[3]),Number(m[2])-1,Number(m[1])));
 if(date.getUTCDate()!==Number(m[1])||date.getUTCMonth()!==Number(m[2])-1)throw new Error('Ungültiges Kalenderdatum: '+value);return date;
}
export function parseCSV(raw){
 if(typeof raw!=='string'||raw.length>10000000)throw new Error('CSV fehlt oder ist größer als 10 MB.');
 const bom=raw.startsWith('\ufeff');const lines=(bom?raw.slice(1):raw).split(/\r\n|\n|\r/);while(lines.at(-1)==='')lines.pop();
 if(lines[0]!==CSV_HEADER)throw new Error('Kopfzeile entspricht nicht der vereinbarten Neun-Spalten-Struktur.');
 if(lines.length<2)throw new Error('Die Datei enthält keine Tageszeilen.');
 const rows=[],warnings=[],gaps=[];const seen=new Set();let previous;
 if(!bom)warnings.push('UTF-8-BOM fehlt. Original bleibt unverändert.');
 for(let index=1;index<lines.length;index++){
  const fields=lines[index].split(';');if(fields.length!==9)throw new Error('Zeile '+(index+1)+': genau neun Spalten erwartet.');
  const date=csvDate(fields[1]);const stamp=date.getTime();
  if(seen.has(fields[1]))throw new Error('Doppelter Kalendertag: '+fields[1]);seen.add(fields[1]);
  if(previous!==undefined&&stamp<=previous)throw new Error('Tage nicht aufsteigend sortiert: '+fields[1]);
  if(previous!==undefined)for(let gap=previous+86400000;gap<stamp;gap+=86400000){const d=new Date(gap),value=String(d.getUTCDate()).padStart(2,'0')+'.'+String(d.getUTCMonth()+1).padStart(2,'0')+'.'+String(d.getUTCFullYear()).slice(-2);if(value!=='17.12.25')gaps.push(value);}
  if(fields[0]!==weekdays[date.getUTCDay()])warnings.push(fields[1]+': Wochentag weicht ab.');
  if(/[äöüÄÖÜß]/.test(lines[index]))warnings.push(fields[1]+': Umlaut oder ß vorhanden.');
  if(fields[5]&&!/^\d+x$/.test(fields[5]))warnings.push(fields[1]+': Urin-Zusatz unverändert: '+fields[5]);
  if(fields[7]&&!/^\d+(,\d+)?$/.test(fields[7]))warnings.push(fields[1]+': Gewichtsformat prüfen: '+fields[7]);
  previous=stamp;rows.push({fields,date:fields[1]});
 }
 if(gaps.length)warnings.push('Weitere Datumslücken: '+gaps.join(', '));
 const full=rows.filter(row=>/^Ja(?:\s|\()/.test(row.fields[2]));
 return {rows,warnings,bom,first:rows[0].date,last:rows.at(-1).date,lastFull:full.at(-1)||null};
}
export async function csvDigest(raw){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function validateDocuments(documents){
 if(documents===undefined)return [];
 if(!Array.isArray(documents)||documents.length>100)throw new Error('Ungültige CSV-Sammlung.');
 const ids=new Set();let active=null;
 for(const doc of documents){
  if(!doc||typeof doc.id!=='string'||ids.has(doc.id))throw new Error('Ungültige oder doppelte CSV-ID.');ids.add(doc.id);
  if(doc.id==='active'){if(typeof doc.sourceId!=='string')throw new Error('CSV-Verweis fehlt.');active=doc.sourceId;continue;}
  if(typeof doc.name!=='string'||doc.name.length>500||typeof doc.importedAt!=='string'||!Number.isFinite(Date.parse(doc.importedAt)))throw new Error('CSV-Metadaten ungültig.');
  parseCSV(doc.raw);if(await csvDigest(doc.raw)!==doc.id)throw new Error('Prüfsumme der CSV stimmt nicht.');
 }
 if(active&&!ids.has(active))throw new Error('Aktive CSV fehlt in der Sicherung.');return documents;
}
