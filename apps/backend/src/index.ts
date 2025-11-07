import express from 'express'
import cors from 'cors'
import helmet from 'helmet';
import { listPokemon } from './poke';
import { PokemonListItem } from './types';

const app = express()
app.use(helmet());
app.use(express.json());

const corsOrigin = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(cors({
  origin: corsOrigin,
  credentials: false
}))

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Pokémon
app.get('/api/pokemon', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  const sort = (req.query.sort as string) || 'id';
  const q = (req.query.q as string) || '';

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
});


const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Backend listening on ${port}`));
