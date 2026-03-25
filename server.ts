import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import QRCode from 'qrcode';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

// Import Routes
import { authRoutes } from './routes/auth.js';
import { productRoutes } from './routes/products.js';
import { orderRoutes } from './routes/orders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'scuola-galilei-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// WebSocket Handling
const adminClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'register_admin') {
                adminClients.add(ws);
                console.log('Admin registered for notifications');
            }
        } catch (err) {
            console.error('WS Message Error:', err);
        }
    });

    ws.on('close', () => {
        adminClients.delete(ws);
    });
});

function notifyAdmins(order: any) {
    const message = JSON.stringify({ type: 'new_order', order });
    adminClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Database initialization
initDb().then(db => {
    console.log('Database initialized');

    // --- API ROUTES ---
    app.use('/api/auth', authRoutes(db));
    app.use('/api/products', productRoutes(db));
    app.use('/api/orders', orderRoutes(db, notifyAdmins));

    // QR Code Generator
    app.get('/api/qr/:code', async (req, res) => {
        try {
            const url = await QRCode.toDataURL(req.params.code);
            res.json({ url });
        } catch (err) {
            res.status(500).send('QR Error');
        }
    });

    // Serve static files
    app.use(express.static('public'));

    // Fallback to index.html
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
});
