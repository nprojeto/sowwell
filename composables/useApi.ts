import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cliente: SupabaseClient | null = null

export function useSupa(): SupabaseClient {
  const cfg = useRuntimeConfig()
  if (!cliente) {
    cliente = createClient(
      cfg.public.supabaseUrl as string,
      cfg.public.supabaseAnonKey as string,
      { auth: { persistSession: true, autoRefreshToken: true } }
    )
  }
  return cliente
}

// Versão do servidor que este site espera encontrar.
// Se não bater, o aviso aparece no topo em vez de erros soltos.
export const VERSAO_ESPERADA = '7.5'

export function useApi() {
  const cfg = useRuntimeConfig()
  const base = `${cfg.public.supabaseUrl}/functions/v1/api`

  async function chamar<T = any>(rota: string, opcoes: any = {}): Promise<T> {
    const supa = useSupa()
    const { data } = await supa.auth.getSession()
    const token = data.session?.access_token

    let resp: Response
    try {
      resp = await fetch(`${base}${rota}`, {
        method: opcoes.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.public.supabaseAnonKey as string,
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
      })
    } catch {
      throw new Error('Sem conexão com o servidor. Verifique sua internet.')
    }

    const texto = await resp.text()
    let json: any = null
    try { json = texto ? JSON.parse(texto) : null } catch { json = null }

    if (!resp.ok) {
      if (resp.status === 404) {
        throw new Error(
          `O servidor não conhece "${rota.split('?')[0]}". ` +
          'Publique a Edge Function mais recente no Supabase.')
      }
      if (resp.status === 401) {
        throw new Error('Sua sessão expirou. Saia e entre de novo.')
      }
      throw new Error(json?.erro ?? texto?.slice(0, 200) ?? `Erro ${resp.status}`)
    }
    return json as T
  }

  return {
    get:    <T = any>(r: string) => chamar<T>(r),
    post:   <T = any>(r: string, body?: any) => chamar<T>(r, { method: 'POST', body }),
    patch:  <T = any>(r: string, body?: any) => chamar<T>(r, { method: 'PATCH', body }),
    remove: <T = any>(r: string) => chamar<T>(r, { method: 'DELETE' })
  }
}

/* ------------------------------------------------------ versão do servidor */
const versaoServidor = ref<string | null>(null)

export async function conferirVersao() {
  if (versaoServidor.value) return versaoServidor.value
  try {
    const r = await useApi().get('/versao')
    versaoServidor.value = String(r?.versao ?? '?')
  } catch {
    versaoServidor.value = 'antiga'
  }
  return versaoServidor.value
}

/* --------------------------------------------------- recursos do plano */
// Guardado em memória para não consultar a cada troca de tela.
const recursosDoPlano = ref<Record<string, boolean> | null>(null)

export async function useRecursos(recarregar = false) {
  if (recursosDoPlano.value && !recarregar) return recursosDoPlano.value
  try {
    const c = await useApi().get('/conta')
    recursosDoPlano.value = c?.plano?.recursos ?? {}
  } catch {
    recursosDoPlano.value = {}
  }
  return recursosDoPlano.value
}

export function limparRecursos() {
  recursosDoPlano.value = null
}

/* ---------------------------------------------------------- arquivos */
// O site vive numa subpasta no GitHub Pages, então os caminhos das
// imagens precisam sair daqui e não escritos à mão.
export function arquivo(nome: string) {
  return `${useRuntimeConfig().app.baseURL}${nome}`.replace(/\/{2,}/g, '/')
}

/* ------------------------------------------------------------ formato */
// Valores da família: escondem quando o olho está fechado.
export const dinheiro = (v: any) => {
  if (sigilo.value) return 'R$ ••••'
  return valor(v)
}

// Valores que NÃO expõem ninguém: o que a pessoa está digitando agora,
// preços de plano, exemplos. Esconder isso só atrapalharia — quem está
// de fora não descobre nada olhando o preço de um plano.
export const valor = (v: any) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(v || 0))

export const dataBr = (d: any) => {
  if (!d) return '—'
  const [a, m, dd] = String(d).slice(0, 10).split('-')
  return `${dd}/${m}/${a}`
}

export const hojeISO = () => {
  const agora = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return agora.toISOString().slice(0, 10)
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
