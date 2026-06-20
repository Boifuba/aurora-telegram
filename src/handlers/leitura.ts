import { Bot, InlineKeyboard } from 'grammy'
import { paginarTexto } from '../lib/paginator.js'
import { getNo, getConteudo, getProximaFolhaIrma } from '../lib/nodes.js'
import { registrarAbertura, type OrigemLeitura } from '../lib/leituras.js'

type Leitura =
  | { ok: true; texto: string; kb: InlineKeyboard }
  | { ok: false; motivo: string }

export async function montarLeitura(
  nodeId: string,
  pagina: number,
  userId?: number,
  origem: OrigemLeitura = 'bot',
): Promise<Leitura> {
  const no = await getNo(nodeId)
  if (!no) {
    return { ok: false, motivo: 'Conteúdo não encontrado.' }
  }

  const corpo = await getConteudo(nodeId)
  if (!corpo) {
    return { ok: false, motivo: 'Conteúdo não disponível.' }
  }

  // Registra só a abertura do conto (página 0), não cada virada de página.
  if (pagina === 0) {
    registrarAbertura(userId, nodeId, origem)
  }

  const paginas = paginarTexto(corpo)
  const total = paginas.length
  const texto = paginas[pagina]

  if (!texto) {
    return { ok: false, motivo: 'Página inválida.' }
  }

  const header = pagina === 0
    ? `*${no.title}*\n${'─'.repeat(30)}\n\n`
    : ''

  const footer = `\n\n─ Parte ${pagina + 1} de ${total} ─`

  const ultimaPagina = pagina === total - 1

  // Na última página, oferece continuar para a próxima folha-irmã, se houver.
  let proxima = null
  if (ultimaPagina) {
    proxima = await getProximaFolhaIrma(nodeId)
  }

  const kb = new InlineKeyboard()
  if (pagina > 0) kb.text('⬅️', `ler:${nodeId}:${pagina - 1}`)
  if (!ultimaPagina) kb.text('➡️', `ler:${nodeId}:${pagina + 1}`)
  if (proxima) {
    kb.row().text(`Continuar: ${proxima.title} ➡️`, `ler:${proxima.id}:0`)
  }
  if (no.parentId) {
    kb.row().text('⬆️ Voltar', `nav:${no.parentId}`)
  }
  kb.row().text('🏠 Início', 'inicio')

  return { ok: true, texto: header + texto + footer, kb }
}

export function registrarLeitura(bot: Bot) {
  bot.callbackQuery(/^ler:(.+):(\d+)$/, async (ctx) => {
    const nodeId = ctx.match[1]
    const pagina = parseInt(ctx.match[2])

    const leitura = await montarLeitura(nodeId, pagina, ctx.from?.id, 'bot')

    if (!leitura.ok) {
      await ctx.answerCallbackQuery(leitura.motivo)
      return
    }

    await ctx.answerCallbackQuery()

    try {
      await ctx.editMessageText(leitura.texto, {
        parse_mode: 'Markdown',
        reply_markup: leitura.kb,
      })
    } catch {
      // Markdown inválido no conteúdo — envia sem formatação
      await ctx.editMessageText(leitura.texto.replace(/\*/g, ''), { reply_markup: leitura.kb })
    }
  })
}
