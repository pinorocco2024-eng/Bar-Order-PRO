import express from 'express';

export function productRoutes(db: any) {
    const router = express.Router();

    // Get Products
    router.get('/', async (req, res) => {
        const products = await db.all('SELECT * FROM products');
        res.json(products);
    });

    // Get Time Slots
    router.get('/slots', async (req, res) => {
        const slots = await db.all('SELECT * FROM time_slots');
        res.json(slots);
    });

    return router;
}
