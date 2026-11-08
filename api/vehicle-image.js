// Miniaturas do modelo ORIGINAL hospedado no Sketchfab.
// A API não recebe URLs externas: apenas UIDs hexadecimais verificados.
const acceptedHost = host => host === 'sketchfab.com' ||
  host.endsWith('.sketchfab.com') || host.endsWith('.cloudfront.net');

async function fetchSourceJson(url){
  const response=await fetch(url,{
    headers:{'Accept':'application/json'},
    signal:AbortSignal.timeout(7000)
  });
  if(!response.ok)throw new Error('Preview provider returned '+response.status);
  return response.json();
}
function safeImage(url){
  try{
    const parsed=new URL(url);
    return parsed.protocol==='https:' && acceptedHost(parsed.hostname) ? parsed.href : null;
  }catch{return null;}
}
export default async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
  const uid=typeof req.query.uid==='string'?req.query.uid.toLowerCase():'';
  if(!/^[a-f0-9]{32}$/.test(uid))return res.status(400).json({error:'Identificador inválido'});
  const cache='public, s-maxage=86400, stale-while-revalidate=604800';
  try{
    let thumbnail=null;
    try{
      const model=await fetchSourceJson('https://api.sketchfab.com/v3/models/'+uid);
      const imgs=(model?.thumbnails?.images||[]).filter(x=>x.url);
      imgs.sort((a,b)=>(a.width||0)-(b.width||0));
      thumbnail=imgs.find(x=>(x.width||0)>=480)?.url||imgs[imgs.length-1]?.url||null;
    }catch{ /* Fonte secundária: oEmbed oficial */ }
    if(!thumbnail){
      const modelUrl='https://sketchfab.com/models/'+uid;
      const embed=await fetchSourceJson('https://sketchfab.com/oembed?url='+encodeURIComponent(modelUrl));
      thumbnail=embed.thumbnail_url||null;
    }
    const verified=safeImage(thumbnail);
    if(!verified)return res.status(404).json({error:'Sem fotografia disponível'});
    res.setHeader('Cache-Control',cache);
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.redirect(302,verified);
  }catch{
    res.setHeader('Cache-Control','public, s-maxage=120');
    return res.status(502).json({error:'Miniatura indisponível na origem'});
  }
}
