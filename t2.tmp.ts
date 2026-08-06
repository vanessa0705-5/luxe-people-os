import { streamText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
const gw = createOpenAICompatible({ name: "lovable", baseURL: "https://ai.gateway.lovable.dev/v1", supportsStructuredOutputs: true, headers: { "Lovable-API-Key": process.env.LOVABLE_API_KEY!, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
const b64 = Buffer.from(await Bun.file("/tmp/t/a.pdf").arrayBuffer()).toString("base64");
const r = streamText({
  model: gw("google/gemini-3.6-flash"),
  output: Output.object({ schema: z.object({ registros: z.array(z.object({ nome_completo: z.string().nullable(), cpf: z.string().nullable() })) }) }),
  messages: [{ role: "user", content: [
    { type: "text", text: "Extraia os registros de colaboradores do PDF. CPF apenas digitos." },
    { type: "file", mediaType: "application/pdf", filename: "a.pdf", data: b64 },
  ] }],
});
try { console.log(JSON.stringify(await r.output)); } catch (e) { console.log("ERR", String(e).slice(0,600)); }
