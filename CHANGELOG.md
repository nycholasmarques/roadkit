# Changelog

Todas as mudanças relevantes ficam aqui, da mais nova para a mais antiga. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [versionamento semântico](https://semver.org/lang/pt-BR/).

Para publicar uma versão, veja [`docs/publicando-versoes.md`](docs/publicando-versoes.md).

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

[1.0.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.0.0
