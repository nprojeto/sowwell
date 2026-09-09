<script setup lang="ts">
const api = useApi()

const dados = ref<any>(null)
const carregando = ref(true)
const erro = ref('')
const temRecurso = ref(true)
const meuLimite = ref(0)
const mexeu = ref(false)
const salvando = ref(false)

const sugerido = computed(() => Number(dados.value?.limite_sugerido ?? 0))
const diasRestantes = computed(() => Number(dados.value?.dias_restantes ?? 0))
const restante = computed(() => Number(dados.value?.restante ?? 0))
const gastoHoje = computed(() => Number(dados.value?.gasto_hoje ?? 0))
const limiteHoje = computed(() => Number(dados.value?.limite_hoje ?? 0))

const sobra = computed(() => limiteHoje.value - gastoHoje.value)
const passou = computed(() => sobra.value < 0)

const maxSlider = computed(() => Math.max(50, Math.ceil(sugerido.value * 2 / 10) * 10))

// Se eu segurar neste ritmo, com quanto termino o mês?
const economia = computed(() => {
  if (!dados.value || diasRestantes.value <= 0) return 0
  return restante.value - meuLimite.value * diasRestantes.value
})

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const r = await useRecursos()
    temRecurso.value = !r || !Object.keys(r).length || r.moderando !== false
    if (!temRecurso.value) return

    dados.value = await api.get(`/moderando?mes=${hojeISO().slice(0, 7)}`)
    // o limite que a pessoa escolheu manda; sem escolha, o sugerido
    if (!mexeu.value) {
      meuLimite.value = Math.floor(
        Number(dados.value?.limite_escolhido ?? sugerido.value) || 0)
    }
  } catch (e: any) {
    // O servidor também barra o que está fora do plano. Sem tratar isso
    // aqui, o bloco simplesmente sumia da tela — e some é pior que
    // trancado: ninguém descobre que a função existe.
    if (/não inclui|nao inclui/i.test(String(e.message))) {
      temRecurso.value = false
    } else {
      erro.value = e.message
    }
  } finally {
    carregando.value = false
  }
}

const guardado = ref(false)

async function guardarLimite() {
  salvando.value = true
  erro.value = ''
  try {
    await api.patch('/config', { limite_diario: String(meuLimite.value) })
    mexeu.value = false
    guardado.value = true
    await carregar()
    setTimeout(() => (guardado.value = false), 2500)
  } catch (e: any) { erro.value = e.message }
  salvando.value = false
}

defineExpose({ carregar })
onMounted(carregar)
</script>

<template>
  <!-- fora do plano: mesmo desenho, números cobertos -->
  <div v-if="!temRecurso && !carregando" class="cartao larga mod mod-travado">
    <div class="entre" style="flex-wrap:wrap;gap:12px">
      <div style="min-width:0">
        <div class="rotulo linha-flex" style="gap:6px">
          <i class="mi" style="font-size:14px">lock</i>Moderador
        </div>
        <div class="selo-valor coberto">R$ 135,02</div>
        <div class="pequeno mudo coberto">Já gastou R$ 54,08 de R$ 189,10</div>
      </div>

      <NuxtLink to="/planos?bloqueado=moderando" class="btn latao mini">
        Liberar
      </NuxtLink>
    </div>

    <div class="mod-numeros">
      <div><span class="rotulo">Ainda tenho</span>
           <span class="num coberto">R$ 486,02</span></div>
      <div><span class="rotulo">Faltam</span>
           <span class="num coberto">5 dia(s)</span></div>
      <div><span class="rotulo">Por dia</span>
           <span class="num coberto">R$ 97,20</span></div>
    </div>

    <div class="mod-recado">
      <span class="mod-cadeado"><i class="mi">lock</i></span>
      <div>
        <strong>Isto não faz parte do seu plano.</strong>
        O Moderador calcula quanto dá para gastar hoje sem apertar o fim do
        mês, e refaz a conta a cada gasto que você lança.
      </div>
    </div>
  </div>

  <div v-else-if="dados" class="cartao larga mod" :class="{ passou }">
    <div class="entre" style="flex-wrap:wrap;gap:12px">
      <div style="min-width:0">
        <div class="rotulo">Moderador · dá para gastar hoje</div>
        <div class="selo-valor" :class="passou ? 'saida' : 'entrada'">
          {{ dinheiro(Math.max(0, sobra)) }}
        </div>
        <div class="pequeno mudo">
          <template v-if="passou">
            Já gastou {{ dinheiro(gastoHoje) }} · passou
            <strong class="saida">{{ dinheiro(-sobra) }}</strong>
          </template>
          <template v-else-if="gastoHoje">
            Já gastou {{ dinheiro(gastoHoje) }} de {{ dinheiro(limiteHoje) }}
          </template>
          <template v-else>
            De {{ dinheiro(limiteHoje) }} previstos para hoje
          </template>
        </div>
      </div>

      <NuxtLink to="/moderando" class="btn claro mini">
        <i class="mi">calendar_month</i>Ver o mês
      </NuxtLink>
    </div>

    <!-- números do mês, em linha -->
    <div class="mod-numeros">
      <div>
        <span class="rotulo">Ainda tenho</span>
        <span class="num">{{ dinheiro(restante) }}</span>
      </div>
      <div>
        <span class="rotulo">Faltam</span>
        <span class="num">{{ diasRestantes }} dia(s)</span>
      </div>
      <div>
        <span class="rotulo">Por dia</span>
        <span class="num">{{ dinheiro(sugerido) }}</span>
      </div>
    </div>

    <!-- a barra fica à vista: é o que faz a pessoa decidir na hora -->
    <div class="mod-ajuste">
      <div class="entre" style="margin-bottom:8px">
        <span class="pequeno">Segurar em</span>
        <strong class="num">{{ dinheiro(meuLimite) }} por dia</strong>
      </div>

      <input v-model.number="meuLimite" type="range" min="0" :max="maxSlider"
             step="5" @input="mexeu = true" />

      <div class="pequeno" style="margin-top:8px">
        <template v-if="economia > 0">
          Neste ritmo, sobram <strong class="entrada">{{ dinheiro(economia) }}</strong>
          no fim do mês.
        </template>
        <template v-else-if="economia < 0">
          Neste ritmo, faltam <strong class="saida">{{ dinheiro(-economia) }}</strong>
          no fim do mês.
        </template>
        <template v-else>
          Neste ritmo, o mês fecha no zero.
        </template>
      </div>

      <div class="linha-flex" style="margin-top:10px">
        <button v-if="mexeu" class="btn mini"
                :disabled="salvando" @click="guardarLimite">
          {{ salvando ? 'Guardando…' : 'Usar este limite' }}
        </button>
        <span v-else-if="guardado" class="pequeno entrada">
          <i class="mi" style="font-size:15px">check</i> Limite guardado.
        </span>
        <span v-else-if="dados?.limite_escolhido" class="pequeno mudo">
          Seu limite: {{ dinheiro(dados.limite_escolhido) }} por dia
        </span>
      </div>

      <div v-if="erro" class="aviso mal pequeno" style="margin-top:10px">{{ erro }}</div>
    </div>
  </div>
</template>

<style scoped>
.mod { border-left: 3px solid var(--entrada); }
.mod.passou { border-left-color: var(--saida); }
.mod .selo-valor { font-size: 1.65rem; }

.mod-numeros {
  display: flex; flex-wrap: wrap; gap: 18px;
  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--linha);
}
.mod-numeros > div { display: grid; gap: 1px; }
.mod-numeros .num { font-size: .92rem; }

.mod-ajuste {
  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--linha);
}
.mod-ajuste input[type="range"] { width: 100%; accent-color: var(--laranja); }

.mod-travado { border-left-color: var(--tinta-45); }

/* números de exemplo, cobertos: mostram o formato sem revelar nada */
.coberto {
  filter: blur(6px); user-select: none; pointer-events: none;
  opacity: .55;
}

.mod-recado {
  display: flex; gap: 11px; align-items: flex-start;
  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--linha);
  font-size: .82rem; color: var(--tinta-70); line-height: 1.5;
}
.mod-cadeado {
  width: 34px; height: 34px; flex: 0 0 34px; border-radius: 11px;
  background: var(--papel); color: var(--tinta-45);
  display: grid; place-items: center;
}

@media (max-width: 760px) {
  .mod .selo-valor { font-size: 1.4rem; }
  .mod-numeros { gap: 12px; }
  .mod-numeros .rotulo { font-size: .57rem; }
  .mod-numeros .num { font-size: .82rem; }
}
</style>
