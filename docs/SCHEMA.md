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

Todos os campos além de `id` e `title` são opcionais; seções vazias não aparecem.

### Ordem e layout

- Tópicos principais (não opcionais) descem pela coluna central **na ordem do array**, e precisam estar agrupados por fase na ordem das fases.
- Opcionais ficam à direita do tópico âncora (vários na mesma âncora empilham). Podem estar em qualquer posição do array.
- O layout é calculado no navegador a partir da altura real de cada card. Não existem coordenadas no JSON.
