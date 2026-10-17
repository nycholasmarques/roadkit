# Changelog

Todas as mudanças relevantes ficam aqui, da mais nova para a mais antiga. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [versionamento semântico](https://semver.org/lang/pt-BR/).

Cada release no GitHub também lista automaticamente os commits desde a versão anterior; este arquivo é onde ficam os destaques escritos à mão. Para publicar uma versão, veja [`docs/publicando-versoes.md`](docs/publicando-versoes.md).

## [1.6.0] - não lançada

### App instalável e offline
- O Roadkit virou um app instalável (PWA): ícone próprio, janela sem a barra do navegador e **Ajustes → Instalar como app**.
- Depois de aberto uma vez, ele **abre sem internet**, com a interface e uma cópia de todos os roadmaps da lista, mesmo os que você nunca abriu naquele aparelho. Progresso e notas feitos offline sobem quando a conexão volta.
- Quando sai uma versão nova, uma faixa oferece **Recarregar**; o app nunca recarrega sozinho.
- A API nunca vem de cache, e a página exportada para compartilhar continua sendo um arquivo único, sem service worker.

### Por dentro
- `src/sw.js` (sem bibliotecas), servido em `/sw.js` com uma versão calculada a partir dos arquivos da interface; `src/manifest.webmanifest`; ícones gerados por `tools/icons.py`, só com a biblioteca padrão.
- O guia de Docker e rede explica o HTTPS necessário para instalar fora do `localhost` (Tailscale ou Caddy).

## [1.5.0] - 2026-10-17

### Exportar e compartilhar
- O botão **Exportar** virou um menu: o `.zip` de sempre, **Markdown** (o roadmap em texto com `- [x]`, projetos e, se quiser, as notas) e **página para compartilhar**.
- A **página para compartilhar** é um `.html` único que abre em qualquer navegador, sem servidor e sem internet: o próprio Roadkit, congelado no progresso do dia, somente leitura, com mapa, kanban, projetos e painéis. As notas vão junto só se você quiser.
### Datas
- **Começo do roadmap**: com o dia em que você começou, os períodos das fases e os prazos dos tópicos ("Semanas 1 e 2", "Mês 2") viram datas no mapa e no painel, com um aviso no que passou da data.
- O JSON aceita `meta.startDate` e `due` em fases e tópicos, que valem mais que as datas calculadas. O `check` valida o formato e avisa quando uma fase vence antes da anterior.

## [1.4.0] - 2026-10-16

### Busca e atalhos
- `Ctrl+K` (ou a lupa no topo) abre uma busca que vai para qualquer tópico ou projeto de todos os roadmaps, para os próprios roadmaps e para as ações. Ela ignora acentos e aceita letras pulando no meio, e mostra o estado de cada tópico e os itens abertos por último.
- Atalhos de uma letra: `/` busca, `M` `K` `P` visualizações, `N` próximo tópico, `J` `L` anterior e seguinte, `1` a `4` estados, `T` modo claro ou escuro e `?` a lista de atalhos. Eles não disparam enquanto você digita e podem ser desligados nos ajustes.
- No celular, a busca ocupa a tela inteira.

### Por dentro
- O `manifest.json` traz um índice leve dos tópicos e projetos de cada roadmap, para a busca não precisar baixar todos os arquivos.

## [1.3.0] - 2026-10-16

### Notas
- Cada tópico e cada projeto tem um bloco **Minhas notas** no painel, em Markdown, com as abas Escrever e Ver. O texto é salvo sozinho no servidor e funciona offline, como o progresso.
- O Markdown aceita títulos, negrito, itálico, listas, código, citações, links e caixas `- [ ]`, que dá para marcar na própria visualização. Nada do que você escreve vira HTML.
- Cartões com notas ganham um ícone, e a busca do topo também procura dentro das notas.
- **Notas do roadmap**, nas ferramentas, junta a nota geral do roadmap e todas as notas em ordem, e copia tudo em Markdown.
- As notas vão no export (`notes.json`) e voltam no import. Excluir um roadmap com o progresso também apaga as notas.

## [1.2.1] - 2026-10-16

### Segurança
- O servidor deixou de entregar arquivos da pasta de dados e do código quando o endereço vinha codificado (por exemplo `/%64ata/<id>.json`). Antes, isso permitia ler o progresso salvo sem passar pela API e, portanto, sem o token. Afeta as versões 1.0.0 a 1.2.0; atualize se você abre o Roadkit para outros aparelhos.

## [1.2.0] - 2026-10-16

### Projetos
- Roadmaps podem trazer projetos práticos em três níveis (iniciante, intermediário e avançado), num campo novo e opcional `projects`. Roadmaps sem projetos ficam exatamente como eram.
- Uma tela **Projetos** ao lado de Mapa e Kanban, com uma coluna por nível (abas no celular), o estado de cada projeto, os tópicos que ele usa e o andamento dos requisitos.
- No painel do projeto: estados, requisitos para marcar, entregável, critério de sucesso, ideias para ir além e um campo para o link do seu repositório. Tudo salvo no servidor, junto com o progresso.
- Um projeto fica "pronto para começar" quando você conclui os tópicos que ele usa, com um aviso na hora e um filtro para ver só esses.
- O painel de cada tópico lista os projetos que o usam.
- O editor ganhou uma seção de projetos, o **Criar com IA** pode pedir projetos junto, e a skill para agentes sabe escrevê-los.
- Os exemplos de Argo CD e SQL, nas duas línguas, trazem projetos.

### Por dentro
- O servidor passou a guardar as partes do progresso que um cliente não manda. Assim, um navegador com a versão anterior não apaga os projetos salvos por esta.
- O `check` e o schema validam os projetos: nível, ids repetidos e tópicos que não existem.

## [1.1.0] - 2026-10-16

### Temas
- Sete temas no lugar de só claro e escuro: Claro, Névoa e Papel no modo claro; Noite, Grafite, Ameixa e Breu no modo escuro.
- Os ajustes separam o modo (claro, escuro ou automático) do tema, com uma prévia de cada um. No automático dá para escolher um tema para cada modo do sistema.
- Névoa e Breu pensados para telas grandes: menos brilho no claro, preto de verdade no escuro.
- Quem já usava o Roadkit continua com o mesmo visual: os temas padrão são o Claro e o Noite de antes.

## [1.0.0] - 2026-10-16

A primeira versão estável. O formato do JSON dos roadmaps e a API do servidor passam a seguir o versionamento semântico: mudanças que quebrem roadmaps existentes só entram numa versão 2.

### Interface
- Mapa e kanban para o mesmo roadmap, com quatro estados por tópico, tarefas dentro dos tópicos e subtópicos em até dois níveis.
- Seletor de roadmaps com o andamento de cada um e selo de concluído, e uma tela para gerenciar: abrir, duplicar, ocultar e restaurar.
- Barras laterais que se redimensionam, e a da esquerda recolhe para uma faixa de ícones.
- Temas claro e escuro, quatro tamanhos de texto e idioma da interface (português e inglês).
- Aviso opcional quando um tópico avança sem os anteriores estarem concluídos.

### Criar roadmaps
- Editor em tela própria, com o formulário de um lado e a prévia ao vivo do outro. Cobre fases, tópicos, subtópicos, opcionais, cores, logo e categoria, e tem uma aba com o JSON completo.
- Validação enquanto você digita, com as mesmas regras do `check`.
- **Criar com IA**: monta um prompt a partir do objetivo, e a resposta da IA volta para o editor. Não usa chave de API.
- Skill para agentes de código em `.agents/skills/roadkit/`.
- Categorias: cada subpasta de `roadmaps/` vira uma seção, e o editor grava roadmaps na categoria escolhida.

### Progresso e dados
- O progresso é salvo no servidor e usado como cache no navegador, então vale em qualquer aparelho e continua funcionando se o servidor cair.
- Exportar e importar roadmap e progresso num `.zip`.
- Token opcional (`ROADKIT_TOKEN`) para proteger a leitura e a escrita.

### Servidor e distribuição
- Servidor em Python, só com a biblioteca padrão, e comandos `serve`, `check` e `index`.
- Imagem Docker com volume para os dados e a pasta `roadmaps/` somente leitura.
- Documentação em `docs/` e GIFs gerados por um script.

[1.6.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.6.0
[1.5.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.5.0
[1.4.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.4.0
[1.3.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.3.0
[1.2.1]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.2.1
[1.2.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.2.0
[1.1.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.1.0
[1.0.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.0.0
