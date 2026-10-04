import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { AiError, aiConfigured, importResume } from "./ai";
import type { ImportRequest } from "../src/import/schema";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "15mb" }));

// Naive per-IP limiter: enough to stop a runaway client; put a real one at the edge in production.
const hits = new Map<string, number[]>();
function limited(ip: string, max = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: aiConfigured() });
});

app.post("/api/import", async (req, res) => {
  const body = req.body as Partial<ImportRequest>;
  if (!aiConfigured()) return res.status(503).json({ error: "AI import isn't configured on this server (set ANTHROPIC_API_KEY).", code: "no_ai" });
  if (limited(req.ip ?? "?")) return res.status(429).json({ error: "Too many imports in a minute. Wait a moment and retry." });
  if (typeof body.text !== "string" || (!body.text.trim() && !body.pdfBase64)) return res.status(400).json({ error: "Nothing to import." });
  if (body.text.length > 120_000) return res.status(413).json({ error: "That file has more text than any resume should." });
  const mode = body.mode === "ats" ? "ats" : "exact";
  const pages = body.pages === 2 || body.pages === 3 ? body.pages : 1;
  try {
    const out = await importResume({ text: body.text, pdfBase64: body.pdfBase64, filename: String(body.filename ?? "resume"), mode, pages });
    res.json(out);
  } catch (err) {
    if (err instanceof AiError) return res.status(err.status).json({ error: err.message });
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return res.status(503).json({ error: "AI import isn't configured on this server.", code: "no_ai" });
    }
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "The AI is busy. Retry in a few seconds." });
    if (err instanceof Anthropic.APIConnectionError) return res.status(503).json({ error: "Couldn't reach the AI service.", code: "no_ai" });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: `AI error (${err.status ?? "?"}).` });
    // Missing credentials surface as a plain Error from the client constructor/request.
    if (err instanceof Error && /api key|credential|auth/i.test(err.message)) return res.status(503).json({ error: "AI import isn't configured on this server.", code: "no_ai" });
    console.error(err);
    res.status(500).json({ error: "Import failed unexpectedly." });
  }
});

// Production: serve the built SPA.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`api listening on http://localhost:${port} (AI import: ${aiConfigured() ? "on" : "off (set ANTHROPIC_API_KEY)"})`));
