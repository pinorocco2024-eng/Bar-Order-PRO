import express from 'express';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';

export function orderRoutes(db: any, notifyAdmins: (order: any) => void) {
    const router = express.Router();

    // Create Order
    router.post('/', isAuthenticated, async (req: any, res) => {
        const { slotId, items, totalPrice } = req.body;
        const userId = req.session.userId;

        // Check slot capacity
        const slot = await db.get('SELECT * FROM time_slots WHERE id = ?', [slotId]);
        if (slot.current_orders >= slot.max_orders) {
            return res.status(400).json({ error: 'Slot orario pieno' });
        }

        // Generate unique code (e.g., A001)
        const lastOrder = await db.get('SELECT id FROM orders ORDER BY id DESC LIMIT 1');
        const nextId = (lastOrder ? lastOrder.id + 1 : 1).toString().padStart(3, '0');
        const orderCode = `A${nextId}`;

        try {
            await db.run('BEGIN TRANSACTION');

            const result = await db.run(
                'INSERT INTO orders (order_code, user_id, slot_id, total_price) VALUES (?, ?, ?, ?)',
                [orderCode, userId, slotId, totalPrice]
            );
            const orderId = result.lastID;

            for (const item of items) {
                await db.run(
                    'INSERT INTO order_items (order_id, product_id, quantity, price_at_order) VALUES (?, ?, ?, ?)',
                    [orderId, item.id, item.quantity, item.price]
                );
            }

            await db.run('UPDATE time_slots SET current_orders = current_orders + 1 WHERE id = ?', [slotId]);

            await db.run('COMMIT');

            // Notify admins
            const fullOrder = await db.get(`
                SELECT o.*, s.display_time, u.email 
                FROM orders o 
                JOIN time_slots s ON o.slot_id = s.id 
                JOIN users u ON o.user_id = u.id
                WHERE o.id = ?
            `, [orderId]);
            notifyAdmins(fullOrder);

            res.json({ success: true, orderCode });
        } catch (err) {
            await db.run('ROLLBACK');
            res.status(500).json({ error: 'Errore durante l\'ordine' });
        }
    });

    // Get User Orders (with history)
    router.get('/my-orders', isAuthenticated, async (req: any, res) => {
        const orders = await db.all(`
            SELECT o.*, s.display_time 
            FROM orders o 
            JOIN time_slots s ON o.slot_id = s.id 
            WHERE o.user_id = ? 
            ORDER BY o.created_at DESC
        `, [req.session.userId]);

        // Fetch items for each order
        for (const order of orders) {
            order.items = await db.all(`
                SELECT oi.*, p.name 
                FROM order_items oi 
                JOIN products p ON oi.product_id = p.id 
                WHERE oi.order_id = ?
            `, [order.id]);
        }

        res.json(orders);
    });

    // Admin: Get All Orders (with filters)
    router.get('/admin/orders', isAuthenticated, isAdmin, async (req, res) => {
        const { status, slotId } = req.query;
        let query = `
            SELECT o.*, s.display_time, u.email 
            FROM orders o 
            JOIN time_slots s ON o.slot_id = s.id 
            JOIN users u ON o.user_id = u.id
        `;
        const params: any[] = [];
        const conditions: string[] = [];

        if (status) {
            conditions.push('o.status = ?');
            params.push(status);
        }
        if (slotId) {
            conditions.push('o.slot_id = ?');
            params.push(slotId);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY s.display_time ASC, o.created_at ASC';

        const orders = await db.all(query, params);

        // Fetch items for each order
        for (const order of orders) {
            order.items = await db.all(`
                SELECT oi.*, p.name 
                FROM order_items oi 
                JOIN products p ON oi.product_id = p.id 
                WHERE oi.order_id = ?
            `, [order.id]);
        }

        res.json(orders);
    });

    // Admin: Update Order Status
    router.post('/admin/orders/:id/status', isAuthenticated, isAdmin, async (req, res) => {
        const { status } = req.body;
        const { id } = req.params;
        await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    });

    return router;
}
