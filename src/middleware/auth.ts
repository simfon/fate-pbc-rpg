import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Accesso negato',
      message: 'Solo gli Amministratori possono accedere a questa area.'
    });
  }
  next();
}

export function requireDestiny(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.role !== 'admin' && req.session.role !== 'destiny') {
    return res.status(403).render('error', {
      title: 'Accesso negato',
      message: 'Solo il Destino può accedere a questa area.'
    });
  }
  next();
}
