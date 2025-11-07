import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes/route';

const app = express();
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

const corsOrigin = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(cors({
  origin: corsOrigin,
  credentials: true
}))

app.use('/api', routes);

app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

const port = Number(process.env.PORT || 4000);
app.listen(port, "0.0.0.0", () => console.log(`Backend listening on ${port}`));
