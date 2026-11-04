import { Bot } from 'grammy'

import { logger } from '@middlewares/logger'
import { startModule } from '@modules/start'

import { commands } from './commands'

const token = process.env.BOT_TOKEN

if (!token) throw new Error('BOT_TOKEN is not set')

const bot = new Bot(token)

bot.use(logger)
bot.use(startModule)

await bot.api.setMyCommands(commands)

bot.start()
