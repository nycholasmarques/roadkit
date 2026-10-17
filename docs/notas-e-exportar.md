# Notas, exportar e compartilhar

O que você aprende não cabe num "concluído". As notas guardam o comando que funcionou e a decisão que você tomou, e o exportar leva tudo para fora: para outra máquina, para um README ou para uma página que qualquer pessoa abre.

<p align="center">
  <img src="media/notas.gif" alt="Escrevendo uma nota em Markdown, vendo formatada, marcando uma caixa e abrindo as notas do roadmap" width="100%">
</p>

## Notas

Cada tópico e cada projeto tem um bloco **Minhas notas** no painel. É seu, não faz parte do roadmap: o comando que funcionou, o link que faltava, a dúvida que ficou, a decisão que você tomou no projeto.

- **Escrever** abre uma caixa de texto que cresce com o conteúdo. O texto é salvo sozinho, meio segundo depois de você parar de digitar, e uma linha embaixo diz se foi para o servidor ("Salvo") ou ficou só no navegador. Sem servidor, nada se perde: a nota sobe quando ele voltar.
- **Ver** mostra o texto formatado. Aceita o básico de Markdown: títulos (`#`), **negrito**, *itálico*, listas, `código`, blocos de código, citações, links e caixas `- [ ]`, que dá para marcar ali mesmo.
- Tópicos e projetos com notas ganham um ícone no cartão, no mapa, no kanban e na tela de projetos.
- A busca do topo também procura dentro das notas.
- **Notas do roadmap**, nas ferramentas da barra lateral, junta tudo numa tela: uma nota geral do roadmap no topo e, embaixo, as notas de cada tópico e projeto, em ordem, com um atalho para cada um. **Copiar tudo em Markdown** leva o conjunto para o Obsidian, um README ou um issue.

As notas vão junto no **Exportar** (um `notes.json` dentro do zip) e voltam no **Importar**. Reiniciar as marcações não apaga as notas; excluir um roadmap com "apagar o progresso e as notas" apaga.

## Exportar, compartilhar e importar

**Exportar** abre um menu com três saídas:

- **Roadmap e progresso (.zip)**: uma pasta com o nome do roadmap, e dentro dela o JSON do roadmap, um `progress.json` e as suas notas. É um jeito de levar tudo para outra máquina ou de guardar uma cópia.
- **Markdown (.md)**: o roadmap em texto, com fases como títulos, `- [x]` no que está concluído, tarefas, desafios, links, projetos e, se você quiser, as suas notas no fim. Abre bem no GitHub e no Obsidian.
- **Página para compartilhar (.html)**: um arquivo só, que abre em qualquer navegador **sem servidor e sem internet**. É o próprio Roadkit, com o mapa, o kanban, os projetos e os painéis, congelado no progresso de hoje e somente leitura. Uma faixa no topo diz de quando é o progresso. Serve para mandar a um mentor ou publicar no GitHub Pages. A caixa "Incluir minhas notas" decide se as notas vão junto.

### Datas

No mesmo menu, **Começo do roadmap** recebe o dia em que você começou (ou vai começar). A partir dele, os períodos das fases e os prazos dos tópicos ("Semanas 1 e 2", "Semana 3", "Mês 2") viram datas: a bandeira de cada fase no mapa e o painel de cada tópico mostram "até 14 de set.", e o que passou da data sem estar concluído ganha um aviso amarelo. A data é sua e fica com o progresso; quem escreve o roadmap também pode fixar datas no JSON (`startDate`, `due`), que valem mais que as calculadas. Sem data nenhuma, nada muda na tela.

### Importar

**Importar** lê esse zip de volta: se o roadmap já existe aqui, só o progresso é aplicado, e se não existe ele abre a partir do arquivo (para guardar de vez, copie o JSON para a pasta `roadmaps/`). Também aceita um `progress.json` solto ou um JSON de roadmap.

Arrastar um `.json` para a janela ou usar **Abrir arquivo JSON** mostra um roadmap sem guardar nada no servidor.
