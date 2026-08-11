/**
 * Leitor de planilhas .xls antigas (BIFF8) geradas por sistemas de folha que
 * gravam offsets inválidos no cabeçalho e por isso não são lidas pela
 * biblioteca padrão. Extrai apenas os valores das células (texto e números).
 */

interface Registro {
  id: number;
  data: Uint8Array;
}

function lerRegistros(bytes: Uint8Array): Registro[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const registros: Registro[] = [];
  let i = 0;
  while (i + 4 <= bytes.length) {
    const id = view.getUint16(i, true);
    const size = view.getUint16(i + 2, true);
    if (i + 4 + size > bytes.length) break;
    registros.push({ id, data: bytes.subarray(i + 4, i + 4 + size) });
    i += 4 + size;
  }
  return registros;
}

function dv(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function lerSst(registros: Registro[], indice: number): string[] {
  const partes: Uint8Array[] = [registros[indice].data];
  for (let j = indice + 1; j < registros.length && registros[j].id === 0x3c; j += 1) {
    partes.push(registros[j].data);
  }
  const total = dv(partes[0]).getUint32(4, true);
  const strings: string[] = [];
  let chunk = 0;
  let buf = partes[chunk];
  let pos = 8;

  while (strings.length < total && chunk < partes.length) {
    if (pos + 3 > buf.length) {
      if (chunk + 1 >= partes.length) break;
      chunk += 1;
      buf = partes[chunk];
      pos = 0;
      continue;
    }
    let view = dv(buf);
    const cch = view.getUint16(pos, true);
    const grbit = buf[pos + 2];
    pos += 3;
    let alto = (grbit & 1) === 1;
    const rico = (grbit & 8) === 8;
    const estendido = (grbit & 4) === 4;
    let runs = 0;
    let extra = 0;
    if (rico) {
      runs = view.getUint16(pos, true);
      pos += 2;
    }
    if (estendido) {
      extra = view.getUint32(pos, true);
      pos += 4;
    }

    let texto = "";
    let lidos = 0;
    while (lidos < cch) {
      if (pos >= buf.length) {
        if (chunk + 1 >= partes.length) break;
        chunk += 1;
        buf = partes[chunk];
        view = dv(buf);
        alto = (buf[0] & 1) === 1;
        pos = 1;
      }
      if (alto) {
        texto += String.fromCharCode(view.getUint16(pos, true));
        pos += 2;
      } else {
        texto += String.fromCharCode(buf[pos]);
        pos += 1;
      }
      lidos += 1;
    }
    pos += runs * 4 + extra;
    strings.push(texto);
  }
  return strings;
}

function lerRk(valor: number): number {
  const inteiro = (valor & 2) === 2;
  const centavos = (valor & 1) === 1;
  let numero: number;
  if (inteiro) {
    numero = valor >> 2;
  } else {
    const temp = new ArrayBuffer(8);
    new DataView(temp).setInt32(4, valor & ~3, true);
    numero = new DataView(temp).getFloat64(0, true);
  }
  return centavos ? numero / 100 : numero;
}

/** Lê um .xls legado e retorna uma matriz de valores por planilha. */
export async function lerMatrizesLegado(buffer: ArrayBuffer): Promise<unknown[][][]> {
  const modulo = (await import("xlsx")) as any;
  const XLSX = modulo.default ?? modulo;
  const cfb = XLSX.CFB.read(new Uint8Array(buffer), { type: "array" });
  const stream = XLSX.CFB.find(cfb, "Workbook") ?? XLSX.CFB.find(cfb, "Book");
  if (!stream?.content) return [];
  const bytes = new Uint8Array(stream.content as ArrayLike<number>);
  const registros = lerRegistros(bytes);

  const indiceSst = registros.findIndex((r) => r.id === 0xfc);
  const sst = indiceSst >= 0 ? lerSst(registros, indiceSst) : [];

  const planilhas: unknown[][][] = [];
  registros.forEach((registro, indice) => {
    if (registro.id !== 0x809 || registro.data.length < 4) return;
    if (dv(registro.data).getUint16(2, true) !== 0x0010) return;

    const linhas: unknown[][] = [];
    const set = (linha: number, coluna: number, valor: unknown) => {
      if (!linhas[linha]) linhas[linha] = [];
      linhas[linha][coluna] = valor;
    };

    for (let i = indice + 1; i < registros.length; i += 1) {
      const atual = registros[i];
      if (atual.id === 0x0a) break;
      const view = dv(atual.data);
      if (atual.id === 0xfd && atual.data.length >= 10) {
        set(view.getUint16(0, true), view.getUint16(2, true), sst[view.getUint32(6, true)] ?? "");
      } else if (atual.id === 0x203 && atual.data.length >= 14) {
        set(view.getUint16(0, true), view.getUint16(2, true), view.getFloat64(6, true));
      } else if (atual.id === 0x27e && atual.data.length >= 10) {
        set(view.getUint16(0, true), view.getUint16(2, true), lerRk(view.getInt32(6, true)));
      } else if (atual.id === 0xbd && atual.data.length >= 6) {
        const linha = view.getUint16(0, true);
        const primeira = view.getUint16(2, true);
        const quantidade = Math.floor((atual.data.length - 6) / 6);
        for (let k = 0; k < quantidade; k += 1) {
          set(linha, primeira + k, lerRk(view.getInt32(4 + k * 6 + 2, true)));
        }
      }
    }

    planilhas.push(linhas.map((linha) => Array.from(linha ?? [], (v) => v ?? "")));
  });

  return planilhas;
}
