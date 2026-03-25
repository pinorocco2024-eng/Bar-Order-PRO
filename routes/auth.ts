import express from 'express';
import bcrypt from 'bcryptjs';

export function authRoutes(db: any) {
    const router = express.Router();

    // Register
    router.post('/register', async (req, res) => {
        const { email, password } = req.body;

        if (!email.endsWith('@lscgalilei.it')) {
            return res.status(400).json({ error: 'Usa la tua email scolastica @lscgalilei.it' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
            res.json({ success: true });
        } catch (err) {
            res.status(400).json({ error: 'Email già registrata' });
        }
    });

    // Login
    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

        if (user && await bcrypt.compare(password, user.password)) {
            const session = req.session as any;
            session.userId = user.id;
            session.role = user.role;
            session.email = user.email;
            res.json({ success: true, role: user.role });
        } else {
            res.status(401).json({ error: 'Credenziali non valide' });
        }
    });

    // Logout
    router.post('/logout', (req, res) => {
        req.session.destroy(() => {
            res.json({ success: true });
        });
    });

    // Get User Info
    router.get('/me', (req: any, res) => {
        const session = req.session as any;
        if (session.userId) {
            res.json({ email: session.email, role: session.role });
        } else {
            res.status(401).json({ error: 'Not logged in' });
        }
    });

    return router;
}
