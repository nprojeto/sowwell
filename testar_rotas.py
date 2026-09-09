"""
Teste de fumaça do servidor Sow Well.

Monta um Supabase de mentira e chama TODAS as rotas de verdade.
Qualquer "x is not defined" aparece aqui em segundos, em vez de
aparecer para o usuário na tela.

    python3 testar_rotas.py

Fica no repositório de propósito: é a rede que pega substituição de
código aplicada pela metade, que o TypeScript não acusa.
"""
import re, subprocess, pathlib, json, sys, tempfile, os

AQUI = pathlib.Path(__file__).resolve().parent
ORIGEM = AQUI / 'api.index.ts'
if not ORIGEM.exists():
    ORIGEM = AQUI.parent / 'api.index.ts'

codigo = ORIGEM.read_text()
codigo = re.sub(r'^import .*?from "https://[^"]+";?\s*$', '', codigo, flags=re.M)
codigo = re.sub(r'^\s*(?:Deno\.)?serve\(', 'export const atender = (', codigo, flags=re.M)

STUBS = '''
const Deno = { env: { get: (k) => ({
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "srv",
  BREVO_API_KEY: "b", BREVO_SENDER: "a@b.c", BREVO_SENDER_NOME: "S",
  CRON_SECRET: "s", SITE_URL: "https://s", MP_ACCESS_TOKEN: "APP_USR-x",
  PRECO_MENSAL: "12.42",
}[k]) } };

// Uma linha plausível para qualquer tabela, para as rotas rodarem de
// verdade em vez de sair pela porta dos fundos na primeira checagem.
const LINHA = {
  id: "1", conta_id: "c1", plano_id: "p1", cartao_id: "k1", categoria_id: "g1",
  nome: "Teste", email: "a@b.c", papel: "dono", plataforma: true,
  plano: "ativo", ativo: true, publico: true, tipo: "despesa",
  valor: 10, valor_total: 10, valor_parcela: 10, valor_pago: 10, preco: 12.42,
  total: 10, saldo: 10, limite: 100, valor_recarga: 100,
  dia_fechamento: 5, dia_vencimento: 10, dia_recarga: 1, dias_teste: 7,
  max_pessoas: 4, parcelas: 1, numero: 1, meses: 1, acumula: false,
  data: "2026-09-05", data_compra: "2026-09-05", vencimento: "2026-10-05",
  competencia: "2026-09-01", criado_em: "2026-08-01T10:00:00Z",
  teste_ate: "2026-10-05", assinatura_ate: "2026-10-05",
  data_pagamento: "2026-09-05", status: "pendente", forma: "dinheiro",
  origem_saida: "caixa", recursos: {}, cor: "#FF8A00", ultimos4: "1234",
  chave: "limite_diario", expira_em: "2099-01-01T00:00:00Z",
  codigo_hash: "z", tentativas: 0, dados: {}, itens: 1, ordem: 0, sou_dono: true,
};

function tabelaFalsa() {
  let unico = false;
  const eu = {
    select: () => eu, insert: () => eu, update: () => eu, delete: () => eu,
    upsert: () => eu, eq: () => eu, neq: () => eu, gt: () => eu, gte: () => eu,
    lt: () => eu, lte: () => eu, is: () => eu, in: () => eu, or: () => eu,
    ilike: () => eu, like: () => eu, order: () => eu, limit: () => eu,
    range: () => eu,
    single: () => { unico = true; return eu; },
    maybeSingle: () => { unico = true; return eu; },
    then: (ok) => ok({ data: unico ? { ...LINHA } : [{ ...LINHA }],
                       error: null, count: 1 }),
  };
  return eu;
}

globalThis.fetch = async () => new Response(
  JSON.stringify({ id: "x", init_point: "https://mp", status: "approved",
                   results: [], external_reference: "1" }),
  { status: 200, headers: { "content-type": "application/json" } });

const clienteFalso = {
  from: () => tabelaFalsa(),
  rpc: async () => ({ data: null, error: null }),
  auth: {
    getUser: async () => ({ data: { user: { id: "u1", email: "a@b.c" } }, error: null }),
    admin: {
      createUser: async () => ({ data: { user: { id: "u2" } }, error: null }),
      updateUserById: async () => ({ data: {}, error: null }),
    },
  },
};
const createClient = () => clienteFalso;
'''

destino = pathlib.Path(tempfile.gettempdir())
(destino / 'sw_teste.ts').write_text(STUBS + codigo)

r = subprocess.run(
    ['npx', '--yes', 'esbuild@0.23.0', str(destino / 'sw_teste.ts'), '--bundle',
     '--platform=node', '--format=cjs', f'--outfile={destino}/sw_teste.cjs'],
    capture_output=True, text=True)
if r.returncode != 0:
    print('NAO COMPILOU:'); print(r.stderr[:1500]); sys.exit(1)

ROTAS = [
    ('GET', '/versao'), ('GET', '/'),
    ('GET', '/conta'), ('PATCH', '/conta'),
    ('GET', '/convites'), ('POST', '/convites'),
    ('GET', '/planos'),
    ('GET', '/assinatura'), ('GET', '/assinatura/pagamentos'),
    ('POST', '/assinatura/checkout'), ('POST', '/assinatura/sincronizar'),
    ('GET', '/avisos'),
    ('GET', '/dash?dias=30'), ('GET', '/dash?de=2026-09-01&ate=2026-09-09'),
    ('GET', '/categorias'), ('POST', '/categorias'),
    ('GET', '/compromissos'), ('POST', '/compromissos'),
    ('GET', '/calendario?mes=2026-09'),
    ('GET', '/ocorrencias'), ('PATCH', '/ocorrencias/pagar/1'),
    ('GET', '/reservas'), ('POST', '/reservas/movimentos'),
    ('GET', '/cartoes'), ('POST', '/cartoes'),
    ('GET', '/faturas'), ('POST', '/faturas/pagar'), ('POST', '/faturas/desfazer'),
    ('GET', '/gastos'), ('POST', '/gastos'), ('POST', '/gastos/interpretar'),
    ('GET', '/moderando'), ('GET', '/moderando?mes=2026-09'),
    ('GET', '/resumo?mes=2026-09'), ('GET', '/resumo'),
    ('GET', '/config'), ('PATCH', '/config'),
    ('POST', '/acesso/codigo'), ('POST', '/acesso/confirmar'),
    ('GET', '/admin/resumo'), ('GET', '/admin/recursos'),
    ('GET', '/admin/planos'), ('POST', '/admin/planos'),
    ('POST', '/admin/casas/estender/1'),
    ('POST', '/webhook/mercadopago'),
]

runner = f'''
const mod = require('{destino}/sw_teste.cjs');
const atender = mod.atender || mod.default;
const rotas = {json.dumps(ROTAS)};

(async () => {{
  const falhas = [];
  for (const [metodo, rota] of rotas) {{
    const req = new Request('https://x.supabase.co/api' + rota, {{
      method: metodo,
      headers: {{ authorization: 'Bearer t', 'content-type': 'application/json',
                 'x-cron-secret': 's' }},
      body: metodo === 'GET' ? undefined : JSON.stringify({{
        nome: 'x', email: 'a@b.c', codigo: '123456', senha: '12345678',
        valor: 10, valor_pago: 10, data: '2026-09-05', forma: 'dinheiro',
        texto: 'mercado 50 no debito', dia_fechamento: 5, dia_vencimento: 10,
        tipo: 'despesa', cartao_id: 'k1', competencia: '2026-09-01',
        limite_diario: '90', dias: 30,
      }}),
    }});
    try {{
      const resp = await atender(req);
      const txt = await resp.text();
      if (/is not defined|is not a function|Cannot read/.test(txt)) {{
        falhas.push(`${{metodo}} ${{rota}} -> ${{txt.slice(0, 160)}}`);
      }}
    }} catch (e) {{
      falhas.push(`${{metodo}} ${{rota}} -> ${{String(e).slice(0, 160)}}`);
    }}
  }}
  if (falhas.length) {{
    console.log('ROTAS COM ERRO:');
    falhas.forEach((f) => console.log('  -', f));
    process.exit(1);
  }}
  console.log(`Todas as ${{rotas.length}} rotas responderam sem erro de codigo.`);
}})();
'''
(destino / 'sw_roda.cjs').write_text(runner)
r = subprocess.run(['node', str(destino / 'sw_roda.cjs')], capture_output=True, text=True)
print(r.stdout or r.stderr[:2000])
sys.exit(r.returncode)
