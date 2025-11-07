import express from 'express';

import { getPokemonList } from '../controllers/pokemon.controller';
import { userLogin, userLogout } from '../controllers/login.controller';
import { authMiddleware } from '../auth';

const router = express.Router();

router.get('/health', (_req, res) => res.json({ ok: true }));
router.get('/pokemon', getPokemonList);

// Login
router.get('/me', authMiddleware, (req, res) => res.json({ user: (req as any).user })); // Validation
router.post('/login', userLogin);
router.post('/logout', userLogout);

export default router;
