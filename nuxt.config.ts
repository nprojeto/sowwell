export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  app: {
    // Nome do repositorio no GitHub. Se mudar o repo, mude AQUI e o resto
    // se ajusta sozinho: os caminhos de imagem saem do helper arquivo().
    baseURL: '/sowwell/',
    buildAssetsDir: 'assets',
    head: {
      title: 'Sow Well Everyday',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#FF8A00' },
        { name: 'description', content: 'Sow Well Everyday — o controle financeiro da família.' }
      ],
      script: [
        {
          // roda antes de desenhar: evita o clarão branco no tema escuro
          innerHTML: `(function(){try{var t=localStorage.getItem('sowwell:tema');`
            + `var e=t==='escuro'||((!t||t==='sistema')&&matchMedia('(prefers-color-scheme: dark)').matches);`
            + `document.documentElement.setAttribute('data-tema',e?'escuro':'claro');}catch(x){}})()`,
          type: 'text/javascript'
        },
        {
          // liga o trabalhador de segundo plano, exigido para o app
          innerHTML: `if('serviceWorker' in navigator){addEventListener('load',`
            + `function(){navigator.serviceWorker.register('/sowwell/sw.js')`
            + `.catch(function(){});});}`,
          type: 'text/javascript'
        }
      ],
      link: [
        // porquinho da marca, embutido para carregar sempre
        { rel: 'icon', type: 'image/png',
          href: 'data:image/png;base64,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' },
        { rel: 'apple-touch-icon', href: '/sowwell/apple-touch-icon.png' },
        { rel: 'manifest', href: '/sowwell/manifest.webmanifest' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap'
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0&display=block'
        }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      supabaseUrl: 'https://fryfijwveqwdssufkprt.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyeWZpand2ZXF3ZHNzdWZrcHJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTk4NjgsImV4cCI6MjEwMzA5NTg2OH0.EB2xo6PR9Bye-Beoxmn00qLKQh4pmby2yTIQ33Y0nSs'
    }
  }
})
