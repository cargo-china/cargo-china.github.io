import { Composer } from 'grammy'

export const startModule = new Composer()

startModule.command('start', (ctx) => ctx.reply('Привет!'))
