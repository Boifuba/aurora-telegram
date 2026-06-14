import 'dotenv/config'
import { Bot, webhookCallback } from 'grammy'
import { createServer } from 'node:http'
import { registrarStart, enviarMenuPrincipal } from './handlers/start.js'
import { registrarNavegar } from './handlers/navegar.js'
import { registrarLeitura } from './handlers/leitura.js'
import { registrarSurpresa } from './handlers/surpresa.js'
import { registrarBoasVindas } from './handlers/boasvindas.js'
import { registrarCanal } from './handlers/canal.js'
import { registrarDivulgacao } from './handlers/divulgacao.js'

const bot = new Bot(process.env.BOT_TOKEN!)

// Handlers
registrarStart(bot)
registrarNavegar(bot)
registrarLeitura(bot)
registrarSurpresa(bot)
registrarBoasVindas(bot)
registrarCanal(bot)
registrarDivulgacao(bot)

// Botão de início (volta ao menu principal — reenvia os dois sets)
bot.callbackQuery('inicio', async (ctx) => {
  await ctx.answerCallbackQuery()
  await ctx.deleteMessage().catch(() => {})
  await enviarMenuPrincipal(ctx)
})

bot.catch((err) => {
  console.error('Erro no bot:', err)
})

if (process.env.NODE_ENV === 'production') {
  const PORT = parseInt(process.env.PORT ?? '3000')
  const handleUpdate = webhookCallback(bot, 'http')

  const server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
      await handleUpdate(req, res)
    } else {
      res.writeHead(200).end('OK')
    }
  })

  server.listen(PORT, () => {
    console.log(`Bot rodando na porta ${PORT}`)
  })
} else {
  bot.start({ allowed_updates: ['message', 'callback_query', 'chat_member'] })
  console.log('Bot rodando em modo polling (dev)')
}
