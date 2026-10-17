# Changelog

Todas as mudanças relevantes ficam aqui, da mais nova para a mais antiga. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [versionamento semântico](https://semver.org/lang/pt-BR/).

Cada release no GitHub também lista automaticamente os commits desde a versão anterior; este arquivo é onde ficam os destaques escritos à mão. Para publicar uma versão, veja [`docs/publicando-versoes.md`](docs/publicando-versoes.md).

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

[1.2.1]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.2.1
[1.2.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.2.0
[1.1.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.1.0
[1.0.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.0.0
