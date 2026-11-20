require('dotenv').config();
const {
  default: makeWASocket, useMultiFileAuthState, DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qr = require('qrcode-terminal');
const config = require('./config');
const { load, save } = require('./db');
const commands = require('./commands');

const prefix = config.prefix || '!';
const digits = s => (s || '').replace(/\D/g, '');
const numberFromJid = jid => digits((jid || '').split('@')[0].split(':')[0]);
const isOwner = n => n === config.owner;
const isAdmin = n => isOwner(n) || (config.admins || []).includes(n);
const money = n => `${n} ${config.currency || 'MT'}`;
const makeId = p => p + Date.now().toString(36).toUpperCase();

function packagesText() {
  return (config.packages || []).map(p => `• ${p.name}: ${money(p.price)}`).join('\n');
}
function plansText() {
  return (config.rentals || []).map(p => `• ${p.name} (${p.days} dias): ${money(p.price)}`).join('\n');
}
function paymentText() {
  return `💳 *PAGAMENTO SPARTA*\nM-Pesa: ${config.payments.mpesa.number} — ${config.payments.mpesa.name}\ne-Mola: ${config.payments.emola.number} — ${config.payments.emola.name}\n\nApós pagar, envie ${prefix}comprovativo REFERÊNCIA. A confirmação é manual.`;
}
let sock;
let maintenance = false;

async function notifyAdmins(message) {
  const nums = [...new Set([config.owner, ...(config.admins || [])].filter(Boolean))];
  for (const n of nums) {
    try { await sock.sendMessage(`${n}@s.whatsapp.net`, { text: message }); } catch {}
  }
}
async function handleMessage(m) {
  if (!m.message || m.key.fromMe) return;
  const jid = m.key.remoteJid;
  const sender = numberFromJid(m.key.participant || jid);
  const body = m.message.conversation ||
    m.message.extendedTextMessage?.text ||
    m.message.imageMessage?.caption || '';
  if (!body.startsWith(prefix)) return;

  const [commandRaw, ...args] = body.slice(prefix.length).trim().split(/\s+/);
  const command = (commandRaw || '').toLowerCase();
  const arg = args.join(' ');
  const db = load();
  const admin = isAdmin(sender);
  const owner = isOwner(sender);
  const group = jid.endsWith('@g.us');
  const reply = text => sock.sendMessage(jid, { text });

  const meta = commands.find(c => c.name === command);
  if (!meta) return;
  if (maintenance && !admin && !['menu','ajuda','suporte'].includes(command))
    return reply('SPARTA está em manutenção. Tente mais tarde.');
  if (meta.role === 'admin' && !admin) return reply('⛔ Comando exclusivo dos administradores.');
  if (meta.role === 'owner' && !owner) return reply('⛔ Comando exclusivo do proprietário.');

  const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const target = mentioned[0];

  switch (command) {
    case 'menu':
      return reply(`🤖 *SPARTA — MENU*\n\n*MEGABYTES*\n!pacotes\n!comprar 1GB\n!precos\n!pagamento\n!comprovativo REFERÊNCIA\n!meuspedidos\n\n*ALUGUER*\n!planos\n!alugar PRO\n!meualuguer\n\n*GRUPO/ADMIN*\n!ajuda para ver os 75 comandos.`);
    case 'ajuda':
    case 'comandos':
      return reply('📚 *75 COMANDOS SPARTA*\n' + commands.map((c,i) => `${i+1}. ${prefix}${c.name} — ${c.desc}`).join('\n'));
    case 'ping': return reply('🏓 SPARTA está online!');
    case 'info':
    case 'botinfo': return reply('🤖 SPARTA\nBot de venda de megabytes e aluguer para grupos.\nTecnologia: Node.js + Baileys.');
    case 'dono': return reply(`Proprietário: ${config.owner || 'Configure OWNER_NUMBER no .env'}`);
    case 'precos':
    case 'pacotes': return reply(`📦 *PACOTES DISPONÍVEIS*\n${packagesText()}\n\nExemplo: !comprar 1GB`);
    case 'comprar': {
      const p = config.packages.find(x => x.name.toLowerCase() === arg.toLowerCase());
      if (!p) return reply(`Pacote inválido.\n${packagesText()}`);
      const order = { id: makeId('MB'), type:'mb', user:sender, item:p.name, price:p.price, status:'PENDENTE', created:new Date().toISOString(), proof:'' };
      db.orders.push(order); save(db);
      return reply(`✅ Pedido *${order.id}* criado.\nPacote: ${p.name}\nValor: ${money(p.price)}\n\n${paymentText()}`);
    }
    case 'pagamento': return reply(paymentText());
    case 'mpesa': return reply(`M-Pesa: ${config.payments.mpesa.number}\nTitular: ${config.payments.mpesa.name}`);
    case 'emola': return reply(`e-Mola: ${config.payments.emola.number}\nTitular: ${config.payments.emola.name}`);
    case 'comprovativo': {
      if (!arg) return reply('Uso: !comprovativo REFERÊNCIA');
      const item = [...db.orders, ...db.rentals].reverse().find(x => x.user === sender && x.status === 'PENDENTE');
      if (!item) return reply('Não há pedido pendente associado ao seu número.');
      item.proof = arg; save(db);
      await notifyAdmins(`📥 Comprovativo recebido\nPedido: ${item.id}\nCliente: ${sender}\nReferência: ${arg}\nAprove com !${item.type === 'mb' ? 'aprovar' : 'aprovaraluguer'} ${item.id}`);
      return reply(`Comprovativo registado no pedido ${item.id}. Aguarde a confirmação.`);
    }
    case 'meuspedidos':
    case 'historico': {
      const mine = db.orders.filter(x => x.user === sender);
      return reply(mine.length ? mine.map(x => `${x.id} | ${x.item} | ${money(x.price)} | ${x.status}`).join('\n') : 'Ainda não tem pedidos.');
    }
    case 'estado': {
      const item = [...db.orders, ...db.rentals].find(x => x.id === arg && (x.user === sender || admin));
      return reply(item ? `${item.id}: ${item.status} — ${item.item}` : 'Pedido não encontrado.');
    }
    case 'cancelarpedido': {
      const item = [...db.orders, ...db.rentals].find(x => x.id === arg && x.user === sender && x.status === 'PENDENTE');
      if (!item) return reply('Pedido pendente não encontrado.');
      item.status = 'CANCELADO'; save(db); return reply('Pedido cancelado.');
    }
    case 'planos': return reply(`🏷️ *PLANOS DE ALUGUER*\n${plansText()}\n\nExemplo: !alugar PRO`);
    case 'alugar': {
      const p = config.rentals.find(x => x.name.toLowerCase() === arg.toLowerCase());
      if (!p) return reply(`Plano inválido.\n${plansText()}`);
      const rental = { id:makeId('GR'), type:'rental', user:sender, group:group?jid:'', item:p.name, days:p.days, price:p.price, status:'PENDENTE', created:new Date().toISOString(), proof:'' };
      db.rentals.push(rental); save(db);
      await notifyAdmins(`Novo pedido de aluguer ${rental.id}\nCliente: ${sender}\nPlano: ${p.name}\nGrupo: ${rental.group || 'Não indicado'}\nValor: ${money(p.price)}`);
      return reply(`Pedido de aluguer ${rental.id} criado.\nPlano: ${p.name}\nValor: ${money(p.price)}\n${paymentText()}`);
    }
    case 'renovar': return reply('Para renovar, use !alugar NOME_DO_PLANO e envie o comprovativo.');
    case 'meualuguer': {
      const mine = db.rentals.filter(x => x.user === sender);
      return reply(mine.length ? mine.map(x => `${x.id} | ${x.item} | ${x.status}`).join('\n') : 'Não tem alugueres registados.');
    }
    case 'pedidos': return reply(db.orders.filter(x => x.status === 'PENDENTE').map(x => `${x.id} ${x.user} ${x.item} ${money(x.price)} comprovativo:${x.proof || 'não'}`).join('\n') || 'Sem pedidos pendentes.');
    case 'pedidosaluguer':
    case 'grupos': return reply(db.rentals.map(x => `${x.id} ${x.user} ${x.item} ${x.status} ${x.group || ''}`).join('\n') || 'Sem alugueres.');
    case 'aprovar':
    case 'aprovaraluguer': {
      const arr = command === 'aprovar' ? db.orders : db.rentals;
      const item = arr.find(x => x.id === args[0]);
      if (!item) return reply('ID não encontrado.');
      item.status = 'APROVADO'; item.approvedAt = new Date().toISOString(); save(db);
      await sock.sendMessage(`${item.user}@s.whatsapp.net`, { text:`✅ O pedido ${item.id} foi aprovado. Obrigado por escolher SPARTA!` });
      return reply(`Pedido ${item.id} aprovado. A entrega/ativação ainda deve ser feita pelo administrador.`);
    }
    case 'rejeitar':
    case 'rejeitaraluguer': {
      const arr = command === 'rejeitar' ? db.orders : db.rentals;
      const item = arr.find(x => x.id === args[0]);
      if (!item) return reply('ID não encontrado.');
      item.status = 'REJEITADO'; save(db);
      return reply(`Pedido ${item.id} rejeitado.`);
    }
    case 'estatisticas':
      return reply(`Pedidos: ${db.orders.length}\nAprovados: ${db.orders.filter(x=>x.status==='APROVADO').length}\nPendentes: ${db.orders.filter(x=>x.status==='PENDENTE').length}\nAlugueres: ${db.rentals.length}`);
    case 'suporte':
    case 'reportar':
    case 'sugestao':
      await notifyAdmins(`${command.toUpperCase()} de ${sender}: ${arg || '(sem mensagem)'}`);
      return reply('Mensagem enviada ao administrador.');
    case 'perfil':
    case 'registar': return reply(`Número: ${sender}\nPedidos: ${db.orders.filter(x=>x.user===sender).length}`);
    case 'faq': return reply('Pagamentos M-Pesa/e-Mola são confirmados manualmente. Use !pacotes para comprar e !planos para alugar.');
    case 'horario': return reply('Configure o horário de atendimento com o proprietário do bot.');
    case 'status': return reply('Vendas disponíveis. Pagamentos com confirmação manual.');
    case 'catalogo': return reply(`PACOTES\n${packagesText()}\n\nPLANOS\n${plansText()}`);
    case 'anuncio': return reply('Bem-vindo ao SPARTA! Venda de megabytes e aluguer de bot.');
    case 'saldo': return reply('Carteira/saldo automático ainda não está ativado. Consulte !meuspedidos.');
    case 'backup': return reply('Os dados estão guardados na pasta data/db.json do servidor.');
    case 'manutencao':
      maintenance = arg.toLowerCase() === 'on';
      return reply(`Modo manutenção ${maintenance ? 'ativado' : 'desativado'}.`);
    case 'abrir':
    case 'fechar': {
      if (!group) return reply('Use este comando num grupo.');
      const md = await sock.groupMetadata(jid);
      const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      if (!md.participants.some(p => p.id === botId && p.admin)) return reply('Promova SPARTA a administrador do grupo.');
      await sock.groupSettingUpdate(jid, command === 'abrir' ? 'not_announcement' : 'announcement');
      return reply('Definição do grupo atualizada.');
    }
    case 'remover':
    case 'promover':
    case 'rebaixar': {
      if (!group || !target) return reply('Use num grupo e marque o membro com @.');
      const md = await sock.groupMetadata(jid);
      const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      if (!md.participants.some(p => p.id === botId && p.admin)) return reply('Promova SPARTA a administrador.');
      const action = command === 'remover' ? 'remove' : command === 'promover' ? 'promote' : 'demote';
      await sock.groupParticipantsUpdate(jid, [target], action);
      return reply('Ação executada.');
    }
    case 'linkgrupo':
      if (!group) return reply('Use num grupo.');
      return reply('https://chat.whatsapp.com/' + await sock.groupInviteCode(jid));
    case 'sair':
      if (group) await sock.groupLeave(jid);
      return;
    case 'todos': {
      if (!group) return reply('Use num grupo.');
      const md = await sock.groupMetadata(jid);
      return sock.sendMessage(jid, { text:arg || 'Atenção a todos!', mentions:md.participants.map(p=>p.id) });
    }
    case 'avisar':
      if (!target) return reply('Marque um membro com @.');
      db.warnings[target] = (db.warnings[target] || 0) + 1; save(db);
      return reply(`Aviso registado. Total: ${db.warnings[target]}`);
    case 'avisos': return reply(JSON.stringify(db.warnings || {}, null, 2));
    case 'limparavisos':
      if (target && db.warnings) delete db.warnings[target];
      save(db); return reply('Avisos limpos.');
    case 'broadcast': {
      const users = [...new Set([...db.orders, ...db.rentals].map(x=>x.user))];
      for (const n of users) { try { await sock.sendMessage(`${n}@s.whatsapp.net`, { text:`📢 ${arg}` }); } catch {} }
      return reply(`Aviso enviado a ${users.length} clientes registados.`);
    }
    case 'adicionaradmin':
    case 'removeradmin':
    case 'definirpreco':
    case 'addsaldo':
    case 'tirarsaldo':
      return reply('Esta ação administrativa deve ser configurada pelo proprietário em src/config.js.');
    case 'bemvindo':
    case 'antilink':
    case 'antispam':
    case 'marcar':
    case 'desmarcar':
    case 'descricao':
    case 'nomegrupo':
    case 'foto':
    case 'top':
    case 'convite':
    case 'avaliar':
    case 'obrigado':
      return reply(`Comando !${command} reconhecido. A função avançada ainda não está ativada nesta versão.`);
    case 'reiniciar': return reply('Reinicie o processo no terminal com npm start.');
    default: return reply('Comando reconhecido, mas ainda não implementado.');
  }
}

async function start() {
  const auth = await useMultiFileAuthState('./auth_info');
  const { state, saveCreds } = auth;
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, logger:pino({ level:'silent' }), auth:state, browser:['SPARTA','Chrome','1.0.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', update => {
    const { connection, lastDisconnect, qr:code } = update;
    if (code) { console.log('Leia o QR Code com o WhatsApp:'); qr.generate(code, { small:true }); }
    if (connection === 'open') console.log('✅ SPARTA conectado!');
    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status !== DisconnectReason.loggedOut) start();
      else console.log('Sessão terminada. Apague auth_info e ligue novamente.');
    }
  });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try { await handleMessage(m); }
      catch (err) { console.error('Erro ao processar mensagem:', err); }
    }
  });
}
start().catch(err => console.error('Falha ao iniciar SPARTA:', err));
