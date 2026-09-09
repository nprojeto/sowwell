<script setup lang="ts">
const api = useApi()

const mes = ref(hojeISO().slice(0, 7))
const resumo = ref<any>(null)
const proximas = ref<any[]>([])
const atrasadas = ref<any[]>([])
const cartoes = ref<any[]>([])
const carregando = ref(true)
const erro = ref('')

const rotuloMes = computed(() => {
  const [a, m] = mes.value.split('-')
  return `${MESES[Number(m) - 1]} de ${a}`
})

const livre = computed(() =>
  Number(resumo.value?.previsao || 0) - Number(resumo.value?.comprometido_faturas || 0))

function mudarMes(passo: number) {
  const [a, m] = mes.value.split('-').map(Number)
  const d = new Date(a, m - 1 + passo, 1)
  mes.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  carregar()
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const hoje = hojeISO()
    const daqui = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    const [r, p, a, f] = await Promise.all([
      api.get(`/resumo?mes=${mes.value}`),
      api.get(`/ocorrencias?de=${hoje}&ate=${daqui}&status=pendente`),
      api.get('/ocorrencias?status=atrasado'),
      api.get('/faturas')
    ])
    resumo.value = r
    proximas.value = (p ?? []).slice(0, 8)
    atrasadas.value = (a ?? []).filter((x: any) => x.tipo === 'despesa').slice(0, 6)
    cartoes.value = f?.cartoes ?? []
  } catch (e: any) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

async function pagar(id: string, valor: number) {
  await api.patch(`/ocorrencias/pagar/${id}`, { valor_pago: valor })
  await carregar()
}

onMounted(carregar)
</script>

<template>
  <div>
    <div class="topo entre">
      <div>
        <h1>Painel</h1>
        <p>Como está a casa em {{ rotuloMes }}.</p>
      </div>
      <div class="linha-flex">
        <button class="btn claro mini" @click="mudarMes(-1)"><i class="mi">chevron_left</i></button>
        <button class="btn claro mini" @click="mudarMes(1)"><i class="mi">chevron_right</i></button>
      </div>
    </div>

    <div v-if="erro" class="aviso mal" style="margin-bottom:16px">{{ erro }}</div>
    <div v-if="carregando" class="vazio">Consultando os livros…</div>

    <template v-else-if="resumo">
      <!-- caixa -->
      <div class="grade g3" style="margin-bottom:16px">
        <div class="cartao caixa-destaque larga">
          <div class="rotulo">No caixa hoje</div>
          <div class="selo-valor" :class="Number(resumo.caixa_real) >= 0 ? 'entrada' : 'saida'">
            {{ dinheiro(resumo.caixa_real) }}
          </div>
          <div class="pequeno mudo" style="margin-top:6px">
            <template v-if="Number(resumo.saldo_anterior)">
              Vieram <strong class="num">{{ dinheiro(resumo.saldo_anterior) }}</strong>
              dos meses anteriores, mais o que entrou menos o que saiu.
            </template>
            <template v-else>
              O que você confirmou que entrou, menos o que já saiu.
            </template>
          </div>
        </div>

        <div class="cartao">
          <div class="rotulo">Previsão fim do mês</div>
          <div class="selo-valor" :class="Number(resumo.previsao) >= 0 ? 'entrada' : 'saida'">
            {{ dinheiro(resumo.previsao) }}
          </div>
          <div class="pequeno mudo" style="margin-top:6px">
            Já descontadas as contas e faturas que vencem até o dia 30.
          </div>
        </div>

        <div class="cartao">
          <div class="rotulo">Livre de verdade</div>
          <div class="selo-valor" :class="livre >= 0 ? 'entrada' : 'saida'">
            {{ dinheiro(livre) }}
          </div>
          <div class="pequeno mudo" style="margin-top:6px">
            Tirando também <span class="num">{{ dinheiro(resumo.comprometido_faturas) }}</span>
            de faturas dos próximos meses.
          </div>
        </div>
      </div>

      <div v-if="resumo.entradas_sem_baixa_qtd" class="aviso entre"
           style="margin-bottom:16px">
        <span>
          <strong>{{ resumo.entradas_sem_baixa_qtd }} entrada(s)</strong> já
          venceram e ainda não foram confirmadas
          (<span class="num">{{ dinheiro(resumo.entradas_sem_baixa_valor) }}</span>).
          Elas só entram no caixa depois que você der baixa.
        </span>
        <NuxtLink to="/calendario" class="btn claro mini">Confirmar</NuxtLink>
      </div>

      <div v-if="Number(resumo.pendente_anterior)" class="aviso entre"
           style="margin-bottom:16px">
        <span>
          Há <strong class="num">{{ dinheiro(resumo.pendente_anterior) }}</strong>
          em contas de meses anteriores sem baixa. Elas não entram no caixa
          acima — enquanto isso, ele mostra mais dinheiro do que existe.
        </span>
        <NuxtLink to="/calendario" class="btn claro mini">Resolver</NuxtLink>
      </div>

      <div v-if="resumo.sem_baixa_qtd" class="aviso entre" style="margin-bottom:16px">
        <span>
          <strong>{{ resumo.sem_baixa_qtd }} conta(s)</strong> já venceram e não têm baixa
          — <span class="num">{{ dinheiro(resumo.sem_baixa_valor) }}</span>.
          Enquanto isso, o caixa de hoje fica maior do que a realidade.
        </span>
        <NuxtLink to="/calendario" class="btn claro mini">Resolver</NuxtLink>
      </div>

      <!-- movimento do mes -->
      <div class="grade g4" style="margin-bottom:16px">
        <div class="cartao">
          <div class="rotulo">Entradas previstas no mês</div>
          <div class="selo-valor entrada">{{ dinheiro(resumo.receitas) }}</div>
          <div class="pequeno mudo">
            já caiu <span class="num">{{ dinheiro(resumo.recebido) }}</span>
          </div>
        </div>
        <div class="cartao">
          <div class="rotulo">Saídas previstas no mês</div>
          <div class="selo-valor saida">{{ dinheiro(resumo.despesas) }}</div>
          <div class="pequeno mudo">
            já saiu <span class="num">{{ dinheiro(Number(resumo.pago) + Number(resumo.gasto_feito)) }}</span>
          </div>
        </div>
        <div class="cartao">
          <div class="rotulo">Falta pagar</div>
          <div class="selo-valor">{{ dinheiro(Number(resumo.a_pagar) + Number(resumo.gasto_futuro)) }}</div>
          <div class="pequeno mudo">contas e faturas até o fim do mês</div>
        </div>
        <div class="cartao">
          <div class="rotulo">Guardado</div>
          <div class="selo-valor">{{ dinheiro(resumo.total_reservado) }}</div>
          <div class="pequeno mudo">reservas e investimentos</div>
        </div>
      </div>

      <div class="grade g2" style="margin-bottom:16px">
        <div class="cartao larga">
          <div class="rotulo">De onde saiu o dinheiro</div>
          <div class="grade g2" style="margin-top:8px">
            <div>
              <div class="pequeno mudo">Direto do saldo</div>
              <div class="num" style="font-size:1.1rem">{{ dinheiro(resumo.saiu_do_saldo) }}</div>
              <div class="pequeno mudo">dinheiro, pix e débito</div>
            </div>
            <div>
              <div class="pequeno mudo">Nas faturas</div>
              <div class="num" style="font-size:1.1rem">{{ dinheiro(resumo.nas_faturas) }}</div>
              <div class="pequeno mudo">crédito, sai no vencimento</div>
            </div>
          </div>
          <div v-if="Number(resumo.comprado_no_credito)" class="pequeno"
               style="margin-top:10px;padding-top:10px;border-top:1px solid var(--linha)">
            Você comprou <strong class="num">{{ dinheiro(resumo.comprado_no_credito) }}</strong>
            no crédito este mês.
            <span class="mudo">Entra na fatura, não no caixa de agora.</span>
            <NuxtLink to="/cartoes" class="pequeno"><strong>Ver faturas</strong></NuxtLink>
          </div>

          <div class="pequeno mudo" style="margin-top:10px">
            Contas fixas: <span class="num">{{ dinheiro(resumo.despesas_contas) }}</span> ·
            Gastos: <span class="num">{{ dinheiro(resumo.despesas_gastos) }}</span>
            <span v-if="Number(resumo.gasto_beneficio)">
              · Vales: <span class="num">{{ dinheiro(resumo.gasto_beneficio) }}</span>
              <span style="opacity:.8">(fora do caixa)</span>
            </span>
          </div>
        </div>
      </div>

      <!-- faturas abertas -->
      <div v-if="cartoes.length" class="cartao chapa" style="margin-bottom:16px">
        <div class="cartao-topo">
          <h2>Faturas abertas</h2>
          <NuxtLink to="/cartoes" class="btn claro mini">Ver cartões</NuxtLink>
        </div>
        <div class="tabela-rolagem">
          <table>
            <tbody>
              <tr v-for="c in cartoes" :key="c.id">
                <td style="width:30px">
                  <i class="ponto" :style="{ background: c.cor, width:'11px', height:'11px' }"></i>
                </td>
                <td>
                  <strong>{{ c.nome }}</strong>
                  <span class="num mudo pequeno"> ••{{ c.ultimos4 }}</span>
                  <div class="pequeno mudo">
                    {{ c.itens_aberta }} lançamento(s) · vira dia {{ c.dia_fechamento }}
                  </div>
                </td>
                <td class="direita num pequeno mudo">
                  {{ c.vencimento_aberta ? 'vence ' + dataBr(c.vencimento_aberta) : '' }}
                </td>
                <td class="direita num saida" style="font-size:1.05rem">
                  {{ dinheiro(c.total_aberta) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- atrasadas -->
      <div v-if="atrasadas.length" class="cartao chapa" style="margin-bottom:16px">
        <div class="cartao-topo">
          <h2 style="color:var(--saida)">Passou do prazo</h2>
          <span class="eti atrasado">{{ atrasadas.length }}</span>
        </div>
        <div class="tabela-rolagem">
          <table>
            <tbody>
              <tr v-for="o in atrasadas" :key="o.id">
                <td>
                  <strong>{{ o.descricao }}</strong>
                  <div class="pequeno mudo">Venceu em {{ dataBr(o.data) }}</div>
                </td>
                <td class="direita num saida">{{ dinheiro(o.valor) }}</td>
                <td class="direita" style="width:110px">
                  <button class="btn claro mini" @click="pagar(o.id, o.valor)">
                    Dar baixa
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- proximas -->
      <div class="cartao chapa">
        <div class="cartao-topo">
          <h2>Próximos 14 dias</h2>
          <NuxtLink to="/calendario" class="btn claro mini">Ver calendário</NuxtLink>
        </div>
        <div v-if="!proximas.length" class="vazio">
          <div class="simbolo"><i class="mi">check</i></div>
          Nada vencendo nas próximas duas semanas.
        </div>
        <div v-else class="tabela-rolagem">
          <table>
            <thead>
              <tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th>
                  <th class="direita">Valor</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="o in proximas" :key="o.id">
                <td class="num">{{ dataBr(o.data) }}</td>
                <td>
                  <strong>{{ o.descricao }}</strong>
                  <span v-if="o.numero_parcela" class="pequeno mudo">
                    ({{ o.numero_parcela }}/{{ o.total_parcelas }})
                  </span>
                </td>
                <td>
                  <span class="linha-flex" style="gap:6px">
                    <i class="ponto" :style="{ background: o.categoria_cor }"></i>
                    <span class="pequeno">{{ o.categoria ?? '—' }}</span>
                  </span>
                </td>
                <td class="direita num" :class="o.tipo === 'receita' ? 'entrada' : 'saida'">
                  {{ o.tipo === 'receita' ? '+' : '−' }} {{ dinheiro(o.valor) }}
                </td>
                <td class="direita" style="width:110px">
                  <button class="btn claro mini" @click="pagar(o.id, o.valor)">
                    Dar baixa
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

<style scoped>
.caixa-destaque {
  border-left: 3px solid var(--latao);
}
.caixa-destaque .selo-valor { font-size: 1.9rem; }
</style>
  </div>
</template>

<style scoped>
.caixa-destaque {
  border-left: 3px solid var(--latao);
}
.caixa-destaque .selo-valor { font-size: 1.9rem; }
</style>
