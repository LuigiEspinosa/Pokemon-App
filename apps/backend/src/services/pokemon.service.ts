import axios from "axios";
import NodeCache from "node-cache";
import { PokemonListItem } from "../types.js";

const POKEAPI_BASE = process.env.POKEAPI_BASE || 'https://pokeapi.co/api/v2';

/**
 * In-memory cache to reduce repeated calls to PokéAPI.
 * - stdTTL: default lifespan of entries (in seconds)
 * - checkperiod: how often expired keys are scanned/removed
 */
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

function extractId(url: string): number {
  const m = url.match(/\/pokemon\/(\d+)\/?$/);
  return m ? Number(m[1]) : 0;
}

/**
 * listPokemon
 * -----------
 * Fetches a paginated list of Pokémon and maps the result into a simplified list structure.
 *
 * Why:
 * - PokéAPI pagination returns results with URLs instead of IDs.
 * - This function extracts IDs and attaches direct artwork URLs for easy UI use.
 * - Results are cached to avoid unnecessary network calls.
 *
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of Pokémon to return per page
 * @returns Object containing:
 *   - count: total available Pokémon
 *   - results: simplified Pokémon list entries
 */
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

/**
 * getPokemon
 * ----------
 * Fetches full Pokémon detail information including:
 * - name, sprites, height, weight
 * - abilities, stats, types
 * - English description (from species endpoint)
 *
 * Why two requests?
 * - PokéAPI splits descriptive flavor text into the `pokemon-species` endpoint.
 *
 * Results are cached to reduce load and improve response times.
 *
 * @param id - Pokémon numeric ID or name (PokéAPI accepts either)
 * @returns Detailed Pokémon information structured for UI consumption.
 */
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

