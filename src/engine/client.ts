import type { Resume } from "../model/types";
import type { Box, CompileInfo, WorkerIn, WorkerOut } from "./worker";

export interface CompileResult { pdf: Uint8Array; info: CompileInfo; boxes: Box[] }
export type { Box, CompileInfo };

/**
 * Typesetting in a worker. Only the latest request resolves with a result;
 * superseded ones resolve null. The worker is created on demand, so a disposed
 * Compiler (React StrictMode unmount/remount) simply starts a fresh one.
 */
export class Compiler {
  private w: Worker | null = null;
  private seq = 0;
  private waiting = new Map<number, { resolve: (r: CompileResult | null) => void; reject: (e: Error) => void }>();
  /** Recent results by document. Undo/redo and a warmed-up first open come back instantly. */
  private recent = new Map<string, CompileResult>();
  private keys = new Map<number, string>();

  private get worker(): Worker {
    if (!this.w) {
      this.w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      this.w.onmessage = (ev: MessageEvent<WorkerOut>) => this.receive(ev.data);
      this.w.onerror = (ev) => {
        for (const o of this.waiting.values()) o.reject(new Error(ev.message || "Typesetter crashed"));
        this.waiting.clear();
      };
    }
    return this.w;
  }

  private receive(m: WorkerOut) {
    const w = this.waiting.get(m.id);
    if (!w) return;
    this.waiting.delete(m.id);
    // Anything older than this response is stale.
    for (const [id, o] of this.waiting) if (id < m.id) { o.resolve(null); this.waiting.delete(id); }
    if (m.ok) {
      const res = { pdf: m.pdf, info: m.info, boxes: m.boxes };
      const key = this.keys.get(m.id);
      if (key) {
        this.recent.delete(key);
        this.recent.set(key, res);
        if (this.recent.size > 8) this.recent.delete(this.recent.keys().next().value!);
      }
      w.resolve(res);
    } else w.reject(new Error(m.error));
    this.keys.delete(m.id);
  }

  /** Resolves null when a newer compile overtook this one. */
  compile(resume: Resume): Promise<CompileResult | null> {
    const id = ++this.seq;
    // Element ids never reach the layout, so two copies of the same content share a result.
    const key = JSON.stringify(resume, (k, v) => (k === "id" ? undefined : v));
    const hit = this.recent.get(key);
    if (hit) {
      // Anything still in flight is now stale, same as when a fresh result arrives.
      for (const o of this.waiting.values()) o.resolve(null);
      this.waiting.clear();
      return Promise.resolve(hit);
    }
    this.keys.set(id, key);
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ id, resume: structuredClone(resume) } satisfies WorkerIn);
    });
  }

  /** Spin up the worker now (downloads it, initialises fontkit) without compiling anything. */
  warm() {
    void this.worker;
  }

  dispose() {
    this.w?.terminate();
    this.w = null;
    for (const o of this.waiting.values()) o.resolve(null);
    this.waiting.clear();
  }
}

let shared: Compiler | null = null;
/** The app's one compiler. Shared so setup can warm it up before the editor opens. */
export const sharedCompiler = () => (shared ??= new Compiler());
