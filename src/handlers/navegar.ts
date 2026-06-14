import { Bot, InlineKeyboard } from 'grammy'
import { getNo, getFilhos, isContainer } from '../lib/nodes.js'
import { montarLeitura } from './leitura.js'
import { enviarMenuPrincipal } from './start.js'

// Navegação na árvore de conteúdo (`nodes`):
// - Container (tem filhos) → lista os filhos.
// - Folha (sem filhos) → abre a leitura.

async function abrirNo(ctx: any, nodeId: string) {
  const no = await getNo(nodeId)
  if (!no) {
    await ctx.answerCallbackQuery('Conteúdo não encontrado.')
    return
  }

  // Folha → vai direto para a leitura.
  if (!(await isContainer(nodeId))) {
    const leitura = await montarLeitura(nodeId, 0)
    await ctx.answerCallbackQuery()
    if (!leitura.ok) {
      await ctx.editMessageText(leitura.motivo, {
        reply_markup: new InlineKeyboard()
          .text('⬆️ Voltar', no.parentId ? `nav:${no.parentId}` : 'inicio')
          .row()
          .text('🏠 Início', 'inicio'),
      })
      return
    }
    try {
      await ctx.editMessageText(leitura.texto, { parse_mode: 'Markdown', reply_markup: leitura.kb })
    } catch {
      await ctx.editMessageText(leitura.texto.replace(/\*/g, ''), { reply_markup: leitura.kb })
    }
    return
  }

  // Container → lista os filhos.
  const filhos = await getFilhos(nodeId)
  const kb = new InlineKeyboard()
  for (const f of filhos) {
    kb.text(f.title, `nav:${f.id}`).row()
  }
  if (no.parentId) kb.text('⬅️ Voltar', `nav:${no.parentId}`).row()
  kb.text('🏠 Início', 'inicio')

  await ctx.answerCallbackQuery()
  const legenda = no.description ? `📚 *${no.title}*\n\n_${no.description}_` : `📚 *${no.title}*`
  try {
    await ctx.editMessageText(legenda, { parse_mode: 'Markdown', reply_markup: kb })
  } catch {
    await ctx.editMessageText(legenda.replace(/[*_]/g, ''), { reply_markup: kb })
  }
}

export function registrarNavegar(bot: Bot) {
  // Atalho para o menu principal (reenvia os dois sets)
  bot.callbackQuery('navegar', async (ctx) => {
    await ctx.answerCallbackQuery()
    await ctx.deleteMessage().catch(() => {})
    await enviarMenuPrincipal(ctx)
  })

  // Abre um nó (container ou folha)
  bot.callbackQuery(/^nav:(.+)$/, async (ctx) => {
    await abrirNo(ctx, ctx.match[1])
  })
}
