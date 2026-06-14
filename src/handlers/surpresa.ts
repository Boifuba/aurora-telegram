import { Bot, InlineKeyboard } from 'grammy'
import { getFolhaAleatoria } from '../lib/nodes.js'

export function registrarSurpresa(bot: Bot) {
  bot.callbackQuery('surpresa', async (ctx) => {
    const sorteado = await getFolhaAleatoria()

    if (!sorteado) {
      await ctx.answerCallbackQuery('Nenhuma história disponível.')
      return
    }

    const kb = new InlineKeyboard()
      .text('📖 Ler agora', `ler:${sorteado.id}:0`)
      .row()
      .text('🎲 Outra', 'surpresa')
      .text('🏠 Início', 'inicio')

    await ctx.answerCallbackQuery()
    await ctx.editMessageText(
      `🎲 *Surpresa!*\n\n_${sorteado.title}_\n\nQuer ler esta?`,
      { parse_mode: 'Markdown', reply_markup: kb }
    )
  })
}
