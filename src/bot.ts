import 'dotenv/config'
import { Bot } from 'grammy'
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

// Garante que não há webhook registrado (webhook e polling são mutuamente exclusivos)
await bot.api.deleteWebhook()
bot.start({ allowed_updates: ['message', 'callback_query', 'chat_member'] })
console.log('Bot rodando em modo polling')
