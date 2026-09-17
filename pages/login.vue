<script setup lang="ts">
const { escuroAgora, alternar } = useTema()
const supa = useSupa()
const email = ref('')
const senha = ref('')
const erro = ref('')
const carregando = ref(false)
const jaEntrado = ref('')
const saindo = ref(false)

onMounted(async () => {
  const { data } = await supa.auth.getSession()
  jaEntrado.value = data.session?.user?.email ?? ''
})

async function trocarConta() {
  saindo.value = true
  limparRecursos()
  await supa.auth.signOut()
  jaEntrado.value = ''
  saindo.value = false
}

async function entrar() {
  erro.value = ''
  if (!email.value.trim() || !senha.value) {
    erro.value = 'Preencha e-mail e senha.'
    return
  }
  carregando.value = true
  // se havia outra sessão aberta, ela sai antes — senão o navegador
  // continuaria com a conta anterior
  if (jaEntrado.value) {
    limparRecursos()
    await supa.auth.signOut()
  }

  const { error } = await supa.auth.signInWithPassword({
    email: email.value.trim().toLowerCase(), password: senha.value
  })
  carregando.value = false
  if (error) {
    erro.value = error.message.includes('Email not confirmed')
      ? 'Confirme seu e-mail antes de entrar. Veja a caixa de entrada.'
      : 'E-mail ou senha não conferem.'
    return
  }
  await navigateTo('/')
}
</script>

<template>
  <div class="portao">
    <button class="tema-flutuante" :title="escuroAgora ? 'Tema claro' : 'Tema escuro'"
            @click="alternar">
      <i class="mi">{{ escuroAgora ? 'light_mode' : 'dark_mode' }}</i>
    </button>

    <div class="portao-caixa">
      <img :src="arquivo('logo.png')" alt="Sow Well Everyday" class="portao-logo" />
      <div class="portao-marca">Sow<em>Well</em></div>
      <div class="portao-sub">Everyday</div>

      <div v-if="jaEntrado" class="aviso" style="margin-bottom:18px">
        <strong>Você já está entrado</strong> como {{ jaEntrado }}.
        <div class="linha-flex" style="margin-top:10px">
          <NuxtLink to="/" class="btn mini">Continuar assim</NuxtLink>
          <button class="btn claro mini" :disabled="saindo" @click="trocarConta">
            {{ saindo ? 'Saindo…' : 'Entrar com outra conta' }}
          </button>
        </div>
      </div>

      <div class="campo">
        <label>E-mail</label>
        <input v-model="email" type="email" autocomplete="email"
               placeholder="seu@email.com" @keyup.enter="entrar" />
      </div>

      <div class="campo">
        <label>Senha</label>
        <input v-model="senha" type="password" autocomplete="current-password"
               placeholder="••••••••" @keyup.enter="entrar" />
      </div>

      <div v-if="erro" class="aviso mal" style="margin-bottom:14px">{{ erro }}</div>

      <button class="btn" style="width:100%" :disabled="carregando" @click="entrar">
        {{ carregando ? 'Entrando…' : 'Entrar' }}
      </button>

      <div class="centro pequeno" style="margin-top:18px">
        <NuxtLink to="/recuperar" class="mudo">Esqueci minha senha</NuxtLink>
      </div>

      <div class="regua-portao"></div>

      <div class="centro pequeno">
        Ainda não tem conta?
        <NuxtLink to="/criar-conta"><strong>Criar agora</strong></NuxtLink>
      </div>
    </div>

    <a class="rodape-privacidade" href="/sowwell/privacidade.html" target="_blank">
      Política de privacidade
    </a>
  </div>
</template>

<style scoped>
.regua-portao {
  height: 1px; background: var(--linha); margin: 20px 0 16px;
}
</style>
