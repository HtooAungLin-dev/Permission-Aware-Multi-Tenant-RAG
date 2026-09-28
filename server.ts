import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { apiRouter } from './src/server/api';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API routes
app.use('/api/rag', apiRouter);

// Serve static build files in production
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Permission-Aware Multi-Tenant RAG server running on port ${PORT}`);
});
