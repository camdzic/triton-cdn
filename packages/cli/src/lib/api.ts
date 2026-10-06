import { basename } from 'node:path';
import {
  accountSchema,
  apiErrorSchema,
  type CreateInviteInput,
  createdInviteSchema,
  fileEntrySchema,
  filePageSchema,
  inviteSchema,
  type LoginInput,
  okSchema,
  type RegisterInput,
  sessionSchema,
  uploadTokenSchema
} from '@triton/shared';
import { z } from 'zod';

export class APIError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);

    this.name = 'APIError';
  }
}

export type UploadProgress = (sent: number, total: number) => void;

export class API {
  constructor(
    readonly server: string,
    private readonly token?: string
  ) {}

  private async send(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);

    if (this.token) {
      headers.set('authorization', `Bearer ${this.token}`);
    }

    try {
      return await fetch(`${this.server}${path}`, { ...init, headers });
    } catch {
      throw new APIError(`Could not reach ${this.server}`, 0);
    }
  }

  private async request<Schema extends z.ZodType>(
    schema: Schema,
    path: string,
    init: RequestInit = {}
  ) {
    const response = await this.send(path, init);

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const error = apiErrorSchema.safeParse(body);

      throw new APIError(
        error.success
          ? error.data.error
          : `Request failed with ${response.status}`,
        response.status
      );
    }

    return schema.parse(body);
  }

  private json<Schema extends z.ZodType>(
    schema: Schema,
    path: string,
    method: string,
    payload: unknown
  ) {
    return this.request(schema, path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  register(input: RegisterInput) {
    return this.json(sessionSchema, '/api/auth/register', 'POST', input);
  }

  login(input: LoginInput) {
    return this.json(sessionSchema, '/api/auth/login', 'POST', input);
  }

  logout() {
    return this.request(okSchema, '/api/auth/logout', { method: 'POST' });
  }

  async probe() {
    const started = performance.now();

    const response = await this.send('/api/me');

    const body = await response.json().catch(() => null);

    return {
      triton: response.status === 401 && apiErrorSchema.safeParse(body).success,
      ms: Math.round(performance.now() - started)
    };
  }

  account() {
    return this.request(accountSchema, '/api/me');
  }

  files(limit: number, offset: number) {
    return this.request(
      filePageSchema,
      `/api/files?${new URLSearchParams({ limit: String(limit), offset: String(offset) })}`
    );
  }

  file(id: string) {
    return this.request(
      fileEntrySchema,
      `/api/files/${encodeURIComponent(id)}`
    );
  }

  deleteFile(id: string) {
    return this.request(okSchema, `/api/files/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  upload(path: string, onProgress: UploadProgress) {
    const file = Bun.file(path);

    const total = file.size;

    let sent = 0;

    const body = file.stream().pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          sent += chunk.byteLength;
          onProgress(sent, total);
          controller.enqueue(chunk);
        }
      })
    );

    return this.request(
      fileEntrySchema,
      `/api/files?${new URLSearchParams({ filename: basename(path) })}`,
      {
        method: 'PUT',
        body,
        headers: {
          'content-type': file.type,
          'content-length': String(total)
        }
      }
    );
  }

  uploadToken() {
    return this.request(uploadTokenSchema, '/api/me/upload-token');
  }

  invites() {
    return this.request(z.array(inviteSchema), '/api/invites');
  }

  createInvite(input: CreateInviteInput) {
    return this.json(createdInviteSchema, '/api/invites', 'POST', input);
  }

  revokeInvite(id: string) {
    return this.request(okSchema, `/api/invites/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  removeInviteAccount(id: string) {
    return this.request(
      okSchema,
      `/api/invites/${encodeURIComponent(id)}/account`,
      { method: 'DELETE' }
    );
  }

  async download(url: string) {
    let response: Response;

    try {
      response = await fetch(url);
    } catch {
      throw new APIError(`Could not reach ${this.server}`, 0);
    }

    if (!response.ok) {
      throw new APIError(
        `Download failed with ${response.status}`,
        response.status
      );
    }

    return new Uint8Array(await response.arrayBuffer());
  }
}
