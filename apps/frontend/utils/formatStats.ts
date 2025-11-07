export function formatStatName(stat: string) {
  const statMap: { [key: string]: string } = {
    "hp": "HP",
    "attack": "ATK",
    "defense": "DEF",
    "special-attack": "SATK",
    "special-defense": "SDEF",
    "speed": "SPD"
  };

  return statMap[stat];
}
