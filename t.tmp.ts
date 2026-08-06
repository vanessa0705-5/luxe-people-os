import { streamText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
const gw = createOpenAICompatible({ name: "lovable", baseURL: "https://ai.gateway.lovable.dev/v1", headers: { "Lovable-API-Key": process.env.LOVABLE_API_KEY!, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
const r = streamText({
  model: gw("google/gemini-3.6-flash"),
  output: Output.object({ schema: z.object({ registros: z.array(z.object({ nome_completo: z.string().nullable(), cpf: z.string().nullable() })) }) }),
  messages: [{ role: "user", content: [{ type: "text", text: "Extraia registros. Conteudo JSON: [{\"nome\":\"Ana Silva\",\"cpf\":\"12345678901\"}]" }] as never }],
});
try { console.log(JSON.stringify(await r.output)); } catch (e) { console.log("ERR", e); }
