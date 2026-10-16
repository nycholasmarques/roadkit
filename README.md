# Roadkit

Uma interface única para roadmaps interativos, no estilo do roadmap.sh, em que todo o conteúdo vem de arquivos JSON. Título, fases, tópicos, desafios, links, cores e idioma ficam no arquivo. Trocou o JSON, trocou o roadmap.

## Por que existe

Eu queria ter vários roadmaps, tanto de projetos que quero tocar quanto de coisas que quero estudar, todos com a mesma cara e sem precisar refazer a interface a cada um. A ideia é simples: a interface não sabe nada sobre o assunto, ela só desenha o que está no JSON. Para um roadmap novo, basta escrever um arquivo.

## Como usar

```bash
python3 tools/roadkit.py serve      # abre em http://localhost:8765
```

Só precisa de Python 3, sem dependências e sem etapa de build. Abrir o `index.html` direto do disco não funciona, porque o navegador bloqueia a leitura dos JSONs. Use o servidor.

- O seletor **Roadmaps** na barra lateral lista os JSONs de `roadmaps/` (os seus) e de `examples/`.
- `?r=<id>` na URL abre um roadmap específico, por exemplo `http://localhost:8765/?r=estudar-sql`.
- Também dá para arrastar um arquivo `.json` para a página, ou usar "Abrir arquivo JSON", para ver um roadmap sem salvá-lo na pasta.
- O progresso (as marcações nos tópicos) fica no `localStorage` do navegador, separado por roadmap, usando o `id` do JSON. Há botões para exportar e importar o progresso. Como o `localStorage` é por origem, mantenha a mesma porta.

## Criar um roadmap

Copie `examples/minimal.json` para `roadmaps/meu-roadmap.json`, edite e valide:

```bash
python3 tools/roadkit.py check
```

O `check` valida todos os JSONs e atualiza o `manifest.json`. Ele aponta erros (ids duplicados, tópico de origem inexistente, fases fora de ordem, link sem http) e avisos (chaves desconhecidas, títulos longos).

O formato está descrito em [`docs/SCHEMA.md`](docs/SCHEMA.md) e em [`schema/roadmap.schema.json`](schema/roadmap.schema.json). O `$schema` no topo dos exemplos dá autocompletar no VS Code. Resumo:

| Bloco | Para quê |
|---|---|
| `id`, `meta` | identidade, título, subtítulo, logo, textos da barra lateral e do rodapé, idioma |
| `theme` | duas cores: botões e destaque do logo |
| `labels` | troca textos da interface, por exemplo "Desafio prático" por "Entrega" |
| `phases` | etapas com cor, período e marco (opcional) |
| `nodes` | tópicos com resumo, assuntos, desafio, critério de conclusão e links. `optional` com `anchor` cria ramos laterais |

Não há coordenadas no JSON. O layout é calculado no navegador: os tópicos principais descem em ordem pela coluna central, agrupados por fase, e os opcionais ficam à direita do tópico de origem.

O tema da interface pode ser claro, escuro ou automático (segue o sistema). A escolha fica salva no navegador e é feita no botão de ajustes, no canto superior direito.

O layout se adapta à tela: em telas grandes o mapa é ampliado e centralizado, e em telas estreitas (celular, janela pequena) vira uma linha do tempo em coluna única, com as fases como atalhos no topo.

## Kanban

Cada roadmap também pode ser visto como um quadro, pelo seletor **Mapa / Kanban** no topo. O quadro tem quatro colunas (a fazer, em andamento, em revisão, concluído) e cada tópico é um cartão que se arrasta entre elas, com o mouse ou pelo ícone de alça no toque. As setas no cartão fazem o mesmo para quem prefere teclado.

Um tópico pode ter `tasks`: ele ganha um kanban pequeno no painel de detalhes, com as mesmas colunas, para quebrar o tópico em passos. Concluir o tópico conclui todas as tarefas, e mover tarefas atualiza o estado do tópico. As regras completas estão em [`docs/SCHEMA.md`](docs/SCHEMA.md#kanban).

Quando um tópico avança no kanban sem que os anteriores (na ordem do roadmap) estejam concluídos, o cartão ganha um pequeno ícone de alerta. Clicar nele abre um aviso simples, dentro do próprio cartão, listando o que falta. Opcionais não entram nessa conta. A tolerância é ajustável: sempre avisar, tolerar até 3 ou 5 pendentes, ou não avisar.

O botão de ajustes, no canto superior direito, concentra o tema (claro, escuro ou automático), o tamanho do texto (pequeno, normal, grande e muito grande) e a tolerância do aviso. No celular ele também dá acesso a exportar, importar e reiniciar o progresso. Em janelas estreitas o quadro tem uma faixa com as quatro colunas que aparece durante o arrasto, para soltar o cartão sem precisar rolar.

Os textos da interface ficam em `src/labels/` (`pt-BR` e `en`) e são escolhidos por `meta.language`. Para um idioma novo, copie um dos arquivos e traduza.

## Exemplos

| Arquivo | Tipo |
|---|---|
| `examples/minimal.json` | o menor roadmap válido, sem fases |
| `examples/estudar-sql.json` | trilha de estudo em fases |
| `examples/home-lab.json` | projeto pessoal, com rótulos trocados |
| `examples/primeira-meia-maratona.json` | meta sem relação com tecnologia |
| `examples/side-project-saas.json` | projeto em inglês, com cores próprias |

## Docker

```bash
docker compose up -d --build   # http://localhost:8765, reinicia sozinho
docker compose logs -f
docker compose down
```

- `./roadmaps` é montada no contêiner em modo somente leitura. Criou ou editou um JSON, recarregue a página, sem rebuild. A imagem leva só o motor e os exemplos.
- A porta escuta apenas em `127.0.0.1`. Para acessar de outro dispositivo na rede, crie um `.env` com `BIND_ADDR=0.0.0.0` (e `PORT=...` para mudar a porta). O servidor é o `http.server` do Python e não tem autenticação, então não o exponha na internet.
- Mudou algo em `src/` ou `tools/`? Rode o `up -d --build` de novo.

## Estrutura

```
index.html              casca da interface, sem conteúdo
src/app.js, style.css   lê o JSON, calcula o layout e desenha
src/labels/             textos da interface por idioma
roadmaps/               seus roadmaps
examples/               roadmaps de exemplo
schema/                 JSON Schema
tools/roadkit.py        serve, check e index
manifest.json           lista de roadmaps, gerada pelo check e pelo serve
docs/                   referência do formato
```

## Licença

MIT. Veja [`LICENSE`](LICENSE).
