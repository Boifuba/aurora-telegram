import { Bot, InlineKeyboard, type Api } from 'grammy'
import { BOT_USERNAME } from './start.js'

const MENSAGEM_DM = `Oi, as histórias do meu diário, que são todas verdadeiras, podem ser lidas aqui no telegram ou no site, é o mesmo conteúdo, escolha onde quer ler:`

// Dedup: chat_member e new_chat_members podem chegar juntos quando o bot é admin.
// Guarda "chatId:userId" por alguns segundos pra não saudar duas vezes.
const recemSaudados = new Map<string, number>()
const TTL_MS = 60_000

function jaSaudou(chatId: number, userId: number): boolean {
  const chave = `${chatId}:${userId}`
  const agora = Date.now()
  // limpa entradas expiradas
  for (const [k, t] of recemSaudados) {
    if (agora - t > TTL_MS) recemSaudados.delete(k)
  }
  if (recemSaudados.has(chave)) return true
  recemSaudados.set(chave, agora)
  return false
}

async function saudar(api: Api, chatId: number, userId: number, nome: string) {
  if (jaSaudou(chatId, userId)) return

  const botoes = new InlineKeyboard()
    .url('📖 Ler no Privado', `https://t.me/${BOT_USERNAME}?start=inicio`).row()
    .url('🌐 Ler no Site', `https://www.princesadevassa.com.br`)

  // 1) DM no privado (só chega para quem já iniciou o bot — Telegram bloqueia o resto)
  try {
    await api.sendMessage(
      userId,
      `Seja bem-vindo(a), *${nome}*! 💕\n\n${MENSAGEM_DM}`,
      { parse_mode: 'Markdown', reply_markup: botoes }
    )
    console.log('[boasvindas] DM enviado', userId)
  } catch {
    console.log('[boasvindas] DM bloqueado (nunca iniciou o bot)', userId)
  }

  // 2) Mensagem no próprio grupo, marcando a pessoa — sempre.
  //    O botão "Ler no Privado" é um link t.me que abre a conversa privada com o bot.
  const mencao = `[${nome}](tg://user?id=${userId})`
  const textoGrupo =
    `Seja bem-vindo(a), ${mencao}! 💕\n\n` +
    `Oi, as histórias do meu diário, que são todas verdadeiras, podem ser lidas aqui no telegram ou no site, é o mesmo conteúdo, escolha onde quer ler:`

  try {
    await api.sendMessage(chatId, textoGrupo, {
      parse_mode: 'Markdown',
      reply_markup: botoes,
    })
    console.log('[boasvindas] mensagem no grupo enviada', userId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'desconhecido'
    console.error('[boasvindas] falhou ao postar no grupo:', msg)
  }
}

export function registrarBoasVindas(bot: Bot) {
  // Evento chat_member: só chega se o bot for ADMIN do grupo.
  bot.on('chat_member', async (ctx) => {
    const membro = ctx.chatMember
    console.log('[chat_member]', JSON.stringify({
      old: membro.old_chat_member.status,
      new: membro.new_chat_member.status,
      user: membro.new_chat_member.user.id,
    }))

    const statusEntrou = ['member', 'administrator', 'creator']
    const statusForaAntes = ['left', 'kicked']
    const entrou =
      statusEntrou.includes(membro.new_chat_member.status) &&
      statusForaAntes.includes(membro.old_chat_member.status)

    if (!entrou) return
    if (membro.new_chat_member.user.is_bot) return

    await saudar(
      ctx.api,
      ctx.chat.id,
      membro.new_chat_member.user.id,
      membro.new_chat_member.user.first_name
    )
  })

  // Mensagem de serviço new_chat_members: chega mesmo sem o bot ser admin.
  // Garante a saudação quando chat_member não é entregue.
  bot.on('message:new_chat_members', async (ctx) => {
    const novos = ctx.message.new_chat_members
    console.log('[new_chat_members]', novos.map((u) => u.id))
    for (const user of novos) {
      if (user.is_bot) continue
      await saudar(ctx.api, ctx.chat.id, user.id, user.first_name)
    }
  })
}
