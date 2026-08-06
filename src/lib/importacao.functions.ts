import { createServerFn } from "@tanstack/react-start";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { SCHEMAS, montarPromptImportacao, type ModuloImportacao } from "@/lib/importacao-config";

const InputSchema = z.object({
  modulo: z.enum(["colaboradores", "empresas", "tomadores", "ferias"]),
  /** Linhas já lidas de uma planilha, serializadas em JSON. */
  linhas: z.string().optional(),
  /** Arquivo PDF em base64 (sem prefixo data:). */
  arquivo: z
    .object({
      nome: z.string(),
      mime: z.string(),
      base64: z.string(),
    })
    .optional(),
});

export const extrairRegistrosImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("A integração de IA não está configurada.");
    if (!data.linhas && !data.arquivo) throw new Error("Nenhum conteúdo enviado para leitura.");

    const modulo = data.modulo as ModuloImportacao;
    // structuredOutputs garante o envio de json_schema estrito: sem isso o modelo
    // responde JSON livre e a validação do schema falha.
    const gateway = createLovableAiGatewayProvider(apiKey, undefined, {
      structuredOutputs: true,
    });
    const prompt = montarPromptImportacao(modulo, data.linhas);

    const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
    if (data.arquivo) {
      content.push({
        type: "file",
        mediaType: data.arquivo.mime || "application/pdf",
        filename: data.arquivo.nome,
        data: data.arquivo.base64,
      });
    }

    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        output: Output.object({
          schema: z.object({ registros: z.array(SCHEMAS[modulo]) }),
        }),
        messages: [{ role: "user", content: content as never }],
      });
      const output = await result.output;
      return { registros: output.registros ?? [] };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error(
          "Não foi possível interpretar o arquivo. Confira se ele contém uma lista de registros legível.",
        );
      }
      const msg = error instanceof Error ? error.message : "Falha ao ler o arquivo.";
      if (msg.includes("429")) throw new Error("Muitas leituras em sequência. Tente novamente em instantes.");
      if (msg.includes("402")) throw new Error("Os créditos de IA do workspace foram esgotados.");
      throw new Error(msg);
    }
  });
