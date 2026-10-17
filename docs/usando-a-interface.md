# Usando a interface

<p align="center">
  <img src="media/visao-geral.gif" alt="Marcando um tópico como concluído, movendo um cartão no kanban e trocando para o tema escuro" width="100%">
</p>

## O que tem na tela

Do lado esquerdo fica a barra lateral: o logo, o seletor de roadmaps, as fases do roadmap aberto e as ferramentas (novo roadmap, exportar, importar, reiniciar, abrir arquivo). No topo do conteúdo estão o título, a barra de progresso, a busca, os botões **Próximo tópico** e **Começar**, o seletor **Mapa / Kanban** e o botão de ajustes. Do lado direito aparece o painel de detalhes do tópico escolhido.

As duas barras laterais dá para arrastar pela borda para ficarem mais largas ou mais estreitas, e um duplo clique volta ao tamanho padrão. A da esquerda também recolhe para uma faixa só de ícones, pelo botão `‹` ao lado do logo, o que ajuda em telas pequenas. O que você escolher fica salvo no navegador.

## O mapa

O mapa desenha os tópicos principais em ordem, de cima para baixo, agrupados por fase. À direita do tópico ficam os subtópicos e as explorações opcionais, ligados por uma linha. Quando um tópico e o próximo estão concluídos, a linha entre eles fica verde.

Clique num tópico para ver o painel de detalhes: o resumo, o que estudar, o desafio prático, o critério para dar por concluído, as tarefas e os links. O quadradinho no canto do cartão marca como concluído sem abrir nada.

**Próximo tópico** pula para o primeiro que ainda não está concluído. **Começar** faz o mesmo e é o que aparece em destaque, porque é o que você quer na primeira vez.

## O kanban

O botão **Kanban** troca o mapa por um quadro com quatro colunas: a fazer, em andamento, em revisão e concluído. Cada tópico é um cartão. Arraste de uma coluna para outra com o mouse, ou use as setas que aparecem no cartão (útil no teclado e no celular).

<p align="center">
  <img src="media/kanban.png" alt="O quadro kanban com os tópicos do roadmap do Argo CD" width="88%">
</p>

O estado do tópico é o mesmo nas duas telas. Mover um cartão no kanban muda a cor no mapa, e vice-versa.

## Projetos

Alguns roadmaps trazem projetos práticos, e aí aparece um terceiro botão: **Mapa / Kanban / Projetos**. A tela mostra uma coluna por nível (iniciante, intermediário e avançado; no celular, abas). Cada cartão diz o estado do projeto, os tópicos que ele usa (em verde os que você já concluiu) e quantos requisitos já estão marcados.

Um projeto fica **pronto para começar** quando todos os tópicos que ele usa estão concluídos. O cartão ganha um selo, e a caixa **Só os que posso começar agora** esconde o resto. Quando você conclui o tópico que faltava, um aviso aparece uma vez no rodapé da tela, com um atalho para o projeto.

Clicar num projeto abre o painel dele, com o mesmo jeito do painel de um tópico:

- os quatro estados (a fazer, em andamento, em revisão, concluído);
- os tópicos que ele usa, cada um com o seu estado, e um aviso discreto se ainda faltar algum. Não bloqueia nada;
- os **requisitos**, como caixas de marcar. Marcar o primeiro passa o projeto para "em andamento". Marcar o projeto como concluído marca todos, e voltar para "a fazer" desmarca todos, como acontece com as tarefas de um tópico;
- o entregável e o critério de sucesso;
- **Para ir além** 🔥: desafios extras, que também dá para marcar. Eles ficam em tons de fogo, e cada um que você encara acende a chama. Não contam para concluir o projeto, e o cartão mostra quantos você já fez (🔥 1/2);
- **Seu repositório**: cole o link do seu código para lembrar onde está. Ele fica salvo com o progresso e vira um botão para abrir.

No painel de um tópico, a seção **Projetos que usam este tópico** leva aos projetos ligados a ele. Os projetos não entram na barra de progresso do topo: ela continua medindo os tópicos principais, e a tela de projetos tem a própria contagem.

## Notas

Cada tópico e cada projeto tem um bloco **Minhas notas** no painel. É seu, não faz parte do roadmap: o comando que funcionou, o link que faltava, a dúvida que ficou, a decisão que você tomou no projeto.

- **Escrever** abre uma caixa de texto que cresce com o conteúdo. O texto é salvo sozinho, meio segundo depois de você parar de digitar, e uma linha embaixo diz se foi para o servidor ("Salvo") ou ficou só no navegador. Sem servidor, nada se perde: a nota sobe quando ele voltar.
- **Ver** mostra o texto formatado. Aceita o básico de Markdown: títulos (`#`), **negrito**, *itálico*, listas, `código`, blocos de código, citações, links e caixas `- [ ]`, que dá para marcar ali mesmo.
- Tópicos e projetos com notas ganham um ícone no cartão, no mapa, no kanban e na tela de projetos.
- A busca do topo também procura dentro das notas.
- **Notas do roadmap**, nas ferramentas da barra lateral, junta tudo numa tela: uma nota geral do roadmap no topo e, embaixo, as notas de cada tópico e projeto, em ordem, com um atalho para cada um. **Copiar tudo em Markdown** leva o conjunto para o Obsidian, um README ou um issue.

As notas vão junto no **Exportar** (um `notes.json` dentro do zip) e voltam no **Importar**. Reiniciar as marcações não apaga as notas; excluir um roadmap com "apagar o progresso e as notas" apaga.

## Como o progresso é contado

Só os tópicos principais contam na barra de progresso do topo. Os outros níveis têm regras próprias:

- **Tarefas.** Um tópico pode ter uma lista de tarefas, que aparece como um kanban pequeno no painel de detalhes. O estado do tópico acompanha as tarefas: quando todas estão concluídas, ele também está. Marcar o tópico como concluído conclui todas as tarefas de uma vez, e reabrir o tópico reabre tudo.
- **Subtópicos.** Funcionam do mesmo jeito, só que com tópicos no lugar de tarefas. Um tópico com subtópicos obrigatórios só fica concluído quando todos estiverem. Os subtópicos não entram sozinhos na barra de progresso, quem entra é o tópico principal.
- **Opcionais.** Ficam do lado, com a borda tracejada, e não contam para nada. São para explorar se der vontade, sem travar o resto.

## O aviso de tópicos pulados

Se você move um tópico para frente no kanban sem ter concluído os anteriores, o cartão ganha um ícone de alerta. Clicar nele mostra, dentro do próprio cartão, o que ficou para trás. Não bloqueia nada, é só um lembrete. Em **Ajustes** dá para escolher a tolerância: avisar sempre, deixar passar até 3 ou 5 pendentes, ou nunca avisar.

## Trocando de roadmap

O seletor da barra lateral mostra cada roadmap com a sua barrinha de progresso, e um selo verde quando ele está concluído. Os roadmaps ficam em seções, que são as pastas onde estão os arquivos (veja [Criando roadmaps](criar-roadmaps.md#categorias)).

No rodapé do seletor está **Gerenciar roadmaps**, a lista completa. Dali dá para abrir, duplicar e ocultar qualquer roadmap, e editar ou excluir os que foram criados pela interface. Os que vêm de arquivos na pasta `roadmaps/` não podem ser apagados daqui, porque o servidor não mexe nos seus arquivos: ocultar tira da lista sem apagar nada, e dá para restaurar depois.

## Ajustes

O botão no canto superior direito abre os ajustes: modo (claro, escuro ou automático), tema, tamanho do texto, idioma da interface e a tolerância do aviso de pulados. O idioma em "automático" segue o `meta.language` do roadmap aberto. Escolher um idioma fixo vale para qualquer roadmap.

O modo diz se a tela é clara ou escura, e o tema escolhe as cores de cada um. Há três temas claros e quatro escuros:

| Tema | Modo | Para quê |
|---|---|---|
| Claro | claro | o padrão, branco e azulado |
| Névoa | claro | cinza suave: menos brilho em monitores grandes |
| Papel | claro | sépia quente, bom para ler por muito tempo |
| Noite | escuro | o padrão, escuro puxado para o azul |
| Grafite | escuro | escuro neutro, sem tom de azul |
| Ameixa | escuro | escuro com um toque de violeta |
| Breu | escuro | preto de verdade, para telas OLED e salas escuras |

No modo automático aparecem as duas fileiras: você escolhe um tema para quando o sistema está claro e outro para quando está escuro. Em todos eles o verde continua sendo "concluído" e o amarelo, "em revisão", e as cores do roadmap (`theme.accent`) continuam valendo. A escolha fica salva no navegador.

Na última linha dos ajustes aparece o estado do salvamento: se o progresso está sendo guardado no servidor ou só neste navegador.

## Exportar e importar

**Exportar** baixa um `.zip` com uma pasta com o nome do roadmap, e dentro dela o JSON do roadmap e um `progress.json`. É um jeito de levar tudo para outra máquina ou de guardar uma cópia. **Importar** lê esse zip de volta: se o roadmap já existe aqui, só o progresso é aplicado, e se não existe ele abre a partir do arquivo (para guardar de vez, copie o JSON para a pasta `roadmaps/`). Também aceita um `progress.json` solto ou um JSON de roadmap.

Arrastar um `.json` para a janela ou usar **Abrir arquivo JSON** mostra um roadmap sem guardar nada no servidor.

## No celular

Em telas estreitas o mapa vira uma linha do tempo de uma coluna só, com as fases como atalhos no topo, e o painel de detalhes abre por cima, como uma gaveta. O kanban ganha uma faixa fixa com as quatro colunas durante o arrasto, para soltar o cartão sem precisar rolar a página.
