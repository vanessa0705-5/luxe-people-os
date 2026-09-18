import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Funções públicas do portal do candidato. O acesso é autorizado exclusivamente
 * pelo token da admissão — nunca por sessão de usuário — e cada função só
 * devolve/altera dados da própria admissão daquele token.
 */

const BUCKET = "admissao-documentos";

const TokenSchema = z.object({ token: z.string().min(20).max(120) });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function carregarPorToken(token: string) {
  const db = await admin();
  const { data, error } = await db
    .from("admissoes")
    .select(
      "id, token, nome_completo, cpf, email, telefone, cargo, unidade, data_prevista, etapa, status, progresso, empresa:empresas(razao_social, nome_fantasia), tomador:tomadores(razao_social)",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar sua admissão.");
  if (!data) throw new Error("Link de admissão inválido.");
  if (data.status === "cancelada") throw new Error("Este processo de admissão foi cancelado.");
  return data;
}

export const getAdmissaoPublica = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const admissao = await carregarPorToken(data.token);

    const [{ data: documentos }, { data: transporte }, { data: treinamentos }, { data: contrato }] =
      await Promise.all([
        db
          .from("admissao_documentos")
          .select("id, codigo, nome, obrigatorio, ordem, status, observacao, arquivo_nome, enviado_em")
          .eq("admissao_id", admissao.id)
          .order("ordem"),
        db
          .from("admissao_transporte")
          .select("*")
          .eq("admissao_id", admissao.id)
          .maybeSingle(),
        db
          .from("admissao_treinamentos")
          .select("id, nr_codigo, nome, obrigatorio, concluido_em, carga_horaria, instrutor")
          .eq("admissao_id", admissao.id)
          .order("nr_codigo"),
        db
          .from("admissao_contrato")
          .select("*")
          .eq("admissao_id", admissao.id)
          .maybeSingle(),
      ]);

    return {
      admissao,
      documentos: documentos ?? [],
      transporte: transporte ?? null,
      treinamentos: treinamentos ?? [],
      contrato: contrato ?? null,
    };
  });

const UploadSchema = TokenSchema.extend({
  documentoId: z.string().uuid(),
  nomeArquivo: z.string().min(1).max(200),
  mime: z.string().min(3).max(120),
  base64: z.string().min(10).max(28_000_000),
});

export const enviarDocumentoAdmissao = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UploadSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const admissao = await carregarPorToken(data.token);

    const { data: doc, error: docErro } = await db
      .from("admissao_documentos")
      .select("id, codigo")
      .eq("id", data.documentoId)
      .eq("admissao_id", admissao.id)
      .maybeSingle();
    if (docErro || !doc) throw new Error("Documento não encontrado nesta admissão.");

    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const extensao = data.nomeArquivo.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${admissao.id}/${doc.codigo}-${Date.now()}.${extensao}`;

    const { error: upErro } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.mime, upsert: true });
    if (upErro) throw new Error("Falha ao enviar o arquivo. Tente novamente.");

    const { error } = await db
      .from("admissao_documentos")
      .update({
        arquivo_path: path,
        arquivo_nome: data.nomeArquivo,
        enviado_em: new Date().toISOString(),
        status: "enviado",
        observacao: null,
      })
      .eq("id", doc.id);
    if (error) throw new Error("Falha ao registrar o documento.");
    return { ok: true };
  });

const TransporteSchema = TokenSchema.extend({
  modalidade: z.enum(["vt", "vc", "proprio", "nenhum"]),
  linhas: z.string().max(500).optional(),
  valor_diario: z.number().nonnegative().optional(),
  placa_veiculo: z.string().max(20).optional(),
  cnh_numero: z.string().max(30).optional(),
  observacoes: z.string().max(500).optional(),
});

export const salvarTransporteAdmissao = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TransporteSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const admissao = await carregarPorToken(data.token);
    const { token: _t, ...campos } = data;
    const { error } = await db
      .from("admissao_transporte")
      .upsert(
        {
          admissao_id: admissao.id,
          modalidade: campos.modalidade,
          linhas: campos.linhas ?? null,
          valor_diario: campos.valor_diario ?? null,
          placa_veiculo: campos.placa_veiculo ?? null,
          cnh_numero: campos.cnh_numero ?? null,
          observacoes: campos.observacoes ?? null,
          confirmado_em: new Date().toISOString(),
        },
        { onConflict: "admissao_id" },
      );
    if (error) throw new Error("Não foi possível salvar as informações de transporte.");
    return { ok: true };
  });

const ContratoSchema = TokenSchema.extend({ assinatura_nome: z.string().trim().min(5).max(150) });

export const aceitarContratoAdmissao = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ContratoSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const admissao = await carregarPorToken(data.token);
    const { error } = await db.from("admissao_contrato").upsert(
      {
        admissao_id: admissao.id,
        assinatura_nome: data.assinatura_nome,
        aceito_em: new Date().toISOString(),
      },
      { onConflict: "admissao_id" },
    );
    if (error) throw new Error("Não foi possível registrar o aceite do contrato.");
    await db
      .from("admissoes")
      .update({ etapa: "concluida", status: "concluida", progresso: 100, concluida_em: new Date().toISOString() })
      .eq("id", admissao.id);
    return { ok: true };
  });

const EtapaSchema = TokenSchema.extend({
  etapa: z.enum(["documentos", "transporte", "treinamentos", "contrato"]),
});

/** Permite ao candidato voltar/avançar entre as etapas já liberadas. */
export const definirEtapaAdmissao = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EtapaSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const admissao = await carregarPorToken(data.token);
    if (admissao.status === "concluida") return { ok: true };

    const ordem = ["documentos", "transporte", "treinamentos", "contrato"] as const;
    const destino = ordem.indexOf(data.etapa);
    const atual = ordem.indexOf(admissao.etapa as (typeof ordem)[number]);

    if (destino > atual) {
      if (data.etapa === "transporte" || destino > atual) {
        const { data: docs } = await db
          .from("admissao_documentos")
          .select("obrigatorio, status")
          .eq("admissao_id", admissao.id);
        const pendentes = (docs ?? []).filter(
          (d) => d.obrigatorio && (d.status === "pendente" || d.status === "reprovado"),
        );
        if (pendentes.length > 0 && atual === 0) {
          throw new Error("Envie todos os documentos obrigatórios antes de avançar.");
        }
      }
    }

    const statusPorEtapa = {
      documentos: "aguardando_documentos",
      transporte: "transporte_pendente",
      treinamentos: "treinamentos_pendentes",
      contrato: "contrato_pendente",
    } as const;
    const progresso = Math.round((destino / 4) * 100);

    const { error } = await db
      .from("admissoes")
      .update({ etapa: data.etapa, status: statusPorEtapa[data.etapa], progresso })
      .eq("id", admissao.id);
    if (error) throw new Error("Não foi possível atualizar sua etapa.");
    return { ok: true };
  });
