import { Bot, InlineKeyboard } from 'grammy'
import { BOT_USERNAME } from './start.js'

const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID ?? '0', 10)
const CANAL_ID = process.env.CANAL_ID ?? ''

export function registrarBotao(bot: Bot) {
  // /botao — admin responde a uma mensagem no privado para publicá-la no canal
  // com os botões "Ler no Telegram" (/start) e "Ler no Site".
  bot.command('botao', async (ctx) => {
    if (ctx.chat.type !== 'private') return
    if (!ADMIN_USER_ID || ctx.from?.id !== ADMIN_USER_ID) return

    if (!CANAL_ID) {
      await ctx.reply('⚙️ Defina CANAL_ID no .env para usar esse comando.')
      return
    }

    const alvo = ctx.message?.reply_to_message
    if (!alvo) {
      await ctx.reply('✍️ Responda à mensagem que quer publicar usando /botao.')
      return
    }

    const kb = new InlineKeyboard()
      .url('📖 Ler no Telegram', `https://t.me/${BOT_USERNAME}?start=inicio`)
      .url('🌐 Ler no Site', 'https://www.princesadevassa.com.br')

    try {
      await ctx.api.copyMessage(CANAL_ID, ctx.chat.id, alvo.message_id, { reply_markup: kb })
      await ctx.reply('✅ Publicado no canal!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconhecido'
      await ctx.reply(`❌ Erro ao publicar: ${msg}`)
    }
  })
}
