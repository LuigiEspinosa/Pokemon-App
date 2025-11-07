import express from 'express';

import { getPokemonData, getPokemonList } from '../controllers/pokemon.controller';
import { userLogin, userLogout } from '../controllers/login.controller';

const router = express.Router();

router.get("/health", (_req, res) => res.status(200).send("ok"));

// Pokemon
router.get('/pokemon', getPokemonList);
router.get('/pokemon/:id', getPokemonData)

// Login
router.post('/login', userLogin);
router.post('/logout', userLogout);

export default router;
