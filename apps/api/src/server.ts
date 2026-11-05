import 'dotenv/config';
import { app } from './app.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.ORIGIN || 'http://localhost:3000',
  },
});

const PORT = Number(process.env.PORT) || 4000;

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
});

httpServer.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
