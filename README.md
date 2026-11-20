# SPARTA — Bot WhatsApp

Bot em Node.js + Baileys para:
- Catálogo e pedidos de megabytes;
- Registo de comprovativos de pagamento M-Pesa/e-Mola;
- Aprovação manual de pagamentos pelo administrador;
- Planos e pedidos de aluguer para grupos;
- Ferramentas de administração e moderação.

## Requisitos
- Node.js 20 ou superior;
- Um número WhatsApp para ligar o bot;
- Computador/VPS com ligação à Internet.

## Instalação
1. Instale o Node.js 20+.
2. Extraia o ZIP e abra a pasta `SPARTA-WhatsApp-Bot`.
3. Execute `npm install`.
4. Copie `.env.example` para `.env` e preencha os números e nomes.
5. Execute `npm start`.
6. Na primeira execução, leia o QR Code com o WhatsApp ligado ao número do bot.

## Configuração
- `OWNER_NUMBER`: número do proprietário no formato internacional, apenas dígitos (ex.: 25884XXXXXXX).
- `ADMIN_NUMBERS`: números separados por vírgula.
- `MPESA_NUMBER` / `EMOLA_NUMBER`: números que recebem pagamentos.
- Edite `src/config.js` para alterar preços de pacotes, planos de aluguer e textos.

## Como vender megabytes
O cliente usa `!pacotes`, depois `!comprar 1GB`. O bot mostra os dados de pagamento. O cliente envia `!comprovativo <referência ou descrição>`. O administrador confirma com `!aprovar <ID_DO_PEDIDO>` ou rejeita com `!rejeitar <ID_DO_PEDIDO>`.

**Importante:** M-Pesa e e-Mola estão configurados como pagamento manual com confirmação do administrador. Este projeto não debita carteiras nem consulta transações automaticamente. Para automatizar, é necessário contrato/acesso oficial às APIs do operador e credenciais comerciais.

## Como alugar o bot
O administrador configura os planos em `src/config.js`. O interessado usa `!planos` e `!alugar <plano>`. O bot regista o pedido. Depois do pagamento, o administrador aprova com `!aprovaraluguer <ID>`. O bot deve ser adicionado ao grupo e promovido a administrador para usar funções de gestão.

## Os 75 comandos
Use `!ajuda` para ver os comandos. Alguns comandos são exclusivos do proprietário/administradores. O prefixo pode ser alterado em `.env`.

## Segurança
- Nunca partilhe a pasta `auth_info` nem o ficheiro `.env`.
- Use um número dedicado para o bot.
- Faça cópias de segurança da pasta `data`.
- Respeite os Termos do WhatsApp e evite mensagens em massa sem consentimento.
