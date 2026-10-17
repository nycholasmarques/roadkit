# Formato do roadmap (JSON)

Fonte formal: [`schema/roadmap.schema.json`](../schema/roadmap.schema.json). Regras semânticas: `python3 tools/roadkit.py check`. Esta página explica o que cada campo faz na tela.

```jsonc
{
  "$schema": "../schema/roadmap.schema.json",   // autocompletar no editor
  "schemaVersion": 1,
  "id": "meu-roadmap",                          // obrigatório, slug; chave do progresso salvo; nunca mude
  "meta": { ... },
  "theme": { ... },
  "labels": { ... },
  "phases": [ ... ],                            // opcional
  "nodes": [ ... ],                             // obrigatório
  "projects": [ ... ]                           // opcional
}
```

## `meta`

| Campo | Onde aparece |
|---|---|
| `title` (obrigatório) | título da página, aba do navegador, seletor |
| `eyebrow` | linha pequena em maiúsculas acima do título |
| `subtitle` | linha abaixo do título |
| `description` | frase única usada em listagens |
| `icon` | emoji no painel vazio e no seletor |
| `language` | pacote de textos da interface: `pt-BR` (padrão), `en` |
| `brand` | logo da barra lateral: `{ "plain": "road", "accent": "kit" }` (o `accent` usa a cor `theme.brandAccent`) |
| `tagline` | texto sob o logo; `\n` quebra linha |
| `sidebarNote` | nota no rodapé da barra lateral; `\n` quebra linha |
| `footer` | rodapé da página |
| `defaultView` | tela aberta primeiro: `map` (padrão) ou `kanban`. A escolha de quem usa fica salva por roadmap |
| `startDate` | dia em que o roadmap começa (`AAAA-MM-DD`). Com ele, os `period` das fases e os `time` dos tópicos viram datas. Quem usa pode definir o próprio começo na interface, que vale mais |

## `theme`

`accent` (botões, "Marcar como concluído") e `brandAccent` (destaque do logo), em hex (`#233b65`). Verde é sempre "concluído".

## `labels`

Sobrescreve qualquer texto da interface. As chaves estão em `src/labels/pt-BR.json`. Exemplos úteis: `challenge` ("Desafio prático" por "Entregável"), `success`, `topics`, `markDone`, `doneHint`, `legendHint`.

## `phases[]` (opcional)

Sem `phases`, o mapa é uma lista simples e a navegação por fase some.

| Campo | Notas |
|---|---|
| `id` (obrigatório) | slug, referenciado por `nodes[].phase` |
| `title` (obrigatório) | bandeira ao lado do mapa e item da barra lateral |
| `summary` | texto da bandeira |
| `period` | "Semanas 1 a 3", "Q1"… (livre) |
| `color` | hex; se omitido usa uma paleta |
| `milestone` | marco exibido depois do último tópico principal da fase; fica verde quando a fase inteira está concluída. |
| `due` | data alvo da fase (`AAAA-MM-DD`), mostrada na bandeira da fase; vale mais que a calculada pelo `period`. O `check` avisa se uma fase vence antes da anterior |

A ordem do array define a ordem das fases.

## `nodes[]`

| Campo | Notas |
|---|---|
| `id` (obrigatório) | slug único; chave do progresso |
| `title` (obrigatório) | curto (≤ 60 caracteres) |
| `phase` | id da fase (obrigatório nos tópicos principais se houver `phases`; subtópicos herdam a do pai) |
| `time` | texto livre no card e no painel ("Semana 2") |
| `summary` | parágrafo no painel lateral |
| `topics` | lista de strings (etiquetas) |
| `challenge` | tarefa prática/entregável (caixa amarela) |
| `success` | critério de conclusão |
| `links` | `[{ "title": "…", "url": "https://…" }]` |
| `parent` | id do tópico de que este é subtópico (veja "Árvore" abaixo) |
| `optional` | `true` = ramo lateral, não conta no progresso nem no tópico pai. Precisa de `parent` |
| `anchor` | nome antigo de `parent`, usado só por opcionais. Ainda funciona |
| `status` | coluna inicial no kanban: `todo`, `working`, `review` ou `finished`. Se omitido, sai das tarefas (ou `todo`) |
| `tasks` | lista de tarefas do tópico, exibidas como um kanban pequeno dentro do card (veja abaixo) |
| `due` | data alvo do tópico (`AAAA-MM-DD`); vale mais que a calculada pelo `time` |

Todos os campos além de `id` e `title` são opcionais; seções vazias não aparecem.

### Ordem e layout

- Tópicos principais (sem `parent` e não opcionais) descem pela coluna central **na ordem do array**, e precisam estar agrupados por fase na ordem das fases.
- Subtópicos e opcionais ficam à direita do pai (vários no mesmo pai empilham) e podem estar em qualquer posição do array.
- O layout é calculado no navegador a partir da altura real de cada card. Não existem coordenadas no JSON.

### Árvore: subtópicos e opcionais

Um tópico pode ter filhos com `parent`, até **2 níveis** abaixo de um tópico principal (principal, filho e neto):

```jsonc
{ "id": "instalar", "title": "Instalar o Argo CD", "phase": "base" },
{ "id": "via-helm", "title": "Via Helm", "parent": "instalar" },
{ "id": "values", "title": "Values do chart", "parent": "via-helm" },
{ "id": "hooks", "title": "Hooks", "parent": "via-helm", "optional": true }
```

- Filhos aparecem nas colunas da direita, ligados ao pai. Em telas estreitas ficam aninhados abaixo dele.
- O filho herda a fase do pai.
- **Subtópicos obrigatórios** (sem `optional`) comandam o pai: o pai fica concluído quando todos eles (e as suas `tasks`) estiverem. Marcar o pai como concluído conclui tudo abaixo dele, e reabrir o pai reabre. Só os tópicos principais contam no progresso geral.
- **Opcionais** não contam em nada: nem no progresso, nem para concluir o pai.
- Ciclos e profundidade acima de 2 são erros no `check`; a interface tolera e sobe o nó um nível.

## Kanban

A interface tem duas telas para o mesmo roadmap: **Mapa** e **Kanban**. O kanban do roadmap tem quatro colunas (`todo`, `working`, `review`, `finished`, com os nomes em `labels`: `kanbanTodo`, `kanbanWorking`, `kanbanReview`, `kanbanFinished`) e cada tópico é um cartão que se arrasta entre elas. Tópico em `finished` conta como concluído no progresso e no mapa.

Qualquer tópico pode ter `tasks`, que viram um kanban pequeno no painel de detalhes, com as mesmas quatro colunas:

```jsonc
{
  "id": "setup",
  "title": "Ambiente e projeto",
  "tasks": [
    { "id": "instalar-hub", "title": "Instalar o Hub e o editor", "status": "finished" },
    { "id": "criar-projeto", "title": "Criar o projeto", "note": "Template 3D com URP." },
    { "id": "primeiro-commit", "title": "Fazer o primeiro commit" }
  ]
}
```

| Campo da tarefa | Notas |
|---|---|
| `id` (obrigatório) | slug, único dentro do tópico |
| `title` (obrigatório) | curto |
| `note` | linha de apoio abaixo do título |
| `status` | coluna inicial; o padrão é `todo` |

Quando usar: quando o tópico tem passos concretos e verificáveis (de 3 a 8 funcionam bem). Tópicos sem `tasks` continuam sendo só um cartão.

Como o estado do tópico e o das tarefas se relacionam:

- Marcar o tópico como concluído (pelo botão, pelo cartão ou arrastando para `finished`) conclui todas as tarefas. Mover o tópico para `todo` zera todas. Tirar o tópico de `finished` reabre todas na coluna de destino.
- Mover para `working` ou `review` (sem sair de `finished`) muda só o tópico.
- Mover uma tarefa recalcula o tópico: todas concluídas é `finished`; todas em `todo` é `todo`; o restante em `review` ou `finished` é `review`; qualquer outra mistura é `working`.
- Sem `status` no tópico, o estado inicial é calculado do mesmo jeito a partir das tarefas.

Se um tópico avança para `working`, `review` ou `finished` com tópicos principais anteriores ainda não concluídos, o cartão do kanban mostra um alerta (o painel de detalhes também). Quem usa decide quanto tolerar nos ajustes. Tópicos opcionais não geram nem contam para o alerta.

O que a pessoa muda na interface fica salvo no navegador, por roadmap; o JSON só define o ponto de partida. As ordens dentro das colunas seguem a ordem do JSON.

## `projects[]` (opcional)

Projetos práticos que atravessam vários tópicos, em três níveis. Com `projects`, aparece a tela **Projetos** ao lado de Mapa e Kanban; sem, nada muda.

```jsonc
"projects": [
  {
    "id": "api-tarefas",
    "title": "API de tarefas",
    "level": "beginner",
    "summary": "Uma API REST com CRUD de tarefas e persistência em banco.",
    "uses": ["http", "sql-basico"],
    "requirements": [
      { "id": "crud", "title": "Criar, listar, editar e apagar tarefas" },
      { "id": "testes", "title": "Testes para as rotas principais" }
    ],
    "deliverable": "Um repositório com o código e um README de como rodar.",
    "success": "Outra pessoa consegue rodar e usar a API seguindo só o README.",
    "stretch": ["Paginação", "Autenticação com token"],
    "time": "1 a 2 semanas",
    "links": [{ "title": "…", "url": "https://…" }]
  }
]
```

| Campo | Notas |
|---|---|
| `id` (obrigatório) | slug único entre os projetos; chave do progresso do projeto |
| `title` (obrigatório) | curto (≤ 60 caracteres) |
| `level` (obrigatório) | `beginner`, `intermediate` ou `advanced`: a coluna da tela Projetos |
| `summary` | uma frase no cartão e no painel |
| `uses` | ids de `nodes` que o projeto pratica. Quando todos estão concluídos, o projeto fica **pronto para começar** |
| `requirements` | o que o projeto precisa fazer, como checklist; `id` único dentro do projeto |
| `deliverable` | o que entregar (caixa amarela no painel) |
| `success` | como saber que acabou |
| `stretch` | desafios extras (lista de textos), que a pessoa pode marcar; não contam para concluir o projeto |
| `time` | texto livre ("1 a 2 semanas") |
| `links` | `[{ "title": "…", "url": "https://…" }]` |

- Os projetos não entram na barra de progresso do roadmap, que continua medindo os tópicos principais. A tela Projetos tem a própria contagem.
- O andamento de cada projeto (estado, requisitos e desafios extras marcados, e o link do seu repositório) é guardado junto com o progresso, em `state.projects`. Os desafios extras são identificados pelo texto, então reescrever um deles desmarca.
- O `check` aponta `uses` com id que não existe, `level` inválido e ids repetidos, e avisa quando um projeto não tem `uses` nem `requirements`, ou quando há mais de 20 projetos (ou mais de 8 num nível).
- Os rótulos da tela (`viewProjects`, `level_beginner`, `requirements`, `deliverable`, `stretch`...) podem ser trocados por `labels`, como os outros.
