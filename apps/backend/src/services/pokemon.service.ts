import axios from "axios";
import NodeCache from "node-cache";
import { PokemonListItem } from "../types.js";

const POKEAPI_BASE = process.env.POKEAPI_BASE || 'https://pokeapi.co/api/v2';
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

function extractId(url: string): number {
  const m = url.match(/\/pokemon\/(\d+)\/?$/);
  return m ? Number(m[1]) : 0;
}

export async function listPokemon(page = 1, pageSize = 20): Promise<{
  count: number;
  results: PokemonListItem[];
} | undefined> {
  const offset = (page - 1) * pageSize;
  const key = `list:${offset}:${pageSize}`;
  if (cache.has(key)) return cache.get(key);

  const { data } = await axios.get(`${POKEAPI_BASE}/pokemon`, {
    params: {
      limit: pageSize,
      offset
    }
  });

  const count = data.count as number;
  const results: PokemonListItem[] = (data.results as Array<{ name: string; url: string }>).map(r => {
    const id = extractId(r.url);
    return {
      id,
      name: r.name,
      image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
    };
  });

  const payload = { count, results };
  cache.set(key, payload);
  return payload;
}

export async function getPokemon(id: string | number) {
  const key = `detail:${id}`;
  if (cache.has(key)) return cache.get(key);

  const { data: pokemonData } = await axios.get(`${POKEAPI_BASE}/pokemon/${id}`);
  const { data: speciesData } = await axios.get(`${POKEAPI_BASE}/pokemon-species/${id}`);

  const descriptionEntry = speciesData.flavor_text_entries.find((entry: any) => entry.language.name === 'en');
  const description = descriptionEntry ? descriptionEntry.flavor_text : '';

  const payload = {
    id: pokemonData.id,
    name: pokemonData.name,
    sprites: pokemonData.sprites,
    abilities: pokemonData.abilities?.map((a: any) => a.ability?.name) || [],
    stats: pokemonData.stats?.map((m: any) => ({ value: m.base_stat, name: m.stat?.name })) || [],
    types: pokemonData.types?.map((t: any) => t.type?.name) || [],
    height: pokemonData.height,
    weight: pokemonData.weight,
    description: description || 'No description available.'
  };

  cache.set(key, payload);
  return payload;
}

