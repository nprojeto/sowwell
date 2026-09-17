// Estamos dentro do aplicativo Android?
//
// O Google exige que conteúdo digital vendido dentro de um app use o
// faturamento dele. Como a assinatura do Sow Well é cobrada no site,
// o app não mostra preço, botão de pagamento nem link para pagar —
// senão a publicação é recusada.
//
// Duas pistas: o app abre com ?origem=app, e o Android identifica a
// origem no referrer. Guardamos no sessionStorage porque as pistas
// somem ao navegar entre telas.

const CHAVE = 'sowwell:noapp'
const noApp = ref(false)
let conferido = false

export function useApp() {
  if (import.meta.client && !conferido) {
    conferido = true
    try {
      const guardado = sessionStorage.getItem(CHAVE) === '1'
      const porEndereco =
        new URL(location.href).searchParams.get('origem') === 'app'
      const porAndroid = String(document.referrer || '').startsWith('android-app://')

      noApp.value = guardado || porEndereco || porAndroid
      if (noApp.value) sessionStorage.setItem(CHAVE, '1')
    } catch {
      noApp.value = false
    }
  }
  return { noApp }
}
