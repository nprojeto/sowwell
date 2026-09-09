<script setup lang="ts">
const emit = defineEmits<{ salvo: [] }>()

const api = useApi()

const ouvindo = ref(false)
const texto = ref('')
const parcial = ref('')
const salvando = ref(false)
const erro = ref('')
const recado = ref('')
const suportaVoz = ref(true)
const motivoSemVoz = ref('')
const ultimoParcial = ref('')

const cartoes = ref<any[]>([])
const temVoz = ref(true)
const categorias = ref<any[]>([])
const form = ref<any>(null)
const seletorCartao = ref<HTMLSelectElement | null>(null)

// Gasto é registro do que já aconteceu: o calendário não abre o futuro.
const hoje = hojeISO()

let reconhecedor: any = null

const exemplos = [
  'Mercado oitenta e cinco no débito',
  'Farmácia trezentos e cinquenta parcelado em três vezes',
  'Três parcelas de duzentos e cinquenta',
  'Padaria quinze no pix'
]

const rotuloForma: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito',
  credito: 'Crédito', beneficio: 'Vale'
}
const FORMAS = ['dinheiro', 'pix', 'debito', 'credito', 'beneficio']

const deCredito = computed(() => cartoes.value.filter((c) => c.tipo !== 'beneficio'))
const deBeneficio = computed(() => cartoes.value.filter((c) => c.tipo === 'beneficio'))
const ehVale = computed(() => form.value?.forma === 'beneficio')

// Uma forma só está disponível se houver como usá-la. Sem cartão de
// crédito cadastrado, "Crédito" não é uma opção — é um beco sem saída.
function formaDisponivel(f: string) {
  if (f === 'credito') return deCredito.value.length > 0
  if (f === 'beneficio') return deBeneficio.value.length > 0
  return true
}

const faltaCadastrar = computed(() => {
  const f = form.value?.forma
  if (!f || formaDisponivel(f)) return null
  return f === 'credito'
    ? { nome: 'cartão de crédito', onde: '/cartoes', tipo: 'credito' }
    : { nome: 'vale-benefício', onde: '/cartoes', tipo: 'beneficio' }
})

const alternativas = ['dinheiro', 'pix', 'debito']

function trocarPara(f: string) {
  if (!form.value) return
  form.value.forma = f
  erro.value = ''
}

const cartaoObrigatorio = computed(() =>
  ['credito', 'beneficio'].includes(form.value?.forma) && !form.value?.cartao_id)

const cartaoEscolhido = computed(() =>
  cartoes.value.find((c) => c.id === form.value?.cartao_id) ?? null)

const valeEscolhido = computed(() =>
  ehVale.value ? cartaoEscolhido.value : null)

const sobraNoVale = computed(() =>
  Number(valeEscolhido.value?.saldo ?? 0) - totalDaCompra.value)

const totalDaCompra = computed(() => {
  if (!form.value) return 0
  const v = Math.abs(Number(form.value.valor) || 0)
  const n = form.value.forma === 'credito' ? Number(form.value.parcelas) || 1 : 1
  return form.value.base === 'total' ? v : v * n
})

const valorDaParcela = computed(() => {
  if (!form.value) return 0
  const n = form.value.forma === 'credito' ? Number(form.value.parcelas) || 1 : 1
  return totalDaCompra.value / n
})

/* ---------------------------------------------------------- voz */
// Mensagem clara para cada motivo de falha — silêncio aqui vira
// "não funciona" sem que ninguém saiba o porquê.
const MOTIVOS: Record<string, string> = {
  'not-allowed': 'O microfone está bloqueado. Clique no cadeado ao lado do endereço e libere o microfone para este site.',
  'service-not-allowed': 'O navegador recusou o serviço de voz. Verifique as permissões do site.',
  'audio-capture': 'Não achei nenhum microfone. Confira se está conectado e escolhido nas configurações do sistema.',
  'no-speech': 'Não ouvi nada. Fale mais perto do microfone e tente de novo.',
  'network': 'A conversão de voz precisa de internet e ela falhou agora. Tente de novo ou escreva no campo abaixo.',
  'aborted': 'A escuta foi interrompida.',
  'language-not-supported': 'Este navegador não reconhece português falado. Use o campo de texto.'
}

onMounted(async () => {
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

  if (!window.isSecureContext) {
    suportaVoz.value = false
    motivoSemVoz.value = 'O microfone só funciona em endereço seguro (https).'
  } else if (!SR) {
    suportaVoz.value = false
    motivoSemVoz.value = 'Este navegador não converte voz em texto. Funciona no Chrome, Edge e Safari — no Firefox, não.'
  } else {
    reconhecedor = new SR()
    reconhecedor.lang = 'pt-BR'
    reconhecedor.continuous = false
    reconhecedor.interimResults = true

    reconhecedor.onresult = (ev: any) => {
      let final = '', temp = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript
        if (ev.results[i].isFinal) final += t; else temp += t
      }
      parcial.value = temp
      if (temp) ultimoParcial.value = temp
      if (final) {
        texto.value = final.trim()
        parcial.value = ''; ultimoParcial.value = ''
        interpretar()
      }
    }

    reconhecedor.onerror = (e: any) => {
      ouvindo.value = false
      erro.value = MOTIVOS[e?.error] ?? `Não consegui ouvir (${e?.error ?? 'motivo desconhecido'}). Tente de novo.`
    }

    // Às vezes a escuta termina sem marcar o texto como final.
    // Em vez de perder o que foi dito, aproveitamos o parcial.
    reconhecedor.onend = () => {
      ouvindo.value = false
      if (!texto.value && ultimoParcial.value) {
        texto.value = ultimoParcial.value.trim()
        ultimoParcial.value = ''; parcial.value = ''
        interpretar()
      }
    }
  }
  await carregarApoio()
})

async function carregarApoio() {
  try {
    const [f, k] = await Promise.all([api.get('/faturas'), api.get('/categorias')])
    cartoes.value = f?.cartoes ?? []
    categorias.value = (k ?? []).filter((c: any) => c.tipo === 'despesa')

    const r = await useRecursos()
    temVoz.value = !r || !Object.keys(r).length || r.voz !== false
  } catch { /* silencioso: o formulario ainda funciona sem as listas */ }
}

async function ouvir() {
  if (!reconhecedor) return
  erro.value = ''; recado.value = ''; form.value = null
  texto.value = ''; parcial.value = ''; ultimoParcial.value = ''

  // pede o microfone antes: o erro fica bem mais claro assim
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
      fluxo.getTracks().forEach((t) => t.stop())
    }
  } catch {
    erro.value = MOTIVOS['not-allowed']
    return
  }

  ouvindo.value = true
  try {
    reconhecedor.start()
  } catch {
    // já estava escutando: reinicia
    try { reconhecedor.stop() } catch { /* ignora */ }
    ouvindo.value = false
    erro.value = 'A escuta já estava aberta. Toque de novo.'
  }
}
function parar() { reconhecedor?.stop(); ouvindo.value = false }

async function interpretar() {
  if (!texto.value.trim()) return
  erro.value = ''
  try {
    const r = await api.post('/gastos/interpretar', { texto: texto.value })
    form.value = {
      id: null,
      descricao: r.descricao,
      valor: r.valor,
      base: r.base,
      forma: r.forma,
      parcelas: r.parcelas,
      cartao_id: r.cartao_id,
      data: r.data,
      categoria_id: r.categoria_id,
      observacao: r.texto,
      origem: 'voz'
    }
    if (r.sem_cartao_cadastrado) {
      erro.value = 'Você falou em cartão, mas não há nenhum cadastrado. '
        + 'Deixei como dinheiro — troque abaixo se quiser.'
    }
    await nextTick()
    if (cartaoObrigatorio.value) seletorCartao.value?.focus()
  } catch (e: any) { erro.value = e.message }
}

/* ---------------------------------------------------------- crud */
function novoManual() {
  erro.value = ''; recado.value = ''; texto.value = ''
  form.value = {
    id: null, descricao: '', valor: '', base: 'parcela', forma: 'dinheiro',
    parcelas: 1, cartao_id: '', data: hojeISO(), categoria_id: '',
    observacao: '', origem: 'manual'
  }
}

function editar(g: any) {
  erro.value = ''
  form.value = {
    id: g.id,
    descricao: g.descricao,
    valor: g.valor_parcela,
    base: 'parcela',
    forma: g.forma,
    parcelas: g.parcelas,
    cartao_id: g.cartao_id ?? '',
    data: String(g.data).slice(0, 10),
    categoria_id: g.categoria_id ?? '',
    observacao: g.observacao ?? '',
    origem: g.origem
  }
}

watch(() => form.value?.forma, (nova) => {
  if (!form.value) return
  if (nova !== 'credito') form.value.parcelas = 1
  if (!['credito', 'beneficio'].includes(nova)) form.value.cartao_id = ''
  // o vale escolhido não serve para o crédito, e vice-versa
  if (nova === 'beneficio' && deCredito.value.some((c) => c.id === form.value.cartao_id)) {
    form.value.cartao_id = deBeneficio.value.length === 1 ? deBeneficio.value[0].id : ''
  }
  if (nova === 'credito' && deBeneficio.value.some((c) => c.id === form.value.cartao_id)) {
    form.value.cartao_id = ''
  }
})

async function salvar() {
  if (!form.value) return
  erro.value = ''
  if (!Number(form.value.valor)) { erro.value = 'Informe o valor.'; return }
  if (String(form.value.data) > hoje) {
    erro.value = 'Não dá para lançar um gasto com data futura.'
    return
  }

  if (faltaCadastrar.value) {
    erro.value = `Você ainda não tem ${faltaCadastrar.value.nome} cadastrado. `
      + 'Cadastre um antes, ou escolha outra forma de pagamento.'
    return
  }
  if (cartaoObrigatorio.value) {
    erro.value = ehVale.value
      ? 'Escolha de qual vale saiu.'
      : 'Escolha de qual cartão saiu.'
    return
  }

  salvando.value = true
  const corpo = {
    descricao: form.value.descricao || 'Gasto',
    valor: Math.abs(Number(form.value.valor)),
    base: form.value.base,
    forma: form.value.forma,
    parcelas: Number(form.value.parcelas) || 1,
    cartao_id: form.value.cartao_id || null,
    data: form.value.data,
    categoria_id: form.value.categoria_id || null,
    observacao: form.value.observacao || null,
    origem: form.value.origem
  }
  try {
    if (form.value.id) await api.patch(`/gastos/${form.value.id}`, corpo)
    else await api.post('/gastos', corpo)
    recado.value = form.value.id ? 'Alterado.' : 'Registrado.'
    form.value = null; texto.value = ''
    emit('salvo')
    setTimeout(() => (recado.value = ''), 2500)
  } catch (e: any) { erro.value = e.message }
  salvando.value = false
}

defineExpose({ editar, novoManual, carregarApoio })
</script>

<template>
  <div>
    <!-- microfone -->
    <div class="cartao centro" style="padding:24px 20px;margin-bottom:14px">
      <button v-if="temVoz" class="botao-voz" :class="{ ativo: ouvindo }"
              :disabled="!suportaVoz" @click="ouvindo ? parar() : ouvir()"
              :aria-label="ouvindo ? 'Parar de ouvir' : 'Falar o gasto'">
        <i class="mi">{{ ouvindo ? 'stop' : 'mic' }}</i>
      </button>
      <NuxtLink v-else to="/planos?bloqueado=voz" class="botao-voz travado">
        <i class="mi">lock</i>
      </NuxtLink>

      <div style="margin-top:12px;min-height:22px">
        <div v-if="!temVoz" class="pequeno mudo" style="max-width:420px;margin:0 auto">
          Lançar por voz não faz parte do seu plano.
          <NuxtLink to="/planos?bloqueado=voz"><strong>Ver planos</strong></NuxtLink>
          — ou escreva no campo abaixo.
        </div>
        <div v-else-if="ouvindo" class="mudo">Estou ouvindo…</div>
        <div v-else-if="!suportaVoz" class="pequeno mudo" style="max-width:420px;margin:0 auto">
          {{ motivoSemVoz }} Use o campo abaixo — funciona igual.
        </div>
        <div v-else-if="temVoz" class="mudo pequeno">Toque para falar seu gasto</div>
        <div v-if="parcial" class="mudo" style="font-style:italic">{{ parcial }}</div>
      </div>

      <div style="max-width:470px;margin:14px auto 0">
        <div class="linha-flex">
          <input v-model="texto" placeholder="ou escreva: mercado 85 no débito"
                 @keyup.enter="interpretar" />
          <button class="btn claro" @click="interpretar">Ler</button>
          <button class="btn claro" @click="novoManual">À mão</button>
        </div>
        <div v-if="!form && !texto" class="pequeno mudo" style="margin-top:9px">
          <em>{{ exemplos.join(' · ') }}</em>
        </div>
      </div>
    </div>

    <div v-if="recado" class="aviso bem" style="margin-bottom:14px">{{ recado }}</div>
    <div v-if="erro && !form" class="aviso mal" style="margin-bottom:14px">{{ erro }}</div>

    <!-- formulario -->
    <div v-if="form" class="cartao" style="margin-bottom:14px;border-color:var(--latao)">
      <div class="entre" style="margin-bottom:12px">
        <div class="rotulo">
          {{ form.id ? 'Editando gasto' : (form.origem === 'voz' ? 'Entendi assim — confira' : 'Novo gasto') }}
        </div>
        <button class="fechar" @click="form = null"><i class="mi">close</i></button>
      </div>

      <div class="resumo-voz">
        <div>
          <div class="selo-valor saida">{{ valor(totalDaCompra) }}</div>
          <div class="pequeno" style="margin-top:2px">
            <strong>{{ form.descricao || 'Sem descrição' }}</strong>
            <span class="mudo"> · {{ rotuloForma[form.forma] }}</span>
            <span v-if="form.forma === 'credito'" class="mudo">
              · {{ Number(form.parcelas) > 1
                ? form.parcelas + '× ' + dinheiro(valorDaParcela) : 'à vista' }}
            </span>
            <span v-if="cartaoEscolhido" class="mudo">
              · {{ cartaoEscolhido.nome }} ••{{ cartaoEscolhido.ultimos4 }}
            </span>
            <span v-if="valeEscolhido" class="mudo">
              · sobra {{ valor(sobraNoVale) }}
            </span>
          </div>
        </div>
      </div>

      <!-- não dá para usar esta forma: explica e oferece saída -->
      <div v-if="faltaCadastrar" class="aviso mal" style="margin-bottom:14px">
        <strong>Você ainda não tem {{ faltaCadastrar.nome }} cadastrado.</strong>
        Sem isso não dá para guardar este gasto — o sistema não saberia
        em qual fatura ou saldo lançar.
        <div class="linha-flex" style="margin-top:10px;flex-wrap:wrap">
          <NuxtLink :to="faltaCadastrar.onde" class="btn latao mini">
            <i class="mi">add</i>Cadastrar agora
          </NuxtLink>
          <span class="pequeno" style="margin-left:4px">ou lançar como:</span>
          <button v-for="f in alternativas" :key="f" class="btn claro mini"
                  @click="trocarPara(f)">
            {{ rotuloForma[f] }}
          </button>
        </div>
      </div>

      <div v-else-if="cartaoObrigatorio" class="aviso" style="margin-bottom:14px">
        <strong>Falta escolher {{ ehVale ? 'o vale' : 'o cartão' }}.</strong>
        Você tem {{ (ehVale ? deBeneficio : deCredito).length }} cadastrado(s)
        — selecione abaixo.
      </div>

      <div class="grade g3">
        <div class="campo">
          <label>O que foi</label>
          <input v-model="form.descricao" placeholder="Mercado, tênis…" />
        </div>
        <div class="campo">
          <label>Data</label>
          <input v-model="form.data" type="date" :max="hoje" />
        </div>
        <div class="campo">
          <label>Categoria</label>
          <select v-model="form.categoria_id">
            <option value="">Sem categoria</option>
            <option v-for="k in categorias" :key="k.id" :value="k.id">{{ k.nome }}</option>
          </select>
        </div>
      </div>

      <div class="campo">
        <label>Como pagou</label>
        <div class="linha-flex" style="flex-wrap:wrap">
          <button v-for="f in FORMAS" :key="f"
                  class="btn mini" :class="form.forma === f ? '' : 'claro'"
                  @click="form.forma = f">
            {{ rotuloForma[f] }}
            <i v-if="!formaDisponivel(f)" class="mi"
               style="font-size:14px;opacity:.7">block</i>
          </button>
        </div>
      </div>

      <div v-if="form.forma === 'credito'" class="grade g3">
        <div class="campo">
          <label>Cartão *</label>
          <select ref="seletorCartao" v-model="form.cartao_id"
                  :style="cartaoObrigatorio ? 'border-color:var(--latao);outline:2px solid var(--latao)' : ''">
            <option value="">— escolha —</option>
            <option v-for="c in cartoes" :key="c.id" :value="c.id">
              {{ c.nome }} ••{{ c.ultimos4 }}
            </option>
          </select>
        </div>
        <div class="campo">
          <label>Em quantas vezes</label>
          <input v-model="form.parcelas" type="number" min="1" max="72" />
        </div>
        <div class="campo">
          <label>O valor que informei é…</label>
          <select v-model="form.base">
            <option value="parcela">de cada parcela</option>
            <option value="total">o total da compra</option>
          </select>
        </div>
      </div>

      <div class="grade g2" style="align-items:end">
        <div class="campo">
          <label>Valor (R$)</label>
          <input v-model="form.valor" type="number" step="0.01" />
        </div>
        <div class="campo">
          <label>Fica assim</label>
          <div class="num saida" style="font-size:1.2rem;padding-top:5px">
            {{ valor(totalDaCompra) }}
            <span v-if="form.forma === 'credito' && Number(form.parcelas) > 1"
                  class="pequeno mudo">
              = {{ form.parcelas }}× {{ valor(valorDaParcela) }}
            </span>
          </div>
        </div>
      </div>

      <div class="campo">
        <label>Observação</label>
        <input v-model="form.observacao" />
      </div>

      <div class="aviso pequeno" style="margin-bottom:12px">
        <template v-if="form.forma === 'credito'">
          Vai para a fatura do cartão e sai do saldo só no vencimento dela.
        </template>
        <template v-else-if="ehVale">
          Sai do saldo do vale, não do seu dinheiro. Não entra no limite diário.
        </template>
        <template v-else>
          Sai do saldo na hora, no dia {{ dataBr(form.data) }}.
        </template>
      </div>

      <div v-if="erro" class="aviso mal" style="margin-bottom:12px">{{ erro }}</div>

      <div class="linha-flex">
        <button class="btn latao" :disabled="salvando || cartaoObrigatorio || !!faltaCadastrar" @click="salvar">
          {{ salvando ? 'Gravando…' : (form.id ? 'Salvar alteração' : 'Gravar gasto') }}
        </button>
        <button class="btn claro" @click="form = null">Descartar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resumo-voz {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; flex-wrap: wrap;
  background: var(--papel); border: 1px solid var(--linha);
  border-radius: 10px; padding: 12px 16px; margin-bottom: 16px;
}
.resumo-voz .selo-valor { font-size: 1.7rem; line-height: 1.1; }

.botao-voz {
  width: 72px; height: 72px; border-radius: 50%;
  border: 2px solid var(--azul); background: var(--azul); color: #fff;
  display: inline-grid; place-items: center; cursor: pointer; transition: .2s;
  box-shadow: 0 8px 24px -10px rgba(11,114,206,.35);
}
.botao-voz:hover { background: var(--azul-forte); }
.botao-voz:disabled { opacity: .4; cursor: not-allowed; }
.botao-voz.travado {
  background: var(--papel); border-color: var(--linha); color: var(--tinta-45);
  display: inline-grid; place-items: center; text-decoration: none;
  box-shadow: none; font-size: 1.6rem;
}
.botao-voz.travado:hover { background: var(--linha); }
.botao-voz .mi { font-size: 32px; vertical-align: 0; }
.botao-voz.ativo {
  background: var(--saida); border-color: var(--saida);
  animation: pulso 1.4s ease-in-out infinite;
}
@keyframes pulso {
  0%, 100% { box-shadow: 0 0 0 0 rgba(224,71,76,.45); }
  50%      { box-shadow: 0 0 0 16px rgba(224,71,76,0); }
}
@media (prefers-reduced-motion: reduce) { .botao-voz.ativo { animation: none; } }
</style>
