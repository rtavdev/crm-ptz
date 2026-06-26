import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/errorHandler';
import { authenticateJWT } from '../middleware/authenticate';
import { injectAccessScope } from '../middleware/authorize';
import { executeTenantQuery } from '../db/context';
import { DEAL_STAGES } from '../domain/enums';
import type { Deal, DealStage } from '../types';

export const dealsRouter = Router();

dealsRouter.use(authenticateJWT, injectAccessScope);

const DEAL_COLUMNS = [
  'id',
  'tenant_id',
  'lead_id',
  'owner_id',
  'amount',
  'stage',
  'name',
  'company',
  'value',
  'close_date',
  'owner',
  'notes',
  'created_at',
].join(', ');

interface DealBody {
  lead_id?: unknown;
  amount?: unknown;
  value?: unknown;
  stage?: unknown;
  owner_id?: unknown;
  name?: unknown;
  company?: unknown;
  close_date?: unknown;
  owner?: unknown;
  notes?: unknown;
}

type WebDeal = Omit<Deal, 'stage' | 'value'> & { stage: string; value: string };

function isDealStage(value: unknown): value is DealStage {
  return typeof value === 'string' && (DEAL_STAGES as readonly string[]).includes(value);
}

function normalizeDealStage(value: unknown): DealStage | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isDealStage(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  const stageMap: Record<string, DealStage> = {
    'new deals': 'PROSPECTING',
    prospect: 'PROSPECTING',
    prospecting: 'PROSPECTING',
    proposal: 'PROPOSAL',
    negotiation: 'NEGOTIATION',
    won: 'CLOSED_WON',
    lost: 'CLOSED_LOST',
    closed_won: 'CLOSED_WON',
    closed_lost: 'CLOSED_LOST',
  };

  return stageMap[value.trim().toLowerCase()];
}

function toWebStage(stage: DealStage): string {
  switch (stage) {
    case 'PROSPECTING':
      return 'new deals';
    case 'PROPOSAL':
      return 'proposal';
    case 'NEGOTIATION':
      return 'negotiation';
    case 'CLOSED_WON':
      return 'won';
    case 'CLOSED_LOST':
      return 'lost';
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

function toWebDeal(deal: Deal): WebDeal {
  return {
    ...deal,
    stage: toWebStage(deal.stage),
    value: deal.value ?? deal.amount,
  };
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function optionalDate(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseAmount(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return value.trim();
  }
  throw new HttpError(400, 'Field "amount" must be a valid number');
}

/** GET /api/deals — list deals, owner-scoped for SALES_REP. */
dealsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user!;
    const scope = req.accessScope!;

    let text = `SELECT ${DEAL_COLUMNS} FROM deals`;
    const params: unknown[] = [];
    if (scope.restrictToOwner) {
      params.push(userId);
      text += ` WHERE owner_id = $${params.length}`;
    }
    text += ' ORDER BY created_at DESC';

    const result = await executeTenantQuery<Deal>(tenantId, text, params);
    const data = result.rows.map(toWebDeal);
    res.json({ deals: result.rows, data, items: data });
  }),
);

/** GET /api/deals/:id — fetch one deal, owner-scoped for SALES_REP. */
dealsRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user!;
    const scope = req.accessScope!;

    const params: unknown[] = [req.params.id];
    let text = `SELECT ${DEAL_COLUMNS} FROM deals WHERE id = $1`;
    if (scope.restrictToOwner) {
      params.push(userId);
      text += ` AND owner_id = $${params.length}`;
    }

    const result = await executeTenantQuery<Deal>(tenantId, text, params);
    const deal = result.rows[0];
    if (!deal) {
      throw new HttpError(404, 'Deal not found');
    }
    res.json({ deal });
  }),
);

/** POST /api/deals — create a deal. SALES_REP can only create deals they own. */
dealsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user!;
    const scope = req.accessScope!;
    const body = req.body as DealBody;

    const leadId = optionalText(body.lead_id);
    const amount = parseAmount(body.amount ?? body.value ?? 0);
    const normalizedStage = normalizeDealStage(body.stage);
    if (body.stage !== undefined && normalizedStage === undefined) {
      throw new HttpError(400, `Invalid "stage"; allowed: ${DEAL_STAGES.join(', ')}`);
    }
    const stage: DealStage = normalizedStage ?? 'PROSPECTING';

    let ownerId = userId;
    if (!scope.restrictToOwner && typeof body.owner_id === 'string' && body.owner_id.length > 0) {
      ownerId = body.owner_id;
    }

    const result = await executeTenantQuery<Deal>(
      tenantId,
      `INSERT INTO deals (
         tenant_id, lead_id, owner_id, amount, stage,
         name, company, value, close_date, owner, notes
       )
         name, company, value, close_date, owner, notes,
         created_by, modified_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${DEAL_COLUMNS}`,
      [
        tenantId,
        leadId,
        ownerId,
        amount,
        stage,
        optionalText(body.name),
        optionalText(body.company),
        amount,
        optionalDate(body.close_date),
        optionalText(body.owner),
        optionalText(body.notes),
        userId,
        userId,
      ],
    );
    const deal = result.rows[0]!;
    const data = toWebDeal(deal);
    res.status(201).json({ ...data, deal, data, item: data });
  }),
);

/** PUT /api/deals/:id — update a deal, owner-scoped for SALES_REP. */
dealsRouter.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user!;
    const scope = req.accessScope!;
    const body = req.body as DealBody;

    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown): void => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };

    if (body.amount !== undefined) {
      add('amount', parseAmount(body.amount));
    }
    if (body.value !== undefined) {
      const value = parseAmount(body.value);
      add('value', value);
      if (body.amount === undefined) {
        add('amount', value);
      }
    }
    if (body.stage !== undefined) {
      const normalizedStage = normalizeDealStage(body.stage);
      if (normalizedStage === undefined) {
        throw new HttpError(400, `Invalid "stage"; allowed: ${DEAL_STAGES.join(', ')}`);
      }
      add('stage', normalizedStage);
    }
    if (body.lead_id !== undefined) {
      add('lead_id', optionalText(body.lead_id));
    }
    if (body.name !== undefined) {
      add('name', optionalText(body.name));
    }
    if (body.company !== undefined) {
      add('company', optionalText(body.company));
    }
    if (body.close_date !== undefined) {
      add('close_date', optionalDate(body.close_date));
    }
    if (body.owner !== undefined) {
      add('owner', optionalText(body.owner));
    }
    if (body.notes !== undefined) {
      add('notes', optionalText(body.notes));
    }
    // Always stamp modification actor.
    add('modified_by', userId);

    if (sets.length === 0) {
      throw new HttpError(400, 'No updatable fields provided');
    }

    params.push(req.params.id);
    let text = `UPDATE deals SET ${sets.join(', ')} WHERE id = $${params.length}`;

    if (scope.restrictToOwner) {
      params.push(userId);
      text += ` AND owner_id = $${params.length}`;
    }
    text += ` RETURNING ${DEAL_COLUMNS}`;

    const result = await executeTenantQuery<Deal>(tenantId, text, params);
    const deal = result.rows[0];
    if (!deal) {
      throw new HttpError(404, 'Deal not found');
    }
    res.json({ deal });
  }),
);

/** DELETE /api/deals/:id — delete a deal, owner-scoped for SALES_REP. */
dealsRouter.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user!;
    const scope = req.accessScope!;

    const params: unknown[] = [req.params.id];
    let text = 'DELETE FROM deals WHERE id = $1';
    if (scope.restrictToOwner) {
      params.push(userId);
      text += ` AND owner_id = $${params.length}`;
    }
    text += ' RETURNING id';

    const result = await executeTenantQuery<{ id: string }>(tenantId, text, params);
    if (result.rowCount === 0) {
      throw new HttpError(404, 'Deal not found');
    }
    res.status(204).send();
  }),
);
