import express from 'express'
import cors from 'cors'

const app = express()

const corsOrigin = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(cors({
  origin: corsOrigin,
  credentials: true
}))

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Backend listening on ${port}`));
