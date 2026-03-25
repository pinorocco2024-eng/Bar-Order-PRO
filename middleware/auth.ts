export const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.session.userId) return next();
    res.status(401).json({ error: 'Non autorizzato' });
};

export const isAdmin = (req: any, res: any, next: any) => {
    if (req.session.role === 'admin') return next();
    res.status(403).json({ error: 'Accesso negato' });
};
