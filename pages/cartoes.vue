<script setup lang="ts">
const { bloqueado, conferindo } = useBloqueio('cartoes')
const api = useApi()

const cartoes = ref<any[]>([])
const faturas = ref<any[]>([])
const carregando = ref(true)
const abrindo = ref(false)
const erro = ref('')
const detalhe = ref<any>(null)

const vazio = () => ({
  id: null as string | null, nome: '', ultimos4: '', tipo: 'credito',
  dia_fechamento: 25, dia_vencimento: 5, limite: '', cor: '#0A4E91',
  dia_recarga: 1, valor_recarga: '', acumula: false,
  padrao: false, observacao: ''
})
const form = ref(vazio())

const deCredito = computed(() => cartoes.value.filter((c) => c.tipo !== 'beneficio'))
const deBeneficio = computed(() => cartoes.value.filter((c) => c.tipo === 'beneficio'))

const totalSaldoVale = computed(() =>
  deBeneficio.value.reduce((s, c) => s + Number(c.saldo || 0), 0))

const totalAberto = computed(() =>
  cartoes.value.reduce((s, c) => s + Number(c.total_aberta || 0), 0))

const quitando = ref<any>(null)
const dataQuitacao = ref(hojeISO())
const salvandoQuitacao = ref(false)

function abrirQuitacao(c: any, qual: 'fechada' | 'aberta') {
  const comp = qual === 'fechada' ? c.competencia_fechada : c.competencia_aberta
  quitando.value = {
    cartao: c, qual, competencia: comp,
    valor: qual === 'fechada' ? c.total_fechada : c.total_aberta,
    vencimento: qual === 'fechada' ? c.vencimento_fechada : c.vencimento_aberta,
  }
  dataQuitacao.value = hojeISO()
  erro.value = ''
}

async function quitar() {
  if (!quitando.value) return
  salvandoQuitacao.value = true
  try {
    await api.post('/faturas/pagar', {
      cartao_id: quitando.value.cartao.id,
      competencia: quitando.value.competencia,
      data_pagamento: dataQuitacao.value,
    })
    quitando.value = null
    await carregar()
  } catch (e: any) { erro.value = e.message }
  salvandoQuitacao.value = false
}

async function desfazerQuitacao(c: any) {
  if (!confirm(`Desfazer o pagamento da fatura de ${c.nome}?`)) return
  try {
    await api.post('/faturas/desfazer', {
      cartao_id: c.id, competencia: c.competencia_fechada,
    })
    await carregar()
  } catch (e: any) { erro.value = e.message }
}

const totalFechado = computed(() =>
  cartoes.value.reduce((s, c) => s + Number(c.total_fechada || 0), 0))

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const r = await api.get('/faturas')
    cartoes.value = r?.cartoes ?? []
    faturas.value = r?.faturas ?? []
  } catch (e: any) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

function novo() { form.value = vazio(); erro.value = ''; abrindo.value = true }

function editar(c: any) {
  form.value = {
    ...vazio(),
    id: c.id, nome: c.nome, ultimos4: c.ultimos4, tipo: c.tipo ?? 'credito',
    dia_fechamento: c.dia_fechamento ?? 25,
    dia_vencimento: c.dia_vencimento ?? 5,
    dia_recarga: c.dia_recarga ?? 1,
    valor_recarga: c.valor_recarga ? String(c.valor_recarga).replace('.', ',') : '',
    acumula: !!c.acumula,
    limite: c.limite ?? '', cor: c.cor, padrao: !!c.padrao, observacao: c.observacao ?? ''
  }
  erro.value = ''
  abrindo.value = true
}

function lerDinheiro(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null
  let t = String(v ?? '').trim().replace(/[R$\s]/gi, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

const ehVale = computed(() => form.value.tipo === 'beneficio')

async function salvar() {
  erro.value = ''
  if (!form.value.nome.trim()) { erro.value = 'Dê um nome ao cartão.'; return }
  if (!/^\d{4}$/.test(String(form.value.ultimos4))) {
    erro.value = 'Os 4 últimos dígitos são obrigatórios (só números).'; return
  }
  if (ehVale.value) {
    if (!Number(form.value.dia_recarga)) {
      erro.value = 'Informe o dia em que o saldo entra.'; return
    }
    if (lerDinheiro(form.value.valor_recarga) === null) {
      erro.value = 'Informe quanto entra a cada recarga.'; return
    }
  } else {
    if (!Number(form.value.dia_fechamento)) {
      erro.value = 'Informe o dia em que a fatura vira.'; return
    }
    if (!Number(form.value.dia_vencimento)) {
      erro.value = 'Informe o dia de vencimento da fatura.'; return
    }
  }

  const corpo: any = {
    nome: form.value.nome.trim(),
    ultimos4: String(form.value.ultimos4),
    tipo: form.value.tipo,
    limite: form.value.limite ? Number(form.value.limite) : null,
    cor: form.value.cor,
    padrao: ehVale.value ? false : !!form.value.padrao,
    observacao: form.value.observacao || null
  }
  if (ehVale.value) {
    corpo.dia_recarga = Number(form.value.dia_recarga)
    corpo.valor_recarga = lerDinheiro(form.value.valor_recarga)
    corpo.acumula = !!form.value.acumula
  } else {
    corpo.dia_fechamento = Number(form.value.dia_fechamento)
    corpo.dia_vencimento = Number(form.value.dia_vencimento)
  }
  try {
    if (form.value.id) await api.patch(`/cartoes/${form.value.id}`, corpo)
    else await api.post('/cartoes', corpo)
    abrindo.value = false
    await carregar()
  } catch (e: any) { erro.value = e.message }
}

async function tornarPadrao(c: any) {
  await api.patch(`/cartoes/${c.id}`, { padrao: true })
  await carregar()
}

async function arquivar(c: any) {
  if (!confirm(`Arquivar o cartão "${c.nome}"? O histórico continua guardado.`)) return
  await api.remove(`/cartoes/${c.id}`)
  await carregar()
}

async function apagar(c: any) {
  if (!confirm(`Apagar "${c.nome}" DE VEZ? Só funciona se não houver gastos nele.`)) return
  try {
    await api.remove(`/cartoes/${c.id}?definitivo=1`)
    detalhe.value = null
    await carregar()
  } catch (e: any) { alert(e.message) }
}

function faturasDo(id: string) {
  return faturas.value
    .filter((f) => f.cartao_id === id)
    .sort((a, b) => String(a.competencia) < String(b.competencia) ? 1 : -1)
}

function rotuloComp(d: string) {
  const [a, m] = String(d).slice(0, 7).split('-')
  return `${MESES[Number(m) - 1]}/${a}`
}

onMounted(carregar)
</script>

<template>
  <div>
    <TelaTrancada v-if="bloqueado" chave="cartoes" />

    <div v-show="!bloqueado">
    <div class="topo entre">
      <div>
        <h1>Cartões</h1>
        <p>Cartões de crédito com fatura e vales-benefício com saldo.</p>
      </div>
      <button class="btn" @click="novo()"><i class="mi">add</i>Novo cartão</button>
    </div>

    <div v-if="erro && !abrindo" class="aviso mal entre" style="margin-bottom:16px">
      <span>{{ erro }}</span>
      <button class="btn claro mini" @click="carregar">Tentar de novo</button>
    </div>

    <div v-if="deBeneficio.length" class="cartao larga" style="margin-bottom:16px">
      <div class="rotulo">Saldo nos vales</div>
      <div class="selo-valor entrada">{{ dinheiro(totalSaldoVale) }}</div>
      <div class="pequeno mudo">dinheiro que já é seu, esperando ser usado</div>
    </div>

    <div v-if="deCredito.length" class="grade g2 larga" style="margin-bottom:16px">
      <div class="cartao">
        <div class="rotulo">A pagar nas faturas fechadas</div>
        <div class="selo-valor saida">{{ dinheiro(totalFechado) }}</div>
        <div class="pequeno mudo">já viraram, aguardando pagamento</div>
      </div>
      <div class="cartao">
        <div class="rotulo">Acumulando nas abertas</div>
        <div class="selo-valor">{{ dinheiro(totalAberto) }}</div>
        <div class="pequeno mudo">ainda dá para mudar de ideia</div>
      </div>
    </div>

    <div v-if="carregando" class="vazio">Consultando…</div>

    <div v-else-if="erro" class="cartao vazio">
      Não deu para consultar agora.
    </div>

    <div v-else-if="!cartoes.length" class="cartao vazio">
      <div class="simbolo"><i class="mi">credit_card</i></div>
      Nenhum cartão cadastrado. Cadastre um para lançar gastos no crédito.
    </div>

    <div v-else class="grade g2 larga">
      <div v-for="c in cartoes" :key="c.id" class="cartao"
           :style="{ borderTop: `3px solid ${c.cor}` }">
        <div class="entre">
          <div>
            <h3>{{ c.nome }}
              <span v-if="c.tipo === 'beneficio'" class="eti pago"
                    style="vertical-align:middle">vale</span>
              <span v-else-if="c.padrao" class="eti pago"
                    style="vertical-align:middle">principal</span>
            </h3>
            <div class="pequeno mudo num">•••• {{ c.ultimos4 }}</div>
          </div>
          <div class="direita pequeno mudo">
            <template v-if="c.tipo === 'beneficio'">
              <div>Entra dia {{ c.dia_recarga }}</div>
              <div>{{ c.acumula ? 'Acumula' : 'Não acumula' }}</div>
            </template>
            <template v-else>
              <div>Vira dia {{ c.dia_fechamento }}</div>
              <div>Vence dia {{ c.dia_vencimento }}</div>
            </template>
          </div>
        </div>

        <!-- vale-benefício: saldo do período -->
        <template v-if="c.tipo === 'beneficio'">
          <div class="rotulo" style="margin-top:14px">Saldo disponível</div>
          <div class="selo-valor" :class="c.estourou ? 'saida' : 'entrada'">
            {{ dinheiro(c.saldo) }}
          </div>

          <div class="barra-meta" style="margin-top:8px">
            <i :style="{
              width: Math.min(100, Math.max(0, (c.saldo / (c.disponivel_no_periodo || 1)) * 100)) + '%',
              background: c.estourou ? 'var(--saida)' : c.cor }"></i>
          </div>

          <div class="pequeno mudo" style="margin-top:8px;line-height:1.6">
            <div>
              Entrou <span class="num">{{ dinheiro(c.valor_recarga) }}</span>
              <span v-if="c.veio_do_periodo_anterior">
                + <span class="num">{{ dinheiro(c.veio_do_periodo_anterior) }}</span> que sobrou
              </span>
            </div>
            <div>Usou <span class="num">{{ dinheiro(c.gasto_no_periodo) }}</span> neste período</div>
            <div>Próxima recarga em {{ dataBr(c.proxima_recarga) }}</div>
          </div>

          <div v-if="c.estourou" class="aviso mal pequeno" style="margin-top:10px">
            Você gastou mais do que tinha no vale.
          </div>
          <div v-else-if="!c.acumula && c.saldo > 0" class="aviso pequeno" style="margin-top:10px">
            Sobram <strong>{{ dinheiro(c.saldo) }}</strong> que se perdem em
            {{ dataBr(c.proxima_recarga) }} — este vale não acumula.
          </div>
        </template>

        <!-- fatura que já virou e espera pagamento -->
        <div v-if="c.tipo !== 'beneficio' && c.tem_fechada" class="fatura fechada">
          <div class="entre">
            <span class="rotulo" style="color:#A32B30">Fatura fechada</span>
            <span class="eti atrasado">a pagar</span>
          </div>
          <div class="selo-valor saida">{{ dinheiro(c.total_fechada) }}</div>
          <div class="pequeno mudo">
            {{ c.itens_fechada }} lançamento(s) · vence em
            {{ dataBr(c.vencimento_fechada) }}
          </div>
          <button class="btn mini" style="margin-top:10px"
                  @click="abrirQuitacao(c, 'fechada')">
            <i class="mi">check</i>Dar baixa
          </button>
        </div>

        <!-- já quitada, mesmo antes do vencimento -->
        <div v-else-if="c.tipo !== 'beneficio' && c.fechada_paga" class="fatura quitada">
          <div class="entre">
            <span class="rotulo" style="color:#0A7038">Fatura anterior</span>
            <span class="eti pago">paga</span>
          </div>
          <div class="selo-valor entrada">{{ dinheiro(c.fechada_paga_valor) }}</div>
          <div class="pequeno mudo">
            Paga em {{ dataBr(c.fechada_paga_em) }}
            <button class="botao-texto" @click="desfazerQuitacao(c)">desfazer</button>
          </div>
        </div>

        <!-- fatura que ainda acumula -->
        <div v-if="c.tipo !== 'beneficio'" class="fatura"
             :style="c.tem_fechada ? 'margin-top:10px' : 'margin-top:14px'">
          <div class="rotulo">Fatura aberta</div>
          <div class="selo-valor" :class="c.tem_fechada ? 'mudo' : 'saida'">
            {{ dinheiro(c.total_aberta) }}
          </div>
          <div class="pequeno mudo">
            {{ c.itens_aberta }} lançamento(s) · vira em {{ dataBr(c.fecha_em) }}
            <span v-if="c.vencimento_aberta">· vence {{ dataBr(c.vencimento_aberta) }}</span>
          </div>
          <div v-if="c.aberta_paga" class="pequeno entrada" style="margin-top:6px">
            <strong>Já paga.</strong>
          </div>
          <button v-else-if="c.total_aberta" class="btn claro mini" style="margin-top:10px"
                  @click="abrirQuitacao(c, 'aberta')">
            Adiantar pagamento
          </button>
        </div>

        <div v-if="c.limite && c.tipo !== 'beneficio'" style="margin-top:10px">
          <div class="barra-meta">
            <i :style="{ width: Math.min(100, (c.total_aberta / c.limite) * 100) + '%',
                         background: c.cor }"></i>
          </div>
          <div class="pequeno mudo" style="margin-top:4px">
            Limite {{ dinheiro(c.limite) }}
          </div>
        </div>

        <div class="linha-flex" style="margin-top:14px;flex-wrap:wrap">
          <button class="btn claro mini" @click="detalhe = c">
            {{ c.tipo === 'beneficio' ? 'Histórico' : 'Faturas' }}
          </button>
          <button class="btn claro mini" @click="editar(c)">Editar</button>
          <button v-if="!c.padrao" class="btn claro mini" @click="tornarPadrao(c)">
            Tornar principal
          </button>
          <button class="btn risco mini" @click="arquivar(c)">Arquivar</button>
        </div>
      </div>
    </div>

    <!-- faturas do cartao -->
    <div v-if="detalhe" class="veu" @click.self="detalhe = null">
      <div class="painel">
        <div class="painel-topo">
          <h2>{{ detalhe.nome }} <span class="mudo num">••{{ detalhe.ultimos4 }}</span></h2>
          <button class="fechar" @click="detalhe = null"><i class="mi">close</i></button>
        </div>
        <div class="painel-corpo" style="padding:0">
          <!-- vale: períodos de recarga -->
          <table v-if="detalhe.tipo === 'beneficio'">
            <thead>
              <tr><th>Período</th><th class="direita">Entrou</th>
                  <th class="direita">Usou</th><th class="direita">Sobrou</th></tr>
            </thead>
            <tbody>
              <tr v-for="h in detalhe.historico" :key="h.periodo">
                <td class="num pequeno">{{ dataBr(h.periodo) }}</td>
                <td class="direita num entrada">
                  {{ dinheiro(h.recarga) }}
                  <div v-if="h.vindo_de_antes" class="pequeno mudo">
                    +{{ dinheiro(h.vindo_de_antes) }} antes
                  </div>
                </td>
                <td class="direita num saida">{{ dinheiro(h.gasto) }}</td>
                <td class="direita num" :class="h.sobra < 0 ? 'saida' : ''">
                  {{ dinheiro(h.sobra) }}
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else-if="!faturasDo(detalhe.id).length" class="vazio">
            Nenhuma fatura ainda.
          </div>
          <table v-else-if="detalhe.tipo !== 'beneficio'">
            <thead>
              <tr><th>Fatura</th><th>Vence</th><th class="direita">Itens</th>
                  <th class="direita">Total</th></tr>
            </thead>
            <tbody>
              <tr v-for="f in faturasDo(detalhe.id)" :key="f.competencia">
                <td style="text-transform:capitalize">{{ rotuloComp(f.competencia) }}</td>
                <td class="num pequeno">{{ dataBr(f.vencimento) }}</td>
                <td class="direita num pequeno">{{ f.itens }}</td>
                <td class="direita num saida">{{ dinheiro(f.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="painel-pe">
          <button class="btn risco" @click="apagar(detalhe)">Apagar cartão</button>
          <span class="espaco"></span>
          <NuxtLink to="/gastos" class="btn latao">Lançar gasto</NuxtLink>
        </div>
      </div>
    </div>

    <!-- formulario -->
    <div v-if="abrindo" class="veu" @click.self="abrindo = false">
      <div class="painel" style="max-width:470px">
        <div class="painel-topo">
          <h2>{{ form.id ? 'Editar cartão' : 'Novo cartão' }}</h2>
          <button class="fechar" @click="abrindo = false"><i class="mi">close</i></button>
        </div>
        <div class="painel-corpo">
          <div class="campo">
            <label>Que tipo de cartão é</label>
            <div class="linha-flex">
              <button class="btn mini" :class="form.tipo === 'credito' ? '' : 'claro'"
                      @click="form.tipo = 'credito'">
                <i class="mi">credit_card</i>Crédito
              </button>
              <button class="btn mini" :class="form.tipo === 'beneficio' ? '' : 'claro'"
                      @click="form.tipo = 'beneficio'">
                <i class="mi">card_giftcard</i>Vale-benefício
              </button>
            </div>
            <div class="pequeno mudo" style="margin-top:6px">
              {{ ehVale
                ? 'Caju, Ticket, VR, VA — tem saldo que entra na recarga.'
                : 'Tem fatura que fecha e vence.' }}
            </div>
          </div>

          <div class="dupla">
            <div class="campo">
              <label>Nome do cartão *</label>
              <input v-model="form.nome" placeholder="Nubank, Inter…" />
            </div>
            <div class="campo">
              <label>4 últimos dígitos *</label>
              <input v-model="form.ultimos4" maxlength="4" inputmode="numeric"
                     placeholder="1234" class="num" />
            </div>
          </div>

          <!-- crédito -->
          <template v-if="!ehVale">
            <div class="dupla">
              <div class="campo">
                <label>Dia que a fatura vira *</label>
                <input v-model="form.dia_fechamento" type="number" min="1" max="31" />
              </div>
              <div class="campo">
                <label>Dia do vencimento *</label>
                <input v-model="form.dia_vencimento" type="number" min="1" max="31" />
              </div>
            </div>

            <div class="aviso pequeno" style="margin-bottom:13px">
              Compras até o dia da virada entram na fatura do mês; depois disso,
              vão para a fatura seguinte. O aviso por e-mail chega no vencimento.
            </div>
          </template>

          <!-- vale-benefício -->
          <template v-else>
            <div class="dupla">
              <div class="campo">
                <label>Dia que o saldo entra *</label>
                <input v-model="form.dia_recarga" type="number" min="1" max="31" />
              </div>
              <div class="campo">
                <label>Quanto entra (R$) *</label>
                <input v-model="form.valor_recarga" inputmode="decimal" placeholder="800,00" />
              </div>
            </div>

            <div class="aviso" style="margin-bottom:13px">
              <label class="linha-flex" style="margin:0;cursor:pointer;font-weight:500">
                <input v-model="form.acumula" type="checkbox" style="width:auto;margin:0" />
                <span>
                  <strong>O saldo acumula.</strong>
                  O que sobrar de um período soma ao próximo, em vez de zerar.
                </span>
              </label>
            </div>
          </template>

          <div class="dupla">
            <div v-if="!ehVale" class="campo">
              <label>Limite (opcional)</label>
              <input v-model="form.limite" type="number" step="0.01" />
            </div>
            <div class="campo">
              <label>Cor</label>
              <input v-model="form.cor" type="color" style="height:40px;padding:3px" />
            </div>
          </div>

          <div class="campo">
            <label>Observação</label>
            <input v-model="form.observacao" />
          </div>

          <div v-if="!ehVale" class="aviso" style="margin-bottom:13px">
            <label class="linha-flex" style="margin:0;cursor:pointer;font-weight:500">
              <input v-model="form.padrao" type="checkbox" style="width:auto;margin:0" />
              <span>Este é meu cartão principal — quando eu falar “no crédito”
                sem dizer o nome, use este.</span>
            </label>
          </div>

          <div v-if="erro" class="aviso mal">{{ erro }}</div>
        </div>
        <div class="painel-pe">
          <button class="btn claro" @click="abrindo = false">Cancelar</button>
          <button class="btn" @click="salvar">Salvar</button>
        </div>
      </div>
    </div>
  </div>

    <!-- dar baixa na fatura -->
    <div v-if="quitando" class="veu" @click.self="quitando = null">
      <div class="painel">
        <div class="painel-topo">
          <h2>Dar baixa na fatura</h2>
          <button class="fechar" @click="quitando = null"><i class="mi">close</i></button>
        </div>

        <div class="painel-corpo">
          <div class="cartao" style="margin-bottom:16px">
            <div class="entre">
              <div>
                <strong>{{ quitando.cartao.nome }}</strong>
                <div class="pequeno mudo">
                  Fatura de {{ dataBr(quitando.competencia) }}
                </div>
              </div>
              <div class="direita">
                <div class="num saida" style="font-size:1.2rem">
                  {{ dinheiro(quitando.valor) }}
                </div>
                <div v-if="quitando.vencimento" class="pequeno mudo">
                  vence {{ dataBr(quitando.vencimento) }}
                </div>
              </div>
            </div>
          </div>

          <div class="campo">
            <label>Quando você pagou</label>
            <input v-model="dataQuitacao" type="date" :max="hojeISO()" />
          </div>

          <div v-if="quitando.vencimento && dataQuitacao < quitando.vencimento"
               class="aviso pequeno">
            Pagamento antecipado. O valor sai do caixa em
            {{ dataBr(dataQuitacao) }}, não no vencimento.
          </div>

          <div v-if="erro" class="aviso mal" style="margin-top:12px">{{ erro }}</div>
        </div>

        <div class="painel-pe">
          <button class="btn claro" @click="quitando = null">Cancelar</button>
          <button class="btn" :disabled="salvandoQuitacao" @click="quitar">
            {{ salvandoQuitacao ? 'Guardando…' : 'Confirmar pagamento' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fatura.quitada {
  background: var(--entrada-fraco); border: 1px solid #BEE8D1;
  border-radius: 11px; padding: 11px 13px; margin-top: 14px;
}
.botao-texto {
  background: none; border: 0; padding: 0; font: inherit; font-size: .78rem;
  color: var(--laranja); text-decoration: underline; cursor: pointer;
}
.fatura.fechada {
  background: var(--saida-fraco); border: 1px solid #F3C9CB;
  border-radius: 11px; padding: 11px 13px; margin-top: 14px;
}
</style>
