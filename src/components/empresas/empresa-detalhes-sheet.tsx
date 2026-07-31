import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_EMPRESA_LABELS, listTomadoresDaEmpresa, type Empresa } from "@/lib/empresas-api";
import { maskCep, maskCnpj, maskTelefone } from "@/lib/br-format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa?: Empresa | null;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

export function EmpresaDetalhesSheet({ open, onOpenChange, empresa }: Props) {
  const { data: vinculos, isLoading } = useQuery({
    queryKey: ["empresa-tomadores", empresa?.id],
    queryFn: () => listTomadoresDaEmpresa(empresa!.id),
    enabled: open && !!empresa?.id,
  });

  const endereco = empresa
    ? [
        empresa.logradouro,
        empresa.numero,
        empresa.complemento,
        empresa.bairro,
      ]
        .filter((p) => p && String(p).trim())
        .join(", ")
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{empresa?.razao_social ?? "Empresa"}</SheetTitle>
          <SheetDescription>Detalhes completos do cadastro da empresa.</SheetDescription>
        </SheetHeader>

        {empresa && (
          <div className="mt-4 space-y-6">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  empresa.status === "ativa"
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-border text-muted-foreground"
                }
              >
                {STATUS_EMPRESA_LABELS[empresa.status as "ativa" | "inativa"]}
              </Badge>
            </div>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Dados cadastrais</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Razão social" value={empresa.razao_social} />
                <Field label="Nome fantasia" value={empresa.nome_fantasia} />
                <Field label="CNPJ" value={maskCnpj(empresa.cnpj)} />
                <Field label="CNAE" value={empresa.cnae} />
                <Field label="Inscrição estadual" value={empresa.inscricao_estadual} />
                <Field label="Inscrição municipal" value={empresa.inscricao_municipal} />
              </dl>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Endereço</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="CEP" value={empresa.cep ? maskCep(empresa.cep) : null} />
                <Field label="Logradouro" value={endereco} />
                <Field label="Cidade" value={empresa.cidade} />
                <Field label="UF" value={empresa.uf} />
              </dl>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Contato</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Responsável" value={empresa.responsavel_nome} />
                <Field label="E-mail" value={empresa.email} />
                <Field
                  label="Telefone"
                  value={empresa.telefone ? maskTelefone(empresa.telefone) : null}
                />
              </dl>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Tomadores vinculados</h3>
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : !vinculos || vinculos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum tomador vinculado.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {vinculos.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.razao_social}</p>
                        <p className="text-xs text-muted-foreground">{maskCnpj(t.cnpj)}</p>
                      </div>
                      <Badge variant="outline" className="border-border text-xs">
                        {t.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {empresa.observacoes && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Observações</h3>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {empresa.observacoes}
                </p>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
