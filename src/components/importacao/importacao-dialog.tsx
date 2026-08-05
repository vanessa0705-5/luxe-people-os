import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  MODULOS_IMPORTACAO,
  type ModuloImportacao,
  type RegistroImportado,
} from "@/lib/importacao-config";
import {
  EXTENSOES_ACEITAS,
  arquivoParaBase64,
  gravarRegistros,
  isPdf,
  lerPlanilha,
} from "@/lib/importacao-api";
import { extrairRegistrosImportacao } from "@/lib/importacao.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modulo: ModuloImportacao;
  /** Vínculos aplicados a todos os registros importados. */
  tomadorId?: string | null;
  empresaId?: string | null;
  /** Chaves de cache invalidadas após a importação. */
  invalidateKeys?: string[];
  /** Executado após uma importação com registros gravados. */
  onImportado?: () => void;
}

export function ImportacaoDialog({
  open,
  onOpenChange,
  modulo,
  tomadorId,
  empresaId,
  invalidateKeys,
  onImportado,
}: Props) {
  const cfg = MODULOS_IMPORTACAO[modulo];
  const queryClient = useQueryClient();
  const extrair = useServerFn(extrairRegistrosImportacao);
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [registros, setRegistros] = useState<RegistroImportado[]>([]);
  const [erros, setErros] = useState<{ linha: number; mensagem: string }[]>([]);

  function limpar() {
    setRegistros([]);
    setErros([]);
    setArquivoNome(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleArquivo(file: File) {
    setLendo(true);
    setErros([]);
    setRegistros([]);
    setArquivoNome(file.name);
    try {
      const payload = isPdf(file)
        ? {
            modulo,
            arquivo: {
              nome: file.name,
              mime: file.type || "application/pdf",
              base64: await arquivoParaBase64(file),
            },
          }
        : { modulo, linhas: JSON.stringify(await lerPlanilha(file)) };

      const resultado = await extrair({ data: payload });
      const lista = (resultado.registros ?? []) as RegistroImportado[];
      if (lista.length === 0) {
        toast.error("Nenhum registro foi identificado no arquivo.");
      } else {
        toast.success(`${lista.length} registro(s) identificado(s). Revise antes de importar.`);
      }
      setRegistros(lista);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao ler o arquivo.";
      toast.error(msg);
      setArquivoNome(null);
    } finally {
      setLendo(false);
    }
  }

  async function importar() {
    setGravando(true);
    try {
      const resultado = await gravarRegistros(modulo, registros, { tomadorId, empresaId });
      setErros(resultado.erros);
      for (const key of invalidateKeys ?? []) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      if (resultado.inseridos > 0) {
        onImportado?.();
        toast.success(`${resultado.inseridos} registro(s) importado(s) com sucesso.`);
      }
      if (resultado.erros.length > 0) {
        toast.error(`${resultado.erros.length} registro(s) não puderam ser importados.`);
        setRegistros((atual) => atual.filter((_, i) => resultado.erros.some((e) => e.linha === i + 1)));
      } else {
        limpar();
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) limpar();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar {cfg.label}</DialogTitle>
          <DialogDescription>{cfg.descricao}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-accent/30 px-4 py-8 text-center">
            <div className="flex gap-3 text-muted-foreground">
              <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo <strong>Excel (.xlsx/.xls)</strong>, <strong>CSV</strong> ou{" "}
              <strong>PDF</strong>. O conteúdo é interpretado automaticamente e você revisa antes de
              salvar.
            </p>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={EXTENSOES_ACEITAS}
              aria-label="Arquivo para importação"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleArquivo(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={lendo}
              onClick={() => inputRef.current?.click()}
            >
              {lendo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lendo arquivo...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Escolher arquivo
                </>
              )}
            </Button>
            {arquivoNome && <p className="text-xs text-muted-foreground">{arquivoNome}</p>}
          </div>

          {registros.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Pré-visualização</p>
                <Badge variant="secondary">{registros.length} registro(s)</Badge>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {cfg.colunas.map((c) => (
                        <TableHead key={c.campo} className="whitespace-nowrap">
                          {c.label}
                        </TableHead>
                      ))}
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registros.map((r, i) => (
                      <TableRow key={i}>
                        {cfg.colunas.map((c) => (
                          <TableCell key={c.campo} className="whitespace-nowrap text-xs">
                            {r[c.campo] === null || r[c.campo] === undefined || r[c.campo] === ""
                              ? "—"
                              : String(r[c.campo])}
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Remover registro ${i + 1}`}
                            onClick={() => setRegistros((a) => a.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {erros.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
              <p className="mb-1 font-semibold text-destructive">Registros não importados:</p>
              <ul className="list-inside list-disc space-y-1 text-destructive">
                {erros.map((e) => (
                  <li key={e.linha}>
                    Linha {e.linha}: {e.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            disabled={registros.length === 0 || gravando || lendo}
            onClick={() => void importar()}
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
          >
            {gravando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...
              </>
            ) : (
              `Importar ${registros.length || ""}`.trim()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
