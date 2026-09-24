/**
 * Einheitliches Nachrichtenformat zwischen Werkzeugseite und Web Worker:
 * Anfrage mit Nummer, danach beliebig viele Fortschrittsmeldungen und genau ein Ergebnis
 * oder ein Fehler mit Code. Die Oberfläche übersetzt Codes in verständliche Meldungen.
 */

export interface WorkerRequest<P> {
  id: number;
  payload: P;
}

export type WorkerResponse =
  | { id: number; kind: 'progress'; progress: unknown }
  | { id: number; kind: 'result'; result: unknown }
  | { id: number; kind: 'error'; code: string };

export interface HandlerResult<R> {
  result: R;
  /** Werden an die Seite übertragen statt kopiert (z. B. große ArrayBuffer). */
  transfer?: Transferable[];
}

/** Minimale Sicht auf den Worker-Kontext, damit keine WebWorker-Typbibliothek nötig ist. */
interface WorkerScope {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

/** Im Worker aufrufen: beantwortet jede Anfrage mit dem Handler. */
export function serveRequests<P>(
  handler: (payload: P, progress: (value: unknown) => void) => Promise<HandlerResult<unknown>>,
): void {
  const scope = self as unknown as WorkerScope;
  scope.addEventListener('message', (event) => {
    const { id, payload } = event.data as WorkerRequest<P>;
    const progress = (value: unknown) =>
      scope.postMessage({ id, kind: 'progress', progress: value });
    handler(payload, progress).then(
      ({ result, transfer }) => scope.postMessage({ id, kind: 'result', result }, transfer ?? []),
      (error: unknown) => scope.postMessage({ id, kind: 'error', code: errorCode(error) }),
    );
  });
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    if (typeof code === 'string') return code;
  }
  return 'unknown';
}

/** Fehler aus dem Worker, mit Code für die Oberfläche. */
export class WorkerError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Worker-Fehler: ${code}`);
    this.name = 'WorkerError';
    this.code = code;
  }
}

export interface WorkerClient<P> {
  request<R>(payload: P, onProgress?: (progress: unknown) => void): Promise<R>;
}

/**
 * Auf der Seite aufrufen. Kann der Worker nicht starten oder stürzt er ab, schlagen alle
 * offenen Anfragen mit dem Code `worker-failed` fehl.
 */
export function createWorkerClient<P>(worker: Worker): WorkerClient<P> {
  let nextId = 1;
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: WorkerError) => void;
      onProgress?: (p: unknown) => void;
    }
  >();

  worker.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as WorkerResponse;
    const entry = pending.get(message.id);
    if (!entry) return;
    if (message.kind === 'progress') {
      entry.onProgress?.(message.progress);
      return;
    }
    pending.delete(message.id);
    if (message.kind === 'result') entry.resolve(message.result);
    else entry.reject(new WorkerError(message.code));
  });

  worker.addEventListener('error', () => {
    for (const entry of pending.values()) entry.reject(new WorkerError('worker-failed'));
    pending.clear();
  });

  return {
    request<R>(payload: P, onProgress?: (progress: unknown) => void): Promise<R> {
      const id = nextId++;
      return new Promise<R>((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
          ...(onProgress ? { onProgress } : {}),
        });
        worker.postMessage({ id, payload } satisfies WorkerRequest<P>);
      });
    },
  };
}
