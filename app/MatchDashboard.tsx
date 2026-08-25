"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Language = "en" | "tr";
type View = "matches" | "model";
type FormSummary = { matches:number; wins:number; losses:number; form:string; win_rate:number|null; aces:number|null; double_faults:number|null; service_points_won_pct:number|null; return_points_won_pct:number|null; break_points_saved_pct:number|null; };
type PlayerProfile = { atp_rank:number|null; elo:number; elo_rank:number|null; surface_elo:number; surface_elo_rank:number|null; last_5:FormSummary; last_10:FormSummary; surface_last_10:FormSummary; career:FormSummary; };
type Match = { match_id:number; start_time_utc:string; tournament_name:string; surface:string; round:string; p1_name:string; p2_name:string; p1_id:number|null; p2_id:number|null; p1_rank:number|null; p2_rank:number|null; p1_elo_rank:number|null; p2_elo_rank:number|null; match_strength:number; };
type HeadToHead = { matches:number; p1_wins:number; p2_wins:number; surface_matches:number; p1_surface_wins:number; p2_surface_wins:number; };
type Prediction = Match & { p1_win_probability:number; p2_win_probability:number; predicted_winner:string; confidence:number; confidence_label:string; h2h:HeadToHead; state_as_of_utc:string; p1_profile:PlayerProfile; p2_profile:PlayerProfile; };

function roundPresentation(round:string){
  const normalized=round.trim().toUpperCase();
  if(normalized==="QF"||normalized.includes("QUARTER"))return{tier:"qf",label:"QF"};
  if(normalized==="SF"||normalized.includes("SEMI"))return{tier:"sf",label:"SF"};
  if(normalized==="F"||normalized==="FINAL")return{tier:"f",label:"F"};
  return{tier:"standard",label:round};
}

function MatchStrength({value}:{value:number}){
  return <div className="match-strength" title={`Match strength: ${value.toFixed(1)} / 5`} aria-label={`Match strength ${value.toFixed(1)} out of 5`}><div aria-hidden="true">{[1,2,3,4,5].map(star=>{
    const fill=value-star;
    return <span className={fill>=0?"full":fill===-0.5?"half":"empty"} key={star}>★</span>;
  })}</div></div>;
}

const API_BASE=
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://umtennis-api.onrender.com";
const PLAYER_IMAGE_FALLBACKS:Record<number,string>={
  19:"https://media.prod.tennis.com/v1/tcf/images/headshots/cb77df64-7fd7-459a-923e-9b909d964f2d.png?fm=webp&q=80&w=1200",
  115:"https://images.prismic.io/fft-rg-site/ZksBuyol0Zci9Rk0_47931_J.FARIA.png?auto=format%2Ccompress&h=900&w=900",
  159:"https://media.prod.tennis.com/v1/tcf/images/players/cbd8af29-cab2-4410-9582-263360a24888/20260605_183838.png?fm=webp&q=80&w=1600",
  214:"https://images.prismic.io/fft-rg-site/b9f1ef94-f06f-429f-b65c-1241636299d4_20210605_PJ_MeridaAguilarDaniel_US.png?auto=compress%2Cformat&h=900&w=900",
  503:"https://media.prod.tennis.com/v1/tcf/images/players/10dca6c0-8a78-42aa-ab96-d112224897cc/20260604_214842.png?fm=webp&q=80&w=1600",
  511:"https://media.prod.tennis.com/v1/tcf/images/players/4ccc452d-a6f2-44d0-9a6c-929ed95b349f/20260605_182959.png?fm=webp&q=80&w=1600",
  539:"https://a.espncdn.com/combiner/i?img=%2Fi%2Fheadshots%2Ftennis%2Fplayers%2Ffull%2F2642.png&w=1200",
  652:"https://staticfanpage.akamaized.net/wp-content/uploads/sites/27/2025/07/Cobolli-casa-londra-1751443743207-1200x675.jpg",
  653:"https://a.espncdn.com/combiner/i?img=%2Fi%2Fheadshots%2Ftennis%2Fplayers%2Ffull%2F2651.png&w=1200",
  1002:"https://media.prod.tennis.com/v1/tcf/images/players/9f7109a5-ca31-43ac-9b9a-c529bcd38d36/20260604_215936.png?fm=webp&q=80&w=1600",
  8730:"https://longform.atptour.com/meet-the-nextgenatp-class-of-2024/assets/djEb5QgRVw/mensik-v-1080x1920.jpg",
};
const PLAYER_CUTOUT_IDS=new Set([2,5,6,7,9,15,18,19,23,27,31,37,64,94,115,159,173,179,189,197,214,225,229,236,401,411,503,511,521,536,539,604,652,653,664,844,990,1002,1096,1215,1253,4872,6146,6316,7607,8730,9137]);
// Provider IDs can change or be temporarily unavailable in a cached fixture.
// Resolve these locally prepared portraits by stable player name first.
const PLAYER_NAME_CUTOUTS:Record<string,string>={
  "Dhakshineswar Suresh":"9137",
  "Quinn Vandecasteele":"604",
  "James Duckworth":"64",
  "Jan Choinski":"94",
  "Mees Rottgering":"7607",
  "Martin Damm":"5",
  "Abedallah Shelbayh":"401",
  "Sebastian Gorzny":"6316",
  "Cruz Hewitt":"4872",
  "Felix Balshaw":"1096",
  "Aleksandar Kovacevic":"189",
  "Hugo Grenier":"179",
  "Marcos Giron":"990",
  "Vit Kopriva":"6146",
  "Adam Walton":"159",
  "Jesper De Jong":"229",
  "Miomir Kecmanovic":"536",
  "Francisco Comesana":"521",
  "Adolfo Daniel Vallejo":"197",
  "Mattia Bellucci":"225",
  "Adrian Mannarino":"adrian-mannarino",
};
const TOP20_PLAYER_CUTOUTS:Record<string,string>={
  "Carlos Alcaraz":"carlos-alcaraz",
  "Jannik Sinner":"jannik-sinner",
  "Alexander Zverev":"alexander-zverev",
  "Novak Djokovic":"novak-djokovic",
  "Arthur Fils":"arthur-fils",
  "Rafael Jodar":"rafael-jodar",
  "Taylor Fritz":"taylor-fritz",
  "Casper Ruud":"casper-ruud",
  "Felix Auger Aliassime":"felix-auger-aliassime",
  "Felix Auger-Aliassime":"felix-auger-aliassime",
  "Lorenzo Musetti":"lorenzo-musetti",
  "Jack Draper":"jack-draper",
  "Frances Tiafoe":"frances-tiafoe",
  "Tommy Paul":"tommy-paul",
  "Alex De Minaur":"alex-de-minaur",
  "Alex de Minaur":"alex-de-minaur",
  "Brandon Nakashima":"brandon-nakashima",
  "Daniil Medvedev":"daniil-medvedev",
  "Learner Tien":"learner-tien",
  "Jakub Mensik":"jakub-mensik",
  "Sebastian Korda":"sebastian-korda",
  "Jiri Lehecka":"jiri-lehecka",
};
const TOP40_PLAYER_CUTOUTS:Record<string,string>={
  "Hyeon Chung":"hyeon-chung",
  "Grigor Dimitrov":"grigor-dimitrov",
  "Joao Fonseca":"joao-fonseca",
  "Ben Shelton":"ben-shelton",
  "Flavio Cobolli":"flavio-cobolli",
  "Alejandro Davidovich Fokina":"alejandro-davidovich-fokina",
  "Andrey Rublev":"andrey-rublev",
  "Alexander Bublik":"alexander-bublik",
  "Nick Kyrgios":"nick-kyrgios",
  "Thiago Agustin Tirante":"thiago-agustin-tirante",
  "Tomas Machac":"tomas-machac",
  "Nuno Borges":"nuno-borges",
  "Cameron Norrie":"cameron-norrie",
  "Francisco Cerundolo":"francisco-cerundolo",
  "Thanasi Kokkinakis":"thanasi-kokkinakis",
  "Kei Nishikori":"kei-nishikori",
  "Stefanos Tsitsipas":"stefanos-tsitsipas",
  "Hubert Hurkacz":"hubert-hurkacz",
  "Matteo Berrettini":"matteo-berrettini",
  "Quentin Halys":"quentin-halys",
  "Alex Michelsen":"alex-michelsen",
  "Luciano Darderi":"luciano-darderi",
};
const TOP60_PLAYER_CUTOUTS:Record<string,string>={
  "Michael Mmoh":"michael-mmoh",
  "Yannick Hanfmann":"yannick-hanfmann",
  "Alexander Blockx":"alexander-blockx",
  "Alex Molcan":"alex-molcan",
  "Jordan Thompson":"jordan-thompson",
  "Mariano Navone":"mariano-navone",
  "Daniel Merida Aguilar":"daniel-merida-aguilar",
  "Valentin Vacherot":"valentin-vacherot",
  "Kamil Majchrzak":"kamil-majchrzak",
  "Ugo Humbert":"ugo-humbert",
  "Botic Van De Zandschulp":"botic-van-de-zandschulp",
  "Botic van de Zandschulp":"botic-van-de-zandschulp",
  "Alejandro Tabilo":"alejandro-tabilo",
  "Denis Shapovalov":"denis-shapovalov",
  "Benjamin Bonzi":"benjamin-bonzi",
  "Marin Cilic":"marin-cilic",
  "Sebastian Baez":"sebastian-baez",
  "S. Baez":"sebastian-baez",
  "Arthur Rinderknech":"arthur-rinderknech",
  "Jaume Munar":"jaume-munar",
};
const TOP80_PLAYER_CUTOUTS:Record<string,string>={
  "Jan Lennard Struff":"jan-lennard-struff",
  "Jan-Lennard Struff":"jan-lennard-struff",
  "Zizou Bergs":"zizou-bergs",
  "Terence Atmane":"terence-atmane",
  "Yoshihito Nishioka":"yoshihito-nishioka",
  "Fabian Marozsan":"fabian-marozsan",
  "Juncheng Shang":"juncheng-shang",
  "Hamad Medjedovic":"hamad-medjedovic",
  "Arthur Fery":"arthur-fery",
  "Daniel Altmaier":"daniel-altmaier",
  "Raphael Collignon":"raphael-collignon",
  "Reilly Opelka":"reilly-opelka",
  "Arthur Cazaux":"arthur-cazaux",
  "Dino Prizmic":"dino-prizmic",
  "Tallon Griekspoor":"tallon-griekspoor",
  "Yibing Wu":"yibing-wu",
  "Karen Khachanov":"karen-khachanov",
  "Roman Safiullin":"roman-safiullin",
  "Daniel Evans":"daniel-evans",
  "Alexei Popyrin":"alexei-popyrin",
  "Juan Manuel Cerundolo":"juan-manuel-cerundolo",
};
const TOP100_PLAYER_CUTOUTS:Record<string,string>={
  "Marton Fucsovics":"marton-fucsovics",
  "Gael Monfils":"gael-monfils",
  "Jenson Brooksby":"jenson-brooksby",
  "Gabriel Diallo":"gabriel-diallo",
  "Pablo Carreno Busta":"pablo-carreno-busta",
  "Ignacio Buse":"ignacio-buse",
  "Jaime Faria":"jaime-faria",
  "Eliot Spizzirri":"eliot-spizzirri",
  "Luca Van Assche":"luca-van-assche",
  "Lorenzo Sonego":"lorenzo-sonego",
  "Tomas Martin Etcheverry":"tomas-martin-etcheverry",
  "Yosuke Watanuki":"yosuke-watanuki",
  "Alexander Shevchenko":"alexander-shevchenko",
  "Thiago Seyboth Wild":"thiago-seyboth-wild",
  "Matteo Arnaldi":"matteo-arnaldi",
  "Rinky Hijikata":"rinky-hijikata",
  "Dominic Stricker":"dominic-stricker",
  "Soon Woo Kwon":"soon-woo-kwon",
  "Titouan Droguet":"titouan-droguet",
  "Ethan Quinn":"ethan-quinn",
};
const PLAYER_PHOTO_HOME_SIDE:Record<string,"left"|"right">={
  "Dhakshineswar Suresh":"right",
  "Quinn Vandecasteele":"left",
  "James Duckworth":"right",
  "Jan Choinski":"left",
  "Mees Rottgering":"left",
  "Martin Damm":"left",
  "Abedallah Shelbayh":"left",
  "Sebastian Gorzny":"left",
  "Felix Balshaw":"left",
  "Aleksandar Kovacevic":"right",
  "Hugo Grenier":"left",
  "Giovanni Mpetshi Perricard":"left",
  "Cruz Hewitt":"left",
  "Sho Shimabukuro":"left",
  "Miomir Kecmanovic":"right",
  "Martin Landaluce":"left",
  "Mattia Bellucci":"left",
  "Adrian Mannarino":"left",
  "Francisco Comesana":"left",
  "Adolfo Daniel Vallejo":"left",
  "Darwin Blanch":"left",
  "Valentin Royer":"left",
  "Marcos Giron":"left",
  "Vit Kopriva":"left",
  "Jesper De Jong":"right",
  "Jannik Sinner":"left",
  "Carlos Alcaraz":"right",
  "Novak Djokovic":"left",
  "Alexander Zverev":"right",
  "Arthur Fils":"right",
  "Rafael Jodar":"left",
  "Casper Ruud":"right",
  "Taylor Fritz":"right",
  "Lorenzo Musetti":"right",
  "Felix Auger Aliassime":"right",
  "Felix Auger-Aliassime":"right",
  "Frances Tiafoe":"right",
  "Jack Draper":"left",
  "Tommy Paul":"left",
  "Alex De Minaur":"right",
  "Alex de Minaur":"right",
  "Brandon Nakashima":"left",
  "Daniil Medvedev":"left",
  "Jakub Mensik":"right",
  "Learner Tien":"right",
  "Sebastian Korda":"left",
  "Jiri Lehecka":"right",
  "Hyeon Chung":"left",
  "Grigor Dimitrov":"left",
  "Ben Shelton":"left",
  "Joao Fonseca":"left",
  "Flavio Cobolli":"right",
  "Alejandro Davidovich Fokina":"right",
  "Alexander Bublik":"left",
  "Andrey Rublev":"left",
  "Thiago Agustin Tirante":"left",
  "Nick Kyrgios":"right",
  "Nuno Borges":"right",
  "Tomas Machac":"right",
  "Cameron Norrie":"left",
  "Francisco Cerundolo":"right",
  "Thanasi Kokkinakis":"left",
  "Kei Nishikori":"right",
  "Hubert Hurkacz":"left",
  "Stefanos Tsitsipas":"right",
  "Matteo Berrettini":"left",
  "Quentin Halys":"right",
  "Alex Michelsen":"right",
  "Luciano Darderi":"left",
  "Michael Mmoh":"right",
  "Yannick Hanfmann":"right",
  "Alexander Blockx":"left",
  "Alex Molcan":"right",
  "Jordan Thompson":"left",
  "Mariano Navone":"left",
  "Valentin Vacherot":"right",
  "Kamil Majchrzak":"left",
  "Ugo Humbert":"right",
  "Botic Van De Zandschulp":"left",
  "Botic van de Zandschulp":"left",
  "Alejandro Tabilo":"left",
  "Denis Shapovalov":"right",
  "Benjamin Bonzi":"right",
  "Marin Cilic":"left",
  "Sebastian Baez":"right",
  "S. Baez":"right",
  "Arthur Rinderknech":"left",
  "Jaume Munar":"right",
  "Jan Lennard Struff":"left",
  "Jan-Lennard Struff":"left",
  "Zizou Bergs":"right",
  "Terence Atmane":"left",
  "Yoshihito Nishioka":"left",
  "Fabian Marozsan":"left",
  "Juncheng Shang":"right",
  "Hamad Medjedovic":"left",
  "Arthur Fery":"right",
  "Daniel Altmaier":"left",
  "Raphael Collignon":"left",
  "Reilly Opelka":"left",
  "Arthur Cazaux":"right",
  "Dino Prizmic":"left",
  "Tallon Griekspoor":"left",
  "Yibing Wu":"left",
  "Juan Manuel Cerundolo":"right",
  "Karen Khachanov":"right",
  "Roman Safiullin":"right",
  "Daniel Evans":"left",
  "Alexei Popyrin":"left",
  "Marton Fucsovics":"left",
  "Gael Monfils":"left",
  "Jenson Brooksby":"left",
  "Gabriel Diallo":"left",
  "Pablo Carreno Busta":"left",
  "Ignacio Buse":"left",
  "Jaime Faria":"right",
  "Eliot Spizzirri":"right",
  "Luca Van Assche":"left",
  "Lorenzo Sonego":"left",
  "Tomas Martin Etcheverry":"left",
  "Yosuke Watanuki":"right",
  "Alexander Shevchenko":"left",
  "Thiago Seyboth Wild":"right",
  "Matteo Arnaldi":"right",
  "Rinky Hijikata":"right",
  "Dominic Stricker":"right",
  "Soon Woo Kwon":"left",
  "Titouan Droguet":"right",
  "Ethan Quinn":"left",
};
const PLAYER_PORTRAIT_SCALE:Record<string,"108"|"109"|"110"|"117"|"118"|"120"|"121"|"127"|"130"|"133"|"140"|"140plain"|"143"|"150"|"157"|"164"|"166"|"169"|"177"|"180"|"182"|"183"|"220"|"230">={
  "Dhakshineswar Suresh":"182",
  "Quinn Vandecasteele":"133",
  "James Duckworth":"130",
  "Jan Choinski":"130",
  "Mees Rottgering":"120",
  "Martin Damm":"109",
  "Abedallah Shelbayh":"109",
  "Sebastian Gorzny":"130",
  "Hugo Grenier":"108",
  "Adam Walton":"110",
  "Arthur Fils":"110",
  "Michael Mmoh":"110",
  "Yannick Hanfmann":"110",
  "Jordan Thompson":"110",
  "Denis Shapovalov":"110",
  "Benjamin Bonzi":"118",
  "Novak Djokovic":"120",
  "Sebastian Korda":"120",
  "Mariano Navone":"120",
  "Daniel Merida Aguilar":"110",
  "Jaume Munar":"120",
  "Alexander Blockx":"130",
  "Alex Molcan":"130",
  "Valentin Vacherot":"130",
  "Kamil Majchrzak":"130",
  "Ugo Humbert":"130",
  "Sebastian Baez":"143",
  "S. Baez":"143",
  "Adrian Mannarino":"130",
  "Arthur Rinderknech":"130",
  "Hyeon Chung":"140",
  "Jan Lennard Struff":"127",
  "Jan-Lennard Struff":"127",
  "Zizou Bergs":"127",
  "Dino Prizmic":"117",
  "Terence Atmane":"169",
  "Yoshihito Nishioka":"183",
  "Hamad Medjedovic":"157",
  "Arthur Fery":"157",
  "Daniel Altmaier":"157",
  "Raphael Collignon":"157",
  "Reilly Opelka":"166",
  "Juncheng Shang":"150",
  "Yibing Wu":"150",
  "Roman Safiullin":"164",
  "Daniel Evans":"150",
  "Marton Fucsovics":"140plain",
  "Lorenzo Sonego":"140plain",
  "Ethan Quinn":"140plain",
  "Gael Monfils":"110",
  "Jenson Brooksby":"121",
  "Ignacio Buse":"121",
  "Rinky Hijikata":"110",
  "Soon Woo Kwon":"110",
  "Gabriel Diallo":"164",
  "Eliot Spizzirri":"177",
  "Alexander Shevchenko":"110",
  "Thiago Seyboth Wild":"164",
  "Dominic Stricker":"177",
};
const PLAYER_PORTRAIT_SHIFT:Record<string,number|string>={
  "Quinn Vandecasteele":"70px",
  "Martin Damm":"5px",
  "Abedallah Shelbayh":"5px",
  "Michael Mmoh":8,
  "Yannick Hanfmann":5,
  "Alexander Blockx":22,
  "Alex Molcan":16,
  "Jordan Thompson":5,
  "Mariano Navone":14,
  "Daniel Merida Aguilar":8,
  "Valentin Vacherot":20,
  "Kamil Majchrzak":22,
  "Ugo Humbert":12,
  "Denis Shapovalov":5,
  "Benjamin Bonzi":9,
  "Sebastian Baez":28,
  "S. Baez":28,
  "Arthur Rinderknech":20,
  "Jaume Munar":16,
  "Gabriel Diallo":"5px",
};
const PLAYER_MOBILE_PORTRAIT_SCALE:Record<string,"70">={
  "Botic Van De Zandschulp":"70",
  "Botic van de Zandschulp":"70",
};
const text={tr:{matches:"Maçlar",upcoming:"Yaklaşan Maçlar",choose:"Tahmini görmek için bir maç seç.",loading:"Maçlar yükleniyor…",failed:"Maçlar yüklenemedi.",back:"Tüm maçlar",prediction:"Kazanma olasılığı",atp:"ATP Sıralaması",elo:"UMTennis Elo",surfaceElo:"Surface Elo",preMatch:"Maç Öncesi İstatistikler",h2h:"Tüm H2H",surfaceH2h:"Surface H2H",last5:"Son 5 Maç",last10:"Son 10 Maç",surface10:"Surface Son 10",career:"Kariyer Ortalamaları",record:"Galibiyet / Mağlubiyet",aces:"Maç başı ace",doubleFaults:"Maç başı double fault",serve:"Service points won",return:"Return points won",bpSaved:"Break points saved",noData:"Yeterli veri yok",modelPick:"MODELİN SEÇİMİ",calculating:"Model hesaplıyor…"},en:{matches:"Matches",upcoming:"Upcoming Matches",choose:"Select a match to see the prediction.",loading:"Loading matches…",failed:"Matches could not be loaded.",back:"All matches",prediction:"Win probability",atp:"ATP Ranking",elo:"UMTennis Elo",surfaceElo:"Surface Elo",preMatch:"Pre-match Statistics",h2h:"All H2H",surfaceH2h:"Surface H2H",last5:"Last 5 Matches",last10:"Last 10 Matches",surface10:"Surface Last 10",career:"Career Averages",record:"Wins / Losses",aces:"Aces per match",doubleFaults:"Double faults per match",serve:"Service points won",return:"Return points won",bpSaved:"Break points saved",noData:"Not enough data",modelPick:"MODEL PICK",calculating:"Running model…"}};

function probability(value:number){return `${(value*100).toFixed(1)}%`;}

function PlayerPortrait({id,name,side}:{id:number|null;name:string;side:"left"|"right"}){
  const fallback=id?PLAYER_IMAGE_FALLBACKS[id]:undefined;
  const top20Slug=TOP20_PLAYER_CUTOUTS[name];
  const top40Slug=TOP40_PLAYER_CUTOUTS[name];
  const top60Slug=TOP60_PLAYER_CUTOUTS[name];
  const top80Slug=TOP80_PLAYER_CUTOUTS[name];
  const top100Slug=TOP100_PLAYER_CUTOUTS[name];
  const nameCutout=PLAYER_NAME_CUTOUTS[name];
  const portraitScale=PLAYER_PORTRAIT_SCALE[name];
  const mobilePortraitScale=PLAYER_MOBILE_PORTRAIT_SCALE[name];
  const portraitShift=PLAYER_PORTRAIT_SHIFT[name]??0;
  const portraitStyle=portraitShift?({"--portrait-shift":typeof portraitShift==="number"?`${portraitShift}%`:portraitShift} as CSSProperties):undefined;
  const shouldMirror=PLAYER_PHOTO_HOME_SIDE[name]!=null&&PLAYER_PHOTO_HOME_SIDE[name]!==side;
  const sources=[
    ...(top20Slug?[`/players/cutouts/top20/${top20Slug}.png`]:[]),
    ...(top40Slug?[`/players/cutouts/top40/${top40Slug}.png`]:[]),
    ...(top60Slug?[`/players/cutouts/top60/${top60Slug}.png`]:[]),
    ...(top80Slug?[`/players/cutouts/top80/${top80Slug}.png?v=griekspoor2`]:[]),
    ...(top100Slug?[`/players/cutouts/top100/${top100Slug}.png?v=top100-5`]:[]),
    ...(nameCutout?[`/players/cutouts/${nameCutout}.png?v=name-stable2`]:[]),
    ...(id&&PLAYER_CUTOUT_IDS.has(id)?[`/players/cutouts/${id}.png?v=racket3`]:[]),
    ...(id&&id!==19?[`/players/${id}.jpg`]:[]),
    ...(fallback?[fallback]:[]),
  ];
  const playerKey=`${id??"unknown"}|${name}`;
  const [failedSources,setFailedSources]=useState<Record<string,number>>({});
  const sourceIndex=failedSources[playerKey]??0;
  const failCurrentSource=()=>setFailedSources(current=>({
    ...current,
    [playerKey]:(current[playerKey]??0)+1,
  }));
  const source=sources[sourceIndex]??null;
  return <div className={`portrait-shell ${side}${portraitScale?` portrait-scale-${portraitScale}`:""}${mobilePortraitScale?` portrait-mobile-scale-${mobilePortraitScale}`:""}${shouldMirror?" portrait-mirrored":""}`} style={portraitStyle}>
    {source?<img src={source} alt={name} onError={failCurrentSource}/>:<div className="player-silhouette" aria-label={`${name} silhouette`}><span/><i/></div>}
  </div>;
}

function FormDots({form}:{form:string}){return <div className="form-dots">{form?form.split("").map((result,index)=><span className={result==="W"?"win":"loss"} key={`${result}-${index}`}>{result}</span>):<em>—</em>}</div>;}

function ComparisonRow({label,left,right,suffix="",lowerIsBetter=false}:{label:string;left:number|null;right:number|null;suffix?:string;lowerIsBetter?:boolean}){
  const display=(value:number|null)=>value==null?"—":`${value}${suffix}`;
  const tones=(()=>{
    if(left==null||right==null)return ["missing","missing"];
    if(left===right)return ["even","even"];
    const leftIsBetter=lowerIsBetter?left<right:left>right;
    return leftIsBetter?["better","worse"]:["worse","better"];
  })();
  return <div className="comparison-row"><b>{display(left)}</b><div className="metric-label"><i className={tones[0]} aria-hidden="true"/><span>{label}</span><i className={tones[1]} aria-hidden="true"/></div><b>{display(right)}</b></div>;
}

function FormComparisonRow({label,left,right}:{label:string;left:FormSummary;right:FormSummary}){
  return <div className="form-comparison-row"><div><FormDots form={left.form}/><small>{left.wins}–{left.losses}</small></div><span>{label}</span><div><FormDots form={right.form}/><small>{right.wins}–{right.losses}</small></div></div>;
}

type SelectOption={value:string;label:string};
function CustomSelect({label,value,options,onChange,className=""}:{label:string;value:string;options:SelectOption[];onChange:(value:string)=>void;className?:string}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const selected=options.find(option=>option.value===value)??options[0];
  useEffect(()=>{
    function close(event:PointerEvent){if(root.current&&!root.current.contains(event.target as Node))setOpen(false);}
    function escape(event:KeyboardEvent){if(event.key==="Escape")setOpen(false);}
    document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape);};
  },[]);
  return <div className={`control-field ${className} ${open?"is-open":""}`} ref={root}>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(current=>!current)}><span className="control-label">{label}</span><b>{selected.label}</b><i aria-hidden="true"/></button>
    {open&&<div className="custom-options" role="listbox" aria-label={label}>{options.map(option=><button type="button" role="option" aria-selected={option.value===value} className={option.value===value?"selected":""} key={option.value} onClick={()=>{onChange(option.value);setOpen(false);}}><span>{option.label}</span>{option.value===value&&<b>✓</b>}</button>)}</div>}
  </div>;
}

function ModelDetails({language}:{language:Language}){
  const isTr=language==="tr";
  const features=[
    {name:isTr?"Genel Elo farkı":"General Elo difference",value:100,weight:"22.1%"},
    {name:isTr?"Surface Elo farkı":"Surface Elo difference",value:60,weight:"13.3%"},
    {name:isTr?"ATP ranking points farkı":"ATP ranking points difference",value:22,weight:"4.9%"},
    {name:isTr?"ATP sıralama farkı":"ATP ranking difference",value:12,weight:"2.6%"},
    {name:isTr?"Turnuva içi game performansı":"In-tournament game performance",value:7,weight:"1.5%"},
  ];
  const confidence=[
    {label:"≥ 60%",accuracy:"71.9%",coverage:"67.8%"},
    {label:"≥ 70%",accuracy:"78.0%",coverage:"39.7%"},
    {label:"≥ 80%",accuracy:"84.5%",coverage:"18.0%"},
    {label:"≥ 90%",accuracy:"94.4%",coverage:"4.8%"},
  ];
  const yearlyPerformance=[
    {year:"2023",accuracy:66.01},{year:"2024",accuracy:66.48},{year:"2025",accuracy:66.09},{year:"2026*",accuracy:65.96},
  ];
  const yearlyPolyline=yearlyPerformance.map((point,index)=>`${70+index*295},${178-(point.accuracy-65)*28}`).join(" ");
  const mobileYearlyPolyline=yearlyPerformance.map((point,index)=>`${60+index*90},${178-(point.accuracy-65)*28}`).join(" ");
  return <section className="model-page">
    <div className="model-hero">
      <div className="model-eyebrow"><span/> UMTENNIS PREDICTION ENGINE <span/></div>
      <h1>{isTr?<>Geçmişten öğrenir.<br/><em>Maçtan önce</em> tahmin eder.</>:<>Built on history.<br/>Ready <em>before the match.</em></>}</h1>
      <p>{isTr?"ATP maç geçmişini, oyuncu güçlerini ve maç öncesinde bilinen koşulları birleştiren leakage-free bir machine learning modeli.":"A leakage-free machine learning model combining ATP match history, player strength and everything known before the first serve."}</p>
      <div className="hero-metrics">
        <article><small>FINAL TEST ACCURACY</small><b>66.2<span>%</span></b><p>2023–2025 · 7,892 {isTr?"maç":"matches"}</p></article>
        <article><small>ROC–AUC</small><b>0.726</b><p>{isTr?"Tahmin ayırt etme gücü":"Ranking quality"}</p></article>
        <article><small>LOG LOSS</small><b>0.608</b><p>{isTr?"Probability kalitesi":"Probability quality"}</p></article>
        <article><small>2026 BACKTEST</small><b>65.96<span>%</span></b><p>ROC–AUC · 0.733</p></article>
      </div>
    </div>

    <div className="model-content">
      <section className="model-block engine-block">
        <div className="block-heading"><span>01</span><div><small>{isTr?"MODEL YAPISI":"MODEL ARCHITECTURE"}</small><h2>{isTr?"İki farklı bakış, tek probability":"Two perspectives, one probability"}</h2></div></div>
        <div className="ensemble-visual">
          <article className="model-node"><div className="node-index">60%</div><small>NON-LINEAR</small><h3>XGBoost</h3><p>{isTr?"Feature'lar arasındaki karmaşık ilişkileri ve eşikleri yakalar.":"Captures complex relationships and thresholds between features."}</p></article>
          <div className="ensemble-join"><i/><span>+</span><i/></div>
          <article className="model-node"><div className="node-index">40%</div><small>LINEAR</small><h3>Logistic Regression</h3><p>{isTr?"Daha stabil, sade ve iyi calibrated probability üretir.":"Adds stable, interpretable and well-calibrated probabilities."}</p></article>
          <div className="ensemble-arrow">→</div>
          <article className="model-node final-node"><div className="pulse-dot"/><small>FINAL OUTPUT</small><h3>Win Probability</h3><p>{isTr?"İki modelin ağırlıklı ortalaması. Her oyuncu için toplam %100.":"Weighted average of both models. Always totals 100% across both players."}</p></article>
        </div>
      </section>

      <section className="model-block process-block">
        <div className="block-heading"><span>02</span><div><small>LEAKAGE-FREE PIPELINE</small><h2>{isTr?"Model geleceği asla görmez":"The model never sees the future"}</h2></div></div>
        <div className="process-line">
          <article><b>148,669</b><small>{isTr?"HAM ATP MAÇI":"RAW ATP MATCHES"}</small><p>1981–2026</p></article><i>→</i>
          <article><b>120,917</b><small>{isTr?"TEMİZ MAÇ":"CLEAN MATCHES"}</small><p>{isTr?"Geçersiz sonuçlar çıkarıldı":"Invalid results removed"}</p></article><i>→</i>
          <article><b>119</b><small>PRE-MATCH FEATURES</small><p>Elo · Form · H2H · Surface</p></article><i>→</i>
          <article><b>5</b><small>TIME-SERIES CV FOLDS</small><p>1990–2022</p></article><i>→</i>
          <article className="process-highlight"><b>7,892</b><small>{isTr?"DOKUNULMAMIŞ TEST":"UNTOUCHED TEST"}</small><p>2023–2025</p></article>
        </div>
        <div className="leakage-note"><span>✓</span><p><b>{isTr?"Her feature yalnızca maçtan önceki bilgilerle hesaplanır.":"Every feature is calculated only from information available before that match."}</b><small>{isTr?"Bir maçın sonucu; aynı maçın Elo, form, H2H veya turnuva içi performance feature'ına hiçbir zaman sızmaz.":"A result never leaks into that match's Elo, form, H2H or in-tournament performance features."}</small></p></div>
      </section>

      <section className="model-block charts-block">
        <div className="block-heading"><span>03</span><div><small>{isTr?"PERFORMANCE GRAFİKLERİ":"PERFORMANCE CHARTS"}</small><h2>{isTr?"Model zaman içinde ne kadar tutarlı?":"How consistent is the model over time?"}</h2></div></div>
        <div className="chart-grid" style={{gridTemplateColumns:"1fr"}}>
          <article className="chart-card yearly-chart">
            <div className="chart-title"><div><small>{isTr?"YILLIK FINAL TEST":"YEARLY FINAL TEST"}</small><h3>Accuracy by year</h3></div><span><i/> Accuracy</span></div>
            <svg className="desktop-yearly-svg" viewBox="0 0 1025 235" role="img" aria-label="Yearly accuracy line chart" preserveAspectRatio="none" style={{height:"300px"}}>
              {[65,66,67,68].map((tick,index)=><g key={tick}><line x1="70" x2="955" y1={178-index*28} y2={178-index*28}/><text x="18" y={183-index*28}>{tick}%</text></g>)}
              <polyline className="chart-area-line" points={yearlyPolyline}/>
              {yearlyPerformance.map((point,index)=><g className="chart-point" key={point.year}><circle cx={70+index*295} cy={178-(point.accuracy-65)*28} r="6"/><text className="point-value" x={70+index*295} y={158-(point.accuracy-65)*28}>{point.accuracy.toFixed(1)}%</text><text className="axis-label" x={70+index*295} y="218">{point.year}</text></g>)}
            </svg>
            <svg className="mobile-yearly-svg" viewBox="0 0 390 235" role="img" aria-label="Yearly accuracy line chart" style={{display:"none",height:"235px"}}>
              {[65,66,67,68].map((tick,index)=><g key={tick}><line x1="38" x2="353" y1={178-index*28} y2={178-index*28}/><text x="-7" y={183-index*28}>{tick}%</text></g>)}
              <polyline className="chart-area-line" points={mobileYearlyPolyline}/>
              {yearlyPerformance.map((point,index)=><g className="chart-point" key={point.year}><circle cx={60+index*90} cy={178-(point.accuracy-65)*28} r="5"/><text className="point-value" x={60+index*90} y={158-(point.accuracy-65)*28}>{point.accuracy.toFixed(1)}%</text><text className="axis-label" x={60+index*90} y="218">{point.year}</text></g>)}
            </svg>
            <p>{isTr?"* 2026 değeri mevcut partial season backtest'idir.":"* 2026 uses the currently available partial-season backtest."}</p>
          </article>

        </div>
      </section>

      <div className="model-two-column">
        <section className="model-block feature-block">
          <div className="block-heading"><span>04</span><div><small>FEATURE IMPORTANCE</small><h2>{isTr?"Tahmini en çok ne etkiliyor?":"What drives the prediction?"}</h2></div></div>
          <div className="feature-bars">{features.map(feature=><div className="feature-bar" key={feature.name}><div><span>{feature.name}</span><b>{feature.weight}</b></div><i><span style={{width:`${feature.value}%`}}/></i></div>)}</div>
          <p className="feature-footnote">{isTr?"Değerler XGBoost feature importance değerleridir; tek başına kazanma ihtimaline eşit değildir.":"Values show XGBoost feature importance and are not win probabilities on their own."}</p>
        </section>

        <section className="model-block confidence-block">
          <div className="block-heading"><span>05</span><div><small>{isTr?"CONFIDENCE ANALİZİ":"CONFIDENCE ANALYSIS"}</small><h2>{isTr?"Confidence yükseldikçe isabet artıyor":"Higher confidence, higher accuracy"}</h2></div></div>
          <div className="confidence-table"><div className="confidence-head"><span>Minimum confidence</span><span>Accuracy</span><span>Coverage</span></div>{confidence.map(row=><div className="confidence-row" key={row.label}><b>{row.label}</b><strong>{row.accuracy}</strong><span>{row.coverage}</span></div>)}</div>
          <div className="calibration-card"><small>EXPECTED CALIBRATION ERROR</small><b>0.0052</b><p>{isTr?"Modelin söylediği probability ile gerçek sonuç oranı birbirine çok yakın.":"Predicted probabilities closely match observed win rates."}</p></div>
        </section>
      </div>

      <section className="model-disclaimer"><span>UM</span><p><b>{isTr?"Tahmin, garanti değildir.":"A prediction is not a guarantee."}</b> {isTr?" UMTennis olasılık üretir; sakatlık, son dakika çekilmesi ve maç sırasında oluşan koşulları bilemez.":" UMTennis estimates probability; it cannot know injuries, late withdrawals or conditions that emerge during a match."}</p></section>
    </div>
  </section>;
}

export function MatchDashboard(){
  const [language,setLanguage]=useState<Language>("tr");
  const [view,setView]=useState<View>("matches");
  const [timezone,setTimezone]=useState("Europe/Istanbul");
  const [matches,setMatches]=useState<Match[]>([]);
  const [selected,setSelected]=useState<Match|null>(null);
  const [prediction,setPrediction]=useState<Prediction|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
  const [predictionError,setPredictionError]=useState(false);
  const timezoneOptions=useMemo(()=>{
    const local=Intl.DateTimeFormat().resolvedOptions().timeZone;
    return [{value:local,label:"Local"},{value:"Europe/Istanbul",label:"İstanbul"},{value:"Europe/London",label:"London"},{value:"America/New_York",label:"New York"},{value:"UTC",label:"UTC"}].filter((item,index,all)=>all.findIndex(candidate=>candidate.value===item.value)===index);
  },[]);
  const t=text[language];

  useEffect(()=>{fetch(`${API_BASE}/api/matches`).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{setMatches(data.matches??[]);setStatus("ready");}).catch(()=>setStatus("error"));},[]);
  function formatStart(value:string){return new Intl.DateTimeFormat(language==="tr"?"tr-TR":"en-GB",{timeZone:timezone,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
  async function openMatch(match:Match){setSelected(match);setPrediction(null);setPredictionError(false);window.scrollTo({top:0,behavior:"smooth"});try{const response=await fetch(`${API_BASE}/api/matches/${match.match_id}/prediction`);if(!response.ok)throw new Error();setPrediction(await response.json());}catch{setPredictionError(true);}}
  function closeMatch(){setView("matches");setSelected(null);setPrediction(null);setPredictionError(false);window.scrollTo({top:0,behavior:"smooth"});}
  function showModel(){setView("model");setSelected(null);setPrediction(null);setPredictionError(false);window.scrollTo({top:0,behavior:"smooth"});}
  const surfaceClass=view==="model"?"model":selected?.surface.toLowerCase()??"default";

  return <main className={`site-screen surface-${surfaceClass}`}>
    <div className="page-background" aria-hidden="true"/>
    <header className="umt-header">
      <button className="umt-logo" onClick={closeMatch}><span>UM</span>Tennis</button>
      <nav><button className={view==="matches"?"active":""} onClick={closeMatch}>{t.matches}</button><button className={view==="model"?"active":""} type="button" onClick={showModel}>Model</button></nav>
      <div className="header-controls">
        <CustomSelect label="LANG" value={language} className="language-field" options={[{value:"tr",label:"TR"},{value:"en",label:"EN"}]} onChange={value=>setLanguage(value as Language)}/>
        <span className="control-divider" aria-hidden="true"/>
        <CustomSelect label="TIME" value={timezone} className="timezone-field" options={timezoneOptions} onChange={setTimezone}/>
      </div>
    </header>

    {view==="model"?<ModelDetails language={language}/>:!selected?<section className="fixture-column">
      <div className="fixture-heading"><div><span className="live-dot"/>ATP TOUR</div><h1>{t.upcoming}</h1><p>{t.choose}</p></div>
      {status==="loading"&&<div className="message-card">{t.loading}</div>}{status==="error"&&<div className="message-card">{t.failed}</div>}
      <div className="fixture-list">{matches.map(match=>{
        const round=roundPresentation(match.round);
        return <button className={`fixture-row round-${round.tier}`} type="button" key={match.match_id} onClick={()=>openMatch(match)}><div className="fixture-topline"><span>{match.tournament_name}</span><span>{formatStart(match.start_time_utc)}</span></div><div className="fixture-mainline"><div className="fixture-player"><small>{match.p1_rank?`#${match.p1_rank}`:"—"}</small><b>{match.p1_name}</b></div><div className="versus"><b>VS</b><MatchStrength value={match.match_strength}/></div><div className="fixture-player right"><small>{match.p2_rank?`#${match.p2_rank}`:"—"}</small><b>{match.p2_name}</b></div></div><div className="fixture-footer"><span className={`surface-tag ${match.surface.toLowerCase()}`}>{match.surface}</span><span className="fixture-round">{round.label}</span><i>→</i></div></button>;
      })}</div>
    </section>:<section className="match-detail">
      <button className="back-button" onClick={closeMatch}>← {t.back}</button>
      <div className="match-kicker"><span className={`surface-tag ${selected.surface.toLowerCase()}`}>{selected.surface}</span><b>{selected.tournament_name}</b><span>{selected.round} · {formatStart(selected.start_time_utc)}</span></div>
      {!prediction&&!predictionError?<div className="prediction-loader"><span/>{t.calculating}</div>:predictionError?<div className="prediction-loader error">{t.failed}</div>:prediction&&<>
        <div className="analysis-stage">
          <article className="analysis-player left">
            <h1 className="analysis-player-name">{selected.p1_name}</h1>
            <div className="analysis-photo-zone"><PlayerPortrait id={selected.p1_id} name={selected.p1_name} side="left"/><div className="player-rank-overlay"><p><span>{t.atp}</span><b>{prediction.p1_profile.atp_rank?`#${prediction.p1_profile.atp_rank}`:"—"}</b></p><p><span>{t.elo}</span><b>#{prediction.p1_profile.elo_rank??"—"} · {prediction.p1_profile.elo} Elo</b></p><p><span>{selected.surface} {t.surfaceElo}</span><b>#{prediction.p1_profile.surface_elo_rank??"—"} · {prediction.p1_profile.surface_elo} Elo</b></p></div></div>
            <div className={`big-probability player-probability ${prediction.p1_win_probability>=.5?"favorite":"underdog"}`}><span>{t.prediction}</span><b>{probability(prediction.p1_win_probability)}</b></div>
          </article>
          <section className="comparison-spine">
            <div className="center-pick"><span>VS</span><small>{t.modelPick}</small><b>{prediction.predicted_winner}</b></div>
            <div className="comparison-heading"><span>{selected.p1_name.split(" ").slice(-1)[0]}</span><h2>{t.preMatch}</h2><span>{selected.p2_name.split(" ").slice(-1)[0]}</span></div>
            <div className="form-comparisons">
              <FormComparisonRow label={t.last5} left={prediction.p1_profile.last_5} right={prediction.p2_profile.last_5}/>
              <FormComparisonRow label={t.last10} left={prediction.p1_profile.last_10} right={prediction.p2_profile.last_10}/>
              <FormComparisonRow label={`${selected.surface} · ${t.surface10}`} left={prediction.p1_profile.surface_last_10} right={prediction.p2_profile.surface_last_10}/>
            </div>
            <div className="metric-comparisons h2h-comparisons">
              <ComparisonRow label={t.h2h} left={prediction.h2h.p1_wins} right={prediction.h2h.p2_wins}/>
              <ComparisonRow label={`${selected.surface} ${t.surfaceH2h}`} left={prediction.h2h.p1_surface_wins} right={prediction.h2h.p2_surface_wins}/>
            </div>
            <div className="career-metrics-title">{t.career}</div>
            <div className="metric-comparisons">
              <ComparisonRow label={t.aces} left={prediction.p1_profile.career.aces} right={prediction.p2_profile.career.aces}/>
              <ComparisonRow label={t.doubleFaults} left={prediction.p1_profile.career.double_faults} right={prediction.p2_profile.career.double_faults} lowerIsBetter/>
              <ComparisonRow label={t.serve} left={prediction.p1_profile.career.service_points_won_pct} right={prediction.p2_profile.career.service_points_won_pct} suffix="%"/>
              <ComparisonRow label={t.return} left={prediction.p1_profile.career.return_points_won_pct} right={prediction.p2_profile.career.return_points_won_pct} suffix="%"/>
              <ComparisonRow label={t.bpSaved} left={prediction.p1_profile.career.break_points_saved_pct} right={prediction.p2_profile.career.break_points_saved_pct} suffix="%"/>
            </div>
          </section>
          <article className="analysis-player right">
            <h1 className="analysis-player-name">{selected.p2_name}</h1>
            <div className="analysis-photo-zone"><PlayerPortrait id={selected.p2_id} name={selected.p2_name} side="right"/><div className="player-rank-overlay"><p><span>{t.atp}</span><b>{prediction.p2_profile.atp_rank?`#${prediction.p2_profile.atp_rank}`:"—"}</b></p><p><span>{t.elo}</span><b>#{prediction.p2_profile.elo_rank??"—"} · {prediction.p2_profile.elo} Elo</b></p><p><span>{selected.surface} {t.surfaceElo}</span><b>#{prediction.p2_profile.surface_elo_rank??"—"} · {prediction.p2_profile.surface_elo} Elo</b></p></div></div>
            <div className={`big-probability player-probability ${prediction.p2_win_probability>=.5?"favorite":"underdog"}`}><span>{t.prediction}</span><b>{probability(prediction.p2_win_probability)}</b></div>
          </article>
        </div>
      </>}
    </section>}
  </main>;
}
