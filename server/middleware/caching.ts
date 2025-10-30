import type { Request, Response, NextFunction } from "express";

export const staticAssetCaching = (req: Request, res: Response, next: NextFunction) => {
  if (req.url.match(/\.(js|css|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
};

export const apiCaching = (maxAge: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);
      res.setHeader('Vary', 'Accept-Encoding, X-User-ID');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    next();
  };
};

export const noCache = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
};
