<script setup lang="ts">
const api = useApi()

const aba = ref<'negocio' | 'planos'>('negocio')
const resumo = ref<any>(null)
const planos = ref<any[]>([])
const recursos = ref<any[]>([])
const integracao = ref<any>({})
const carregando = ref(true)
const erro = ref('')
const recado = ref('')
const salvando = ref(false)

const semAcesso = ref(false)

const editando = ref<any>(null)
const abertos = ref<Record<string, boolean>>({})

const rotuloPlano: Record<string, string> = {
  teste: 'Em teste', ativo: 'Assinante',
  vencido: 'Vencida', cancelado: 'Cancelada'
}

function lerDinheiro(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null
  let t = String(v ?? '').trim().replace(/[R$\s]/gi, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

const precoLido = computed(() => lerDinheiro(editando.value?.preco))

const liberados = computed(() => {
  if (!editando.value) return 0
  return recursos.value.filter((r) => editando.value.recursos[r.chave] !== false).length
})

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const [r, p] = await Promise.all([
      api.get('/admin/resumo'),
      api.get('/admin/planos')
    ])
    resumo.value = r
    planos.value = p?.planos ?? []
    recursos.value = p?.recursos ?? []
    integracao.value = p ?? {}
  } catch (e: any) {
    if (String(e.message).includes('restrita')) semAcesso.value = true
    else erro.value = e.message
  } finally {
    carregando.value = false
  }
}

function novoPlano() {
  const tudo: Record<string, boolean> = {}
  for (const r of recursos.value) tudo[r.chave] = true
  editando.value = {
    id: null, nome: '', descricao: '', preco: '',
    dias_teste: 14, max_pessoas: 2, recursos: tudo,
    publico: true, ativo: true, ordem: planos.value.length + 1
  }
  abertos.value.funcoes = true
}

function editar(p: any) {
  const r: Record<string, boolean> = {}
  for (const x of recursos.value) r[x.chave] = p.recursos?.[x.chave] !== false
  editando.value = {
    id: p.id, nome: p.nome, descricao: p.descricao ?? '',
    preco: String(p.preco).replace('.', ','),
    dias_teste: p.dias_teste, max_pessoas: p.max_pessoas,
    recursos: r, publico: p.publico, ativo: p.ativo, ordem: p.ordem,
    mp_plan_id: p.mp_plan_id
  }
  abertos.value.funcoes = false
}

async function salvar() {
  erro.value = ''
  if (!editando.value.nome.trim()) { erro.value = 'Dê um nome ao plano.'; return }
  if (precoLido.value === null && Number(editando.value.preco) !== 0) {
    erro.value = 'Escreva o preço, algo como 19,90.'; return
  }

  // mexer no preço de um plano com assinantes altera cobranças de verdade
  const original = planos.value.find((x) => x.id === editando.value.id)
  const mudouPreco = original && Number(original.preco) !== Number(precoLido.value ?? 0)
  if (mudouPreco && original.assinantes > 0) {
    const ok = confirm(
      `"${original.nome}" tem ${original.assinantes} assinante(s).\n\n` +
      `Mudar de ${dinheiro(original.preco)} para ${dinheiro(precoLido.value ?? 0)} ` +
      `altera o que eles pagam nas próximas cobranças.\n\nConfirma?`)
    if (!ok) return
  }

  salvando.value = true
  const corpo = {
    nome: editando.value.nome.trim(),
    descricao: editando.value.descricao || null,
    preco: precoLido.value ?? 0,
    dias_teste: Number(editando.value.dias_teste),
    max_pessoas: Number(editando.value.max_pessoas),
    recursos: editando.value.recursos,
    publico: editando.value.publico,
    ativo: editando.value.ativo,
    ordem: Number(editando.value.ordem)
  }
  try {
    if (editando.value.id) await api.patch(`/admin/planos/${editando.value.id}`, corpo)
    else await api.post('/admin/planos', corpo)

    recado.value = 'Plano guardado. O preço já vale para as próximas compras.'

    editando.value = null
    await carregar()
    setTimeout(() => (recado.value = ''), 4000)
  } catch (e: any) { erro.value = e.message }
  salvando.value = false
}

async function apagar(p: any) {
  if (!confirm(`Apagar o plano "${p.nome}"?`)) return
  try {
    await api.remove(`/admin/planos/${p.id}`)
    await carregar()
  } catch (e: any) { erro.value = e.message }
}

async function moverCasa(casa: any, planoId: string) {
  if (!planoId || planoId === casa.plano_id) return
  try {
    await api.post(`/admin/casas/plano/${casa.id}`, { plano_id: planoId })
    recado.value = 'Plano trocado.'
    await carregar()
    setTimeout(() => (recado.value = ''), 3000)
  } catch (e: any) { erro.value = e.message }
}

const prazo = ref<any>(null)
const dataPrazo = ref('')
const salvandoPrazo = ref(false)

function abrirPrazo(casa: any) {
  prazo.value = casa
  dataPrazo.value = String(casa.valido_ate ?? '').slice(0, 10) || hojeISO()
  erro.value = ''
}

async function mexerPrazo(corpo: any, aviso: string) {
  if (!prazo.value) return
  salvandoPrazo.value = true
  try {
    const r = await api.post(`/admin/casas/estender/${prazo.value.id}`, corpo)
    recado.value = `${aviso} Vale até ${dataBr(r.valido_ate)}.`
    prazo.value = null
    await carregar()
    setTimeout(() => (recado.value = ''), 4000)
  } catch (e: any) { erro.value = e.message }
  salvandoPrazo.value = false
}

const somar = (d: number) =>
  mexerPrazo({ dias: d }, `${d} dia(s) somados.`)

const tirar = (d: number) =>
  mexerPrazo({ dias: -d }, `${d} dia(s) retirados.`)

const fixarData = () =>
  mexerPrazo({ ate: dataPrazo.value }, 'Prazo definido.')

async function encerrarAgora() {
  if (!confirm(`Encerrar o acesso de "${prazo.value.nome}" hoje?\n\n`
    + 'A família continua vendo tudo o que registrou, mas para de lançar.')) return
  await mexerPrazo({ encerrar: true }, 'Acesso encerrado.')
}

function copiar(texto: string) {
  navigator.clipboard?.writeText(texto)
  recado.value = 'Copiado.'
  setTimeout(() => (recado.value = ''), 2000)
}

onMounted(carregar)
</script>

<template>
  <div>
    <div class="topo">
      <h1>Administração</h1>
      <p>O negócio por trás do Sow Well.</p>
    </div>

    <div v-if="semAcesso" class="cartao vazio">
      <div class="simbolo"><i class="mi">lock</i></div>
      Esta área é do administrador da plataforma.
    </div>

    <template v-else>
      <div v-if="recado" class="aviso bem" style="margin-bottom:14px">{{ recado }}</div>
      <div v-if="erro" class="aviso mal entre" style="margin-bottom:14px">
        <span>{{ erro }}</span>
        <button class="btn claro mini" @click="carregar">Tentar de novo</button>
      </div>

      <div class="linha-flex" style="margin-bottom:16px">
        <button class="btn mini" :class="aba === 'negocio' ? '' : 'claro'"
                @click="aba = 'negocio'">Clientes</button>
        <button class="btn mini" :class="aba === 'planos' ? '' : 'claro'"
                @click="aba = 'planos'">Planos</button>
      </div>

      <div v-if="carregando" class="vazio">Consultando…</div>

      <!-- ================= CLIENTES ================= -->
      <template v-else-if="aba === 'negocio' && resumo">
        <div class="grade g4" style="margin-bottom:16px">
          <div class="cartao">
            <div class="rotulo">Assinantes</div>
            <div class="selo-valor entrada">{{ resumo.ativas }}</div>
          </div>
          <div class="cartao">
            <div class="rotulo">Em teste</div>
            <div class="selo-valor">{{ resumo.em_teste }}</div>
          </div>
          <div class="cartao">
            <div class="rotulo">Receita prevista</div>
            <div class="selo-valor entrada">{{ dinheiro(resumo.receita_prevista) }}</div>
            <div class="pequeno mudo">por mês, com os assinantes de hoje</div>
          </div>
          <div class="cartao">
            <div class="rotulo">Recebido no mês</div>
            <div class="selo-valor">{{ dinheiro(resumo.recebido_no_mes) }}</div>
          </div>
        </div>

        <div class="cartao chapa">
          <div class="cartao-topo">
            <h2>Famílias cadastradas</h2>
            <span class="pequeno mudo">
              {{ resumo.total_casas }} no total · {{ resumo.vencidas }} vencida(s)
            </span>
          </div>
          <div class="tabela-rolagem">
            <table>
              <thead>
                <tr><th>Família</th><th>Plano</th><th>Situação</th>
                    <th>Válida até</th><th class="direita">Pessoas</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="c in resumo.casas" :key="c.id">
                  <td>
                    <strong>{{ c.nome }}</strong>
                    <div class="pequeno mudo">desde {{ dataBr(c.criado_em) }}</div>
                  </td>
                  <td style="min-width:150px">
                    <select :value="c.plano_id ?? ''" style="font-size:.8rem;padding:5px 8px"
                            @change="moverCasa(c, ($event.target as HTMLSelectElement).value)">
                      <option value="">— sem plano —</option>
                      <option v-for="p in planos" :key="p.id" :value="p.id">
                        {{ p.nome }}
                      </option>
                    </select>
                  </td>
                  <td>
                    <span class="eti" :class="c.em_dia
                      ? (c.plano === 'ativo' ? 'pago' : 'pendente')
                      : 'atrasado'">
                      {{ rotuloPlano[c.plano] ?? c.plano }}
                    </span>
                  </td>
                  <td class="num pequeno">
                    {{ dataBr(c.plano === 'teste' ? c.teste_ate : c.assinatura_ate) }}
                  </td>
                  <td class="direita num">{{ c.pessoas }}</td>
                  <td class="direita">
                    <button class="btn claro mini" @click="abrirPrazo(c)">Prazo</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
          <!-- mexer no prazo de uma família -->
    <div v-if="prazo" class="veu" @click.self="prazo = null">
      <div class="painel" style="max-width:460px">
        <div class="painel-topo">
          <h2>Prazo de {{ prazo.nome }}</h2>
          <button class="fechar" @click="prazo = null"><i class="mi">close</i></button>
        </div>

        <div class="painel-corpo">
          <div class="cartao" style="margin-bottom:18px">
            <div class="entre">
              <div>
                <div class="rotulo">Vale até</div>
                <div class="num" style="font-size:1.15rem">
                  {{ prazo.valido_ate ? dataBr(prazo.valido_ate) : 'sem prazo' }}
                </div>
              </div>
              <span class="eti" :class="prazo.em_dia ? 'pago' : 'atrasado'">
                {{ prazo.em_dia
                  ? (prazo.dias_restantes + ' dia(s)')
                  : 'vencida' }}
              </span>
            </div>
          </div>

          <div class="rotulo" style="margin-bottom:8px">Somar dias</div>
          <div class="linha-flex" style="flex-wrap:wrap;margin-bottom:18px">
            <button v-for="d in [7, 15, 30, 90, 365]" :key="'m' + d"
                    class="btn mini" :disabled="salvandoPrazo" @click="somar(d)">
              +{{ d }}
            </button>
          </div>

          <div class="rotulo" style="margin-bottom:8px">Tirar dias</div>
          <div class="linha-flex" style="flex-wrap:wrap;margin-bottom:18px">
            <button v-for="d in [7, 15, 30, 90]" :key="'t' + d"
                    class="btn claro mini" :disabled="salvandoPrazo" @click="tirar(d)">
              −{{ d }}
            </button>
          </div>

          <div class="rotulo" style="margin-bottom:8px">Ou definir a data</div>
          <div class="linha-flex" style="margin-bottom:18px">
            <input v-model="dataPrazo" type="date" />
            <button class="btn mini" :disabled="salvandoPrazo" @click="fixarData">
              Definir
            </button>
          </div>

          <div v-if="erro" class="aviso mal" style="margin-bottom:14px">{{ erro }}</div>

          <div class="aviso pequeno">
            Somar dias a uma família vencida conta a partir de hoje, não da
            data antiga — senão o acesso não voltaria.
          </div>
        </div>

        <div class="painel-pe" style="justify-content:space-between">
          <button class="btn risco mini" :disabled="salvandoPrazo" @click="encerrarAgora">
            Encerrar hoje
          </button>
          <button class="btn claro" @click="prazo = null">Fechar</button>
        </div>
      </div>
    </div>
</template>

      <!-- ================= PLANOS ================= -->
      <template v-else-if="aba === 'planos'">
        <!-- credencial -->
        <div class="cartao" style="margin-bottom:16px">
          <div class="entre">
            <div>
              <div class="rotulo">Credencial do Mercado Pago</div>
              <div v-if="integracao.token_configurado && integracao.token_producao"
                   class="entrada" style="font-weight:600;margin-top:4px">
                Produção configurada no servidor
              </div>
              <div v-else-if="integracao.token_configurado" class="saida"
                   style="font-weight:600;margin-top:4px">
                A credencial não é de produção — cobranças reais não funcionam
              </div>
              <div v-else class="saida" style="font-weight:600;margin-top:4px">
                Sem credencial — ninguém consegue assinar
              </div>
              <div class="pequeno mudo" style="margin-top:4px">
                Troca-se em Supabase → Edge Functions → Secrets → MP_ACCESS_TOKEN
              </div>
              <div class="pequeno mudo" style="margin-top:6px">
                Cobrança avulsa mensal — Pix, boleto e cartão. Sem renovação
                automática: o cliente é avisado por e-mail 3, 2 e 1 dia antes.
              </div>
            </div>
            <button class="btn claro mini" @click="copiar(integracao.webhook_url)">
              Copiar aviso de pagamento
            </button>
          </div>
        </div>

        <div class="entre" style="margin-bottom:14px">
          <h2>Planos oferecidos</h2>
          <button class="btn" @click="novoPlano"><i class="mi">add</i>Novo plano</button>
        </div>

        <div v-if="!planos.length" class="cartao vazio">
          Nenhum plano criado ainda.
        </div>

        <div v-else class="grade g2 larga">
          <div v-for="p in planos" :key="p.id" class="cartao"
               :style="p.ativo ? '' : 'opacity:.55'">
            <div class="entre">
              <div>
                <h3>
                  {{ p.nome }}
                  <span v-if="!p.publico" class="eti cancelado">oculto</span>
                  <span v-if="!p.ativo" class="eti cancelado">desativado</span>
                </h3>
                <div class="pequeno mudo">{{ p.descricao || 'Sem descrição' }}</div>
              </div>
              <div class="direita">
                <div class="selo-valor" style="font-size:1.3rem">{{ dinheiro(p.preco) }}</div>
                <div class="pequeno mudo">por mês</div>
              </div>
            </div>

            <div class="grade g3" style="margin-top:14px">
              <div>
                <div class="rotulo">Pessoas</div>
                <div class="num">{{ p.max_pessoas }}</div>
              </div>
              <div>
                <div class="rotulo">Teste grátis</div>
                <div class="num">{{ p.dias_teste }} dias</div>
              </div>
              <div>
                <div class="rotulo">Assinantes</div>
                <div class="num">{{ p.assinantes }}</div>
              </div>
            </div>

            <div style="margin-top:12px">
              <div class="rotulo" style="margin-bottom:6px">Inclui</div>
              <div class="linha-flex" style="flex-wrap:wrap;gap:5px">
                <span v-for="r in recursos" :key="r.chave" class="eti"
                      :class="p.recursos?.[r.chave] !== false ? 'pago' : 'cancelado'">
                  {{ r.nome }}
                </span>
              </div>
            </div>

            <div v-if="Number(p.preco) < 1" class="pequeno saida" style="margin-top:12px">
              O Mercado Pago não aceita menos de R$ 1,00 — ninguém consegue pagar
            </div>

            <div class="linha-flex" style="margin-top:14px;flex-wrap:wrap">
              <button class="btn claro mini" @click="editar(p)">Editar</button>
              <button v-if="!p.assinantes" class="btn risco mini" @click="apagar(p)">
                Apagar
              </button>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- ================= EDITOR DE PLANO ================= -->
    <div v-if="editando" class="veu" @click.self="editando = null">
      <div class="painel" style="max-width:580px">
        <div class="painel-topo">
          <h2>{{ editando.id ? 'Editar plano' : 'Novo plano' }}</h2>
          <button class="fechar" @click="editando = null"><i class="mi">close</i></button>
        </div>

        <div class="painel-corpo">
          <div class="campo">
            <label>Nome do plano</label>
            <input v-model="editando.nome" placeholder="Família, Essencial, Completo…" />
          </div>

          <div class="campo">
            <label>Descrição <span class="mudo">(o cliente vê)</span></label>
            <input v-model="editando.descricao" placeholder="Todas as funções, para a família toda." />
          </div>

          <div class="grade g3">
            <div class="campo">
              <label>Preço por mês</label>
              <input v-model="editando.preco" inputmode="decimal" placeholder="19,90" />
              <div v-if="precoLido !== null" class="pequeno mudo" style="margin-top:4px">
                {{ dinheiro(precoLido) }}
              </div>
            </div>
            <div class="campo">
              <label>Pessoas na casa</label>
              <input v-model="editando.max_pessoas" type="number" min="1" max="50" />
            </div>
            <div class="campo">
              <label>Dias de teste</label>
              <input v-model="editando.dias_teste" type="number" min="0" max="365" />
            </div>
          </div>

          <!-- retrátil: funcionalidades -->
          <div class="gaveta">
            <button class="gaveta-topo" @click="abertos.funcoes = !abertos.funcoes">
              <span>
                <strong>Funcionalidades liberadas</strong>
                <span class="pequeno mudo"> — {{ liberados }} de {{ recursos.length }}</span>
              </span>
              <span class="seta" :class="{ aberta: abertos.funcoes }">›</span>
            </button>

            <div v-if="abertos.funcoes" class="gaveta-corpo">
              <label v-for="r in recursos" :key="r.chave" class="opcao">
                <input type="checkbox"
                       :checked="editando.recursos[r.chave] !== false"
                       @change="editando.recursos[r.chave] = ($event.target as HTMLInputElement).checked" />
                <span>
                  <strong>{{ r.nome }}</strong>
                  <span class="pequeno mudo"> — {{ r.texto }}</span>
                </span>
              </label>
            </div>
          </div>

          <div class="grade g2" style="margin-top:14px">
            <label class="opcao">
              <input v-model="editando.publico" type="checkbox" />
              <span>Aparece para novos clientes</span>
            </label>
            <label class="opcao">
              <input v-model="editando.ativo" type="checkbox" />
              <span>Plano ativo</span>
            </label>
          </div>

          <div class="aviso pequeno" style="margin-top:14px">
            O preço vale a partir da próxima compra. Quem já pagou o mês
            corrente não é afetado.
          </div>
        </div>

        <div class="painel-pe">
          <button class="btn claro" @click="editando = null">Cancelar</button>
          <button class="btn" :disabled="salvando" @click="salvar">
            {{ salvando ? 'Guardando…' : 'Guardar plano' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gaveta {
  border: 1px solid var(--linha); border-radius: 8px;
  overflow: hidden; margin-top: 4px;
}
.gaveta-topo {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  background: var(--papel); border: 0; padding: 12px 14px;
  font: inherit; font-size: .9rem; text-align: left; cursor: pointer;
}
.gaveta-topo:hover { background: #E7EBE4; }
.seta { transition: transform .18s; display: inline-block; font-size: 1.2rem; color: var(--tinta-45); }
.seta.aberta { transform: rotate(90deg); }
.gaveta-corpo { padding: 12px 14px; display: grid; gap: 10px; background: var(--carta); }

.opcao {
  display: flex; align-items: flex-start; gap: 9px;
  margin: 0; cursor: pointer; font-weight: 400; font-size: .88rem;
  color: var(--tinta);
}
.opcao input { width: auto; margin: 2px 0 0; flex: 0 0 auto; }

@media (prefers-reduced-motion: reduce) { .seta { transition: none; } }
</style>
