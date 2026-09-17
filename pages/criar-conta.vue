<script setup lang="ts">
const { escuroAgora, alternar } = useTema()
const supa = useSupa()
const api = useApi()
const rota = useRoute()

const etapa = ref<'dados' | 'codigo'>('dados')
const nome = ref('')
const casa = ref('')
const foto = ref<string | null>(null)
const email = ref(String(rota.query.email ?? ''))
const senha = ref('')
const senha2 = ref('')
const codigo = ref('')
const erro = ref('')
const recado = ref('')
const carregando = ref(false)
const espera = ref(0)

const convidado = computed(() => !!rota.query.email)

const forcaSenha = computed(() => {
  const s = senha.value
  if (!s) return { n: 0, txt: '', cor: '' }
  let n = 0
  if (s.length >= 8) n++
  if (s.length >= 12) n++
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) n++
  if (/\d/.test(s)) n++
  if (/[^A-Za-z0-9]/.test(s)) n++
  const rot = ['muito fraca', 'fraca', 'razoável', 'boa', 'forte', 'forte']
  const cores = ['#E0474C', '#E0474C', '#C77800', '#12A150', '#12A150', '#12A150']
  return { n, txt: rot[n], cor: cores[n] }
})

let cronometro: any = null
function contar() {
  espera.value = 60
  clearInterval(cronometro)
  cronometro = setInterval(() => {
    espera.value--
    if (espera.value <= 0) clearInterval(cronometro)
  }, 1000)
}
onUnmounted(() => clearInterval(cronometro))

async function criar() {
  erro.value = ''
  const mail = email.value.trim().toLowerCase()

  if (!nome.value.trim()) { erro.value = 'Como podemos te chamar?'; return }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { erro.value = 'E-mail inválido.'; return }
  if (senha.value.length < 8) { erro.value = 'A senha precisa ter ao menos 8 caracteres.'; return }
  if (senha.value !== senha2.value) { erro.value = 'As senhas não são iguais.'; return }

  carregando.value = true

  // O código sai do nosso servidor, pelo Brevo. O Supabase não envia
  // nada: os limites dele são baixos e as falhas ficam invisíveis.
  try {
    await api.post('/acesso/codigo', {
      email: mail, tipo: 'cadastro',
      nome: nome.value.trim(), casa: casa.value.trim() || null,
      foto: foto.value
    })
    etapa.value = 'codigo'
    contar()
  } catch (e: any) {
    erro.value = e.message
  }
  carregando.value = false
}

async function conferir() {
  erro.value = ''
  if (codigo.value.length < 6) { erro.value = 'Digite o código inteiro.'; return }

  const mail = email.value.trim().toLowerCase()
  carregando.value = true

  try {
    // o servidor confere o código e cria a conta já confirmada
    await api.post('/acesso/confirmar', {
      email: mail, tipo: 'cadastro', codigo: codigo.value, senha: senha.value
    })
  } catch (e: any) {
    carregando.value = false
    erro.value = e.message
    if (String(e.message).toLowerCase().includes('incorreto')) codigo.value = ''
    return
  }

  // conta criada: entra normalmente
  const { error } = await supa.auth.signInWithPassword({
    email: mail, password: senha.value
  })
  carregando.value = false

  if (error) {
    erro.value = 'Conta criada. Entre com seu e-mail e senha.'
    setTimeout(() => navigateTo('/login'), 2000)
    return
  }
  await navigateTo('/')
}

async function reenviar() {
  if (espera.value > 0) return
  erro.value = ''; recado.value = ''
  try {
    await api.post('/acesso/codigo', {
      email: email.value.trim().toLowerCase(), tipo: 'cadastro',
      nome: nome.value.trim(), casa: casa.value.trim() || null
    })
    recado.value = 'Mandamos outro código.'
    contar()
  } catch (e: any) { erro.value = e.message }
}
</script>

<template>
  <div class="portao">
    <button class="tema-flutuante" :title="escuroAgora ? 'Tema claro' : 'Tema escuro'"
            @click="alternar">
      <i class="mi">{{ escuroAgora ? 'light_mode' : 'dark_mode' }}</i>
    </button>

    <div class="portao-caixa">
      <!-- ---------------- código ---------------- -->
      <template v-if="etapa === 'codigo'">
        <div class="portao-marca">Confirme o e-mail</div>
        <div class="portao-sub">
          Enviamos um código para<br><strong>{{ email }}</strong>
        </div>

        <CampoCodigo v-model="codigo" :erro="!!erro" @completo="conferir" />

        <div v-if="erro" class="aviso mal" style="margin:16px 0 0">{{ erro }}</div>
        <div v-if="recado" class="aviso bem" style="margin:16px 0 0">{{ recado }}</div>

        <button class="btn" style="width:100%;margin-top:18px"
                :disabled="carregando || codigo.length < 6" @click="conferir">
          {{ carregando ? 'Conferindo…' : 'Confirmar e entrar' }}
        </button>

        <div class="centro pequeno" style="margin-top:18px">
          <button v-if="espera <= 0" class="botao-texto" @click="reenviar">
            Não chegou? Enviar outro código
          </button>
          <span v-else class="mudo">Pode pedir outro em {{ espera }}s</span>
        </div>

        <div class="centro pequeno" style="margin-top:10px">
          <button class="botao-texto mudo" @click="etapa = 'dados'; erro = ''">
            Corrigir o e-mail
          </button>
        </div>
      </template>

      <!-- ---------------- dados ---------------- -->
      <template v-else>
        <div class="portao-marca">Criar conta</div>
        <div class="portao-sub">
          {{ convidado
            ? 'Você foi convidado — use este mesmo e-mail'
            : 'Experimente sem cartão de crédito' }}
        </div>

        <div class="campo">
          <label>Seu nome</label>
          <input v-model="nome" autocomplete="name" placeholder="Como quer ser chamado" />
        </div>

        <div v-if="!convidado" class="campo">
          <label>Nome da família <span class="mudo">(opcional)</span></label>
          <input v-model="casa" placeholder="Família Silva" />
        </div>

        <div v-if="!convidado" class="campo">
          <label>Foto da família <span class="mudo">(opcional)</span></label>
          <CampoFoto v-model="foto" :nome="casa || nome" :tamanho="72" />
        </div>

        <div class="campo">
          <label>E-mail</label>
          <input v-model="email" type="email" autocomplete="email"
                 :disabled="convidado" placeholder="seu@email.com" />
        </div>

        <div class="campo">
          <label>Senha</label>
          <input v-model="senha" type="password" autocomplete="new-password"
                 placeholder="ao menos 8 caracteres" />
          <div v-if="senha" class="forca">
            <div class="forca-barra">
              <i :style="{ width: (forcaSenha.n / 5 * 100) + '%', background: forcaSenha.cor }"></i>
            </div>
            <span class="pequeno" :style="{ color: forcaSenha.cor }">{{ forcaSenha.txt }}</span>
          </div>
        </div>

        <div class="campo">
          <label>Repita a senha</label>
          <input v-model="senha2" type="password" autocomplete="new-password"
                 placeholder="••••••••" @keyup.enter="criar" />
        </div>

        <div v-if="erro" class="aviso mal" style="margin-bottom:14px">{{ erro }}</div>

        <button class="btn" style="width:100%" :disabled="carregando" @click="criar">
          {{ carregando ? 'Criando…' : 'Criar minha conta' }}
        </button>

        <div class="centro pequeno" style="margin-top:18px">
          Já tem conta? <NuxtLink to="/login"><strong>Entrar</strong></NuxtLink>
        </div>
      </template>
    </div>

    <div class="rodape-privacidade">
      <a href="/sowwell/privacidade.html" target="_blank">Privacidade</a>
      ·
      <a href="/sowwell/excluir-conta.html" target="_blank">Excluir conta</a>
    </div>
  </div>
</template>

<style scoped>
.forca { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.forca-barra {
  flex: 1; height: 4px; background: #E9EEF5; border-radius: 999px; overflow: hidden;
}
.forca-barra i { display: block; height: 100%; transition: width .2s; }

.botao-texto {
  background: none; border: 0; padding: 0; font: inherit;
  color: var(--azul-forte); text-decoration: underline; cursor: pointer;
}
.botao-texto.mudo { color: var(--tinta-45); }
</style>
