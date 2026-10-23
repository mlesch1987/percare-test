import {csvDate} from './csv.js';
export function isFull(row){return /^Ja(?:\s|\()/.test(row.fields[2]);}
export function isPartial(row){return /^Ja(?:\s|\()/.test(row.fields[3]);}
export function measuredWeight(row){return /^\d+(?:,\d+)?$/.test(row.fields[7])?Number(row.fields[7].replace(',','.')):null;}
export function summarize(parsed,days=30){
 const end=csvDate(parsed.last).getTime();const start=days===0?-Infinity:end-(days-1)*86400000;
 const rows=parsed.rows.filter(row=>csvDate(row.date).getTime()>=start);
 const weights=parsed.rows.filter(row=>measuredWeight(row)!==null).map(row=>({date:row.date,value:measuredWeight(row)}));
 const urine=rows.filter(row=>/^\d+x$/.test(row.fields[5]));
 return {rows,first:rows[0]?.date,last:parsed.last,fullDays:rows.filter(isFull).length,partialDays:rows.filter(isPartial).length,urineDays:urine.length,urineAnnotated:rows.filter(row=>row.fields[5]&&!/^\d+x$/.test(row.fields[5])).length,lastWeight:weights.at(-1)||null,weights:rows.filter(row=>measuredWeight(row)!==null).map(row=>({date:row.date,value:measuredWeight(row)}))};
}
export function rowMatches(row,query){return !query||row.fields.join(' ').toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE'));}
export function coverageText(last,today){
 const a=csvDate(last).getTime(),b=csvDate(today).getTime();const days=Math.round((b-a)/86400000);
 if(days<0)return 'CSV enthält spätere Tage als das heutige Datum. Datierung prüfen.';
 if(days===0)return 'CSV reicht bis heute. Der letzte Tag kann unvollständig sein; leere Felder bedeuten nicht dokumentiert.';
 return 'CSV endet '+days+' Kalendertag(e) vor heute. Ereignisse danach sind hier nicht berücksichtigt.';
}
