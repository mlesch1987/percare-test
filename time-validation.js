// Gemeinsame Prüfung vor Textgenerierung. Keine Veränderung gespeicherter Daten.
var PerCareTimeValidation = {
 parse: function(date,time){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
  var parts=date.split('-').map(Number),clock=time.split(':').map(Number);
  if(clock[0]>23||clock[1]>59)return null;
  var value=new Date(date+'T'+time);
  if(!Number.isFinite(value.getTime())||value.getFullYear()!==parts[0]||value.getMonth()+1!==parts[1]||value.getDate()!==parts[2]||value.getHours()!==clock[0]||value.getMinutes()!==clock[1])return null;
  return value;
 },
 validate: function(startDate,startTime,endDate,endTime){
  var start=this.parse(startDate,startTime),end=this.parse(endDate,endTime);
  if(!start||!end)return 'Bitte Anfang und Ende vollständig mit gültigem Datum und Uhrzeit angeben.';
  if(end<=start)return 'Ende muss nach Beginn liegen.';
  return '';
 }
};
