# Criando roadmaps

Tem três jeitos de chegar a um roadmap, e todos terminam no mesmo lugar: um JSON. Escolha pelo que for mais confortável.

## 1. Pelo editor da interface

Clique em **Novo roadmap** (nas ferramentas da barra lateral ou no rodapé do seletor). A tela se divide em duas: à esquerda o formulário, à direita o roadmap de verdade, que vai se desenhando enquanto você escreve.

<p align="center">
  <img src="media/criar-roadmap.gif" alt="Escrevendo um roadmap no editor, com a prévia se montando ao lado" width="100%">
</p>

O formulário cobre o que a maioria dos roadmaps precisa: nome, idioma, ícone, subtítulo, cores, logo, fases e tópicos. Cada tópico tem um prazo e, em "Detalhes", um resumo, o que estudar, tarefas, um desafio prático, o critério de sucesso e links.

Alguns detalhes que ajudam:

- **Subtópicos.** O botão "+ Subtópico" dentro de um tópico cria um filho, e um filho pode ter filhos, até dois níveis abaixo do tópico principal. No mapa eles aparecem em colunas à direita.
- **Opcional.** Dentro de um subtópico tem a caixa "Opcional". Marcar um tópico como opcional marca também tudo o que está abaixo dele (dá para desmarcar um por um). Um subtópico novo criado sob um opcional já nasce opcional.
- **Prévia ligada ao formulário.** Clicar num tópico da prévia leva você ao campo dele, e focar num campo seleciona o tópico na prévia. Uma fase sem tópicos aparece com um cartão pontilhado "Seu tópico aqui" só para você ver onde ela fica.
- **Aviso de problemas.** Embaixo, junto do botão Salvar, uma linha diz "Sem problemas" ou lista o que está errado (e o que é só um aviso, como um título comprido). São as mesmas regras do `check`, rodando enquanto você digita.
- **Aba JSON.** O formulário não cobre tudo: rótulos trocados, o marco no fim de uma fase e outras coisas do [formato](SCHEMA.md) ficam só no JSON. A aba mostra o arquivo inteiro, a prévia continua funcionando, e dá para voltar ao formulário a qualquer hora.

Os roadmaps criados aqui ficam na pasta de dados do servidor (`data/roadmaps/`), não na sua pasta `roadmaps/`. Dá para voltar e editar, trocar de categoria ou excluir quando quiser. Se quiser levar um para a sua pasta de arquivos, exporte e copie o JSON de dentro do zip.

## 2. Escrevendo o arquivo

Copie um exemplo para a pasta `roadmaps/` e mexa nele:

```bash
cp examples/pt-BR/minimal.json roadmaps/meu-roadmap.json
python3 tools/roadkit.py check
```

O `check` valida todos os JSONs e atualiza o `manifest.json`. Ele aponta erros (ids repetidos, pai que não existe, fases fora de ordem, link sem `https://`) e avisos (chaves desconhecidas, títulos longos, fase sem tópico). Recarregue a página e o roadmap já aparece na lista.

Dica de editor: os exemplos começam com `"$schema": "../../schema/roadmap.schema.json"`, o que dá autocompletar e validação no VS Code. Ajuste o caminho se o seu arquivo estiver em outra pasta.

Os exemplos em `examples/` cobrem situações bem diferentes e valem uma olhada antes de começar do zero:

| Arquivo | O que mostra |
|---|---|
| `minimal.json` | o menor roadmap válido, sem fases |
| `sql.json` | uma trilha de estudo em fases |
| `argocd.json` | tarefas por tópico, subtópicos e opcionais (é o que aparece nos GIFs) |
| `home-lab.json` | um projeto pessoal, com rótulos trocados |
| `half-marathon.json` | uma meta que nada tem a ver com tecnologia |
| `side-project.json` | um projeto de produto, com cores e rótulos próprios |

Existem em português (`examples/pt-BR/`) e em inglês (`examples/en/`), com o mesmo conteúdo.

## 3. Com uma IA

Descreva o que quer, e uma IA escreve o JSON. Tem um botão para isso dentro do editor e uma skill para quem usa o Claude Code. Está tudo em [Criando com IA](criar-com-ia.md).

## Categorias

A categoria de um roadmap é a pasta onde ele está. Cada subpasta de `roadmaps/` vira uma seção no seletor, e os arquivos soltos ficam em "Meus roadmaps":

```
roadmaps/
  solto.json              → Meus roadmaps
  trabalho/
    argocd.json           → Trabalho
    migracao.json
  estudos/
    _section.json         → {"title": "Estudos 2026"}
    sql.json              → Estudos 2026
    cloud/
      redes.json          → Estudos 2026 / Cloud
```

O título da seção é o nome da pasta com a primeira letra maiúscula. Para outro título, ponha um `_section.json` com `{ "title": "..." }` dentro da pasta. Pastas e arquivos que começam com `_` ou `.` são ignorados.

O que vale é o `id` de cada roadmap, não a pasta: mover um arquivo de pasta não faz perder o progresso. Só não repita o mesmo `id` em dois arquivos.

Pelo editor, a categoria é o campo logo acima do formulário. Ele lista as seções que já existem e tem a opção "Nova categoria…". Um roadmap criado na interface aparece na mesma seção dos seus arquivos daquela categoria, mesmo que um esteja em `roadmaps/estudos/` e o outro em `data/roadmaps/estudos/`.

## O que faz um roadmap ser bom de usar

Depois de montar alguns, o que mais fez diferença foi isto:

**Títulos curtos.** O cartão no mapa tem pouco espaço. "Instalar o Argo CD" funciona, "Instalação e configuração inicial do Argo CD no cluster" vira um bloco de texto. O limite é 60 caracteres, mas dá para ser bem mais curto.

**Um desafio que você consegue conferir sozinho.** "Entender o Git" não é um desafio, "Desfazer um merge errado sem perder o trabalho" é. O campo `challenge` é o que faz o tópico virar algo para fazer, e `success` diz quando parar.

**Tarefas só quando o tópico se divide mesmo.** De três a seis, no máximo. Uma lista de quinze tarefas num tópico é um sinal de que ele deveria ser dois (ou de que algumas são subtópicos).

**Subtópicos para o que é parte do tópico, opcional para o que é extra.** Se o tópico não está pronto sem aquilo, é subtópico. Se é "se sobrar tempo", é opcional, e nada trava por causa dele.

**Fases em número pequeno.** Entre três e cinco costuma bastar. Mais que isso e a barra lateral vira uma lista de capítulos. Dê um período a cada uma ("Semanas 1 e 2"), porque é o que dá a sensação de caminho.

**Prazos sinceros.** O campo `time` é texto livre e não faz conta nenhuma, mas escrever "Semana 3" para algo que leva três dias te engana. Prefira estimar para cima.

**Não passe de uns 40 tópicos principais.** Passou disso, divida em dois roadmaps. O `check` avisa.

**Nunca mude o `id` de um roadmap que você já usa.** É a chave do progresso salvo. Pode mudar o título, o conteúdo, a ordem e até a pasta, mas o `id` fica.
