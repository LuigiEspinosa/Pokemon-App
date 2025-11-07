export interface PokemonListItem {
  id: number;
  name: string;
  image: string;
}


type PokemonStats = {
  value: number;
  name: string;
}

type PokemonSprites = {
  front_default?: string;
  other?: {
    ["official-artwork"]?: {
      front_default?: string;
    };
  };
}

export interface PokemonData {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  abilities: string[];
  stats?: PokemonStats[];
  sprites: PokemonSprites;
  description: string;
};
