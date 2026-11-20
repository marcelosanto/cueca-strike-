# Cueca Strike

![Made with Three.js](https://img.shields.io/badge/Made%20with-Three.js%20%2B%20React%20%2B%20Vite-f43f5e)

Um jogo tático 3D isométrico low-poly com humor absurdo inspirado em Counter-Strike — onde **todos os lutadores têm cabeças gigantes (1:2)** e usam **cuecas ou calcinhas coloridas como capacete**.

## Principais Recursos

- **Headshots com Cuecas Voadoras:** Acertar a cabeça gigante causa dano extra, toca um `BOING! + WHOOSH!` synthwave e faz a cueca sair voando girando pelo ar.
- **Minigame "Costurar Cueca!":** Quando sua cueca leva um tiro na cabeça e você sobrevive, abre-se uma janela de **3 segundos** para completar a sequência de pontos (`Q / E / F` no desktop ou toque nos botões coloridos no mobile). Se conseguir, o capacete é salvo! Se falhar, a cueca se destrói e você fica **careca** pelo restante da rodada.
- **Evolução de Cueca:** Comece com a *Algodão Clássica* e evolua acumulando pontos até *Listrada Náutica*, *Frutinhas Tropicais*, *Neon Synthwave* e *Coroa Dourada*.
- **3 Modos:** Deathmatch, Team Deathmatch (Azul vs Laranja) e Cueca King (última cueca na cabeça vence).
- **3 Mapas:** Canteiro, Mercado e Base Militar.
- **Desktop & Mobile (Landscape):** Joystick virtual, área de mira por arraste, botões tocáveis `>= 44×44px`, suporte a `safe-area-inset-*` e bloqueio de orientação retrato.
- **100% Estático & Procedural:** Texturas, modelos 3D e trilha/efeitos Web Audio gerados em código — zero backend e compatível com GitHub Pages.

## Jogar

https://marcelosanto.github.io/cueca-strike

## Rodar localmente

```bash
npm install
npm run dev
```

Para gerar o build estático otimizado (`./dist`):

```bash
npm run build
```

## Publicar no GitHub Pages

1. O `vite.config.ts` já usa `base: './'`, garantindo caminhos relativos (`./assets/...`) em qualquer subpasta.
2. Execute `npm run build` e publique a pasta `dist/` (via GitHub Actions ou copiando o conteúdo de `dist/` para a raiz da branch `gh-pages` / `main`).
3. No repositório do GitHub, acesse **Settings → Pages → Source** e selecione a branch/pasta publicada.
