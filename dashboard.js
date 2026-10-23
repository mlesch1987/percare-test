import {readDocuments} from './csv-ui.js';
import {parseCSV,csvDate} from './csv.js';
import {summarize,isFull,isPartial,rowMatches,coverageText} from './dashboard-model.js';
const $=id=>document.getElementById(id);
let db,parsed,source,period=30,page=0;
const headers=['Tag','Datum','Vollabsatz','Köddel / Teilabsatz','Verstopfung','Urin – Originalangabe','Bemerkung','Gewicht (kg)','Medikamente'];
function text(parent,tag,value,cls){const element=document.createElement(tag);element.textContent=value;if(cls)element.className=cls;parent.append(element);return element;}
function todayBerlin(){const parts=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date());return parts;}
function stat(parent,label,value,detail){const tile=document.createElement('article');tile.className='dash-stat';text(tile,'h3',label);text(tile,'p',value,'dash-value');text(tile,'small',detail);parent.append(tile);}
function showDay(row,container){container.replaceChildren();text(container,'h3',row.fields[0]+' · '+row.date);const dl=document.createElement('dl');row.fields.forEach((value,index)=>{if(index<2)return;text(dl,'dt',headers[index]);text(dl,'dd',value||'Nicht dokumentiert');});container.append(dl);if(row.fields[5]&&!/^\d+x$/.test(row.fields[5]))text(container,'p','Urin-Zusatz: Datumsbezug und Vollständigkeit sind vor einer Auswertung einzeln zu prüfen.');text(container,'small','Quelle: '+source.name+' · unveränderte CSV-Zeile.');}
function renderTimeline(rows){
 const host=$('dash-timeline');host.replaceChildren();const recent=rows.slice(-30);text(host,'p','Letzte '+recent.length+' vorhandene Tageszeilen im gewählten Zeitraum. Tag antippen für Originalangaben.');
 const grid=document.createElement('div');grid.className='dash-days';const legend='● Vollabsatz · ◇ Köddel · – kein Absatz dokumentiert';
 recent.forEach(row=>{const button=document.createElement('button');button.type='button';const marker=(isFull(row)?'●':'')+(isPartial(row)?'◇':'')||'–';button.textContent=row.date.slice(0,5)+' '+marker;button.setAttribute('aria-label',row.date+': '+(isFull(row)?'Vollabsatz dokumentiert. ':'')+(isPartial(row)?'Köddel dokumentiert. ':'')+(!isFull(row)&&!isPartial(row)?'Kein Absatz dokumentiert.':''));button.addEventListener('click',()=>{grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));showDay(row,$('dash-day'));});grid.append(button);});host.append(grid);text(host,'small',legend);if(recent.length)showDay(recent.at(-1),$('dash-day'));
}
function renderWeights(weights){
 const host=$('dash-weights');host.replaceChildren();
 if(!weights.length){text(host,'p','Im gewählten Zeitraum sind keine auswertbaren Gewichtsmessungen dokumentiert.');return;}
 text(host,'small','Nur gemessene Werte. Zwischenwerte werden nicht berechnet.');
 const width=Math.max(260,host.clientWidth||320),left=52,right=width-12;const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+width+' 230');svg.setAttribute('role','img');svg.setAttribute('aria-label','Gewichtsmessungen in Kilogramm im gewählten Zeitraum. Alle Werte stehen auch in der Liste darunter.');
 const xs=weights.map(x=>csvDate(x.date).getTime()),ys=weights.map(x=>x.value);let minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);if(minX===maxX){minX-=86400000;maxX+=86400000;}const padding=Math.max(.05,(maxY-minY)*.15);minY-=padding;maxY+=padding;
 function mark(tag,attrs,label){const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));if(label!==undefined)el.textContent=label;svg.append(el);return el;}
 for(let i=0;i<3;i++){const value=minY+(maxY-minY)*i/2,y=180-(value-minY)/(maxY-minY)*145;mark('line',{x1:left,x2:right,y1:y,y2:y,stroke:'var(--line)'});mark('text',{x:left-8,y:y+4,'text-anchor':'end',fill:'var(--ink)','font-size':14},value.toFixed(2).replace('.',','));}
 weights.forEach((point,i)=>{const x=left+(xs[i]-minX)/(maxX-minX)*(right-left),y=180-(point.value-minY)/(maxY-minY)*145;const circle=mark('circle',{cx:x,cy:y,r:5,fill:'var(--accent)'});const title=document.createElementNS(ns,'title');title.textContent=point.date+': '+point.value.toFixed(2).replace('.',',')+' kg';circle.append(title);});
 mark('text',{x:left,y:210,fill:'var(--ink)','font-size':14},weights[0].date);if(weights.length>1)mark('text',{x:right,y:210,'text-anchor':'end',fill:'var(--ink)','font-size':14},weights.at(-1).date);mark('text',{x:12,y:18,fill:'var(--ink)','font-size':14},'kg');host.append(svg);
 const details=document.createElement('details');text(details,'summary','Alle '+weights.length+' Messwerte anzeigen');weights.slice().reverse().forEach(point=>text(details,'p',point.date+' · '+String(point.value).replace('.',',')+' kg'));host.append(details);
}
function renderHistory(){
 if(!parsed)return;const model=summarize(parsed,period),query=$('dash-search').value.trim(),rows=model.rows.filter(row=>rowMatches(row,query)).slice().reverse();
 const pages=Math.max(1,Math.ceil(rows.length/15));page=Math.min(page,pages-1);const host=$('dash-history');host.replaceChildren();
 text(host,'p',rows.length+' passende Tageszeilen · Seite '+(page+1)+' von '+pages);
 rows.slice(page*15,page*15+15).forEach(row=>{const details=document.createElement('details');text(details,'summary',row.fields[0]+' · '+row.date+(isFull(row)?' · Vollabsatz':'')+(isPartial(row)?' · Köddel':''));const panel=document.createElement('div');showDay(row,panel);details.append(panel);host.append(details);});$('dash-prev').disabled=page===0;$('dash-next').disabled=page>=pages-1;
}
function render(){
 if(!parsed)return;const model=summarize(parsed,period);$('dash-source').textContent=source.name+' · '+parsed.rows.length+' Tageszeilen · '+parsed.first+' bis '+parsed.last;
 $('dash-coverage').textContent=coverageText(parsed.last,todayBerlin())+' Aktueller Darmstatus: aus der CSV allein nicht sicher bestimmbar.';
 $('dash-range').textContent='Auswertung: '+model.first+' bis '+model.last+' · Zeitraum endet am CSV-Datenstand, nicht automatisch heute.';
 const stats=$('dash-stats');stats.replaceChildren();stat(stats,'Letzter dokumentierter Vollabsatz',parsed.lastFull?parsed.lastFull.date:'Nicht dokumentiert',parsed.lastFull?parsed.lastFull.fields[2]:'Kein eindeutiger Ja-Eintrag');stat(stats,'Tage mit Vollabsatz',String(model.fullDays),'Im gewählten Zeitraum; keine Anzahl einzelner Absätze.');stat(stats,'Tage mit Köddeln',String(model.partialDays),'Ein Tag kann gleichzeitig Vollabsatz und Köddel enthalten.');stat(stats,'Letzte Gewichtsmessung',model.lastWeight?String(model.lastWeight.value).replace('.',',')+' kg':'Nicht dokumentiert',model.lastWeight?model.lastWeight.date+' · gesamte CSV':'Nur gemessene Werte');
 $('dash-quality').textContent=parsed.warnings.length+' Importhinweise insgesamt. Im gewählten Zeitraum: '+model.urineDays+' Tage mit schlichtem Urinfeld (z. B. 3x), '+model.urineAnnotated+' Urinfelder mit Zusatz. Zusätze werden weder umdatiert noch summiert. Leere Felder sind keine Nullwerte.';
 renderTimeline(model.rows);renderWeights(model.weights);renderHistory();
}
async function refresh(){
 try{const docs=await readDocuments(db),active=docs.find(x=>x.id==='active');source=docs.find(x=>x.id===active?.sourceId);$('dash-empty').hidden=Boolean(source);$('dash-content').hidden=!source;if(!source){parsed=null;return;}parsed=parseCSV(source.raw);render();}catch(error){$('dash-empty').hidden=false;$('dash-empty').textContent='Dashboard konnte nicht geladen werden: '+error.message;$('dash-content').hidden=true;}
}
export function setupDashboard(database){
 db=database;
 const nav=$('app-nav');const sections=Array.from(document.querySelectorAll('main > section'));sections.forEach(section=>{if(section.id==='dashboard')section.dataset.area='dashboard';else if(section.id==='csv-section')section.dataset.area='import';else {const heading=section.querySelector('h2')?.textContent||'';section.dataset.area=heading.startsWith('1 ·')?'capture':heading.startsWith('2 ·')?'entries':heading.startsWith('3 ·')?'backup':'settings';}});
 function show(area){sections.forEach(section=>section.hidden=section.dataset.area!==area);nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.area===area)));if(area==='dashboard'&&parsed)render();}
 nav.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>show(button.dataset.area)));show('dashboard');
 $('dash-period').addEventListener('change',()=>{period=Number($('dash-period').value);page=0;render();});$('dash-search').addEventListener('input',()=>{page=0;renderHistory();});$('dash-prev').addEventListener('click',()=>{page--;renderHistory();});$('dash-next').addEventListener('click',()=>{page++;renderHistory();});
 document.addEventListener('percare:review',()=>show('entries'));window.addEventListener('resize',()=>{if(parsed&&!$('dashboard').hidden)renderWeights(summarize(parsed,period).weights);});document.addEventListener('percare:csv-changed',refresh);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});refresh();
}
