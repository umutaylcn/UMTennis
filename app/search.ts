/** Match search that tolerates accents and small typos without matching short noise. */
export function normalizeSearchText(value:string):string{
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[ı]/g,"i")
    .replace(/ß/g,"ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function closeWord(query:string,candidate:string):boolean{
  const length=Math.max(query.length,candidate.length);
  const allowed=length>=8?2:length>=4?1:0;
  if(!allowed||Math.abs(query.length-candidate.length)>allowed)return false;
  let previous=Array.from({length:candidate.length+1},(_,index)=>index);
  for(let i=1;i<=query.length;i++){
    const current=[i];
    for(let j=1;j<=candidate.length;j++){
      current[j]=Math.min(
        current[j-1]+1,
        previous[j]+1,
        previous[j-1]+(query[i-1]===candidate[j-1]?0:1),
      );
    }
    previous=current;
  }
  return previous[candidate.length]<=allowed
    &&previous[candidate.length]/length<=.28;
}

export function matchesSearch(query:string,fields:readonly string[]):boolean{
  const needle=normalizeSearchText(query);
  if(!needle)return true;
  const normalized=fields.map(normalizeSearchText);
  if(normalized.some(field=>field.includes(needle)))return true;
  const words=normalized.flatMap(field=>field.split(" ")).filter(Boolean);
  return needle.split(" ").every(part=>words.some(word=>
    word.startsWith(part)||closeWord(part,word)
  ));
}
