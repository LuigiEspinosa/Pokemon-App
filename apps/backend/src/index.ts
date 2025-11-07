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

// Pokémons
app.get('/api/pokemon', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  const sort = (req.query.sort as string) || 'id';
  const q = (req.query.q as string) || '';

  const response = await listPokemon(page, pageSize);
  const results = response?.results ?? [];
  const count = response?.count ?? 0;

  let filtered = results;
  if (q) {
    filtered = results.filter((r: PokemonListItem) => (
      r.name.toLowerCase().includes(q.toLowerCase()) || String(r.id) === q
    ));
  }

  if (sort === 'name') {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    filtered = [...filtered].sort((a, b) => a.id - b.id);
  }

  res.json({ count, page, pageSize, results: filtered });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Backend listening on ${port}`));
