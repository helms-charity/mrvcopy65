# Sandbox for Meusensia.com.br on Edge Delivery Services


## Environments / ambientes
O código foi desenvolvido na conta do GitHub do MRV.
(Code was developed on MRV's github account.)
- Preview: https://main--meusensia--mrvengenharia.aem.page/
- Live: https://main--meusensia--mrvengenharia.aem.live/

## Configurações
Este projeto começou com o ponto de montagem definido no arquivo fstab.yaml e o mapeamento de caminho em paths.json. Em 8 de setembro de 2025, essas configurações foram enviadas para o "barramento de configuração" conforme https://www.aem.live/developer/repoless-environments. Renomeei os arquivos originais aqui para referência, mas eles podem ser excluídos.

## Configurations
This project started out with the mountpoint defined in the fstab.yaml file, and the path mapping in paths.json. On September 8, 2025 these configurations were sent to the "config bus" per https://www.aem.live/developer/repoless-environments. I renamed the original files here for reference but they can be deleted.

## Documentação

Antes de usar o aem-boilerplate, recomendamos que você leia a documentação em: (Before using the aem-boilerplate, we recommand you to go through the documentation on) [www.aem.live](https://www.aem.live/docs/) e [experienceleague.adobe.com](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/authoring), mais especificamente:
1. [Introdução](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/edge-dev-getting-started), 
1. [Criação de Blocos](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/create-block), [Conteúdo Modelagem](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/content-modeling)
1. [A Anatomia de um Projeto](https://www.aem.live/developer/anatomy-of-a-project)
1. [Desempenho Web](https://www.aem.live/developer/keeping-it-100)
1. [Marcação, Seções, Blocos e Bloqueio Automático](https://www.aem.live/developer/markup-sections-blocks)

Além disso, recomendamos que você assista às gravações de nossas apresentações ou sessões anteriores: (Furthremore, we encourage you to watch the recordings of any of our previous presentations or sessions)
- [Introdução ao AEM Authoring e Edge Delivery Serviços](https://experienceleague.adobe.com/pt-BR/docs/events/experience-manager-gems-recordings/gems2024/aem-authoring-and-edge-delivery)
- [Recursos de autoatendimento dos Serviços de Entrega de Borda no Cloud Manager, setembro de 2025](https://adobe.ly/4lYpzyQ)]

## biblioteca de blocos, ícones

- Veja exemplos de estilos de bloco e seção em https://main--meusensia--mrvengenharia.aem.page/tools/sidekick/library.html. (Você não pode copiá-los daqui; em vez disso, você pode encontrar essas páginas no seu autor em /meusensia/library, onde pode ver como foram criadas). 
- Veja exemplos de ícones disponíveis usando a notação de dois pontos em https://main--meusensia--mrvengenharia.aem.page/tools/sidekick/library.html?plugin=icons. Você PODE clicar em um ícone para copiar a notação e colá-la no seu editor de texto.

##  Block library, icons

- See examples of block and section styles at https://main--meusensia--mrvengenharia.aem.page/tools/sidekick/library.html. You cannot copy these from here, instead you can find these pages in your author under /meusensia/library/ where you can see how they were authored. 
- See examples of icons that are available using the colon notation at https://main--meusensia--mrvengenharia.aem.page/tools/sidekick/library.html?plugin=icons. You CAN click an icon to copy the notation, so you can paste it into your text editor.


## Pré-requisitos / Prerequisites

- nodejs 18.3.x or newer
- AEM Cloud Service release 2024.8 or newer (>= `17465`)

## Instalação / Installation

```sh
npm i
```

## Verificação de código, "Linting"

```sh
npm run lint
```

## Desenvolvimento local

1. Para um novo projeto, siga os passos em https://www.aem.live/developer/ue-tutorial
1. Para o seu projeto existente, clone o repositório localmente e abra-o no seu IDE.
1. Instale o [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Inicie o Proxy AEM: `aem up` (abre seu navegador em `http://localhost:3000`)
1. Agora você pode fazer alterações no seu CSS e JS e visualizá-las em tempo real.
1. Se precisar fazer alterações no Universal Editor (UE) (arquivo _blockname.json), você pode enviá-las para o seu branch principal antes de qualquer código para permitir a criação de uma página de teste. Ou se você quiser fazer alterações na UE apenas localmente, siga as instruções em https://github.com/mrvengenharia/meusensia/wiki/Developing-locally-(Desenvolvimento-local).

## Local Development

1. For a new project, follow the steps at https://www.aem.live/developer/ue-tutorial
1. For your existing project, clone your repository locally and open in your IDE.
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Now you can make changes to your CSS and JS and see them in real time.
1. If you need to make Universal Editor (UE) (_blockname.json file) changes, you can push those to you main branch before any code to allow you to author a test page. Or if you want to only make changes to UE locally, follow instructions at https://github.com/mrvengenharia/meusensia/wiki/Developing-locally-(Desenvolvimento-local).
