
(function() {
var pcRoot=document.getElementById("percare-mock");
function captureSnapshot(){
 return {schema:1,fields:Array.from(pcRoot.querySelectorAll('input,select,textarea')).filter(e=>e.type!=='file').map(e=>({id:e.id||'',label:e.closest('label')?.textContent?.trim()||'',type:e.type||e.tagName,value:e.value,checked:!!e.checked})),choices:Array.from(pcRoot.querySelectorAll('.chip.sel,.chip.wrn,.mbtn.d,.mbtn.f')).map(e=>({id:e.id||'',text:e.textContent.trim()})),sections:Array.from(pcRoot.querySelectorAll('[id^="sec-"]')).map(e=>({id:e.id,included:e.style.display==='block'}))};
}


var pad = function(n) { return n < 10 ? '0'+n : ''+n; };
var now = new Date();
var fmtD = function(d) { return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
var yd = new Date(now); yd.setDate(now.getDate()-1);

pcRoot.querySelector("#" + 'datum').value = fmtD(now);
pcRoot.querySelector("#" + 'uhrzeit').value = pad(now.getHours())+':'+pad(now.getMinutes());
pcRoot.querySelector("#" + 'urin-d').value = fmtD(yd);
var erbDates = ['erb-dp','erb-dvon','erb-dbis'];
for(var i=0;i<erbDates.length;i++){var el=pcRoot.querySelector("#" + erbDates[i]);if(el)el.value=fmtD(now);}

// Section toggles
var secNames = ['erb','urin','futter','verh','lax','gew','noti'];
for(var s=0;s<secNames.length;s++){
  (function(name){
    var btn=pcRoot.querySelector("#" + 'btn-'+name);
    var sec=pcRoot.querySelector("#" + 'sec-'+name);
    if(!btn||!sec) return;
    btn.addEventListener('click',function(){
      var open=sec.style.display==='block';
      sec.style.display=open?'none':'block';
      btn.textContent=open?'Hinzufügen':'Erfasst ✓';
      btn.className=open?'tbtn':'tbtn on';
    });
  })(secNames[s]);
}

// Chip helper
function clearGroup(gid){
  var g=pcRoot.querySelector("#" + gid); if(!g) return;
  var cs=g.getElementsByClassName('chip');
  for(var i=0;i<cs.length;i++) cs[i].className='chip';
}
function setChip(id,warn){
  var el=pcRoot.querySelector("#" + id); if(!el) return;
  el.className=warn?'chip wrn':'chip sel';
}
function getSelChip(gid){
  var g=pcRoot.querySelector("#" + gid); if(!g) return null;
  var cs=g.getElementsByClassName('chip');
  for(var i=0;i<cs.length;i++){if(cs[i].className.indexOf('sel')>=0||cs[i].className.indexOf('wrn')>=0) return cs[i];}
  return null;
}
function secOpen(name){ return pcRoot.querySelector("#" + 'sec-'+name)&&pcRoot.querySelector("#" + 'sec-'+name).style.display==='block'; }

// ── KOTABSATZ (multi-entry) ──────────────────────────────────────────────
var kotCount=0;
var erbVGlobal='';

function checkSchwer(){
  var hasVstopf=false;
  var boxes=pcRoot.querySelector("#" + 'kot-list').getElementsByClassName('entrybox');
  for(var i=0;i<boxes.length;i++){
    var v=boxes[i].dataset.kotv||'nein';
    if(v==='vstopf') hasVstopf=true;
  }
  var b=pcRoot.querySelector("#" + 'schwer');
  b.style.display=(hasVstopf&&erbVGlobal==='futter')?'inline':'none';
}

function calcMidById(dvon,tvon,dbis,tbis,midId){
  var vD=pcRoot.querySelector("#" + dvon)?pcRoot.querySelector("#" + dvon).value:'';
  var vT=pcRoot.querySelector("#" + tvon)?pcRoot.querySelector("#" + tvon).value:'';
  var bD=pcRoot.querySelector("#" + dbis)?pcRoot.querySelector("#" + dbis).value:'';
  var bT=pcRoot.querySelector("#" + tbis)?pcRoot.querySelector("#" + tbis).value:'';
  var h=pcRoot.querySelector("#" + midId); if(!h) return;
  if(vD&&vT&&bD&&bT){var v=new Date(vD+'T'+vT),b=new Date(bD+'T'+bT);
    if(b>v){var m=new Date((v.getTime()+b.getTime())/2);
      h.textContent='Mittelwert: '+m.getFullYear()+'-'+pad(m.getMonth()+1)+'-'+pad(m.getDate())+' '+pad(m.getHours())+':'+pad(m.getMinutes())+' Uhr';}
    else h.textContent='Ende muss nach Beginn liegen.';}else h.textContent='Ende muss nach Beginn liegen.';}

pcRoot.querySelector("#" + 'add-kot').addEventListener('click', function(){
  kotCount++;
  var n=kotCount;
  var box=document.createElement('div');
  box.className='entrybox'; box.id='kot-'+n; box.dataset.kotv='nein';

  var html='<div class="entrytitle"><span>Eintrag '+n+'</span><button class="delbtn" id="kdel-'+n+'">Entfernen</button></div>';

  // Typ-Chips
  html+='<div class="field"><div class="chips" id="kchips-'+n+'">';
  html+='<button type="button" class="chip" id="kc-nein-'+n+'" data-v="nein">Kein Kot</button>';
  html+='<button type="button" class="chip" id="kc-vstopf-'+n+'" data-v="vstopf">Verstopfung</button>';
  html+='<button type="button" class="chip" id="kc-koeddel-'+n+'" data-v="koeddel">Köddel</button>';
  html+='<button type="button" class="chip" id="kc-voll-'+n+'" data-v="voll">Vollständiger Absatz</button>';
  html+='</div></div>';

  // Zeit-Modus
  html+='<div id="kext-'+n+'" style="display:none">';
  html+='<div class="field"><label>Zeiterfassung</label><div class="chips" id="kzchips-'+n+'">';
  html+='<button type="button" class="chip sel" id="kzp-'+n+'" data-v="punkt">Fester Zeitpunkt</button>';
  html+='<button type="button" class="chip" id="kzs-'+n+'" data-v="spanne">Zeitspanne</button>';
  html+='</div></div>';

  // Punkt
  html+='<div id="kzpbox-'+n+'" class="tsbox">';
  html+='<div class="tslbl" id="ktslbl-'+n+'">Zeitpunkt</div>';
  html+='<div class="grid2"><div class="field"><label>Datum</label><input type="date" id="kdp-'+n+'" value="'+fmtD(now)+'"/></div>';
  html+='<div class="field"><label>Uhrzeit</label><input type="time" id="ktp-'+n+'"/></div></div>';
  html+='<div class="tshint" id="ktshint-'+n+'"></div></div>';

  // Spanne
  html+='<div id="kzsbox-'+n+'" style="display:none" class="tsbox">';
  html+='<div class="tslbl">Von</div>';
  html+='<div class="grid2" style="margin-bottom:8px"><div class="field"><label>Datum</label><input type="date" id="kdvon-'+n+'" value="'+fmtD(now)+'"/></div>';
  html+='<div class="field"><label>Uhrzeit</label><input type="time" id="ktvon-'+n+'"/></div></div>';
  html+='<div class="tslbl">Bis</div>';
  html+='<div class="grid2"><div class="field"><label>Datum</label><input type="date" id="kdbis-'+n+'" value="'+fmtD(now)+'"/></div>';
  html+='<div class="field"><label>Uhrzeit</label><input type="time" id="ktbis-'+n+'"/></div></div>';
  html+='<div class="midhint" id="kmid-'+n+'"></div></div>';

  // Qualität + Bemerkung
  html+='<div id="kqual-'+n+'" style="display:none" class="field"><label>Kotqualität</label>';
  html+='<select id="kq-'+n+'"><option value="">— auswählen —</option><option value="normal">Normal / geformt</option><option value="weich">Weich</option><option value="hart">Hart / trocken</option><option value="fluessig">Flüssig</option></select></div>';
  html+='<div id="kbem-'+n+'" style="display:none" class="field"><label>Bemerkung (optional)</label><textarea id="kb-'+n+'" placeholder="z.B. Fundort, Besonderheiten ..."></textarea></div>';
  html+='</div>'; // kext

  box.innerHTML=html;
  pcRoot.querySelector("#" + 'kot-list').appendChild(box);
  pcRoot.querySelector("#" + 'kot-none').style.display='none';

  // Events für diesen Eintrag
  (function(num){
    // Delete
    pcRoot.querySelector("#" + 'kdel-'+num).addEventListener('click',function(){
      var el=pcRoot.querySelector("#" + 'kot-'+num); if(el) el.remove();
      // Renumber
      var boxes=pcRoot.querySelector("#" + 'kot-list').getElementsByClassName('entrybox');
      for(var i=0;i<boxes.length;i++){
        var t=boxes[i].querySelector('.entrytitle span'); if(t) t.textContent='Eintrag '+(i+1);
      }
      if(!boxes.length) pcRoot.querySelector("#" + 'kot-none').style.display='';
      checkSchwer();
    });

    // Typ-Chips
    var typMap=[
      ['kc-nein-'+num,'nein',false,false,false],
      ['kc-vstopf-'+num,'vstopf',false,false,false],
      ['kc-koeddel-'+num,'koeddel',true,true,true],
      ['kc-voll-'+num,'voll',false,true,true]
    ];
    for(var ti=0;ti<typMap.length;ti++){
      (function(cid,val,warn,showQual,showBem){
        var el=pcRoot.querySelector("#" + cid); if(!el) return;
        el.addEventListener('click',function(){
          clearGroup('kchips-'+num);
          pcRoot.querySelector("#" + cid).className=warn?'chip wrn':'chip sel';
          pcRoot.querySelector("#" + 'kot-'+num).dataset.kotv=val;
          var ext=pcRoot.querySelector("#" + 'kext-'+num);
          ext.style.display=val!=='nein'?'block':'none';
          // Label
          var lbl=pcRoot.querySelector("#" + 'ktslbl-'+num);
          var hint=pcRoot.querySelector("#" + 'ktshint-'+num);
          if(val==='vstopf'){lbl.textContent='Beginn Episode';hint.textContent='Startzeitpunkt der Verstopfungsepisode';}
          else if(val==='voll'){lbl.textContent='Vollabsatz';hint.textContent='Zeitpunkt des vollständigen Absatzes';}
          else{lbl.textContent='Zeitpunkt';hint.textContent='';}
          pcRoot.querySelector("#" + 'kqual-'+num).style.display=showQual?'block':'none';
          pcRoot.querySelector("#" + 'kbem-'+num).style.display=showBem?'block':'none';
          checkSchwer();
        });
      })(typMap[ti][0],typMap[ti][1],typMap[ti][2],typMap[ti][3],typMap[ti][4]);
    }

    // Zeit-Modus Chips
    pcRoot.querySelector("#" + 'kzp-'+num).addEventListener('click',function(){
      clearGroup('kzchips-'+num); pcRoot.querySelector("#" + 'kzp-'+num).className='chip sel';
      pcRoot.querySelector("#" + 'kzpbox-'+num).style.display='block';
      pcRoot.querySelector("#" + 'kzsbox-'+num).style.display='none';
    });
    pcRoot.querySelector("#" + 'kzs-'+num).addEventListener('click',function(){
      clearGroup('kzchips-'+num); pcRoot.querySelector("#" + 'kzs-'+num).className='chip sel';
      pcRoot.querySelector("#" + 'kzpbox-'+num).style.display='none';
      pcRoot.querySelector("#" + 'kzsbox-'+num).style.display='block';
    });
    pcRoot.querySelector("#" + 'ktvon-'+num).addEventListener('input',function(){
      calcMidById('kdvon-'+num,'ktvon-'+num,'kdbis-'+num,'ktbis-'+num,'kmid-'+num);});
    pcRoot.querySelector("#" + 'ktbis-'+num).addEventListener('input',function(){
      calcMidById('kdvon-'+num,'ktvon-'+num,'kdbis-'+num,'ktbis-'+num,'kmid-'+num);});
  })(n);
});

// ── ERBRECHEN ────────────────────────────────────────────────────────────
var erbZeit='kein';
var erbIds=[['ec-nein','nein',false],['ec-futter','futter',true],['ec-galle','galle',true],['ec-haar','haarballen',true],['ec-sonst','sonstiges',true]];
for(var ei=0;ei<erbIds.length;ei++){
  (function(cid,val,warn){
    pcRoot.querySelector("#" + cid).addEventListener('click',function(){
      clearGroup('erb-chips'); pcRoot.querySelector("#" + cid).className=warn?'chip wrn':'chip sel';
      erbVGlobal=val;
      pcRoot.querySelector("#" + 'erb-extra').style.display=val!=='nein'?'block':'none';
      checkSchwer();
    });
  })(erbIds[ei][0],erbIds[ei][1],erbIds[ei][2]);
}
pcRoot.querySelector("#" + 'erbz-kein').addEventListener('click',function(){
  clearGroup('erbz-chips'); pcRoot.querySelector("#" + 'erbz-kein').className='chip sel'; erbZeit='kein';
  pcRoot.querySelector("#" + 'erbz-p').style.display='none'; pcRoot.querySelector("#" + 'erbz-s').style.display='none';});
pcRoot.querySelector("#" + 'erbz-punkt').addEventListener('click',function(){
  clearGroup('erbz-chips'); pcRoot.querySelector("#" + 'erbz-punkt').className='chip sel'; erbZeit='punkt';
  pcRoot.querySelector("#" + 'erbz-p').style.display='block'; pcRoot.querySelector("#" + 'erbz-s').style.display='none';});
pcRoot.querySelector("#" + 'erbz-spanne').addEventListener('click',function(){
  clearGroup('erbz-chips'); pcRoot.querySelector("#" + 'erbz-spanne').className='chip sel'; erbZeit='spanne';
  pcRoot.querySelector("#" + 'erbz-p').style.display='none'; pcRoot.querySelector("#" + 'erbz-s').style.display='block';});
pcRoot.querySelector("#" + 'erb-tvon').addEventListener('input',function(){calcMidById('erb-dvon','erb-tvon','erb-dbis','erb-tbis','erb-mid');});
pcRoot.querySelector("#" + 'erb-tbis').addEventListener('input',function(){calcMidById('erb-dvon','erb-tvon','erb-dbis','erb-tbis','erb-mid');});

// ── CHIP GROUPS (single select) ──────────────────────────────────────────
var simpleGroups=[
  ['mz-chips',['mzc-fr','mzc-mi','mzc-ab'],false],
  ['mg-chips',['mgc-v','mgc-w','mgc-m','mgc-vi'],false],
  ['ba-chips',['bac-un','bac-gb','bac-np'],[false,true,false]],
  ['sc-chips',['scc-nein','scc-pr','scc-sch'],[false,true,true]]
];
for(var gi=0;gi<simpleGroups.length;gi++){
  (function(gid,ids,warns){
    for(var ci=0;ci<ids.length;ci++){
      (function(cid,warn){
        var el=pcRoot.querySelector("#" + cid); if(!el) return;
        el.addEventListener('click',function(){clearGroup(gid); pcRoot.querySelector("#" + cid).className=warn?'chip wrn':'chip sel';});
      })(ids[ci], Array.isArray(warns)?warns[ci]:warns);
    }
  })(simpleGroups[gi][0],simpleGroups[gi][1],simpleGroups[gi][2]);
}

var behaviorRoot=pcRoot.querySelector('#pc-behavior');
var behaviorCategories=[
 ['Aktivität',['Aktiver als üblich','Weniger aktiv','Überwiegend gelegen','Unruhig / läuft häufig umher']],
 ['Beweglichkeit',['Steif beim Aufstehen','Zögert beim Springen','Vermeidet Sprünge','Schwierigkeiten beim Hinaufspringen','Schwierigkeiten beim Hinunterspringen','Hinkt','Unsicher / wackelig']],
 ['Kontaktverhalten',['Sucht mehr Nähe','Zieht sich zurück','Versteckt sich','Gereizt / wehrt Kontakt ab','Aggressiv']],
 ['Ruhe und Schlaf',['Schläft mehr','Wechselt häufig den Liegeplatz','Findet schwer Ruhe','Nachts auffällig unruhig']],
 ['Fellpflege',['Weniger geputzt','Bestimmte Stellen nicht erreicht','Auffällig häufiges Lecken einer Stelle']],
 ['Laute',['Mehr Miauen','Nächtliches Rufen','Knurren / Fauchen','Lautäußerung bei Bewegung','Lautäußerung beim Toilettengang']],
 ['Haltung und Berührung',['Gekrümmte / angespannte Haltung','Abwehr bei sonst angenehmer Berührung']]
];
var behaviorStates=[];
function behaviorField(label,type){
 var wrap=document.createElement('label');wrap.className='pc-beh-field';wrap.append(document.createTextNode(label));
 var input=document.createElement(type==='textarea'?'textarea':type==='select'?'select':'input');
 if(type!=='textarea'&&type!=='select')input.type=type;
 wrap.append(input);return {wrap:wrap,input:input};
}
behaviorCategories.forEach(function(category,index){
 var section=document.createElement('div');section.className='pc-beh-category';
 var title=document.createElement('h3');title.textContent=category[0];section.append(title);
 var state={name:category[0],status:'',choices:[],fields:{},attachments:null};behaviorStates.push(state);
 var controls=document.createElement('div');controls.className='chips';
 var details=document.createElement('div');details.hidden=true;
 ['Wie üblich','Auffällig','Nicht beobachtet'].forEach(function(label){
  var button=document.createElement('button');button.type='button';button.className='chip cursor-interaction';button.textContent=label;button.setAttribute('aria-pressed','false');
  button.addEventListener('click',function(){state.status=label;controls.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b===button));b.className=b===button?'chip sel cursor-interaction':'chip cursor-interaction';});details.hidden=label!=='Auffällig';});controls.append(button);
 });section.append(controls);
 var checks=document.createElement('div');checks.className='pc-beh-checks';
 category[1].forEach(function(label){
  var wrap=document.createElement('label');var input=document.createElement('input');input.type='checkbox';wrap.append(input,document.createTextNode(label));checks.append(wrap);state.choices.push({label:label,input:input});
 });details.append(checks);
 var mode=behaviorField('Seit wann?','select');['','Zeitpunkt','Zeitfenster'].forEach(function(label){var o=document.createElement('option');o.value=label;o.textContent=label||'Nicht angegeben';mode.input.append(o);});details.append(mode.wrap);state.fields.mode=mode.input;
 var dates=document.createElement('div');dates.className='pc-beh-dates';dates.hidden=true;
 ['Beginn','Ende'].forEach(function(label){var f=behaviorField(label,'datetime-local');dates.append(f.wrap);state.fields[label]=f.input;});details.append(dates);
 mode.input.addEventListener('change',function(){dates.hidden=!mode.input.value;state.fields.Ende.parentElement.hidden=mode.input.value!=='Zeitfenster';});
 var duration=behaviorField('Verlauf','select');['','Einmalig','Wiederholt','Anhaltend'].forEach(function(label){var o=document.createElement('option');o.value=label;o.textContent=label||'Nicht angegeben';duration.input.append(o);});details.append(duration.wrap);state.fields.duration=duration.input;
 var context=behaviorField('Situation','select');['','Nach dem Aufstehen','Beim Springen','Vor dem Toilettengang','Nach dem Toilettengang','Sonstige'].forEach(function(label){var o=document.createElement('option');o.value=label;o.textContent=label||'Nicht angegeben';context.input.append(o);});details.append(context.wrap);state.fields.context=context.input;
 var note=behaviorField(category[0]==='Haltung und Berührung'?'Beschreibung / Körperstelle':'Freie Beschreibung','textarea');details.append(note.wrap);state.fields.note=note.input;
 var files=behaviorField('Foto / Video (optional, nur lokale Vorschau)','file');files.input.accept='image/*,video/*';files.input.multiple=true;details.append(files.wrap);state.attachments=files.input;
 var preview=document.createElement('div');preview.className='pc-beh-media';details.append(preview);var urls=[];
 files.input.addEventListener('change',function(){urls.forEach(function(url){URL.revokeObjectURL(url);});urls=[];preview.replaceChildren();Array.from(files.input.files).forEach(function(file){if(!file.type.startsWith('image/')&&!file.type.startsWith('video/'))return;var url=URL.createObjectURL(file);urls.push(url);var media=document.createElement(file.type.startsWith('image/')?'img':'video');media.src=url;if(media.tagName==='IMG')media.alt=file.name;else media.controls=true;preview.append(media);});});
 section.append(details);behaviorRoot.append(section);
});
function behaviorText(){
 var lines=[];
 behaviorStates.forEach(function(state){
  if(!state.status)return;
  var parts=[state.name+': '+state.status];
  if(state.status==='Auffällig'){
   var choices=state.choices.filter(function(x){return x.input.checked;}).map(function(x){return x.label;});if(choices.length)parts.push(choices.join(', '));
   var f=state.fields;
   if(f.mode.value==='Zeitpunkt'&&f.Beginn.value)parts.push('Seit: '+f.Beginn.value.replace('T',' '));
   if(f.mode.value==='Zeitfenster'){if(!f.Beginn.value||!f.Ende.value||f.Ende.value<=f.Beginn.value)throw new Error(state.name+': Bitte ein vollständiges Zeitfenster mit Ende nach Beginn eingeben.');parts.push('Beginn zwischen '+f.Beginn.value.replace('T',' ')+' und '+f.Ende.value.replace('T',' '));}
   if(f.duration.value)parts.push('Verlauf: '+f.duration.value);if(f.context.value)parts.push('Situation: '+f.context.value);if(f.note.value.trim())parts.push('Beschreibung: '+f.note.value.trim());
   if(state.attachments.files.length)parts.push('Lokale Medienauswahl: '+Array.from(state.attachments.files).map(function(file){return file.name;}).join(', ')+' (nicht gespeichert oder übertragen)');
  }lines.push(parts.join(' | '));
 });
 var alert=pcRoot.querySelector('#pc-apathy');if(alert.checked)lines.push('Apathisch / kaum ansprechbar: ausdrücklich beobachtet');
 var ba=getSelChip('ba-chips'),sc=getSelChip('sc-chips');if(ba)lines.push('Bauch: '+baL[ba.dataset.v]);if(sc)lines.push('Schmerzzeichen: '+scL[sc.dataset.v]);
 var note=pcRoot.querySelector('#verh-notiz').value.trim();if(note)lines.push('Verhalten-Notiz: '+note);
 return (lines.length?lines.join('\n'):'Verhalten: Nicht erfasst')+'\n';
}
pcRoot.querySelector('#pc-apathy').addEventListener('change',function(e){pcRoot.querySelector('#pc-apathy-hint').hidden=!e.target.checked;});

// ── LAXATRACT ────────────────────────────────────────────────────────────
var doseCount=0; var doseSerial=0;
pcRoot.querySelector("#" + 'add-dose').addEventListener('click',function(){
  if(doseCount>=3) return;
  doseCount++;
  var n=++doseSerial;
  var t=pad(now.getHours())+':'+pad(now.getMinutes());
  var box=document.createElement('div');
  box.className='dosebox'; box.id='dose-'+n;
  var html='<div class="dosetitle"><span>Gabe '+n+'</span><button class="delbtn" id="ddel-'+n+'">Entfernen</button></div>';
  html+='<div class="grid2">';
  html+='<div class="field"><label style="font-size:12px;color:var(--pc-muted)">Uhrzeit</label><input type="time" id="dt-'+n+'" value="'+t+'" style="font-size:16px;padding:9px 11px;border-radius:9px;border:1.5px solid var(--pc-line);background:var(--pc-bg);width:100%;-webkit-appearance:none"/></div>';
  html+='<div class="field"><label style="font-size:12px;color:var(--pc-muted)">Menge (ml)</label><input type="number" id="dm-'+n+'" value="0.8" min="0.1" max="2" step="0.1" style="font-size:16px;padding:9px 11px;border-radius:9px;border:1.5px solid var(--pc-line);background:var(--pc-bg);width:100%;-webkit-appearance:none"/></div>';
  html+='</div><div class="mrow" id="meth-'+n+'">';
  html+='<button type="button" class="mbtn d" id="mbd-'+n+'">D &mdash; direkt</button>';
  html+='<button type="button" class="mbtn" id="mbf-'+n+'">F &mdash; Futter</button>';
  html+='</div>';
  box.innerHTML=html;
  pcRoot.querySelector("#" + 'dose-list').appendChild(box);
  pcRoot.querySelector("#" + 'lax-none').style.display='none';
  if(doseCount>=3) pcRoot.querySelector("#" + 'add-dose').style.display='none';
  (function(num){
    pcRoot.querySelector("#" + 'mbd-'+num).addEventListener('click',function(){pcRoot.querySelector("#" + 'mbd-'+num).className='mbtn d';pcRoot.querySelector("#" + 'mbf-'+num).className='mbtn';});
    pcRoot.querySelector("#" + 'mbf-'+num).addEventListener('click',function(){pcRoot.querySelector("#" + 'mbd-'+num).className='mbtn';pcRoot.querySelector("#" + 'mbf-'+num).className='mbtn f';});
    pcRoot.querySelector("#" + 'ddel-'+num).addEventListener('click',function(){
      var el=pcRoot.querySelector("#" + 'dose-'+num); if(el) el.remove();
      doseCount--;
      pcRoot.querySelector("#" + 'add-dose').style.display='';
      var boxes=pcRoot.querySelector("#" + 'dose-list').getElementsByClassName('dosebox');
      for(var i=0;i<boxes.length;i++){var dt=boxes[i].querySelector('.dosetitle span');if(dt)dt.textContent='Gabe '+(i+1);}
      if(!boxes.length) pcRoot.querySelector("#" + 'lax-none').style.display='';
    });
  })(n);
});

// ── HELPERS ──────────────────────────────────────────────────────────────
var bezL={'vor-kot':'Vor dem Kotabsatz','nach-kot':'Nach dem Kotabsatz','kein-kot':'Kein Kotabsatz gefolgt',unbekannt:'Nicht zuordenbar'};
var mzL={fruehstueck:'Frühstück',mittag:'Mittag',abendessen:'Abendessen'};
var mgL={verweigert:'Verweigert (0%)',wenig:'Wenig (0-30%)',mittel:'Mittel (31-70%)',viel:'Viel (71-100%)'};
var akL={normal:'Normal/aktiv',ruhiger:'Ruhiger als sonst',apathisch:'Apathisch',aggressiv:'Aggressiv'};
var baL={unauffaellig:'Unauffällig',geblaeht:'Gebläht/hart','nicht-geprueft':'Nicht geprüft'};
var scL={nein:'Keine',pressen:'Pressen ohne Erfolg',schmerzen:'Sichtbare Schmerzen'};
var eL={nein:'Nein',futter:'Futtererbrechen',galle:'Galle/Schleim',haarballen:'Haarballen',sonstiges:'Sonstiges'};
var kTypL={nein:'Kein Kot',vstopf:'Verstopfung (Beginn Episode)',koeddel:'Köddel (leichte Verstopfung)',voll:'Vollständiger Absatz'};
var kQualL={normal:'Normal / geformt',weich:'Weich',hart:'Hart / trocken',fluessig:'Flüssig'};

function getKotZeitStr(n){
  var zmode=pcRoot.querySelector("#" + 'kzp-'+n)&&pcRoot.querySelector("#" + 'kzp-'+n).className.indexOf('sel')>=0?'punkt':'spanne';
  if(zmode==='punkt'){
    var d=pcRoot.querySelector("#" + 'kdp-'+n)?pcRoot.querySelector("#" + 'kdp-'+n).value:'';
    var t=pcRoot.querySelector("#" + 'ktp-'+n)?pcRoot.querySelector("#" + 'ktp-'+n).value:'';
    if(!t) return null;
    var lbl=pcRoot.querySelector("#" + 'ktslbl-'+n)?pcRoot.querySelector("#" + 'ktslbl-'+n).textContent:'Zeitpunkt';
    return lbl+': '+d+' '+t+' Uhr';
  }
  var vD=pcRoot.querySelector("#" + 'kdvon-'+n)?pcRoot.querySelector("#" + 'kdvon-'+n).value:'';
  var vT=pcRoot.querySelector("#" + 'ktvon-'+n)?pcRoot.querySelector("#" + 'ktvon-'+n).value:'';
  var bD=pcRoot.querySelector("#" + 'kdbis-'+n)?pcRoot.querySelector("#" + 'kdbis-'+n).value:'';
  var bT=pcRoot.querySelector("#" + 'ktbis-'+n)?pcRoot.querySelector("#" + 'ktbis-'+n).value:'';
  if(!vD||!bD||!vT||!bT||new Date(bD+'T'+bT)<=new Date(vD+'T'+vT)) return 'Ungültige oder unvollständige Zeitspanne – bitte prüfen';
  var v=new Date(vD+'T'+vT),b=new Date(bD+'T'+bT),m=new Date((v.getTime()+b.getTime())/2);
  return 'Zeitspanne: '+vD+' '+vT+' bis '+bD+' '+bT+' Uhr | Mittelwert: '+m.getFullYear()+'-'+pad(m.getMonth()+1)+'-'+pad(m.getDate())+' '+pad(m.getHours())+':'+pad(m.getMinutes())+' Uhr';
}

function getErbZeitStr(){
  if(erbZeit==='kein') return null;
  if(erbZeit==='punkt'){
    var d=pcRoot.querySelector("#" + 'erb-dp').value,t=pcRoot.querySelector("#" + 'erb-tp').value;
    if(!t) return null; return 'Zeitpunkt: '+d+' '+t+' Uhr';
  }
  var vD=pcRoot.querySelector("#" + 'erb-dvon').value,vT=pcRoot.querySelector("#" + 'erb-tvon').value;
  var bD=pcRoot.querySelector("#" + 'erb-dbis').value,bT=pcRoot.querySelector("#" + 'erb-tbis').value;
  if(!vD||!bD||!vT||!bT||new Date(bD+'T'+bT)<=new Date(vD+'T'+vT)) return 'Ungültige oder unvollständige Zeitspanne – bitte prüfen';
  var v=new Date(vD+'T'+vT),b=new Date(bD+'T'+bT),m=new Date((v.getTime()+b.getTime())/2);
  return 'Zeitspanne: '+vD+' '+vT+' bis '+bD+' '+bT+' Uhr | Mittelwert: '+m.getFullYear()+'-'+pad(m.getMonth()+1)+'-'+pad(m.getDate())+' '+pad(m.getHours())+':'+pad(m.getMinutes())+' Uhr';
}

function validateEventWindows(){
  function field(id){return pcRoot.querySelector('#'+id)?.value||'';}
  function check(label,ids){var error=PerCareTimeValidation.validate.apply(PerCareTimeValidation,ids.map(field));return error?label+': '+error:'';}
  var boxes=pcRoot.querySelectorAll('#kot-list .entrybox');
  for(var i=0;i<boxes.length;i++){
    var n=boxes[i].id.replace('kot-','');
    if(boxes[i].dataset.kotv==='nein')continue;
    if(pcRoot.querySelector('#kzs-'+n)?.classList.contains('sel')){
      var error=check('Kotereignis '+(i+1),['kdvon-'+n,'ktvon-'+n,'kdbis-'+n,'ktbis-'+n]);if(error)return error;
    }
  }
  if(secOpen('erb')&&erbVGlobal&&erbVGlobal!=='nein'&&erbZeit==='spanne'){
    var error=check('Erbrechen',['erb-dvon','erb-tvon','erb-dbis','erb-tbis']);if(error)return error;
  }
  return '';
}

// ── GENERATE ─────────────────────────────────────────────────────────────
pcRoot.querySelector("#" + 'submit-btn').addEventListener('click',function(){
  document.dispatchEvent(new Event('percare:dirty'));
  pcRoot.querySelector('#outbox').textContent='';
  pcRoot.querySelector('#outbox').style.display='none';
  pcRoot.querySelector('#copybtn').style.display='none';
  pcRoot.querySelector('#copyhint').style.display='none';
  var eventError=validateEventWindows();
  pcRoot.querySelector('#capture-error').textContent=eventError;
  if(eventError){pcRoot.querySelector('#capture-error').scrollIntoView({block:'center'});return;}

  pcRoot.querySelector('#pc-beh-error').textContent='';
  if(secOpen('verh')){try{behaviorText();}catch(error){pcRoot.querySelector('#pc-beh-error').textContent=error.message;pcRoot.querySelector('#pc-beh-error').scrollIntoView({block:'nearest'});return;}}
  var datum=pcRoot.querySelector("#" + 'datum').value;
  var uhrzeit=pcRoot.querySelector("#" + 'uhrzeit').value;
  var msg='**Protokolleintrag Perkele — '+datum+' '+uhrzeit+'**\n\n';

  // Check Auffällige Kombination – prüfen
  var hasVstopf=false;
  var kotBoxes=pcRoot.querySelector("#" + 'kot-list').getElementsByClassName('entrybox');
  for(var ki=0;ki<kotBoxes.length;ki++){if(kotBoxes[ki].dataset.kotv==='vstopf') hasVstopf=true;}
  var isSchwer=hasVstopf&&erbVGlobal==='futter';

  // Kotabsatz
  if(!kotBoxes.length){
    msg+='Kotabsatz: Nicht erfasst\n';
  } else if(kotBoxes.length===1){
    var kv=kotBoxes[0].dataset.kotv||'nein';
    var kLabel=(kTypL[kv]||kv)+(isSchwer?' → Auffällige Kombination – prüfen':'');
    msg+='Kotabsatz: '+kLabel;
    var kz=(kv!=='nein'?getKotZeitStr(kotBoxes[0].id.replace('kot-','')):null);if(kz)msg+=' | '+kz;
    var kqEl=kotBoxes[0].querySelector('select');var kq=kqEl?kqEl.value:'';
    if(kq&&kv!=='vstopf')msg+=' | Qualität: '+(kQualL[kq]||kq);
    var kbEl=kotBoxes[0].querySelector('textarea');var kb=kbEl?kbEl.value.trim():'';
    if(kb)msg+=' | Bemerkung: '+kb;
    msg+='\n';
  } else {
    msg+='Kotabsatz: '+kotBoxes.length+' Einträge'+(isSchwer?' → Auffällige Kombination: Verstopfung und Futtererbrechen – keine automatische Schweregradeinstufung':'')+'\n';
    for(var ki2=0;ki2<kotBoxes.length;ki2++){
      var kv2=kotBoxes[ki2].dataset.kotv||'nein';
      msg+='  Eintrag '+(ki2+1)+': '+(kTypL[kv2]||kv2);
      var kzStr=(kv2!=='nein'?getKotZeitStr(kotBoxes[ki2].id.replace('kot-','')):null);if(kzStr)msg+=' | '+kzStr;
      var kqEl2=kotBoxes[ki2].querySelector('select');var kq2=kqEl2?kqEl2.value:'';
      if(kq2&&kv2!=='vstopf')msg+=' | Qualität: '+(kQualL[kq2]||kq2);
      var kbEl2=kotBoxes[ki2].querySelector('textarea');var kb2=kbEl2?kbEl2.value.trim():'';
      if(kb2)msg+=' | Bemerkung: '+kb2;
      msg+='\n';
    }
  }

  // Erbrechen
  if(secOpen('erb')){
    if(!erbVGlobal){pcRoot.querySelector('#pc-beh-error').textContent='Bitte Erbrechen ausdrücklich auswählen oder den Bereich schließen.';return;}
    msg+='Erbrechen: '+(eL[erbVGlobal]||erbVGlobal);
    if(erbVGlobal!=='nein'){
      var ez=getErbZeitStr();if(ez)msg+=' | '+ez;
      var ea=pcRoot.querySelector("#" + 'erb-anz').value;if(ea)msg+=' | Episoden: '+ea;
      var eb2=pcRoot.querySelector("#" + 'erb-bez').value;if(eb2)msg+=' | Bezug: '+(bezL[eb2]||eb2);
      var ebm=pcRoot.querySelector("#" + 'erb-bem').value.trim();if(ebm)msg+=' | Bemerkung: '+ebm;
    }
    msg+='\n';
  } else msg+='Erbrechen: Nicht erfasst\n';

  // Urin
  if(secOpen('urin')){
    var ua=pcRoot.querySelector("#" + 'urin-anz').value;
    var ub=pcRoot.querySelector("#" + 'urin-bem').value.trim();
    msg+='Urinabsatz ('+pcRoot.querySelector('#urin-d').value+'): '+(ua!==''?ua+'x':'keine Angabe');
    if(ub)msg+=' | Bemerkung: '+ub;msg+='\n';
  } else msg+='Urinabsatz: Nicht erfasst\n';

  // Futter
  if(secOpen('futter')){
    var mzc=getSelChip('mz-chips');var mgc=getSelChip('mg-chips');
    var mzv=mzc?mzc.dataset.v:'';var mgv=mgc?mgc.dataset.v:'';
    var fm=pcRoot.querySelector("#" + 'fut-marke').value.trim();
    var fs=pcRoot.querySelector("#" + 'fut-sorte').value.trim();
    var fb=pcRoot.querySelector("#" + 'fut-bem').value.trim();
    msg+='Futteraufnahme: '+(mzL[mzv]||mzv)+' — '+(mgL[mgv]||mgv);
    if(fm||fs)msg+=' | Futter: '+[fm,fs].filter(function(x){return x;}).join(' ');
    if(fb)msg+=' | Bemerkung: '+fb;msg+='\n';
  } else msg+='Futteraufnahme: Nicht erfasst\n';

  if(secOpen('futter')&&(!getSelChip('mz-chips')||!getSelChip('mg-chips'))){pcRoot.querySelector('#pc-beh-error').textContent='Bitte Mahlzeit und aufgenommene Menge ausdrücklich auswählen.';return;}

  // Verhalten
  if(secOpen('verh')){msg+=behaviorText();}else msg+='Verhalten: Nicht erfasst\n';

  // Laxatract
  if(secOpen('lax')){
    var dboxes=pcRoot.querySelector("#" + 'dose-list').getElementsByClassName('dosebox');
    if(!dboxes.length){msg+='Laxatract: Keine Gabe\n';}
    else{
      msg+='Laxatract: '+dboxes.length+' Gabe(n)\n';
      for(var di=0;di<dboxes.length;di++){
        var bid=dboxes[di].id.replace('dose-','');
        var dt2=pcRoot.querySelector("#" + 'dt-'+bid);var dm2=pcRoot.querySelector("#" + 'dm-'+bid);
        var mbd=pcRoot.querySelector("#" + 'mbd-'+bid);
        var bt=dt2?dt2.value:'';var bml=dm2?parseFloat(dm2.value):0.8;
        var bm=mbd&&mbd.className.indexOf(' d')>=0?'D':'F';
        var best=bm==='F'?' (tatsächliche Aufnahme unbekannt; Futteraufnahme separat berücksichtigen)':'';
        msg+='  Gabe '+(di+1)+': '+bml+' ml, '+(bm==='D'?'direkt':'über Futter')+', '+bt+' Uhr'+best+'\n';
      }
    }
    var lb=pcRoot.querySelector("#" + 'lax-bem').value.trim();if(lb)msg+='Laxatract-Bemerkung: '+lb+'\n';
  } else msg+='Laxatract: Nicht erfasst\n';

  // Gewicht
  if(secOpen('gew')){var g=pcRoot.querySelector("#" + 'gewicht').value;if(g)msg+='Gewicht: '+g+' kg\n';}
  // Notizen
  if(secOpen('noti')){var nt=pcRoot.querySelector("#" + 'notizen').value.trim();if(nt)msg+='Notizen: '+nt+'\n';}

  var ob=pcRoot.querySelector("#" + 'outbox');
  ob.textContent=msg; ob.style.display='block';
document.dispatchEvent(new CustomEvent('percare:review',{detail:{text:msg,snapshot:captureSnapshot()}}));
  pcRoot.querySelector("#" + 'copybtn').style.display='block';
  pcRoot.querySelector("#" + 'copyhint').style.display='block';
  pcRoot.querySelector("#" + 'copybtn').textContent='📋 Text kopieren';
  ob.scrollIntoView({behavior:'smooth',block:'nearest'});
});

// Copy
pcRoot.querySelector("#" + 'copybtn').addEventListener('click',function(){
  var t=pcRoot.querySelector("#" + 'outbox').textContent;
  var btn=pcRoot.querySelector("#" + 'copybtn');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(function(){
      btn.textContent='✅ Kopiert!';setTimeout(function(){btn.textContent='📋 Text kopieren';},2000);
    }).catch(function(){fb(t,btn);});
  } else fb(t,btn);
});
function fb(t,btn){
  var ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(ta);ta.focus();ta.select();
  try{document.execCommand('copy');btn.textContent='✅ Kopiert!';setTimeout(function(){btn.textContent='📋 Text kopieren';},2000);}catch(e){}
  document.body.removeChild(ta);
}

pcRoot.addEventListener('input',function(e){var id=e.target.id; if(/^k(dvon|dbis|tvon|tbis)-/.test(id)){var n=id.split('-')[1];calcMidById('kdvon-'+n,'ktvon-'+n,'kdbis-'+n,'ktbis-'+n,'kmid-'+n);}if(/^erb-(dvon|dbis|tvon|tbis)$/.test(id))calcMidById('erb-dvon','erb-tvon','erb-dbis','erb-tbis','erb-mid');});

pcRoot.addEventListener('input',()=>document.dispatchEvent(new Event('percare:dirty')));
pcRoot.addEventListener('click',e=>{const button=e.target.closest('button');if(button&&!button.matches('#submit-btn,#copybtn'))document.dispatchEvent(new Event('percare:dirty'));});
})();
