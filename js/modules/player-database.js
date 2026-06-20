const clamp=(n,min=1,max=99)=>Math.max(min,Math.min(max,Math.round(Number(n)||0)));
const hash=(text='')=>[...String(text)].reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0);
const variation=(seed,offset,span=7)=>Math.abs((seed*(offset+11))% (span*2+1))-span;
export function enrichPlayer(raw={}){
  const p={...raw}; const base=clamp(p.overall||60); const seed=Math.abs(hash(p.id||p.name||'player'));
  p.country ||= p.countryCode || 'INT'; p.style ||= p.archetype || 'Equilibrado'; p.potential=clamp(p.potential||Math.min(99,base+8+variation(seed,2,5)));
  p.serve=clamp(p.serve||base+variation(seed,1)); p.forehand=clamp(p.forehand||base+variation(seed,2)); p.backhand=clamp(p.backhand||base+variation(seed,3));
  p.return=clamp(p.return||base+variation(seed,4)); p.volley=clamp(p.volley||base+variation(seed,5,10)); p.slice=clamp(p.slice||base+variation(seed,6,9));
  p.speed=clamp(p.speed||base+variation(seed,7)); p.agility=clamp(p.agility||base+variation(seed,8)); p.stamina=clamp(p.stamina||base+variation(seed,9)); p.strength=clamp(p.strength||base+variation(seed,10));
  p.mental=clamp(p.mental||p.focus||base+variation(seed,11)); p.composure=clamp(p.composure||base+variation(seed,12)); p.consistency=clamp(p.consistency||base+variation(seed,13)); p.tacticalIQ=clamp(p.tacticalIQ||base+variation(seed,14));
  p.professionalism=clamp(p.professionalism||55+(seed%40)); p.ambition=clamp(p.ambition||58+((seed>>2)%38)); p.loyalty=clamp(p.loyalty||45+((seed>>4)%48)); p.injuryProneness=clamp(p.injuryProneness||8+((seed>>6)%38));
  p.preferredSurface ||= p.surface || ['hard','clay','grass'][seed%3];
  const pref=p.preferredSurface; p.surfaceRatings ||= {hard:clamp(base+(pref==='hard'?5:variation(seed,15,3))),clay:clamp(base+(pref==='clay'?5:variation(seed,16,3))),grass:clamp(base+(pref==='grass'?5:variation(seed,17,3)))};
  p.personality ||= p.professionalism>82?'Profissional':p.ambition>82?'Ambicioso':p.loyalty>82?'Leal':p.mental>82?'Competidor':'Equilibrado';
  p.form ||= 65+(seed%26); p.confidence ||= 60+((seed>>3)%31); p.marketValue ||= Math.max(25000,Math.round((base*base)*(p.potential/20)*100));
  return p;
}
export const enrichPlayers=(rows=[])=>rows.map(enrichPlayer);
export function categoryAverage(p,keys){return Math.round(keys.reduce((s,k)=>s+(Number(p[k])||0),0)/keys.length)}
export function surfaceLabel(key){return ({hard:'Piso duro',clay:'Saibro',grass:'Grama'})[key]||key}
