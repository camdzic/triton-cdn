import {
  accountSchema,
  apiErrorSchema,
  type CreateInviteInput,
  createdInviteSchema,
  type FileEntry,
  fileEntrySchema,
  filePageSchema,
  inviteSchema,
  type LoginInput,
  okSchema,
  type RegisterInput,
  type UpdateFileInput,
  uploadTokenSchema,
  WEB_CLIENT,
  WEB_CLIENT_HEADER,
  webSessionSchema
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

function failure(status: number, body: unknown) {
  const error = apiErrorSchema.safeParse(body);

  return new APIError(
    error.success ? error.data.error : `Request failed with ${status}`,
    status
  );
}

async function request<Schema extends z.ZodType>(
  schema: Schema,
  path: string,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);

  headers.set(WEB_CLIENT_HEADER, WEB_CLIENT);

  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: 'same-origin'
    });
  } catch {
    throw new APIError('Could not reach the server', 0);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw failure(response.status, body);
  }

  return schema.parse(body);
}

function json<Schema extends z.ZodType>(
  schema: Schema,
  path: string,
  method: string,
  payload: unknown
) {
  return request(schema, path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function parseJSON(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function upload(file: File, onProgress: UploadProgress, signal: AbortSignal) {
  return new Promise<FileEntry>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(
      'PUT',
      `/api/files?${new URLSearchParams({ filename: file.name })}`
    );
    xhr.setRequestHeader(WEB_CLIENT_HEADER, WEB_CLIENT);

    if (file.type !== '') {
      xhr.setRequestHeader('content-type', file.type);
    }

    xhr.upload.addEventListener('progress', (event) => {
      onProgress(
        event.loaded,
        event.lengthComputable ? event.total : file.size
      );
    });

    xhr.addEventListener('load', () => {
      const body = parseJSON(xhr.responseText);

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(failure(xhr.status, body));
        return;
      }

      const parsed = fileEntrySchema.safeParse(body);

      if (parsed.success) {
        resolve(parsed.data);
      } else {
        reject(new APIError('Unexpected response from the server', xhr.status));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new APIError('Could not reach the server', 0));
    });

    xhr.addEventListener('abort', () => {
      reject(new APIError('Upload cancelled', 0));
    });

    signal.addEventListener('abort', () => xhr.abort());

    xhr.send(file);
  });
}

export const api = {
  login(input: LoginInput) {
    return json(webSessionSchema, '/api/auth/login', 'POST', input);
  },
  register(input: RegisterInput) {
    return json(webSessionSchema, '/api/auth/register', 'POST', input);
  },
  logout() {
    return request(okSchema, '/api/auth/logout', { method: 'POST' });
  },
  account() {
    return request(accountSchema, '/api/me');
  },
  uploadToken() {
    return request(uploadTokenSchema, '/api/me/upload-token');
  },
  files(limit: number, offset: number) {
    return request(
      filePageSchema,
      `/api/files?${new URLSearchParams({ limit: String(limit), offset: String(offset) })}`
    );
  },
  updateFile(id: string, input: UpdateFileInput) {
    return json(
      fileEntrySchema,
      `/api/files/${encodeURIComponent(id)}`,
      'PATCH',
      input
    );
  },
  deleteFile(id: string) {
    return request(okSchema, `/api/files/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },
  upload,
  invites() {
    return request(z.array(inviteSchema), '/api/invites');
  },
  createInvite(input: CreateInviteInput) {
    return json(createdInviteSchema, '/api/invites', 'POST', input);
  },
  revokeInvite(id: string) {
    return request(okSchema, `/api/invites/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },
  removeInviteAccount(id: string) {
    return request(okSchema, `/api/invites/${encodeURIComponent(id)}/account`, {
      method: 'DELETE'
    });
  }
};

export function errorMessage(error: unknown) {
  if (error instanceof APIError || error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
}

export function isUnauthorized(error: unknown) {
  return error instanceof APIError && error.status === 401;
}
