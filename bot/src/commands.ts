import type { BotCommand } from 'grammy/types'

// Команды, которые пользователь видит в меню Telegram (кнопка «Меню» / подсказки после «/»)
export const commands: BotCommand[] = [{ command: 'start', description: 'Запустить бота' }]
