# Usando a interface

<p align="center">
  <img src="media/visao-geral.gif" alt="Marcando um tópico como concluído, movendo um cartão no kanban e trocando para o tema escuro" width="100%">
</p>

## O que tem na tela

Do lado esquerdo fica a barra lateral: o logo, o seletor de roadmaps, as fases do roadmap aberto e as ferramentas (novo roadmap, exportar, importar, reiniciar, abrir arquivo). No topo do conteúdo estão o título, a barra de progresso, a busca, os botões **Próximo tópico** e **Começar**, o seletor **Mapa / Kanban** e o botão de ajustes. Do lado direito aparece o painel de detalhes do tópico escolhido.

As duas barras laterais dá para arrastar pela borda para ficarem mais largas ou mais estreitas, e um duplo clique volta ao tamanho padrão. A da esquerda também recolhe para uma faixa só de ícones, pelo botão `‹` ao lado do logo, o que ajuda em telas pequenas. O que você escolher fica salvo no navegador.

## A tela Hoje

**Hoje**, no topo da barra lateral (ou a tecla `H`), responde "o que eu faço agora?" juntando todos os roadmaps numa tela só:

- **Continuar**: os tópicos e projetos em andamento ou em revisão, de todos os roadmaps, do que você mexeu por último para o mais antigo. Cada linha mostra o roadmap, a fase, as tarefas feitas e quando foi a última mudança. Clicar abre o tópico no roadmap dele.
- **A seguir**: o próximo tópico a fazer de cada roadmap que você usou nos últimos 30 dias, com o andamento do roadmap e o prazo, se houver. Sem nenhuma atividade recente, aparece o próximo tópico do último roadmap aberto, em **Para começar**.

Roadmaps ocultos ficam de fora, e os que você nunca mexeu também (os estados escritos pelo autor no JSON não contam como seus). O botão com o nome do roadmap, ou `Esc`, volta para ele. Em **Ajustes → Ao abrir** dá para fazer o Roadkit abrir direto na tela Hoje.

### Revisão espaçada

Desligada por padrão. Com **Ajustes → Revisão espaçada** ligada, cada tópico principal que você concluir volta para revisão 3 dias depois, num bloco **Para revisar hoje** da tela Hoje, e o botão Hoje mostra quantas revisões venceram.

- **Ainda lembro** afasta a próxima revisão: 3, 7, 21, 60 e 150 dias. Depois da última, o tópico sai da fila.
- **Preciso rever** recomeça os intervalos, volta o tópico para "em revisão" e abre ele. Ele deixa de contar como concluído até você concluir de novo.

O que já estava concluído quando você liga a revisão não entra na fila: só o que você concluir dali em diante. Opcionais e subtópicos ficam de fora. A caixa **Revisar este roadmap**, nos ajustes, tira um roadmap da revisão (útil para os de projeto, que não são de estudo). O painel do tópico mostra quando é a próxima revisão. A fila fica no servidor, então vale em todos os aparelhos.

## Sessões de foco

Desligadas por padrão. Com **Ajustes → Sessões de foco** ligadas, o painel de cada tópico e de cada projeto ganha um botão **Focar**. Ele abre um timer no canto da tela: escolha 25 ou 50 minutos, ou livre (um cronômetro), e comece. Se o tópico ainda estava "a fazer", o timer oferece movê-lo para "em andamento".

- O título da aba mostra o tempo restante, para você ver de outra aba. Recarregar a página ou trocar de roadmap não para o timer.
- No fim toca um som curto e, se você ligar **Avisar quando terminar**, aparece uma notificação do navegador. A permissão só é pedida quando você liga essa opção.
- Sessões de 5 minutos ou mais ficam registradas no tópico (inclusive quando você para antes do fim), e o painel mostra o total: "Tempo de foco: 3 h 20 min em 8 sessões". Offline, elas esperam numa fila e sobem quando o servidor voltar.
- Terminada uma sessão, dá para emendar uma pausa de 5 minutos, que não é registrada.

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

## Instalar e usar sem internet

O Roadkit é um app instalável (PWA). No Chrome e no Edge, o ícone de instalar aparece na barra de endereço, e **Ajustes → Instalar como app** faz o mesmo. Instalado, ele abre em janela própria, com ícone, e pode ficar na barra de tarefas ou na tela inicial do celular. No iPhone, use **Compartilhar → Adicionar à Tela de Início**.

Depois de aberto uma vez, o Roadkit **abre sem internet**: a interface fica guardada no navegador, junto com uma cópia de todos os roadmaps da lista, mesmo os que você nunca abriu nesse aparelho. Sem conexão, você continua marcando progresso e escrevendo notas; a linha dos ajustes avisa que está salvando só neste aparelho, e tudo sobe para o servidor quando a conexão volta.

Quando sai uma versão nova do Roadkit, uma faixa discreta no rodapé diz **Nova versão disponível · Recarregar**. Ele nunca recarrega sozinho, para não interromper o que você está escrevendo.

Isso funciona em `http://localhost` e em qualquer endereço com HTTPS. Para usar de outro aparelho da rede, veja [Docker e rede](docker-e-rede.md#app-instalável-e-https).

## Busca e atalhos de teclado

`Ctrl+K` (`⌘K` no Mac), ou a lupa no topo, abre uma busca que vai para qualquer lugar: tópicos e projetos de **todos** os roadmaps, os próprios roadmaps e as ações (novo roadmap, exportar, notas, trocar de visualização, alternar o modo, ajustes). A busca ignora acentos e maiúsculas e aceita letras pulando no meio, como "kstmz" para Kustomize. Os resultados do roadmap aberto vêm primeiro, cada tópico com o roadmap, a fase e o estado. `↑` `↓` escolhem, `Enter` abre e `Esc` fecha. Com a caixa vazia, aparecem os itens abertos por último.

Fora de campos de texto, algumas teclas de uma letra funcionam direto:

| Tecla | O que faz |
|---|---|
| `/` | vai para a busca do topo |
| `M` · `K` · `P` | Mapa, Kanban, Projetos |
| `H` | abre ou fecha a tela Hoje |
| `N` | próximo tópico a fazer |
| `J` · `L` | tópico anterior / seguinte, na ordem do caminho |
| `1` · `2` · `3` · `4` | a fazer, em andamento, em revisão, concluído, no tópico ou projeto aberto |
| `T` | alterna entre modo claro e escuro |
| `?` | mostra a lista de atalhos |

No computador, os botões que têm atalho mostram a tecla ao lado (`H` em Hoje, `N` em Próximo tópico, `M` `K` `P` nas visualizações, `Ctrl K` na lupa), para você ir decorando. Em **Ajustes → Atalhos de teclado** dá para desligar as teclas de uma letra (para quem usa leitor de tela ou extensões que já usam essas teclas); `Ctrl+K` e `Esc` continuam. No celular, a busca abre pela lupa e ocupa a tela inteira.

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

O botão no canto superior direito abre os ajustes: modo (claro, escuro ou automático), tema, tamanho do texto, idioma da interface, o que abrir primeiro (o último roadmap ou a tela Hoje), a revisão espaçada, as sessões de foco e a tolerância do aviso de pulados. O idioma em "automático" segue o `meta.language` do roadmap aberto. Escolher um idioma fixo vale para qualquer roadmap.

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

## Exportar, compartilhar e importar

**Exportar** abre um menu com três saídas:

- **Roadmap e progresso (.zip)**: uma pasta com o nome do roadmap, e dentro dela o JSON do roadmap, um `progress.json` e as suas notas. É um jeito de levar tudo para outra máquina ou de guardar uma cópia.
- **Markdown (.md)**: o roadmap em texto, com fases como títulos, `- [x]` no que está concluído, tarefas, desafios, links, projetos e, se você quiser, as suas notas no fim. Abre bem no GitHub e no Obsidian.
- **Página para compartilhar (.html)**: um arquivo só, que abre em qualquer navegador **sem servidor e sem internet**. É o próprio Roadkit, com o mapa, o kanban, os projetos e os painéis, congelado no progresso de hoje e somente leitura. Uma faixa no topo diz de quando é o progresso. Serve para mandar a um mentor ou publicar no GitHub Pages. A caixa "Incluir minhas notas" decide se as notas vão junto.
### Datas

No mesmo menu, **Começo do roadmap** recebe o dia em que você começou (ou vai começar). A partir dele, os períodos das fases e os prazos dos tópicos ("Semanas 1 e 2", "Semana 3", "Mês 2") viram datas: a bandeira de cada fase no mapa e o painel de cada tópico mostram "até 14 de set.", e o que passou da data sem estar concluído ganha um aviso amarelo. A data é sua e fica com o progresso; quem escreve o roadmap também pode fixar datas no JSON (`startDate`, `due`), que valem mais que as calculadas. Sem data nenhuma, nada muda na tela.

### Importar **Importar** lê esse zip de volta: se o roadmap já existe aqui, só o progresso é aplicado, e se não existe ele abre a partir do arquivo (para guardar de vez, copie o JSON para a pasta `roadmaps/`). Também aceita um `progress.json` solto ou um JSON de roadmap.

Arrastar um `.json` para a janela ou usar **Abrir arquivo JSON** mostra um roadmap sem guardar nada no servidor.

## No celular

Em telas estreitas o mapa vira uma linha do tempo de uma coluna só, com as fases como atalhos no topo, e o painel de detalhes abre por cima, como uma gaveta. O kanban ganha uma faixa fixa com as quatro colunas durante o arrasto, para soltar o cartão sem precisar rolar a página.
