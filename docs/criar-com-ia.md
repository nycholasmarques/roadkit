# Criando com IA

A ideia é simples: um roadmap é um JSON, e escrever JSON é uma coisa em que uma IA é boa. O que ela não sabe é o formato do Roadkit, nem o que você quer aprender. Os dois caminhos abaixo resolvem isso, cada um do seu jeito.

## Pelo botão "Criar com IA"

Serve para qualquer IA (ChatGPT, Claude, Gemini, um modelo local), porque o Roadkit não fala com nenhuma delas. Ele só monta o texto que você leva até lá e traz a resposta de volta. Não pede chave de API nem manda nada para fora.

<p align="center">
  <img src="media/criar-com-ia.gif" alt="Descrevendo o objetivo, copiando o prompt e trazendo a resposta da IA para o editor" width="100%">
</p>

1. Abra **Novo roadmap** e clique em **Criar com IA**.
2. Conte o que você quer aprender ou fazer, escolha o idioma e o tamanho. Quanto mais contexto você dá (o que já sabe, quanto tempo tem), melhor sai.
3. **Copiar prompt**, cole na sua IA e espere a resposta.
4. Cole a resposta na terceira caixa e clique em **Usar no editor**.

O roadmap abre no editor, já com a prévia ao lado. A resposta pode vir dentro de um bloco ```` ```json ```` ou com uma frase antes e depois; o Roadkit pega só o objeto JSON. Se o `id` que a IA escolheu já existir aqui, ele troca por um livre.

A partir daí é o editor de sempre. A linha de problemas embaixo roda a validação enquanto você mexe, então se a IA errou alguma coisa (um pai que não existe, um id repetido) você vê na hora e corrige no formulário ou na aba JSON.

O texto do prompt está em [`src/ai-prompt.txt`](../src/ai-prompt.txt). Se quiser que a IA escreva de outro jeito (mais direta, mais detalhada), é só editar esse arquivo.

## Pela skill do Claude Code

Se você usa o Claude Code, o repositório traz uma skill em [`.claude/skills/roadkit/`](../.claude/skills/roadkit/SKILL.md). Ela é uma conversa guiada em vez de um prompt único.

Abra o Claude Code dentro da pasta do Roadkit e peça algo como "monta um roadmap para eu aprender Rust" (ou chame direto com `/roadkit`). A skill faz o seguinte:

1. Pergunta o que falta saber: objetivo, ponto de partida, tempo, idioma e categoria. Se você já contou, não repete.
2. Mostra o esqueleto em texto (fases, tópicos e prazos) e espera o seu ok, antes de escrever o arquivo. Mudar uma lista de dez linhas é bem mais fácil do que mudar um JSON.
3. Escreve o arquivo em `roadmaps/<categoria>/`, e roda o `check`. Se o servidor estiver no Docker, com a pasta `roadmaps/` somente leitura, ela grava pela API do servidor, que guarda no volume de dados.
4. Diz como abrir e fica disponível para os ajustes: trocar um prazo, abrir um tópico em subtópicos, cortar o que sobrou.

Para evoluir um roadmap que já existe ela lê o arquivo antes, preserva o que você não pediu para mudar e não mexe nos `id`, para o progresso salvo continuar valendo.

Outras ferramentas que leem instruções de um arquivo do projeto podem aproveitar o mesmo texto: o `SKILL.md` é só Markdown.

## O que a IA acerta e o que ela erra

Estrutura ela acerta quase sempre, e o `check` pega o resto. A parte de conteúdo pede olho humano:

- **Links.** É onde modelos mais inventam. O prompt pede só links que ela tenha certeza que existem, mas confira os que ficarem. Na dúvida, apague.
- **Prazos.** Costumam sair otimistas. Leia "Semana 2" e pergunte se você faria aquilo em uma semana.
- **Desafios genéricos.** "Pratique o que aprendeu" não é desafio. Peça "um desafio concreto que eu consiga conferir sozinho" e a resposta melhora.
- **Tamanho.** Se veio coisa demais, peça para juntar tópicos ou mover parte para opcionais.

Em [Criando roadmaps](criar-roadmaps.md#o-que-faz-um-roadmap-ser-bom-de-usar) estão as regras que eu uso para revisar, e elas valem para o que a IA devolveu tanto quanto para o que você escreveu.
