type MatchIdentity = {
  match_id: number;
  p1_name: string;
  p2_name: string;
  tournament_name: string;
  start_time_utc: string;
};

/** An ID alone is unsafe: providers sometimes reuse or remap match IDs. */
export function matchingCompletedResults(
  matches: MatchIdentity[],
  completed: MatchIdentity[],
): Array<{ match_id: number }> {
  const byId = new Map(matches.map(match => [match.match_id, match]));
  return completed.filter(item => {
    const match = byId.get(item.match_id);
    if (!match) return false;
    const players = (value: MatchIdentity) => [value.p1_name, value.p2_name]
      .map(name => name.trim().toLocaleLowerCase()).sort().join("|");
    const dayGap = Math.abs(Date.parse(item.start_time_utc) - Date.parse(match.start_time_utc));
    return players(item) === players(match)
      && item.tournament_name.trim().toLocaleLowerCase() === match.tournament_name.trim().toLocaleLowerCase()
      && Number.isFinite(dayGap) && dayGap <= 2 * 24 * 60 * 60 * 1000;
  }).map(item => ({ match_id: item.match_id }));
}
