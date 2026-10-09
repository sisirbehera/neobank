import { z } from 'zod';
import type { $ZodType } from 'zod/v4/core';
import * as m from 'zod/mini';
import {
  AccountDtoSchema,
  AddBeneficiaryRequestSchema,
  AdminStatsSchema,
  AdminTransactionsPageSchema,
  AdminTransactionsQuerySchema,
  AdminUserDetailSchema,
  AdminUsersPageSchema,
  AdminUsersQuerySchema,
  AuditEntryDtoSchema,
  AuthResponseSchema,
  BackupCodesResponseSchema,
  BeneficiaryDtoSchema,
  ChangePasswordRequestSchema,
  EnrollConfirmResponseSchema,
  HealthResponseSchema,
  HistoryPageSchema,
  HistoryQuerySchema,
  IDEMPOTENCY_HEADER,
  LedgerEntryDtoSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  MfaDisableRequestSchema,
  MfaEnableRequestSchema,
  MfaEnrollConfirmRequestSchema,
  MfaSetupResponseSchema,
  MfaTokenRequestSchema,
  MfaVerifyRequestSchema,
  MoneyMovementRequestSchema,
  MoneyMovementResponseSchema,
  MonthlySummarySchema,
  OpenAccountRequestSchema,
  RegisterRequestSchema,
  SessionDtoSchema,
  STEP_UP_HEADER,
  StepUpRequestSchema,
  StepUpResponseSchema,
  TransferRequestSchema,
  TransferResponseSchema,
  UpdateAccountStatusRequestSchema,
  UserDtoSchema,
} from '@neobank/shared/models';

/**
 * OpenAPI 3.1 description of the API, generated from the SAME Zod schemas the
 * routes validate with, so the docs can't drift from the real rules.
 * Served at /api/docs/openapi.json and rendered by Swagger UI at /api/docs.
 */

type Auth = 'none' | 'bearer' | 'cookie';
type JsonSchema = Record<string, unknown>;

interface Operation {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  tag: string;
  summary: string;
  auth?: Auth;
  body?: $ZodType;
  query?: $ZodType;
  /** Response body schema; null = no body. */
  response?: $ZodType | null;
  status?: number;
  /** Extra request headers. */
  headers?: { name: string; required: boolean; description: string }[];
  produces?: 'application/json' | 'text/csv';
}

function toJsonSchema(schema: $ZodType, io: 'input' | 'output'): JsonSchema {
  const json = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'any',
  }) as JsonSchema;
  delete json['$schema'];
  return json;
}

const idempotencyHeader = {
  name: IDEMPOTENCY_HEADER,
  required: true,
  description:
    'Random value (e.g. a UUID) per user action. Retrying with the same key returns the first result instead of moving money twice.',
};

const stepUpHeader = {
  name: STEP_UP_HEADER,
  required: false,
  description:
    'Step-up token from POST /security/step-up, required when the API answers 403 STEP_UP_REQUIRED (users with 2FA).',
};

const LimitQuery = m.object({ limit: m.optional(m.int()) });

const operations: Operation[] = [
  // ---- System
  {
    method: 'get',
    path: '/health',
    tag: 'System',
    summary: 'Service and database health (503 when the DB is down)',
    response: HealthResponseSchema,
  },

  // ---- Auth
  {
    method: 'post',
    path: '/auth/register',
    tag: 'Auth',
    summary: 'Create a customer and start a session',
    body: RegisterRequestSchema,
    response: AuthResponseSchema,
    status: 201,
  },
  {
    method: 'post',
    path: '/auth/login',
    tag: 'Auth',
    summary: 'Password step: a session, or a 2FA challenge',
    body: LoginRequestSchema,
    response: LoginResponseSchema,
  },
  {
    method: 'post',
    path: '/auth/mfa/verify',
    tag: 'Auth',
    summary: 'Second step: code or backup code → session',
    body: MfaVerifyRequestSchema,
    response: AuthResponseSchema,
  },
  {
    method: 'post',
    path: '/auth/mfa/enroll/start',
    tag: 'Auth',
    summary: "Admin's first sign-in: get the QR code",
    body: MfaTokenRequestSchema,
    response: MfaSetupResponseSchema,
  },
  {
    method: 'post',
    path: '/auth/mfa/enroll/confirm',
    tag: 'Auth',
    summary: "Admin's first sign-in: confirm a code → session + backup codes",
    body: MfaEnrollConfirmRequestSchema,
    response: EnrollConfirmResponseSchema,
  },
  {
    method: 'post',
    path: '/auth/refresh',
    tag: 'Auth',
    summary: 'Swap the refresh cookie for a new session (rotation)',
    auth: 'cookie',
    response: AuthResponseSchema,
  },
  {
    method: 'post',
    path: '/auth/logout',
    tag: 'Auth',
    summary: 'Revoke the refresh token',
    auth: 'cookie',
    response: null,
    status: 204,
  },
  {
    method: 'get',
    path: '/auth/me',
    tag: 'Auth',
    summary: 'The signed-in user',
    auth: 'bearer',
    response: UserDtoSchema,
  },

  // ---- Security
  {
    method: 'post',
    path: '/security/mfa/setup',
    tag: 'Security',
    summary: 'Start 2FA setup (QR code)',
    auth: 'bearer',
    response: MfaSetupResponseSchema,
  },
  {
    method: 'post',
    path: '/security/mfa/enable',
    tag: 'Security',
    summary: 'Confirm a code and turn 2FA on',
    auth: 'bearer',
    body: MfaEnableRequestSchema,
    response: BackupCodesResponseSchema,
  },
  {
    method: 'post',
    path: '/security/mfa/disable',
    tag: 'Security',
    summary: 'Turn 2FA off (password + code; not for admins)',
    auth: 'bearer',
    body: MfaDisableRequestSchema,
    response: null,
    status: 204,
  },
  {
    method: 'post',
    path: '/security/mfa/backup-codes',
    tag: 'Security',
    summary: 'Replace the backup codes',
    auth: 'bearer',
    body: MfaEnableRequestSchema,
    response: BackupCodesResponseSchema,
  },
  {
    method: 'post',
    path: '/security/step-up',
    tag: 'Security',
    summary: 'Fresh code → 5-minute token for one risky action',
    auth: 'bearer',
    body: StepUpRequestSchema,
    response: StepUpResponseSchema,
  },
  {
    method: 'post',
    path: '/security/password',
    tag: 'Security',
    summary: 'Change password (signs out other devices)',
    auth: 'bearer',
    body: ChangePasswordRequestSchema,
    response: null,
    status: 204,
  },
  {
    method: 'get',
    path: '/security/sessions',
    tag: 'Security',
    summary: 'Signed-in devices',
    auth: 'bearer',
    response: m.array(SessionDtoSchema),
  },
  {
    method: 'post',
    path: '/security/sessions/revoke-others',
    tag: 'Security',
    summary: 'Sign out all other devices',
    auth: 'bearer',
    response: null,
    status: 204,
  },
  {
    method: 'delete',
    path: '/security/sessions/{id}',
    tag: 'Security',
    summary: 'Sign out one device',
    auth: 'bearer',
    response: null,
    status: 204,
  },

  // ---- Accounts
  {
    method: 'get',
    path: '/accounts',
    tag: 'Accounts',
    summary: 'My accounts',
    auth: 'bearer',
    response: m.array(AccountDtoSchema),
  },
  {
    method: 'post',
    path: '/accounts',
    tag: 'Accounts',
    summary: 'Open an account (max 5)',
    auth: 'bearer',
    body: OpenAccountRequestSchema,
    response: AccountDtoSchema,
    status: 201,
  },
  {
    method: 'get',
    path: '/accounts/activity',
    tag: 'Accounts',
    summary: 'Latest entries across my accounts',
    auth: 'bearer',
    query: LimitQuery,
    response: m.array(LedgerEntryDtoSchema),
  },
  {
    method: 'get',
    path: '/accounts/{id}',
    tag: 'Accounts',
    summary: 'One account',
    auth: 'bearer',
    response: AccountDtoSchema,
  },
  {
    method: 'get',
    path: '/accounts/{id}/activity',
    tag: 'Accounts',
    summary: 'Latest entries of one account',
    auth: 'bearer',
    query: LimitQuery,
    response: m.array(LedgerEntryDtoSchema),
  },
  {
    method: 'post',
    path: '/accounts/{id}/deposit',
    tag: 'Accounts',
    summary: 'Add money (demo)',
    auth: 'bearer',
    body: MoneyMovementRequestSchema,
    response: MoneyMovementResponseSchema,
    headers: [idempotencyHeader],
  },
  {
    method: 'post',
    path: '/accounts/{id}/withdraw',
    tag: 'Accounts',
    summary: 'Withdraw money',
    auth: 'bearer',
    body: MoneyMovementRequestSchema,
    response: MoneyMovementResponseSchema,
    headers: [idempotencyHeader],
  },

  // ---- Beneficiaries & transfers
  {
    method: 'get',
    path: '/beneficiaries',
    tag: 'Transfers',
    summary: 'My saved payees',
    auth: 'bearer',
    response: m.array(BeneficiaryDtoSchema),
  },
  {
    method: 'post',
    path: '/beneficiaries',
    tag: 'Transfers',
    summary: 'Add a payee (step-up with 2FA)',
    auth: 'bearer',
    body: AddBeneficiaryRequestSchema,
    response: BeneficiaryDtoSchema,
    status: 201,
    headers: [stepUpHeader],
  },
  {
    method: 'delete',
    path: '/beneficiaries/{id}',
    tag: 'Transfers',
    summary: 'Remove a payee',
    auth: 'bearer',
    response: null,
    status: 204,
  },
  {
    method: 'post',
    path: '/transfers',
    tag: 'Transfers',
    summary: 'Transfer money (step-up above ₹10,000 to others)',
    auth: 'bearer',
    body: TransferRequestSchema,
    response: TransferResponseSchema,
    status: 201,
    headers: [idempotencyHeader, stepUpHeader],
  },

  // ---- History
  {
    method: 'get',
    path: '/transactions',
    tag: 'History',
    summary: 'My statement, filtered and paged',
    auth: 'bearer',
    query: HistoryQuerySchema,
    response: HistoryPageSchema,
  },
  {
    method: 'get',
    path: '/transactions/export.csv',
    tag: 'History',
    summary: 'Statement as CSV (same filters)',
    auth: 'bearer',
    query: HistoryQuerySchema,
    produces: 'text/csv',
  },
  {
    method: 'get',
    path: '/transactions/summary',
    tag: 'History',
    summary: 'Money in/out per month, last 6 months',
    auth: 'bearer',
    response: MonthlySummarySchema,
  },

  // ---- Admin (role admin + a 2FA session)
  {
    method: 'get',
    path: '/admin/stats',
    tag: 'Admin',
    summary: 'Bank-wide numbers',
    auth: 'bearer',
    response: AdminStatsSchema,
  },
  {
    method: 'get',
    path: '/admin/users',
    tag: 'Admin',
    summary: 'Search users',
    auth: 'bearer',
    query: AdminUsersQuerySchema,
    response: AdminUsersPageSchema,
  },
  {
    method: 'get',
    path: '/admin/users/{id}',
    tag: 'Admin',
    summary: 'One user and their accounts',
    auth: 'bearer',
    response: AdminUserDetailSchema,
  },
  {
    method: 'patch',
    path: '/admin/accounts/{id}/status',
    tag: 'Admin',
    summary: 'Freeze / unfreeze (reason goes to the audit log)',
    auth: 'bearer',
    body: UpdateAccountStatusRequestSchema,
    response: AccountDtoSchema,
  },
  {
    method: 'get',
    path: '/admin/transactions',
    tag: 'Admin',
    summary: 'Every transaction',
    auth: 'bearer',
    query: AdminTransactionsQuerySchema,
    response: AdminTransactionsPageSchema,
  },
  {
    method: 'get',
    path: '/admin/audit',
    tag: 'Admin',
    summary: 'Latest admin actions',
    auth: 'bearer',
    response: m.array(AuditEntryDtoSchema),
  },
  {
    method: 'post',
    path: '/admin/demo/reset',
    tag: 'Admin',
    summary: 'Recreate the demo users (demo mode only)',
    auth: 'bearer',
    response: null,
    status: 204,
  },
];

/** The documented operations (used by tests to check the routes exist). */
export const DOCUMENTED_OPERATIONS = operations.map(({ method, path }) => ({
  method,
  path,
}));

export function buildOpenApi(version: string): JsonSchema {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const op of operations) {
    const parameters: unknown[] = [];
    for (const [, name] of op.path.matchAll(/\{(\w+)\}/g)) {
      parameters.push({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
    }
    if (op.query) {
      const query = toJsonSchema(op.query, 'input');
      const properties = (query['properties'] ?? {}) as Record<
        string,
        JsonSchema
      >;
      for (const [name, schema] of Object.entries(properties)) {
        parameters.push({ name, in: 'query', required: false, schema });
      }
    }
    for (const header of op.headers ?? []) {
      parameters.push({
        name: header.name,
        in: 'header',
        required: header.required,
        description: header.description,
        schema: { type: 'string' },
      });
    }

    const status = String(op.status ?? 200);
    const success =
      op.produces === 'text/csv'
        ? {
            description: 'CSV file',
            content: { 'text/csv': { schema: { type: 'string' } } },
          }
        : op.response
          ? {
              description: 'Success',
              content: {
                'application/json': {
                  schema: toJsonSchema(op.response, 'output'),
                },
              },
            }
          : { description: 'Success (no content)' };

    paths[op.path] ??= {};
    paths[op.path][op.method] = {
      tags: [op.tag],
      summary: op.summary,
      ...(op.auth === 'bearer' && { security: [{ bearerAuth: [] }] }),
      ...(op.auth === 'cookie' && { security: [{ refreshCookie: [] }] }),
      ...(parameters.length && { parameters }),
      ...(op.body && {
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: toJsonSchema(op.body, 'input') },
          },
        },
      }),
      responses: {
        [status]: success,
        default: { $ref: '#/components/responses/Error' },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'NeoBank API',
      version,
      description:
        'Demo retail banking API (learning project; no real money). Money is integer **paise** (₹1 = 100). Errors always look like `{ "error": { "code", "message", "fields?", "meta?" } }`.',
    },
    servers: [{ url: '/api' }],
    tags: [
      'System',
      'Auth',
      'Security',
      'Accounts',
      'Transfers',
      'History',
      'Admin',
    ].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        refreshCookie: { type: 'apiKey', in: 'cookie', name: 'nb_rt' },
      },
      responses: {
        Error: {
          description: 'Error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['error'],
                properties: {
                  error: {
                    type: 'object',
                    required: ['code', 'message'],
                    properties: {
                      code: {
                        type: 'string',
                        examples: ['INSUFFICIENT_FUNDS'],
                      },
                      message: { type: 'string' },
                      fields: {
                        type: 'object',
                        additionalProperties: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      meta: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
