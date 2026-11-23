export function previousTournamentName(name:string):string{
  return /^Finals - Turin(?: ATP - Play Offs(?: \(indoor\))?)?$/i.test(name.trim())
    ?"Finals - Turin"
    :name;
}
