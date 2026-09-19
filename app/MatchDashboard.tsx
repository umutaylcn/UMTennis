"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Language = "en" | "tr" | "fr" | "es" | "de" | "it";
type View = "matches" | "previous" | "model";
type FormSummary = { matches:number; wins:number; losses:number; form:string; win_rate:number|null; aces:number|null; double_faults:number|null; service_points_won_pct:number|null; return_points_won_pct:number|null; break_points_saved_pct:number|null; };
type PlayerProfile = { atp_rank:number|null; elo:number; elo_rank:number|null; surface_elo:number; surface_elo_rank:number|null; last_5:FormSummary; last_10:FormSummary; surface_last_10:FormSummary; career:FormSummary; };
type Match = { match_id:number; start_time_utc:string; tournament_name:string; surface:string; round:string; p1_name:string; p2_name:string; p1_id:number|null; p2_id:number|null; p1_rank:number|null; p2_rank:number|null; p1_elo_rank:number|null; p2_elo_rank:number|null; match_strength:number; p1_win_probability:number; p2_win_probability:number; predicted_winner:string; confidence:number; confidence_label:string; is_demo?:boolean; };
type HeadToHead = { matches:number; p1_wins:number; p2_wins:number; surface_matches:number; p1_surface_wins:number; p2_surface_wins:number; };
type Prediction = Match & { p1_win_probability:number; p2_win_probability:number; predicted_winner:string; confidence:number; confidence_label:string; h2h:HeadToHead; state_as_of_utc:string; p1_profile:PlayerProfile; p2_profile:PlayerProfile; };
type PreviousMatch = { match_id:number; start_time_utc:string; tournament_name:string; surface:string; round:string; p1_name:string; p2_name:string; p1_win_probability:number; p2_win_probability:number; predicted_winner:string; confidence:number; actual_winner:string; actual_loser:string; match_status:string; prediction_correct:boolean; winner_sets?:number; loser_sets?:number; };

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
const PLAYER_CUTOUT_IDS=new Set([2,5,6,7,9,15,18,19,23,27,31,33,37,64,68,73,94,105,109,115,117,159,163,164,173,177,179,189,193,197,198,204,214,224,225,229,233,234,236,397,399,401,411,447,472,494,503,511,521,527,536,539,576,578,604,623,652,653,664,842,844,878,990,1002,1096,1178,1179,1215,1253,4872,6146,6316,7607,8730,8745,9137,12825,13409,33875]);
// Provider IDs can change or be temporarily unavailable in a cached fixture.
// Resolve these locally prepared portraits by stable player name first.
const PLAYER_NAME_CUTOUTS:Record<string,string>={
  "Camilo Ugo Carabelli":"472",
  "Carlos Taberner":"12825",
  "Corentin Moutet":"33",
  "Damir Dzumhur":"204",
  "Dane Sweeny":"842",
  "Facundo Diaz Acosta":"494",
  "Filip Misolic":"13409",
  "John Jeffrey Wolf":"623",
  "J.J. Wolf":"623",
  "J J Wolf":"623",
  "Marco Trungelliti":"164",
  "Roman Andres Burruchaga":"109",
  "Stan Wawrinka":"527",
  "Zachary Svajda":"198",
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
  "Aleksandar Vukic":"234",
  "Arthur Gea":"578",
  "Andrea Guerrieri":"105",
  "Coleman Chak Lam Wong":"193",
  "Coleman Wong":"193",
  "Dalibor Svrcina":"399",
  "Federico Cina":"33875",
  "Francesco Passaro":"8745",
  "Harry Wendelken":"73",
  "Hugo Gaston":"233",
  "Jack Kennedy":"878",
  "Jacob Fearnley":"1179",
  "Jurij Rodionov":"224",
  "Lloyd Harris":"177",
  "Nishesh Basavareddy":"447",
  "Rei Sakamoto":"163",
  "Shintaro Mochizuki":"1178",
  "Toby Samuel":"397",
  "Tomas Barrios Vera":"68",
  "Tomas Vera Barrios":"68",
  "Tristan Schoolkate":"117",
  "Zsombor Piros":"576",
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
  "Pablo Carreno-Busta":"pablo-carreno-busta",
  "Ignacio Buse":"ignacio-buse",
  "Jaime Faria":"jaime-faria",
  "Eliot Spizzirri":"eliot-spizzirri",
  "Luca Van Assche":"luca-van-assche",
  "Luca van Assche":"luca-van-assche",
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
  "Arthur Gea":"right",
  "Michael Zheng":"left",
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
const PLAYER_PORTRAIT_SCALE:Record<string,"108"|"109"|"110"|"115"|"117"|"118"|"120"|"121"|"127"|"130"|"133"|"140"|"140plain"|"143"|"150"|"157"|"164"|"166"|"169"|"177"|"180"|"182"|"183"|"220"|"230">={
  "Marco Trungelliti":"220",
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
  "Michael Zheng":"115",
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
  "Michael Zheng":"-30px",
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
  "Adrian Mannarino":"130px",
  "Arthur Rinderknech":20,
  "Jaume Munar":16,
  "Gabriel Diallo":"5px",
};
const PLAYER_MOBILE_PORTRAIT_SCALE:Record<string,"70">={
  "Botic Van De Zandschulp":"70",
  "Botic van de Zandschulp":"70",
};
const text={
  tr:{matches:"Maçlar",previous:"Geçmiş",previousHeading:"Geçmiş Maçlar",previousIntro:"Maç başlamadan kaydedilen model tahminleri ve gerçek sonuçlar.",ourPick:"Model tahmini",actualResult:"Gerçek sonuç",correct:"Doğru tahmin",wrong:"Yanlış tahmin",noPrevious:"Henüz sonuçlanmış ve arşivlenmiş tahmin yok.",upcoming:"Yaklaşan Maçlar",choose:"Tahmini görmek için bir maç seç.",noUpcoming:"Yaklaşan maç bulunmuyor.",loading:"Maçlar yükleniyor…",failed:"Maçlar yüklenemedi.",back:"Tüm maçlar",prediction:"Kazanma olasılığı",atp:"ATP Sıralaması",elo:"UMTennis Elo",surfaceElo:"Surface Elo",preMatch:"Maç Öncesi İstatistikler",h2h:"Tüm H2H",surfaceH2h:"Surface H2H",last5:"Son 5 Maç",last10:"Son 10 Maç",surface10:"Surface Son 10",career:"Kariyer Ortalamaları",record:"Galibiyet / Mağlubiyet",aces:"Maç başı ace",doubleFaults:"Maç başı double fault",serve:"Service points won",return:"Return points won",bpSaved:"Break points saved",noData:"Yeterli veri yok",modelPick:"MODELİN SEÇİMİ",calculating:"Model hesaplıyor…"},
  en:{matches:"Matches",previous:"Previous",previousHeading:"Previous Matches",previousIntro:"Pre-match model predictions compared with the actual results.",ourPick:"Model prediction",actualResult:"Actual result",correct:"Correct pick",wrong:"Wrong pick",noPrevious:"No completed archived predictions yet.",upcoming:"Upcoming Matches",choose:"Select a match to see the prediction.",noUpcoming:"There are no upcoming matches.",loading:"Loading matches…",failed:"Matches could not be loaded.",back:"All matches",prediction:"Win probability",atp:"ATP Ranking",elo:"UMTennis Elo",surfaceElo:"Surface Elo",preMatch:"Pre-match Statistics",h2h:"All H2H",surfaceH2h:"Surface H2H",last5:"Last 5 Matches",last10:"Last 10 Matches",surface10:"Surface Last 10",career:"Career Averages",record:"Wins / Losses",aces:"Aces per match",doubleFaults:"Double faults per match",serve:"Service points won",return:"Return points won",bpSaved:"Break points saved",noData:"Not enough data",modelPick:"MODEL PICK",calculating:"Running model…"},
  fr:{matches:"Matchs",previous:"Historique",previousHeading:"Matchs précédents",previousIntro:"Les prédictions enregistrées avant le match comparées aux résultats réels.",ourPick:"Prédiction du modèle",actualResult:"Résultat réel",correct:"Prédiction correcte",wrong:"Prédiction incorrecte",noPrevious:"Aucune prédiction terminée et archivée.",upcoming:"Prochains matchs",choose:"Sélectionnez un match pour voir la prédiction.",noUpcoming:"Aucun match à venir.",loading:"Chargement des matchs…",failed:"Impossible de charger les matchs.",back:"Tous les matchs",prediction:"Probabilité de victoire",atp:"Classement ATP",elo:"Elo UMTennis",surfaceElo:"Elo par surface",preMatch:"Statistiques d'avant-match",h2h:"Tous les H2H",surfaceH2h:"H2H sur cette surface",last5:"5 derniers matchs",last10:"10 derniers matchs",surface10:"10 derniers sur la surface",career:"Moyennes en carrière",record:"Victoires / Défaites",aces:"Aces par match",doubleFaults:"Doubles fautes par match",serve:"Points gagnés au service",return:"Points gagnés en retour",bpSaved:"Balles de break sauvées",noData:"Données insuffisantes",modelPick:"CHOIX DU MODÈLE",calculating:"Calcul du modèle…"},
  es:{matches:"Partidos",previous:"Historial",previousHeading:"Partidos anteriores",previousIntro:"Predicciones guardadas antes del partido comparadas con los resultados reales.",ourPick:"Predicción del modelo",actualResult:"Resultado real",correct:"Predicción correcta",wrong:"Predicción incorrecta",noPrevious:"Aún no hay predicciones finalizadas y archivadas.",upcoming:"Próximos partidos",choose:"Selecciona un partido para ver la predicción.",noUpcoming:"No hay próximos partidos.",loading:"Cargando partidos…",failed:"No se pudieron cargar los partidos.",back:"Todos los partidos",prediction:"Probabilidad de victoria",atp:"Ranking ATP",elo:"Elo UMTennis",surfaceElo:"Elo por superficie",preMatch:"Estadísticas previas",h2h:"H2H total",surfaceH2h:"H2H en superficie",last5:"Últimos 5 partidos",last10:"Últimos 10 partidos",surface10:"Últimos 10 en superficie",career:"Promedios de carrera",record:"Victorias / Derrotas",aces:"Aces por partido",doubleFaults:"Dobles faltas por partido",serve:"Puntos ganados al saque",return:"Puntos ganados al resto",bpSaved:"Puntos de break salvados",noData:"Datos insuficientes",modelPick:"ELECCIÓN DEL MODELO",calculating:"Calculando el modelo…"},
  de:{matches:"Matches",previous:"Verlauf",previousHeading:"Vergangene Matches",previousIntro:"Vor dem Match gespeicherte Prognosen im Vergleich zu den tatsächlichen Ergebnissen.",ourPick:"Modellprognose",actualResult:"Tatsächliches Ergebnis",correct:"Richtige Prognose",wrong:"Falsche Prognose",noPrevious:"Noch keine abgeschlossenen und archivierten Prognosen.",upcoming:"Bevorstehende Matches",choose:"Wähle ein Match, um die Prognose zu sehen.",noUpcoming:"Keine bevorstehenden Matches.",loading:"Matches werden geladen…",failed:"Matches konnten nicht geladen werden.",back:"Alle Matches",prediction:"Siegwahrscheinlichkeit",atp:"ATP-Rangliste",elo:"UMTennis Elo",surfaceElo:"Belag-Elo",preMatch:"Statistiken vor dem Match",h2h:"Gesamtes H2H",surfaceH2h:"Belag-H2H",last5:"Letzte 5 Matches",last10:"Letzte 10 Matches",surface10:"Letzte 10 auf Belag",career:"Karrieredurchschnitt",record:"Siege / Niederlagen",aces:"Asse pro Match",doubleFaults:"Doppelfehler pro Match",serve:"Gewonnene Aufschlagpunkte",return:"Gewonnene Returnpunkte",bpSaved:"Abgewehrte Breakbälle",noData:"Nicht genügend Daten",modelPick:"MODELLAUSWAHL",calculating:"Modell wird berechnet…"},
  it:{matches:"Partite",previous:"Storico",previousHeading:"Partite precedenti",previousIntro:"Pronostici salvati prima della partita confrontati con i risultati reali.",ourPick:"Pronostico del modello",actualResult:"Risultato reale",correct:"Pronostico corretto",wrong:"Pronostico errato",noPrevious:"Non ci sono ancora pronostici conclusi e archiviati.",upcoming:"Prossime partite",choose:"Seleziona una partita per vedere il pronostico.",noUpcoming:"Non ci sono partite in programma.",loading:"Caricamento partite…",failed:"Impossibile caricare le partite.",back:"Tutte le partite",prediction:"Probabilità di vittoria",atp:"Classifica ATP",elo:"Elo UMTennis",surfaceElo:"Elo per superficie",preMatch:"Statistiche pre-partita",h2h:"H2H totale",surfaceH2h:"H2H sulla superficie",last5:"Ultime 5 partite",last10:"Ultime 10 partite",surface10:"Ultime 10 sulla superficie",career:"Medie in carriera",record:"Vittorie / Sconfitte",aces:"Ace per partita",doubleFaults:"Doppi falli per partita",serve:"Punti vinti al servizio",return:"Punti vinti in risposta",bpSaved:"Palle break salvate",noData:"Dati insufficienti",modelPick:"SCELTA DEL MODELLO",calculating:"Calcolo del modello…"},
};

function probability(value:number){return `${(value*100).toFixed(1)}%`;}
function probabilityTone(value:number):CSSProperties{
  const distance=Math.abs(value-.5);
  const strength=Math.max(0,Math.min(1,(distance-.04)/.36));
  const neutral=[244,211,94];
  const target=value>=.5?[117,233,155]:[255,114,109];
  const rgb=neutral.map((channel,index)=>Math.round(channel+(target[index]-channel)*strength));
  return{
    color:`rgb(${rgb.join(",")})`,
    textShadow:strength>.02?`0 0 ${Math.round(7+strength*11)}px rgba(${target.join(",")},${(.08+strength*.3).toFixed(2)})`:"0 0 10px rgba(244,211,94,.18)",
  };
}

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
    ...(id&&PLAYER_CUTOUT_IDS.has(id)?[`/players/cutouts/${id}.png?v=racket4`]:[]),
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

function ConfidenceRange({label,value,onChange}:{label:string;value:[number,number];onChange:(value:[number,number])=>void}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const popoverRoot=useRef<HTMLDivElement>(null);
  const [minimum,maximum]=value;
  const start=(minimum-50)*2;
  const end=(maximum-50)*2;
  useEffect(()=>{
    function close(event:PointerEvent){if(root.current&&!root.current.contains(event.target as Node)&&!popoverRoot.current?.contains(event.target as Node))setOpen(false);}
    function escape(event:KeyboardEvent){if(event.key==="Escape")setOpen(false);}
    document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape);};
  },[]);
  const popover=<div className="confidence-range-popover" role="dialog" aria-label={label} ref={popoverRoot}>
    <div className="confidence-range-values"><b>{minimum}%</b><span>—</span><b>{maximum}%</b></div>
    <div className="confidence-range-slider" style={{"--range-start":`${start}%`,"--range-end":`${end}%`} as CSSProperties}>
      <span className="confidence-range-track" aria-hidden="true"/>
      <input type="range" min="50" max="100" step="1" value={minimum} aria-label={`${label} minimum`} onChange={event=>onChange([Math.min(Number(event.target.value),maximum),maximum])}/>
      <input type="range" min="50" max="100" step="1" value={maximum} aria-label={`${label} maximum`} onChange={event=>onChange([minimum,Math.max(Number(event.target.value),minimum)])}/>
    </div>
    <div className="confidence-range-limits"><span>50%</span><span>100%</span></div>
  </div>;
  return <div className={`control-field confidence-range-field ${open?"is-open":""}`} ref={root}>
    <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(current=>!current)}><span className="control-label">{label}</span><b>{minimum}%–{maximum}%</b><i aria-hidden="true"/></button>
    {open&&popover}
  </div>;
}

function ModelDetails({language}:{language:Language}){
  const m={
    tr:{featureGeneral:"Genel Elo farkı",featureSurface:"Surface Elo farkı",featurePoints:"ATP ranking points farkı",featureRank:"ATP sıralama farkı",featureTournament:"Turnuva içi game performansı",heroLead:"Geçmişten öğrenir.",heroEm:"Maçtan önce",heroTail:" tahmin eder.",heroIntro:"ATP maç geçmişini, oyuncu güçlerini ve maç öncesinde bilinen koşulları birleştiren leakage-free bir machine learning modeli.",matches:"maç",rankingQuality:"Tahmin ayırt etme gücü",probabilityQuality:"Probability kalitesi",architecture:"MODEL YAPISI",perspectives:"İki farklı bakış, tek probability",xgb:"Feature'lar arasındaki karmaşık ilişkileri ve eşikleri yakalar.",logistic:"Daha stabil, sade ve iyi calibrated probability üretir.",final:"İki modelin ağırlıklı ortalaması. Her oyuncu için toplam %100.",neverFuture:"Model geleceği asla görmez",raw:"HAM ATP MAÇI",clean:"TEMİZ MAÇ",invalid:"Geçersiz sonuçlar çıkarıldı",untouched:"DOKUNULMAMIŞ TEST",leakage:"Her feature yalnızca maçtan önceki bilgilerle hesaplanır.",leakageDetail:"Bir maçın sonucu; aynı maçın Elo, form, H2H veya turnuva içi performance feature'ına hiçbir zaman sızmaz.",charts:"PERFORMANCE GRAFİKLERİ",consistent:"Model zaman içinde ne kadar tutarlı?",yearly:"YILLIK FINAL TEST",accuracyYear:"Yıllara göre accuracy",partial:"* 2026 değeri mevcut partial season backtest'idir.",drives:"Tahmini en çok ne etkiliyor?",importanceNote:"Değerler XGBoost feature importance değerleridir; tek başına kazanma ihtimaline eşit değildir.",confidenceAnalysis:"CONFIDENCE ANALİZİ",confidenceTitle:"Confidence yükseldikçe isabet artıyor",minimum:"Minimum confidence",accuracy:"Accuracy",coverage:"Coverage",calibration:"Modelin söylediği probability ile gerçek sonuç oranı birbirine çok yakın.",guarantee:"Tahmin, garanti değildir.",disclaimer:" UMTennis olasılık üretir; sakatlık, son dakika çekilmesi ve maç sırasında oluşan koşulları bilemez."},
    en:{featureGeneral:"General Elo difference",featureSurface:"Surface Elo difference",featurePoints:"ATP ranking points difference",featureRank:"ATP ranking difference",featureTournament:"In-tournament game performance",heroLead:"Built on history.",heroEm:"before the match.",heroTail:"Ready ",heroIntro:"A leakage-free machine learning model combining ATP match history, player strength and everything known before the first serve.",matches:"matches",rankingQuality:"Ranking quality",probabilityQuality:"Probability quality",architecture:"MODEL ARCHITECTURE",perspectives:"Two perspectives, one probability",xgb:"Captures complex relationships and thresholds between features.",logistic:"Adds stable, interpretable and well-calibrated probabilities.",final:"Weighted average of both models. Always totals 100% across both players.",neverFuture:"The model never sees the future",raw:"RAW ATP MATCHES",clean:"CLEAN MATCHES",invalid:"Invalid results removed",untouched:"UNTOUCHED TEST",leakage:"Every feature is calculated only from information available before that match.",leakageDetail:"A result never leaks into that match's Elo, form, H2H or in-tournament performance features.",charts:"PERFORMANCE CHARTS",consistent:"How consistent is the model over time?",yearly:"YEARLY FINAL TEST",accuracyYear:"Accuracy by year",partial:"* 2026 uses the currently available partial-season backtest.",drives:"What drives the prediction?",importanceNote:"Values show XGBoost feature importance and are not win probabilities on their own.",confidenceAnalysis:"CONFIDENCE ANALYSIS",confidenceTitle:"Higher confidence, higher accuracy",minimum:"Minimum confidence",accuracy:"Accuracy",coverage:"Coverage",calibration:"Predicted probabilities closely match observed win rates.",guarantee:"A prediction is not a guarantee.",disclaimer:" UMTennis estimates probability; it cannot know injuries, late withdrawals or conditions that emerge during a match."},
    fr:{featureGeneral:"Écart Elo général",featureSurface:"Écart Elo par surface",featurePoints:"Écart de points ATP",featureRank:"Écart au classement ATP",featureTournament:"Performance dans le tournoi",heroLead:"Construit sur l'historique.",heroEm:"avant le match.",heroTail:"Prêt ",heroIntro:"Un modèle de machine learning sans fuite de données combinant l'historique ATP, la force des joueurs et les informations connues avant le premier service.",matches:"matchs",rankingQuality:"Pouvoir de classement",probabilityQuality:"Qualité des probabilités",architecture:"ARCHITECTURE DU MODÈLE",perspectives:"Deux perspectives, une probabilité",xgb:"Détecte les relations complexes et les seuils entre les variables.",logistic:"Ajoute des probabilités stables, interprétables et bien calibrées.",final:"Moyenne pondérée des deux modèles. Le total est toujours de 100 %.",neverFuture:"Le modèle ne voit jamais le futur",raw:"MATCHS ATP BRUTS",clean:"MATCHS NETTOYÉS",invalid:"Résultats invalides supprimés",untouched:"TEST INTACT",leakage:"Chaque variable utilise uniquement les informations disponibles avant le match.",leakageDetail:"Le résultat d'un match ne fuite jamais dans son Elo, sa forme, son H2H ou ses performances dans le tournoi.",charts:"GRAPHIQUES DE PERFORMANCE",consistent:"Le modèle reste-t-il constant dans le temps ?",yearly:"TEST FINAL ANNUEL",accuracyYear:"Précision par année",partial:"* La valeur 2026 utilise le backtest partiel disponible.",drives:"Qu'est-ce qui influence la prédiction ?",importanceNote:"Ces valeurs indiquent l'importance des variables XGBoost et ne sont pas des probabilités de victoire.",confidenceAnalysis:"ANALYSE DE CONFIANCE",confidenceTitle:"Plus de confiance, plus de précision",minimum:"Confiance minimale",accuracy:"Précision",coverage:"Couverture",calibration:"Les probabilités prédites correspondent étroitement aux taux de victoire observés.",guarantee:"Une prédiction n'est pas une garantie.",disclaimer:" UMTennis estime une probabilité ; il ne peut pas connaître les blessures, forfaits tardifs ou conditions apparues pendant le match."},
    es:{featureGeneral:"Diferencia de Elo general",featureSurface:"Diferencia de Elo por superficie",featurePoints:"Diferencia de puntos ATP",featureRank:"Diferencia de ranking ATP",featureTournament:"Rendimiento en el torneo",heroLead:"Construido con el historial.",heroEm:"antes del partido.",heroTail:"Listo ",heroIntro:"Un modelo de machine learning sin data leakage que combina el historial ATP, la fuerza de los jugadores y lo conocido antes del primer saque.",matches:"partidos",rankingQuality:"Calidad de clasificación",probabilityQuality:"Calidad de probabilidad",architecture:"ARQUITECTURA DEL MODELO",perspectives:"Dos perspectivas, una probabilidad",xgb:"Captura relaciones complejas y umbrales entre variables.",logistic:"Aporta probabilidades estables, interpretables y bien calibradas.",final:"Promedio ponderado de ambos modelos. Siempre suma 100 % entre los jugadores.",neverFuture:"El modelo nunca ve el futuro",raw:"PARTIDOS ATP CRUDOS",clean:"PARTIDOS LIMPIOS",invalid:"Resultados inválidos eliminados",untouched:"TEST SIN TOCAR",leakage:"Cada variable se calcula solo con información disponible antes del partido.",leakageDetail:"El resultado nunca se filtra en el Elo, la forma, el H2H o el rendimiento del mismo partido.",charts:"GRÁFICOS DE RENDIMIENTO",consistent:"¿Qué tan consistente es el modelo con el tiempo?",yearly:"TEST FINAL ANUAL",accuracyYear:"Precisión por año",partial:"* El valor de 2026 usa el backtest parcial disponible.",drives:"¿Qué impulsa la predicción?",importanceNote:"Los valores muestran la importancia de variables en XGBoost y no equivalen a probabilidades de victoria.",confidenceAnalysis:"ANÁLISIS DE CONFIANZA",confidenceTitle:"Más confianza, mayor precisión",minimum:"Confianza mínima",accuracy:"Precisión",coverage:"Cobertura",calibration:"Las probabilidades predichas se acercan a las tasas de victoria observadas.",guarantee:"Una predicción no es una garantía.",disclaimer:" UMTennis estima probabilidades; no puede conocer lesiones, retiros de última hora o condiciones surgidas durante el partido."},
    de:{featureGeneral:"Allgemeine Elo-Differenz",featureSurface:"Belag-Elo-Differenz",featurePoints:"ATP-Punktedifferenz",featureRank:"ATP-Rangdifferenz",featureTournament:"Leistung im Turnier",heroLead:"Auf Historie aufgebaut.",heroEm:"vor dem Match.",heroTail:"Bereit ",heroIntro:"Ein leakage-freies Machine-Learning-Modell aus ATP-Matchhistorie, Spielerstärke und allen vor dem ersten Aufschlag bekannten Informationen.",matches:"Matches",rankingQuality:"Rangqualität",probabilityQuality:"Wahrscheinlichkeitsqualität",architecture:"MODELLARCHITEKTUR",perspectives:"Zwei Perspektiven, eine Wahrscheinlichkeit",xgb:"Erkennt komplexe Zusammenhänge und Schwellenwerte zwischen Features.",logistic:"Ergänzt stabile, interpretierbare und gut kalibrierte Wahrscheinlichkeiten.",final:"Gewichteter Mittelwert beider Modelle. Zusammen immer 100 %.",neverFuture:"Das Modell sieht niemals die Zukunft",raw:"ROHE ATP-MATCHES",clean:"BEREINIGTE MATCHES",invalid:"Ungültige Ergebnisse entfernt",untouched:"UNBERÜHRTER TEST",leakage:"Jedes Feature wird nur aus Informationen vor dem Match berechnet.",leakageDetail:"Ein Ergebnis fließt nie in Elo, Form, H2H oder Turnierleistung desselben Matches ein.",charts:"PERFORMANCE-DIAGRAMME",consistent:"Wie konstant ist das Modell über die Zeit?",yearly:"JÄHRLICHER FINALTEST",accuracyYear:"Genauigkeit nach Jahr",partial:"* Der Wert 2026 verwendet den aktuell verfügbaren Teil-Saison-Backtest.",drives:"Was beeinflusst die Prognose?",importanceNote:"Die Werte zeigen die XGBoost-Feature-Importance und sind keine Siegchancen.",confidenceAnalysis:"KONFIDENZANALYSE",confidenceTitle:"Höhere Konfidenz, höhere Genauigkeit",minimum:"Minimale Konfidenz",accuracy:"Genauigkeit",coverage:"Abdeckung",calibration:"Die vorhergesagten Wahrscheinlichkeiten liegen nahe an den beobachteten Siegraten.",guarantee:"Eine Prognose ist keine Garantie.",disclaimer:" UMTennis schätzt Wahrscheinlichkeiten; Verletzungen, kurzfristige Absagen oder Matchbedingungen sind nicht vorhersehbar."},
    it:{featureGeneral:"Differenza Elo generale",featureSurface:"Differenza Elo per superficie",featurePoints:"Differenza punti ATP",featureRank:"Differenza ranking ATP",featureTournament:"Rendimento nel torneo",heroLead:"Costruito sulla storia.",heroEm:"prima della partita.",heroTail:"Pronto ",heroIntro:"Un modello di machine learning senza data leakage che combina storico ATP, forza dei giocatori e informazioni note prima del primo servizio.",matches:"partite",rankingQuality:"Qualità del ranking",probabilityQuality:"Qualità delle probabilità",architecture:"ARCHITETTURA DEL MODELLO",perspectives:"Due prospettive, una probabilità",xgb:"Coglie relazioni complesse e soglie tra le feature.",logistic:"Aggiunge probabilità stabili, interpretabili e ben calibrate.",final:"Media ponderata dei due modelli. Il totale tra i giocatori è sempre 100%.",neverFuture:"Il modello non vede mai il futuro",raw:"PARTITE ATP GREZZE",clean:"PARTITE PULITE",invalid:"Risultati non validi rimossi",untouched:"TEST INALTERATO",leakage:"Ogni feature è calcolata solo con informazioni disponibili prima della partita.",leakageDetail:"Il risultato non entra mai nell'Elo, nella forma, nell'H2H o nel rendimento della stessa partita.",charts:"GRAFICI DELLE PRESTAZIONI",consistent:"Quanto è costante il modello nel tempo?",yearly:"TEST FINALE ANNUALE",accuracyYear:"Precisione per anno",partial:"* Il valore 2026 usa il backtest parziale attualmente disponibile.",drives:"Cosa influenza il pronostico?",importanceNote:"I valori mostrano la feature importance di XGBoost e non sono probabilità di vittoria.",confidenceAnalysis:"ANALISI DELL'AFFIDABILITÀ",confidenceTitle:"Più affidabilità, maggiore precisione",minimum:"Affidabilità minima",accuracy:"Precisione",coverage:"Copertura",calibration:"Le probabilità previste sono molto vicine ai tassi di vittoria osservati.",guarantee:"Un pronostico non è una garanzia.",disclaimer:" UMTennis stima probabilità; non può conoscere infortuni, ritiri dell'ultimo minuto o condizioni emerse durante la partita."},
  }[language];
  const features=[
    {name:m.featureGeneral,value:100,weight:"22.1%"},
    {name:m.featureSurface,value:60,weight:"13.3%"},
    {name:m.featurePoints,value:22,weight:"4.9%"},
    {name:m.featureRank,value:12,weight:"2.6%"},
    {name:m.featureTournament,value:7,weight:"1.5%"},
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
      <h1>{m.heroLead}<br/>{language==="tr"?<><em>{m.heroEm}</em>{m.heroTail}</>:<>{m.heroTail}<em>{m.heroEm}</em></>}</h1>
      <p>{m.heroIntro}</p>
      <div className="hero-metrics">
        <article><small>FINAL TEST ACCURACY</small><b>66.2<span>%</span></b><p>2023–2025 · 7,892 {m.matches}</p></article>
        <article><small>ROC–AUC</small><b>0.726</b><p>{m.rankingQuality}</p></article>
        <article><small>LOG LOSS</small><b>0.608</b><p>{m.probabilityQuality}</p></article>
        <article><small>2026 BACKTEST</small><b>65.96<span>%</span></b><p>ROC–AUC · 0.733</p></article>
      </div>
    </div>

    <div className="model-content">
      <section className="model-block engine-block">
        <div className="block-heading"><span>01</span><div><small>{m.architecture}</small><h2>{m.perspectives}</h2></div></div>
        <div className="ensemble-visual">
          <article className="model-node"><div className="node-index">60%</div><small>NON-LINEAR</small><h3>XGBoost</h3><p>{m.xgb}</p></article>
          <div className="ensemble-join"><i/><span>+</span><i/></div>
          <article className="model-node"><div className="node-index">40%</div><small>LINEAR</small><h3>Logistic Regression</h3><p>{m.logistic}</p></article>
          <div className="ensemble-arrow">→</div>
          <article className="model-node final-node"><div className="pulse-dot"/><small>FINAL OUTPUT</small><h3>Win Probability</h3><p>{m.final}</p></article>
        </div>
      </section>

      <section className="model-block process-block">
        <div className="block-heading"><span>02</span><div><small>LEAKAGE-FREE PIPELINE</small><h2>{m.neverFuture}</h2></div></div>
        <div className="process-line">
          <article><b>148,669</b><small>{m.raw}</small><p>1981–2026</p></article><i>→</i>
          <article><b>120,917</b><small>{m.clean}</small><p>{m.invalid}</p></article><i>→</i>
          <article><b>119</b><small>PRE-MATCH FEATURES</small><p>Elo · Form · H2H · Surface</p></article><i>→</i>
          <article><b>5</b><small>TIME-SERIES CV FOLDS</small><p>1990–2022</p></article><i>→</i>
          <article className="process-highlight"><b>7,892</b><small>{m.untouched}</small><p>2023–2025</p></article>
        </div>
        <div className="leakage-note"><span>✓</span><p><b>{m.leakage}</b><small>{m.leakageDetail}</small></p></div>
      </section>

      <section className="model-block charts-block">
        <div className="block-heading"><span>03</span><div><small>{m.charts}</small><h2>{m.consistent}</h2></div></div>
        <div className="chart-grid" style={{gridTemplateColumns:"1fr"}}>
          <article className="chart-card yearly-chart">
            <div className="chart-title"><div><small>{m.yearly}</small><h3>{m.accuracyYear}</h3></div><span><i/> {m.accuracy}</span></div>
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
            <p>{m.partial}</p>
          </article>

        </div>
      </section>

      <div className="model-two-column">
        <section className="model-block feature-block">
          <div className="block-heading"><span>04</span><div><small>FEATURE IMPORTANCE</small><h2>{m.drives}</h2></div></div>
          <div className="feature-bars">{features.map(feature=><div className="feature-bar" key={feature.name}><div><span>{feature.name}</span><b>{feature.weight}</b></div><i><span style={{width:`${feature.value}%`}}/></i></div>)}</div>
          <p className="feature-footnote">{m.importanceNote}</p>
        </section>

        <section className="model-block confidence-block">
          <div className="block-heading"><span>05</span><div><small>{m.confidenceAnalysis}</small><h2>{m.confidenceTitle}</h2></div></div>
          <div className="confidence-table"><div className="confidence-head"><span>{m.minimum}</span><span>{m.accuracy}</span><span>{m.coverage}</span></div>{confidence.map(row=><div className="confidence-row" key={row.label}><b>{row.label}</b><strong>{row.accuracy}</strong><span>{row.coverage}</span></div>)}</div>
          <div className="calibration-card"><small>EXPECTED CALIBRATION ERROR</small><b>0.0052</b><p>{m.calibration}</p></div>
        </section>
      </div>

      <section className="model-disclaimer"><span>UM</span><p><b>{m.guarantee}</b>{m.disclaimer}</p></section>
    </div>
  </section>;
}

function PreviousMatches({matches,status,language,formatStart}:{matches:PreviousMatch[];status:"loading"|"ready"|"error";language:Language;formatStart:(value:string)=>string}){
  const t=text[language];
  const [query,setQuery]=useState("");
  const [tournament,setTournament]=useState("all");
  const [round,setRound]=useState("all");
  const [result,setResult]=useState("all");
  const [confidenceRange,setConfidenceRange]=useState<[number,number]>([50,100]);
  const [page,setPage]=useState(1);
  const pageSize=20;
  const labels={
    tr:{search:"Oyuncu veya turnuva ara",tournament:"TURNUVA",allTournaments:"Tüm turnuvalar",round:"TUR",allRounds:"Tüm turlar",result:"SONUÇ",allResults:"Tüm tahminler",confidence:"TAHMİN GÜVENİ",correct:"Doğru",wrong:"Yanlış",clear:"Filtreleri temizle",shown:"maç gösteriliyor",none:"Bu filtrelere uyan maç bulunamadı.",previous:"Önceki",next:"Sonraki",page:"Sayfa",accuracy:"isabet"},
    en:{search:"Search player or tournament",tournament:"TOURNAMENT",allTournaments:"All tournaments",round:"ROUND",allRounds:"All rounds",result:"RESULT",allResults:"All predictions",confidence:"CONFIDENCE",correct:"Correct",wrong:"Wrong",clear:"Clear filters",shown:"matches shown",none:"No matches found for these filters.",previous:"Previous",next:"Next",page:"Page",accuracy:"accuracy"},
    fr:{search:"Rechercher un joueur ou un tournoi",tournament:"TOURNOI",allTournaments:"Tous les tournois",round:"TOUR",allRounds:"Tous les tours",result:"RÉSULTAT",allResults:"Toutes les prédictions",confidence:"CONFIANCE",correct:"Correct",wrong:"Incorrect",clear:"Effacer les filtres",shown:"matchs affichés",none:"Aucun match ne correspond à ces filtres.",previous:"Précédent",next:"Suivant",page:"Page",accuracy:"précision"},
    es:{search:"Buscar jugador o torneo",tournament:"TORNEO",allTournaments:"Todos los torneos",round:"RONDA",allRounds:"Todas las rondas",result:"RESULTADO",allResults:"Todas las predicciones",confidence:"CONFIANZA",correct:"Correcta",wrong:"Incorrecta",clear:"Limpiar filtros",shown:"partidos mostrados",none:"No hay partidos para estos filtros.",previous:"Anterior",next:"Siguiente",page:"Página",accuracy:"acierto"},
    de:{search:"Spieler oder Turnier suchen",tournament:"TURNIER",allTournaments:"Alle Turniere",round:"RUNDE",allRounds:"Alle Runden",result:"ERGEBNIS",allResults:"Alle Prognosen",confidence:"KONFIDENZ",correct:"Richtig",wrong:"Falsch",clear:"Filter löschen",shown:"Matches angezeigt",none:"Keine Matches für diese Filter gefunden.",previous:"Zurück",next:"Weiter",page:"Seite",accuracy:"Genauigkeit"},
    it:{search:"Cerca giocatore o torneo",tournament:"TORNEO",allTournaments:"Tutti i tornei",round:"TURNO",allRounds:"Tutti i turni",result:"RISULTATO",allResults:"Tutti i pronostici",confidence:"AFFIDABILITÀ",correct:"Corretto",wrong:"Errato",clear:"Azzera filtri",shown:"partite mostrate",none:"Nessuna partita corrisponde ai filtri.",previous:"Precedente",next:"Successivo",page:"Pagina",accuracy:"precisione"},
  }[language];
  const tournamentOptions=useMemo(()=>[{value:"all",label:labels.allTournaments},...Array.from(new Set(matches.map(match=>match.tournament_name))).sort().map(value=>({value,label:value}))],[matches,labels.allTournaments]);
  const roundOptions=useMemo(()=>[{value:"all",label:labels.allRounds},...Array.from(new Set(matches.map(match=>match.round))).sort().map(value=>({value,label:value}))],[matches,labels.allRounds]);
  const filteredMatches=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase(language);
    return matches.filter(match=>{
      const searchable=`${match.p1_name} ${match.p2_name} ${match.tournament_name} ${match.round}`.toLocaleLowerCase(language);
      return (!needle||searchable.includes(needle))
        &&(tournament==="all"||match.tournament_name===tournament)
        &&(round==="all"||match.round===round)
        &&(result==="all"||(result==="correct")===match.prediction_correct)
        &&match.confidence*100>=confidenceRange[0]
        &&match.confidence*100<=confidenceRange[1];
    });
  },[matches,query,tournament,round,result,confidenceRange,language]);
  useEffect(()=>setPage(1),[query,tournament,round,result,confidenceRange,matches.length]);
  const filtersActive=Boolean(query)||tournament!=="all"||round!=="all"||result!=="all"||confidenceRange[0]!==50||confidenceRange[1]!==100;
  const accuracy=filteredMatches.length?Math.round(filteredMatches.filter(match=>match.prediction_correct).length/filteredMatches.length*100):null;
  const pageCount=Math.ceil(filteredMatches.length/pageSize);
  const paginatedMatches=filteredMatches.slice((page-1)*pageSize,page*pageSize);
  const paginationItems=useMemo<(number|string)[]>(()=>{
    if(pageCount<=7)return Array.from({length:pageCount},(_,index)=>index+1);
    const pages=[1,page-1,page,page+1,pageCount].filter(value=>value>=1&&value<=pageCount);
    const unique=Array.from(new Set(pages)).sort((a,b)=>a-b);
    return unique.flatMap((value,index)=>index&&value-unique[index-1]>1?[`gap-${value}`,value]:[value]);
  },[page,pageCount]);
  return <section className="previous-page">
    <div className="previous-heading"><div><span className="history-dot"/>UMTENNIS TRACK RECORD</div><h1>{t.previousHeading}</h1><p>{t.previousIntro}</p>{accuracy!=null&&<strong>{accuracy}% <span>{labels.accuracy}</span></strong>}</div>
    <div className="history-filter-panel">
      <label className="history-search"><span aria-hidden="true"/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={labels.search} aria-label={labels.search}/>{query&&<button type="button" onClick={()=>setQuery("")} aria-label={labels.clear}>×</button>}</label>
      <div className="history-filter-selects">
        <CustomSelect label={labels.tournament} value={tournament} options={tournamentOptions} onChange={setTournament}/>
        <CustomSelect label={labels.round} value={round} options={roundOptions} onChange={setRound}/>
        <ConfidenceRange label={labels.confidence} value={confidenceRange} onChange={setConfidenceRange}/>
        <CustomSelect label={labels.result} value={result} options={[{value:"all",label:labels.allResults},{value:"correct",label:labels.correct},{value:"wrong",label:labels.wrong}]} onChange={setResult}/>
      </div>
      <div className="history-filter-summary"><span><b>{filteredMatches.length}</b> / {matches.length} {labels.shown}</span>{filtersActive&&<button type="button" onClick={()=>{setQuery("");setTournament("all");setRound("all");setResult("all");setConfidenceRange([50,100]);}}>↺ {labels.clear}</button>}</div>
    </div>
    {status==="loading"&&<div className="message-card">{t.loading}</div>}
    {status==="error"&&<div className="message-card">{t.failed}</div>}
    {status==="ready"&&!matches.length&&<div className="message-card">{t.noPrevious}</div>}
    {status==="ready"&&matches.length>0&&!filteredMatches.length&&<div className="message-card history-empty">{labels.none}</div>}
    <div className="previous-list">{paginatedMatches.map(match=>{
      const p1Picked=match.predicted_winner===match.p1_name;
      const statusLabel=match.prediction_correct?t.correct:t.wrong;
      return <article className={`previous-card ${match.prediction_correct?"correct":"wrong"}`} key={match.match_id}>
        <div className="previous-meta"><span>{match.tournament_name}</span><span className="previous-meta-center"><span className={`surface-tag ${match.surface.toLowerCase()}`}>{match.surface}</span><small>{match.round}</small></span><span>{formatStart(match.start_time_utc)}</span></div>
        <div className="previous-matchup">
          <div className={match.actual_winner===match.p1_name?"actual-winner":""}><b>{match.p1_name}</b><strong>{probability(match.p1_win_probability)}</strong></div>
          <div className="previous-vs"><span className={`surface-tag ${match.surface.toLowerCase()}`}>{match.surface}</span><b>VS</b><small>{match.round}</small></div>
          <div className={match.actual_winner===match.p2_name?"actual-winner":""}><b>{match.p2_name}</b><strong>{probability(match.p2_win_probability)}</strong></div>
        </div>
        <div className="previous-outcome">
          <div><small>{t.ourPick}</small><b>{match.predicted_winner}</b><span>{probability(p1Picked?match.p1_win_probability:match.p2_win_probability)}</span></div>
          <i aria-hidden="true">→</i>
          <div><small>{t.actualResult}</small><b>{match.actual_winner}</b>{match.match_status==="retirement"&&<span>RET.</span>}</div>
          <strong className="result-badge">{match.prediction_correct?"✓":"×"} {statusLabel}</strong>
        </div>
      </article>;
    })}</div>
    {pageCount>1&&<nav className="history-pagination" aria-label={labels.page}>
      <button type="button" disabled={page===1} onClick={()=>setPage(current=>Math.max(1,current-1))}>← <span>{labels.previous}</span></button>
      <div>{paginationItems.map(item=>typeof item==="number"?<button type="button" className={item===page?"active":""} aria-current={item===page?"page":undefined} onClick={()=>setPage(item)} key={item}>{item}</button>:<i aria-hidden="true" key={item}>…</i>)}</div>
      <button type="button" disabled={page===pageCount} onClick={()=>setPage(current=>Math.min(pageCount,current+1))}><span>{labels.next}</span> →</button>
    </nav>}
  </section>;
}

export function MatchDashboard(){
  const [language,setLanguage]=useState<Language>("en");
  const [view,setView]=useState<View>("matches");
  const [timezone,setTimezone]=useState("local");
  const [matches,setMatches]=useState<Match[]>([]);
  const [previousMatches,setPreviousMatches]=useState<PreviousMatch[]>([]);
  const [selected,setSelected]=useState<Match|null>(null);
  const [prediction,setPrediction]=useState<Prediction|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
  const [previousStatus,setPreviousStatus]=useState<"loading"|"ready"|"error">("loading");
  const [predictionError,setPredictionError]=useState(false);
  const [upcomingQuery,setUpcomingQuery]=useState("");
  const [upcomingConfidence,setUpcomingConfidence]=useState<[number,number]>([50,100]);
  const timezoneOptions=useMemo(()=>{
    return [
      {value:"local",label:"Local"},
      {value:"UTC",label:"UTC"},
      {value:"Europe/London",label:"GMT / BST"},
      {value:"Europe/Paris",label:"CET / CEST"},
      {value:"Europe/Athens",label:"EET / EEST"},
      {value:"Europe/Istanbul",label:"Türkiye"},
      {value:"America/New_York",label:"ET"},
      {value:"America/Chicago",label:"CT"},
      {value:"America/Denver",label:"MT"},
      {value:"America/Los_Angeles",label:"PT"},
      {value:"America/Sao_Paulo",label:"Brazil"},
      {value:"Asia/Dubai",label:"Dubai"},
      {value:"Asia/Kolkata",label:"India"},
      {value:"Asia/Bangkok",label:"Bangkok"},
      {value:"Asia/Singapore",label:"Singapore"},
      {value:"Asia/Hong_Kong",label:"Hong Kong"},
      {value:"Asia/Tokyo",label:"Japan"},
      {value:"Asia/Seoul",label:"South Korea"},
      {value:"Australia/Sydney",label:"Australia"},
    ];
  },[]);
  const t=text[language];
  const upcomingLabels={
    tr:{search:"Oyuncu veya turnuva ara",confidence:"TAHMİN GÜVENİ",shown:"maç gösteriliyor",none:"Bu arama ve güven aralığında yaklaşan maç yok.",clear:"Filtreleri temizle"},
    en:{search:"Search player or tournament",confidence:"CONFIDENCE",shown:"matches shown",none:"No upcoming matches match this search and confidence range.",clear:"Clear filters"},
    fr:{search:"Rechercher un joueur ou un tournoi",confidence:"CONFIANCE",shown:"matchs affichés",none:"Aucun match à venir ne correspond à cette recherche et à cette confiance.",clear:"Effacer les filtres"},
    es:{search:"Buscar jugador o torneo",confidence:"CONFIANZA",shown:"partidos mostrados",none:"No hay próximos partidos para esta búsqueda y este nivel de confianza.",clear:"Limpiar filtros"},
    de:{search:"Spieler oder Turnier suchen",confidence:"KONFIDENZ",shown:"Matches angezeigt",none:"Keine bevorstehenden Matches entsprechen dieser Suche und Konfidenz.",clear:"Filter löschen"},
    it:{search:"Cerca giocatore o torneo",confidence:"AFFIDABILITÀ",shown:"partite mostrate",none:"Nessuna partita in programma corrisponde alla ricerca e all'affidabilità.",clear:"Azzera filtri"},
  }[language];
  const availableMatches=useMemo(()=>status==="ready"?matches:[],[matches,status]);
  const visibleMatches=useMemo(()=>{
    const needle=upcomingQuery.trim().toLocaleLowerCase(language);
    return availableMatches.filter(match=>{
      const searchable=`${match.p1_name} ${match.p2_name} ${match.tournament_name}`.toLocaleLowerCase(language);
      const confidence=(match.confidence??.5)*100;
      return (!needle||searchable.includes(needle))&&confidence>=upcomingConfidence[0]&&confidence<=upcomingConfidence[1];
    });
  },[availableMatches,upcomingQuery,upcomingConfidence,language]);
  const upcomingFiltersActive=Boolean(upcomingQuery)||upcomingConfidence[0]!==50||upcomingConfidence[1]!==100;

  useEffect(()=>{fetch(`${API_BASE}/api/matches`).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{setMatches(data.matches??[]);setStatus("ready");}).catch(()=>setStatus("error"));},[]);
  useEffect(()=>{fetch(`${API_BASE}/api/previous-matches`).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{setPreviousMatches(data.matches??[]);setPreviousStatus("ready");}).catch(()=>setPreviousStatus("error"));},[]);
  function formatStart(value:string){const locale:Record<Language,string>={en:"en-GB",tr:"tr-TR",fr:"fr-FR",es:"es-ES",de:"de-DE",it:"it-IT"};return new Intl.DateTimeFormat(locale[language],{timeZone:timezone==="local"?undefined:timezone,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
  async function openMatch(match:Match){setSelected(match);setPrediction(null);setPredictionError(false);window.scrollTo({top:0,behavior:"smooth"});try{const response=await fetch(`${API_BASE}/api/matches/${match.match_id}/prediction`);if(!response.ok)throw new Error();setPrediction(await response.json());}catch{setPredictionError(true);}}
  function closeMatch(){setView("matches");setSelected(null);setPrediction(null);setPredictionError(false);window.scrollTo({top:0,behavior:"smooth"});}
  function showModel(){setView("model");setSelected(null);setPrediction(null);setPredictionError(false);window.scrollTo({top:0,behavior:"smooth"});}
  function showPrevious(){setView("previous");setSelected(null);setPrediction(null);setPredictionError(false);window.scrollTo({top:0,behavior:"smooth"});}
  const surfaceClass=view==="model"?"model":view==="previous"?"history":selected?.surface.toLowerCase()??"default";

  return <main className={`site-screen surface-${surfaceClass}`}>
    <div className="page-background" aria-hidden="true"/>
    {view==="previous"&&<div className="history-sparks" aria-hidden="true"><div className="history-spark-gutter left">{Array.from({length:6},(_,index)=><i key={index}/>)}</div><div className="history-spark-gutter right">{Array.from({length:6},(_,index)=><i key={index}/>)}</div></div>}
    <header className="umt-header">
      <button className="umt-logo" onClick={closeMatch}><span>UM</span>Tennis</button>
      <nav><button className={view==="matches"?"active":""} onClick={closeMatch}>{t.matches}</button><button className={view==="previous"?"active":""} type="button" onClick={showPrevious}>{t.previous}</button><button className={view==="model"?"active":""} type="button" onClick={showModel}>Model</button></nav>
      <div className="header-controls">
        <CustomSelect label="LANG" value={language} className="language-field" options={[{value:"en",label:"EN"},{value:"tr",label:"TR"},{value:"fr",label:"FR"},{value:"es",label:"ES"},{value:"de",label:"DE"},{value:"it",label:"IT"}]} onChange={value=>setLanguage(value as Language)}/>
        <span className="control-divider" aria-hidden="true"/>
        <CustomSelect label="TIME" value={timezone} className="timezone-field" options={timezoneOptions} onChange={setTimezone}/>
      </div>
    </header>

    {view==="model"?<ModelDetails language={language}/>:view==="previous"?<PreviousMatches matches={previousMatches} status={previousStatus} language={language} formatStart={formatStart}/>:!selected?<section className="fixture-column">
      <div className="fixture-heading"><div><span className="live-dot"/>ATP TOUR</div><h1>{t.upcoming}</h1><p>{status==="ready"&&!availableMatches.length?t.noUpcoming:t.choose}</p></div>
      {status==="loading"&&<div className="message-card">{t.loading}</div>}{status==="error"&&<div className="message-card">{t.failed}</div>}
      {status==="ready"&&availableMatches.length>0&&<div className="upcoming-filter-bar">
        <label className="upcoming-search"><span aria-hidden="true"/><input type="search" value={upcomingQuery} onChange={event=>setUpcomingQuery(event.target.value)} placeholder={upcomingLabels.search} aria-label={upcomingLabels.search}/>{!upcomingQuery&&<div className="upcoming-search-marquee" aria-hidden="true"><div><i>{upcomingLabels.search}</i><i>{upcomingLabels.search}</i></div></div>}{upcomingQuery&&<button type="button" onClick={()=>setUpcomingQuery("")} aria-label={upcomingLabels.clear}>×</button>}</label>
        <ConfidenceRange label={upcomingLabels.confidence} value={upcomingConfidence} onChange={setUpcomingConfidence}/>
        <div className="upcoming-filter-summary"><span><b>{visibleMatches.length}</b> / {availableMatches.length} {upcomingLabels.shown}</span>{upcomingFiltersActive&&<button type="button" onClick={()=>{setUpcomingQuery("");setUpcomingConfidence([50,100]);}}>↺ {upcomingLabels.clear}</button>}</div>
      </div>}
      {status==="ready"&&availableMatches.length>0&&!visibleMatches.length&&<div className="message-card upcoming-empty">{upcomingLabels.none}</div>}
      <div className="fixture-list">{visibleMatches.map(match=>{
        const round=roundPresentation(match.round);
        return <button className={`fixture-row round-${round.tier}${match.is_demo?" demo-fixture":""}`} type="button" key={match.match_id} disabled={match.is_demo} title={match.is_demo?"Filter preview":undefined} onClick={()=>openMatch(match)}><div className="fixture-topline"><span>{match.tournament_name}</span><span>{formatStart(match.start_time_utc)}</span></div><div className="fixture-mainline"><div className="fixture-player"><small>{match.p1_rank?`#${match.p1_rank}`:"—"}</small><b>{match.p1_name}</b></div><strong className="fixture-probability" style={probabilityTone(match.p1_win_probability)}>{probability(match.p1_win_probability)}</strong><div className="versus"><b>VS</b><MatchStrength value={match.match_strength}/><div className="mobile-fixture-meta"><span className={`surface-tag ${match.surface.toLowerCase()}`}>{match.surface}</span><span className="fixture-round">{round.label}</span></div></div><strong className="fixture-probability" style={probabilityTone(match.p2_win_probability)}>{probability(match.p2_win_probability)}</strong><div className="fixture-player right"><small>{match.p2_rank?`#${match.p2_rank}`:"—"}</small><b>{match.p2_name}</b></div></div><div className="fixture-footer"><span className={`surface-tag ${match.surface.toLowerCase()}`}>{match.surface}</span><span className="fixture-round">{round.label}</span></div></button>;
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
