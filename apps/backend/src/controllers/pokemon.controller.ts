import { Request, Response } from 'express';
import { getPokemon, listPokemon } from '../services/pokemon.service.js';
import { PokemonListItem } from '../types.js';

export const getPokemonList = async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  const sort = (req.query.sort as string) || 'id';
  const q = (req.query.q as string) || '';

  try {
    const response = await listPokemon(1, 2000);
    let results = response?.results ?? [];

    // Filter
    if (q) {
      results = results.filter((r: PokemonListItem) => (
        r.name.toLowerCase().includes(q.toLowerCase()) || String(r.id) === q
      ));
    }

    // Sort
    if (sort === 'name') {
      results.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      results.sort((a, b) => a.id - b.id);
    }

    // Pagination
    const count = results.length;
    const start = (page - 1) * pageSize;
    const paginated = results.slice(start, start + pageSize);

    res.json({ count, page, pageSize, results: paginated });
  } catch (error) {
    console.error('Error fetching Pokémon:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getPokemonData = async (req: Request, res: Response) => {
  const id = req.params.id;

  try {
    const data = await getPokemon(id);
    res.json(data);
  } catch (error) {
    console.error('Error fetching Pokémon data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
