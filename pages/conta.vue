<script setup lang="ts">
const api = useApi()
const { noApp } = useApp()

const dados = ref<any>(null)
const carregando = ref(true)
const erro = ref('')
const recado = ref('')
const nomeCasa = ref('')
const fotoCasa = ref<string | null>(null)
const novoEmail = ref('')
const convidando = ref(false)
const assinando = ref(false)
const pagamentos = ref<any[]>([])
const rota = useRoute()

const plano = computed(() => dados.value?.conta?.plano)
const dias = computed(() => Number(dados.value?.dias_restantes ?? 0))

// Prazos muito longos nao viram numero de dias — fica ilegivel.
const semPrazo = computed(() => dias.value > 400)

const prazoTexto = computed(() => {
  if (!dados.value?.em_dia) return 'expirada'
  if (semPrazo.value) return 'sem prazo'
  if (dias.value > 60) return `${Math.round(dias.value / 30)} meses`
  if (dias.value > 1) return `${dias.value} dias`
  if (dias.value === 1) return 'último dia'
  return 'termina hoje'
})

const rotuloPlano: Record<string, string> = {
  teste: 'Período de teste',
  ativo: 'Assinatura ativa',
  vencido: 'Assinatura vencida',
  cancelado: 'Assinatura cancelada'
}

const podePagar = computed(() => dados.value?.assinatura?.pagamento_disponivel)
const temAssinatura = computed(() => dados.value?.assinatura?.tem_assinatura)
const preco = computed(() => Number(dados.value?.assinatura?.preco_mensal ?? 0))

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const [c, a] = await Promise.all([api.get('/conta'), api.get('/assinatura')])
    dados.value = { ...c, assinatura: a }
    nomeCasa.value = c?.conta?.nome ?? ''
    fotoCasa.value = c?.conta?.foto ?? null
    try { pagamentos.value = await api.get('/assinatura/pagamentos') ?? [] } catch { /* opcional */ }
  } catch (e: any) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

async function salvarNome() {
  erro.value = ''
  try {
    await api.patch('/conta', { nome: nomeCasa.value, foto: fotoCasa.value })
    recado.value = 'Família salva.'
    setTimeout(() => (recado.value = ''), 2500)
    await carregar()
  } catch (e: any) { erro.value = e.message }
}

async function convidar() {
  erro.value = ''; recado.value = ''
  if (!novoEmail.value.trim()) return
  convidando.value = true
  try {
    await api.post('/convites', { email: novoEmail.value })
    recado.value = `Convite enviado para ${novoEmail.value.trim()}.`
    novoEmail.value = ''
    await carregar()
  } catch (e: any) { erro.value = e.message }
  convidando.value = false
}

async function assinar() {
  erro.value = ''
  assinando.value = true
  try {
    const r = await api.post('/assinatura/checkout')
    if (r?.link) { window.location.href = r.link; return }
    erro.value = 'O Mercado Pago não devolveu o link de pagamento.'
  } catch (e: any) { erro.value = e.message }
  assinando.value = false
}

const conferindo = ref(false)

async function conferirPagamento() {
  erro.value = ''; recado.value = ''
  conferindo.value = true
  try {
    const r = await api.post('/assinatura/sincronizar')
    recado.value = r?.plano === 'ativo'
      ? 'Pagamento confirmado. Acesso liberado.'
      : 'Situação atualizada.'
    await carregar()
    setTimeout(() => (recado.value = ''), 4000)
  } catch (e: any) { erro.value = e.message }
  conferindo.value = false
}

async function cancelarConvite(c: any) {
  if (!confirm(`Cancelar o convite de ${c.email}?`)) return
  try {
    await api.remove(`/convites/${c.id}`)
    await carregar()
  } catch (e: any) { erro.value = e.message }
}

async function removerMembro(m: any) {
  if (!confirm(`Remover ${m.nome || m.email} da família? A conta dessa pessoa será apagada.`)) return
  try {
    await api.remove(`/conta/membros/${m.id}`)
    await carregar()
  } catch (e: any) { erro.value = e.message }
}

onMounted(async () => {
  await carregar()
  // voltou do Mercado Pago: confere a situacao na origem
  if (rota.query.retorno && dados.value?.assinatura?.tem_assinatura) {
    recado.value = 'Conferindo seu pagamento…'
    await conferirPagamento()
  }
})
</script>

<template>
  <div>
    <div class="topo">
      <h1>Minha casa</h1>
      <p>Os mordomos, o nome da família e sua assinatura.</p>
    </div>

    <div v-if="recado" class="aviso bem" style="margin-bottom:14px">{{ recado }}</div>
    <div v-if="erro" class="aviso mal entre" style="margin-bottom:14px">
      <span>{{ erro }}</span>
      <button class="btn claro mini" @click="carregar">Tentar de novo</button>
    </div>

    <div v-if="carregando" class="vazio">Consultando…</div>

    <template v-else-if="dados">
      <!-- assinatura -->
      <div class="cartao" style="margin-bottom:16px"
           :style="dados.em_dia ? 'border-left:3px solid var(--entrada)' : 'border-left:3px solid var(--saida)'">
        <div class="entre">
          <div>
            <div class="rotulo">
              {{ rotuloPlano[plano] ?? plano }}
              <span v-if="dados.plano?.nome" style="color:var(--latao)">
                · {{ dados.plano.nome }}
              </span>
            </div>
            <div class="selo-valor" :class="dados.em_dia ? 'entrada' : 'saida'">
              {{ prazoTexto }}
            </div>
            <div class="pequeno mudo">
              <template v-if="plano === 'teste'">
                Teste até {{ dataBr(dados.conta.teste_ate) }}
              </template>

<style scoped>
.foto-familia {
  width: 84px; height: 84px; border-radius: 50%; object-fit: cover;
  border: 2px solid var(--linha);
}
</style>
              <template v-else-if="dados.conta.assinatura_ate && !semPrazo">
                Válida até {{ dataBr(dados.conta.assinatura_ate) }}
              </template>
              <template v-else-if="semPrazo">
                Acesso liberado, sem data de corte
              </template>
              <template v-else>Sem data de expiração</template>
            </div>
          </div>
          <div class="direita">
            <div v-if="preco" class="pequeno mudo" style="margin-bottom:6px">
              {{ dinheiro(preco) }}/mês
            </div>
            <button v-if="!noApp && podePagar && plano !== 'ativo'" class="btn latao"
                    :disabled="assinando || !dados.sou_dono" @click="assinar">
              {{ assinando ? 'Abrindo…' : 'Pagar o próximo mês' }}
            </button>
            <button v-else-if="!noApp && podePagar && plano === 'ativo' && !semPrazo"
                    class="btn claro" :disabled="conferindo" @click="conferirPagamento">
              {{ conferindo ? 'Conferindo…' : 'Atualizar situação' }}
            </button>
          </div>
        </div>

        <div v-if="!dados.em_dia" class="aviso mal entre" style="margin-top:14px">
          <span>
            O acesso expirou. Você ainda consegue consultar tudo, mas não dá
            para lançar nada novo até renovar.
          </span>
          <button v-if="!noApp && podePagar" class="btn claro mini" :disabled="conferindo"
                  @click="conferirPagamento">
            {{ conferindo ? 'Conferindo…' : 'Já paguei' }}
          </button>
        </div>
        <div v-else-if="plano === 'teste' && dias <= 5 && !semPrazo"
             class="aviso" style="margin-top:14px">
          Seu teste termina em breve.
        </div>

        <div v-if="!semPrazo" class="entre pequeno mudo" style="margin-top:14px">
          <span>
            <template v-if="!noApp && podePagar">
              Pagamento mensal avulso — Pix, boleto ou cartão.
              Nada é debitado automaticamente.
            </template>
            <template v-else>
              O pagamento ainda não foi configurado neste sistema.
            </template>
          </span>

        </div>
      </div>

      <!-- nome da casa -->
      <div class="cartao" style="margin-bottom:16px">
        <h2 style="margin-bottom:4px">Família</h2>
        <p class="pequeno mudo" style="margin:0 0 16px">
          O nome e a foto aparecem no alto do menu e no seu perfil.
        </p>

        <CampoFoto v-if="dados.sou_dono" v-model="fotoCasa" :nome="nomeCasa"
                   style="margin-bottom:16px" />
        <div v-else-if="fotoCasa" style="margin-bottom:16px">
          <img :src="fotoCasa" alt="" class="foto-familia" />
        </div>

        <div class="linha-flex">
          <input v-model="nomeCasa" :disabled="!dados.sou_dono"
                 placeholder="Família Silva" />
          <button v-if="dados.sou_dono" class="btn" @click="salvarNome">Salvar</button>
        </div>
        <div v-if="!dados.sou_dono" class="pequeno mudo" style="margin-top:6px">
          Só um mordomo responsável pode alterar.
        </div>
      </div>

      <!-- membros -->
      <div class="cartao chapa" style="margin-bottom:16px">
        <div class="cartao-topo">
          <h2>Mordomos da casa</h2>
          <span class="pequeno mudo">{{ dados.membros.length }} pessoa(s)</span>
        </div>

        <div class="tabela-rolagem">
          <table>
            <tbody>
              <tr v-for="m in dados.membros" :key="m.id">
                <td>
                  <strong>{{ m.nome || m.email }}</strong>
                  <span v-if="m.id === dados.eu" class="eti pago"
                        style="margin-left:6px">você</span>
                  <div class="pequeno mudo">{{ m.email }}</div>
                </td>
                <td class="pequeno mudo">
                  Mordomo<span v-if="m.papel === 'dono'"> · administra</span>
                </td>
                <td class="direita">
                  <button v-if="dados.sou_dono && m.id !== dados.eu"
                          class="btn risco mini" @click="removerMembro(m)">
                    Remover
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="padding:16px 18px;border-top:1px solid var(--linha)">
          <template v-if="!dados.sou_dono">
            <div class="pequeno mudo">
              Só um mordomo responsável pode chamar mais gente para a família.
            </div>
          </template>

          <template v-else-if="!dados.em_dia">
            <div class="aviso mal" style="margin:0">
              <strong>Assinatura vencida.</strong>
              Renove para voltar a chamar gente para a família.
              <NuxtLink to="/planos"><strong>Ver planos ›</strong></NuxtLink>
            </div>
          </template>

          <template v-else-if="dados.vagas !== null && dados.vagas <= 0">
            <div class="aviso" style="margin:0">
              <strong>Sem vagas.</strong>
              O plano {{ dados.plano?.nome }} comporta
              {{ dados.plano?.max_pessoas }} pessoa(s), e todas já estão ocupadas.
              <NuxtLink to="/planos"><strong>Ver planos maiores ›</strong></NuxtLink>
            </div>
          </template>

          <template v-else>
            <label>Chamar outro mordomo para esta família</label>
            <div class="linha-flex">
              <input v-model="novoEmail" type="email" placeholder="email@dapessoa.com"
                     @keyup.enter="convidar" />
              <button class="btn" :disabled="convidando" @click="convidar">
                {{ convidando ? 'Enviando…' : 'Convidar' }}
              </button>
            </div>
            <div class="pequeno mudo" style="margin-top:6px">
              <template v-if="dados.vagas !== null">
                Resta{{ dados.vagas > 1 ? 'm' : '' }} <strong>{{ dados.vagas }}</strong>
                vaga(s) neste plano.
              </template>
              A pessoa recebe um e-mail e, ao criar a conta com esse mesmo endereço,
              entra direto aqui.
            </div>
          </template>
        </div>
      </div>

      <!-- convites pendentes -->
      <div v-if="dados.convites.length" class="cartao chapa" style="margin-bottom:16px">
        <div class="cartao-topo"><h2>Convites aguardando</h2></div>
        <div class="tabela-rolagem">
          <table>
            <tbody>
              <tr v-for="c in dados.convites" :key="c.id">
                <td>
                  <strong>{{ c.email }}</strong>
                  <div class="pequeno mudo">vale até {{ dataBr(c.expira_em) }}</div>
                </td>
                <td class="direita">
                  <button class="btn risco mini" @click="cancelarConvite(c)">Cancelar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="dados.assinatura?.pagamentos_pendentes"
           class="aviso entre" style="margin-bottom:16px">
        <span>
          Há {{ dados.assinatura.pagamentos_pendentes }} pagamento(s) aguardando.
          Boleto pode levar até 3 dias; Pix cai em minutos.
        </span>
        <button class="btn claro mini" :disabled="conferindo" @click="conferirPagamento">
          {{ conferindo ? 'Conferindo…' : 'Já paguei' }}
        </button>
      </div>

      <div v-if="pagamentos.length" class="cartao chapa" style="margin-bottom:16px">
        <div class="cartao-topo">
          <h2>Pagamentos</h2>
          <button class="btn claro mini" :disabled="conferindo" @click="conferirPagamento">
            {{ conferindo ? 'Conferindo…' : 'Conferir' }}
          </button>
        </div>
        <div class="tabela-rolagem">
          <table>
            <tbody>
              <tr v-for="pg in pagamentos" :key="pg.id">
                <td class="num pequeno">{{ dataBr(pg.pago_em ?? pg.criado_em) }}</td>
                <td class="pequeno">
                  Mensalidade
                  <div class="mudo">
                    {{ pg.status === 'pago' ? 'confirmado'
                      : pg.status === 'pendente' ? 'aguardando pagamento' : pg.status }}
                    <span v-if="pg.valida_ate"> · vale até {{ dataBr(pg.valida_ate) }}</span>
                  </div>
                </td>
                <td class="direita num">{{ pg.valor ? dinheiro(pg.valor) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>


    </template>
  </div>
</template>
