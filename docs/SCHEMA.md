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
  "nodes": [ ... ]                              // obrigatório
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

A ordem do array define a ordem das fases.

## `nodes[]`

| Campo | Notas |
|---|---|
| `id` (obrigatório) | slug único; chave do progresso |
| `title` (obrigatório) | curto (≤ 60 caracteres) |
| `phase` | id da fase (obrigatório se houver `phases`) |
| `time` | texto livre no card e no painel ("Semana 2") |
| `summary` | parágrafo no painel lateral |
| `topics` | lista de strings (etiquetas) |
| `challenge` | tarefa prática/entregável (caixa amarela) |
| `success` | critério de conclusão |
| `links` | `[{ "title": "…", "url": "https://…" }]` |
| `optional` | `true` = ramo lateral, não conta no progresso |
| `anchor` | obrigatório se `optional`: id de um tópico **principal** |
| `status` | coluna inicial no kanban: `todo`, `working`, `review` ou `finished`. Se omitido, sai das tarefas (ou `todo`) |
| `tasks` | lista de tarefas do tópico, exibidas como um kanban pequeno dentro do card (veja abaixo) |

Todos os campos além de `id` e `title` são opcionais; seções vazias não aparecem.

### Ordem e layout

- Tópicos principais (não opcionais) descem pela coluna central **na ordem do array**, e precisam estar agrupados por fase na ordem das fases.
- Opcionais ficam à direita do tópico âncora (vários na mesma âncora empilham). Podem estar em qualquer posição do array.
- O layout é calculado no navegador a partir da altura real de cada card. Não existem coordenadas no JSON.

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
