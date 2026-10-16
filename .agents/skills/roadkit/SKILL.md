---
name: roadkit
description: Cria, revisa e organiza roadmaps do Roadkit (arquivos JSON em roadmaps/) conversando com a pessoa. Use quando pedirem para montar um roadmap de estudos, de um projeto ou de uma meta, quebrar um objetivo em fases e tópicos, ajustar ou estender um roadmap que já existe, ou validar um JSON de roadmap. Triggers - "roadmap", "trilha de estudos", "plano de estudos", "roadkit", "criar um roadmap", "study plan", "learning path".
---

# Roadkit: criar roadmaps conversando

O Roadkit desenha um roadmap interativo (mapa e kanban) a partir de um JSON. Seu trabalho aqui é transformar uma conversa em um JSON bom, validado e no lugar certo. O formato completo está em `docs/SCHEMA.md`; o que faz um roadmap ser bom está em `docs/criar-roadmaps.md`. Leia os dois se ainda não leu nesta sessão, e olhe `examples/pt-BR/argocd.json` como modelo de um roadmap completo (fases, tarefas, subtópicos e opcionais).

## 1. Entenda o que a pessoa quer

Pergunte só o que falta. Se ela já contou o objetivo, não repita a pergunta. O que importa saber:

- **Objetivo**: aprender X, tocar um projeto, chegar numa meta. Qual o resultado concreto no fim?
- **Ponto de partida**: o que já sabe. Isso decide por onde começar.
- **Tempo**: prazo e quantas horas por semana. Define o número de fases e o ritmo dos prazos (`time`).
- **Idioma** do roadmap (`pt-BR` ou `en`) e **categoria**, que é a pasta onde ele vai ficar (`estudos`, `trabalho`, `jogos`...).
- **Projetos práticos**: se a pessoa quer, além dos tópicos, projetos para construir do iniciante ao avançado. Num roadmap de estudo, ofereça; num roadmap que já é um projeto, normalmente não faz sentido.

Faça no máximo três ou quatro perguntas por vez, de preferência numa mensagem só. Se a pessoa não quiser responder, escolha o padrão mais razoável e diga qual foi.

## 2. Mostre o esqueleto antes do JSON

Antes de escrever o arquivo, mostre em texto simples as fases e os tópicos em ordem, uma linha por tópico, com o prazo. Se houver projetos, liste-os por nível, cada um com os tópicos que usa. Peça o ok ou ajustes. É muito mais barato mudar uma lista de dez linhas do que um JSON de trezentas.

## 3. Escreva o JSON

Siga `docs/SCHEMA.md`. Resumo do que mais erra:

- Todo `id` é um slug (`a-z`, `0-9`, hífen), único dentro da sua lista. O `id` do roadmap é a chave do progresso salvo: **nunca mude o id de um roadmap que já existe**.
- `nodes` traz os tópicos principais na ordem em que serão feitos, agrupados por fase na mesma ordem de `phases`.
- Subtópicos usam `"parent": "<id do pai>"`, no máximo 2 níveis abaixo de um tópico principal, e herdam a fase do pai. Escreva cada subtópico logo depois do pai. Um tópico com subtópicos obrigatórios só fica concluído quando todos eles estiverem.
- Exploração que não deve travar o progresso é `"optional": true` (e também precisa de `parent`). Filhos de um opcional também devem ser opcionais.
- Título com até 60 caracteres. `challenge` é algo concreto que a pessoa consegue conferir sozinha. `tasks` só quando o tópico realmente se divide em passos (3 a 6).
- Só coloque `links` que você tem certeza de que existem (documentação oficial). Na dúvida, deixe de fora.
- Projetos ficam em `projects` (veja a seção no `docs/SCHEMA.md`): `level` é `beginner`, `intermediate` ou `advanced`, e `uses` lista os ids dos tópicos que o projeto pratica. Um projeto fica "pronto para começar" quando todos esses tópicos estão concluídos, então escolha tópicos que vêm antes dele. De 2 a 4 projetos por nível e de 3 a 6 `requirements` em cada um. Escreva projetos próprios, sem copiar enunciados de outros sites. `examples/pt-BR/argocd.json` e `sql.json` têm projetos como modelo.
- Não invente campos. Campo sem nada bom para dizer fica de fora.

## 4. Salve no lugar certo

Veja como a pessoa está usando o Roadkit:

- **Repositório local** (existe `tools/roadkit.py`): grave em `roadmaps/<categoria>/<id>.json` (ou direto em `roadmaps/` se não houver categoria). Pasta nova vira seção nova sozinha. Para um título de seção diferente do nome da pasta, crie `_section.json` com `{ "title": "..." }`.
- **Servidor rodando em Docker** (`roadmaps/` montada somente leitura): use a API para gravar no volume de dados:
  ```bash
  curl -X POST "http://localhost:8765/api/roadmaps?category=estudos" \
    -H "Content-Type: application/json" --data-binary @roadmap.json
  ```
  Se o servidor tiver `ROADKIT_TOKEN`, acrescente `-H "Authorization: Bearer <token>"`.
- **Sem acesso a arquivos** (conversa comum): entregue o JSON num bloco de código. A pessoa cola em **Novo roadmap → aba JSON** (a prévia aparece na hora) ou em **Criar com IA → Cole a resposta**.

## 5. Valide e corrija

```bash
python3 tools/roadkit.py check roadmaps/estudos/meu-roadmap.json
```

Erros precisam ser corrigidos; avisos merecem uma olhada (título longo, fase sem tópico principal, muitas tarefas). Rode de novo até ficar limpo. O `check` também atualiza o `manifest.json`.

Sem o repositório à mão, mas com o servidor no ar, dá para validar sem gravar: `curl -X POST http://localhost:8765/api/validate -H "Content-Type: application/json" --data-binary @roadmap.json` devolve `{"errors": [...], "warnings": [...]}`.

## 6. Confira e itere

Diga como abrir (`http://localhost:8765/?r=<id>`) e peça para a pessoa olhar o mapa. Ajustes depois são edições no mesmo arquivo: troque textos, prazos e tarefas à vontade, acrescente tópicos novos no fim da fase certa, mas deixe os `id` que já existem como estão para não perder o progresso.

Para evoluir um roadmap existente, leia o arquivo antes, preserve o que não foi pedido para mudar e mostre um resumo do que mudou.
