import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, NextFunction } from "express";

type RequestLike = Request & {
  tenantId?: string;
  userId?: string;
  userRole?: string;
};

const requestContextStore = new AsyncLocalStorage<RequestLike>();

export function withRequestContext(req: Request, _res: Response, next: NextFunction): void {
  requestContextStore.run(req as RequestLike, next);
}

export function getRequestContext(): RequestLike | undefined {
  return requestContextStore.getStore();
}
