# Шпаргалка по grammY

Короткий справочник по возможностям библиотеки [grammY](https://grammy.dev) с примерами, привязанными к структуре этого проекта.

## Содержание

1. [Структура проекта и запуск](#1-структура-проекта-и-запуск)
2. [Создание и запуск бота](#2-создание-и-запуск-бота)
3. [Context — объект `ctx`](#3-context--объект-ctx)
4. [Обработчики апдейтов](#4-обработчики-апдейтов)
5. [Команды](#5-команды)
6. [Отправка сообщений](#6-отправка-сообщений)
7. [Клавиатуры и кнопки](#7-клавиатуры-и-кнопки)
8. [Middleware](#8-middleware)
9. [Модули (Composer)](#9-модули-composer)
10. [Фильтры и ветвление](#10-фильтры-и-ветвление)
11. [Сессии](#11-сессии)
12. [Свой контекст (Context Flavors)](#12-свой-контекст-context-flavors)
13. [Обработка ошибок](#13-обработка-ошибок)
14. [Прямые вызовы Bot API](#14-прямые-вызовы-bot-api)
15. [Плагины](#15-плагины)
16. [Webhook вместо polling](#16-webhook-вместо-polling)
17. [Лимиты Telegram](#17-лимиты-telegram)

---

## 1. Структура проекта и запуск

```
bot/
├── src/
│   ├── index.ts          # точка входа: создание бота, подключение модулей
│   ├── commands.ts       # список команд для меню Telegram
│   ├── modules/          # фичи бота (Composer), алиас @modules/*
│   └── middlewares/      # общие middleware, алиас @middlewares/*
├── .env                  # BOT_TOKEN=...
└── package.json
```

| Скрипт             | Что делает                                 |
| ------------------ | ------------------------------------------ |
| `npm run dev`      | запуск с перезапуском при изменении файлов |
| `npm start`        | обычный запуск                             |
| `npm run check`    | проверка типов, линт и форматирование      |
| `npm run lint:fix` | линт с автоисправлением                    |
| `npm run format`   | форматирование через prettier              |

---

## 2. Создание и запуск бота

```ts
import { Bot } from 'grammy'

const bot = new Bot(process.env.BOT_TOKEN!)

// ...обработчики...

bot.start({
  drop_pending_updates: true, // пропустить апдейты, пришедшие, пока бот был выключен
  onStart: (me) => console.info(`Бот @${me.username} запущен`),
})

// корректная остановка
process.once('SIGINT', () => bot.stop())
process.once('SIGTERM', () => bot.stop())
```

`bot.start()` запускает **long polling**: бот сам опрашивает Telegram. Для продакшена можно перейти на webhook (см. [раздел 16](#16-webhook-вместо-polling)).

> Обработчики выполняются **в порядке регистрации**. Апдейт уходит в первый подходящий обработчик и дальше не передаётся, если не вызвать `next()`.

---

## 3. Context — объект `ctx`

Каждый обработчик получает `ctx`: в нём данные апдейта и методы для ответа.

**Данные:**

| Свойство            | Что это                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `ctx.update`        | сырой апдейт от Telegram                                          |
| `ctx.message`       | входящее сообщение (если это сообщение)                           |
| `ctx.msg`           | сообщение из любого места: message, edited_message, channel_post… |
| `ctx.from`          | пользователь, от которого пришёл апдейт                           |
| `ctx.chat`          | чат                                                               |
| `ctx.chatId`        | ID чата                                                           |
| `ctx.callbackQuery` | нажатие inline-кнопки                                             |
| `ctx.match`         | аргументы команды / результат регулярки                           |
| `ctx.me`            | информация о самом боте                                           |
| `ctx.api`           | полный доступ к Bot API                                           |

**Методы-сокращения** (автоматически подставляют `chat_id` текущего чата):

```ts
ctx.reply('текст')
ctx.replyWithPhoto(...)
ctx.replyWithDocument(...)
ctx.editMessageText('новый текст')
ctx.deleteMessage()
ctx.answerCallbackQuery()
ctx.replyWithChatAction('typing') // «печатает…»
```

---

## 4. Обработчики апдейтов

### `bot.on` — по типу апдейта (filter queries)

```ts
bot.on('message', (ctx) => {}) // любое сообщение
bot.on('message:text', (ctx) => {}) // только текст
bot.on('message:photo', (ctx) => {}) // фото
bot.on(':document', (ctx) => {}) // документ в сообщении или посте канала
bot.on('edited_message', (ctx) => {}) // отредактированное сообщение
bot.on('callback_query:data', (ctx) => {}) // любая inline-кнопка
bot.on('message:entities:url', (ctx) => {}) // сообщение со ссылкой
bot.on('my_chat_member', (ctx) => {}) // бота добавили/удалили/заблокировали

// несколько типов сразу — сработает на любой из них
bot.on(['message:photo', 'message:video'], (ctx) => {})
```

TypeScript сужает типы по фильтру: внутри `bot.on('message:text', ...)` поле `ctx.message.text` точно `string`.

### `bot.hears` — по тексту

```ts
bot.hears('Привет', (ctx) => ctx.reply('Привет!'))
bot.hears(/заказ\s+(\d+)/i, (ctx) => ctx.reply(`Заказ №${ctx.match[1]}`))
```

### `bot.command` — по команде

Подробно в [разделе 5](#5-команды).

### `bot.callbackQuery` — по нажатию inline-кнопки

```ts
bot.callbackQuery('confirm', async (ctx) => {
  await ctx.answerCallbackQuery('Подтверждено')
})
```

### Другое

```ts
bot.chatType('private').on('message', (ctx) => {}) // только личные чаты
bot.reaction('👍', (ctx) => {}) // реакции на сообщения
bot.inlineQuery(/товар/, (ctx) => {}) // inline-режим (@bot запрос)
```

---

## 5. Команды

### Обработчик команды

```ts
bot.command('start', (ctx) => ctx.reply('Добро пожаловать!'))

// несколько имён для одной команды
bot.command(['help', 'info'], (ctx) => ctx.reply('Справка'))
```

Имя команды: латиница в нижнем регистре, цифры и `_`, длиной до 32 символов. В группах `/start@your_bot` обрабатывается автоматически.

### Аргументы команды

Всё, что пользователь написал после команды, лежит в `ctx.match`:

```ts
// /track ABC123  →  ctx.match === 'ABC123'
bot.command('track', async (ctx) => {
  const code = ctx.match.trim()
  if (!code) return ctx.reply('Укажи трек-номер: /track ABC123')
  await ctx.reply(`Ищу посылку ${code}...`)
})

// несколько аргументов: /add iphone 2
bot.command('add', (ctx) => {
  const [name, qty = '1'] = ctx.match.split(/\s+/)
  return ctx.reply(`Добавлено: ${name} × ${qty}`)
})
```

### Deep link (параметр в `/start`)

Ссылка `https://t.me/your_bot?start=promo42` отправляет боту `/start promo42`:

```ts
bot.command('start', (ctx) => {
  const payload = ctx.match // 'promo42' или ''
  if (payload) return ctx.reply(`Ты пришёл по коду ${payload}`)
  return ctx.reply('Привет!')
})
```

Параметр: до 64 символов, разрешены `A-Z a-z 0-9 _ -`. Подходит для реферальных кодов и ID товаров.

### Меню команд (что видит пользователь)

Чтобы команды появились в кнопке «Меню» и в подсказках после ввода `/`, их нужно зарегистрировать в Telegram. В проекте список лежит в `src/commands.ts` и отправляется при старте:

```ts
// src/commands.ts
import type { BotCommand } from 'grammy/types'

export const commands: BotCommand[] = [
  { command: 'start', description: 'Запустить бота' },
  { command: 'order', description: 'Новый заказ' },
  { command: 'track', description: 'Отследить посылку' },
]
```

```ts
// src/index.ts
await bot.api.setMyCommands(commands)
```

**Разные списки для разных мест и языков** (`scope`, `language_code`):

```ts
// только в личных чатах
await bot.api.setMyCommands(commands, { scope: { type: 'all_private_chats' } })

// для админов групп
await bot.api.setMyCommands([{ command: 'ban', description: 'Забанить' }], {
  scope: { type: 'all_chat_administrators' },
})

// для конкретного чата (например, админ-панель для себя)
await bot.api.setMyCommands([{ command: 'stats', description: 'Статистика' }], {
  scope: { type: 'chat', chat_id: ADMIN_ID },
})

// английская версия для пользователей с английским интерфейсом
await bot.api.setMyCommands([{ command: 'start', description: 'Start the bot' }], {
  language_code: 'en',
})

// удалить меню
await bot.api.deleteMyCommands()
```

> Меню и обработчики **не связаны**: команда из меню без `bot.command(...)` ничего не сделает. Если меню не обновилось, перезайди в чат с ботом.

### «Вызов» команды из другого места

Бот не может «нажать» команду за пользователя. Обработчик выносят в функцию и переиспользуют:

```ts
const showHelp = (ctx: Context) => ctx.reply('Справка: ...')

bot.command('help', showHelp)

// та же логика по inline-кнопке
bot.callbackQuery('help', async (ctx) => {
  await ctx.answerCallbackQuery()
  await showHelp(ctx)
})

// и по тексту с обычной клавиатуры
bot.hears('❓ Помощь', showHelp)
```

Кнопка обычной клавиатуры с текстом `/help` при нажатии отправляет команду от имени пользователя, и сработает `bot.command('help')`.

---

## 6. Отправка сообщений

### Текст и форматирование

```ts
await ctx.reply(
  '<b>Жирный</b>, <i>курсив</i>, <code>код</code>, <a href="https://grammy.dev">ссылка</a>',
  {
    parse_mode: 'HTML',
  }
)

// ответ с цитированием исходного сообщения
await ctx.reply('Ответ', { reply_parameters: { message_id: ctx.msg!.message_id } })

// без звука и без превью ссылок
await ctx.reply('Тихо', {
  disable_notification: true,
  link_preview_options: { is_disabled: true },
})
```

`HTML` удобнее, чем `MarkdownV2`: в MarkdownV2 нужно экранировать почти все спецсимволы. Пользовательский текст в HTML экранируй (`<`, `>`, `&`).

### Файлы и медиа

```ts
import { InputFile, InputMediaBuilder } from 'grammy'

await ctx.replyWithPhoto(new InputFile('./images/product.jpg'), { caption: 'Товар' })
await ctx.replyWithPhoto('https://example.com/photo.jpg') // по URL
await ctx.replyWithPhoto(fileId) // по file_id уже загруженного файла — быстрее всего
await ctx.replyWithDocument(new InputFile(buffer, 'invoice.pdf'))

// альбом
await ctx.replyWithMediaGroup([
  InputMediaBuilder.photo('https://example.com/1.jpg', { caption: 'Подпись альбома' }),
  InputMediaBuilder.photo('https://example.com/2.jpg'),
])
```

### Получить файл от пользователя

```ts
bot.on('message:photo', async (ctx) => {
  const photo = ctx.message.photo.at(-1)! // последний элемент — наибольший размер
  const file = await ctx.api.getFile(photo.file_id)
  const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`
  // скачать по url или использовать плагин @grammyjs/files
})
```

### Редактирование и удаление

```ts
const msg = await ctx.reply('Загрузка...')
await ctx.api.editMessageText(msg.chat.id, msg.message_id, 'Готово!')
await ctx.api.deleteMessage(msg.chat.id, msg.message_id)

// внутри callbackQuery можно короче — редактируется сообщение с кнопкой
await ctx.editMessageText('Новый текст')
await ctx.deleteMessage()
```

### Написать пользователю по ID (не в ответ)

```ts
await bot.api.sendMessage(userId, 'Ваш заказ отправлен 📦')
```

Работает, только если пользователь уже запускал бота и не заблокировал его.

---

## 7. Клавиатуры и кнопки

### Inline-клавиатура (кнопки под сообщением)

```ts
import { InlineKeyboard } from 'grammy'

const keyboard = new InlineKeyboard()
  .text('✅ Да', 'confirm')
  .text('❌ Нет', 'cancel')
  .row()
  .url('Наш сайт', 'https://example.com')

await ctx.reply('Подтвердить заказ?', { reply_markup: keyboard })

bot.callbackQuery('confirm', async (ctx) => {
  await ctx.answerCallbackQuery() // обязательно — иначе у кнопки будут «часики»
  await ctx.editMessageText('Заказ подтверждён')
})

bot.callbackQuery('cancel', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Отменено', show_alert: true }) // всплывающее окно
  await ctx.deleteMessage()
})
```

### Данные в кнопке

`callback_data` ограничена **64 байтами**. Передавай ID, а не объекты:

```ts
const kb = new InlineKeyboard()
for (const product of products) {
  kb.text(product.name, `product:${product.id}`).row()
}

bot.callbackQuery(/^product:(\d+)$/, async (ctx) => {
  const productId = Number(ctx.match[1])
  await ctx.answerCallbackQuery()
  await ctx.reply(`Товар #${productId}`)
})
```

Другие типы inline-кнопок: `.webApp(text, url)` (Mini App), `.switchInline(text, query)`, `.copyText(text, value)`, `.login(text, url)`.

### Обычная клавиатура (вместо поля ввода)

```ts
import { Keyboard } from 'grammy'

const menu = new Keyboard()
  .text('🛒 Каталог')
  .text('📦 Мои заказы')
  .row()
  .requestContact('📱 Отправить телефон')
  .requestLocation('📍 Отправить геолокацию')
  .resized() // компактные кнопки
  .persistent() // не прятать клавиатуру

await ctx.reply('Главное меню', { reply_markup: menu })

// нажатие = обычное текстовое сообщение
bot.hears('🛒 Каталог', (ctx) => ctx.reply('Каталог...'))
bot.on('message:contact', (ctx) => ctx.reply(`Телефон: ${ctx.message.contact.phone_number}`))

// убрать клавиатуру
await ctx.reply('Клавиатура скрыта', { reply_markup: { remove_keyboard: true } })
```

---

## 8. Middleware

Middleware — функция `(ctx, next) => ...`. Вся обработка в grammY — цепочка таких функций. `next()` передаёт апдейт дальше; без вызова `next()` цепочка останавливается.

```ts
// src/middlewares/logger.ts — уже есть в проекте
import type { Context, NextFunction } from 'grammy'

export const logger = async (ctx: Context, next: NextFunction) => {
  const start = Date.now()
  await next() // всё, что ниже — выполнится после обработчиков
  console.info(`update ${ctx.update.update_id} processed in ${Date.now() - start}ms`)
}
```

```ts
// src/middlewares/admin-only.ts — пропускает только админов
import type { Context, NextFunction } from 'grammy'

const ADMIN_IDS = new Set([123456789])

export const adminOnly = async (ctx: Context, next: NextFunction) => {
  if (ctx.from && ADMIN_IDS.has(ctx.from.id)) return next()
  await ctx.reply('Нет доступа')
}
```

```ts
// подключение
bot.use(logger) // для всех апдейтов
bot.command('stats', adminOnly, (ctx) => ctx.reply('Статистика')) // для одной команды
```

> Всегда делай `await next()` (или `return next()`), иначе ошибки из следующих обработчиков потеряются, а порядок выполнения нарушится.

---

## 9. Модули (Composer)

`Composer` — «мини-бот»: у него те же методы (`command`, `on`, `use`…), но он не запускается сам, а подключается в основной бот. Так бот делится на модули по фичам.

```ts
// src/modules/order.ts
import { Composer } from 'grammy'

import { adminOnly } from '@middlewares/admin-only'

export const orderModule = new Composer()

orderModule.command('order', (ctx) => ctx.reply('Оформляем заказ...'))
orderModule.callbackQuery(/^order:cancel:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery('Заказ отменён')
})

// middleware только внутри модуля
const adminPart = orderModule.filter((ctx) => ctx.chat?.type === 'private')
adminPart.use(adminOnly)
adminPart.command('orders_all', (ctx) => ctx.reply('Все заказы...'))
```

```ts
// src/index.ts
import { orderModule } from '@modules/order'
import { startModule } from '@modules/start'

bot.use(logger)
bot.use(startModule)
bot.use(orderModule)
```

Модули можно вкладывать: `orderModule.use(paymentModule)`.

> Порядок `bot.use(...)` важен. Модуль с общим обработчиком вроде `on('message')` подключай **последним**, иначе он перехватит апдейты у остальных.

---

## 10. Фильтры и ветвление

```ts
// filter — продолжить только если условие истинно
bot.filter((ctx) => ctx.from?.language_code === 'ru').command('ru', (ctx) => ctx.reply('Привет'))

// drop — наоборот, отбросить
bot.drop((ctx) => ctx.from?.is_bot === true).use(mainModule)

// branch — if/else
bot.branch(
  (ctx) => ADMIN_IDS.has(ctx.from?.id ?? 0),
  adminModule, // если true
  userModule // если false
)

// lazy — выбрать middleware динамически для каждого апдейта
bot.lazy((ctx) => (ctx.chat?.type === 'private' ? privateModule : groupModule))

// fork — запустить параллельно, не дожидаясь (например, аналитика)
bot.fork((ctx) => saveAnalytics(ctx.update))
```

Условие может быть асинхронным, например проверкой по базе.

---

## 11. Сессии

Сессия — объект `ctx.session`, который grammY сохраняет между сообщениями. Встроена в `grammy`, отдельный пакет не нужен.

**Как работает:** апдейт приходит → по ключу (по умолчанию `chat.id`) данные загружаются в `ctx.session` → отрабатывают обработчики → `ctx.session` записывается обратно.

### Подключение с типами

```ts
// src/context.ts
import type { Context, SessionFlavor } from 'grammy'

export interface SessionData {
  cart: { productId: number; qty: number }[]
  step: 'idle' | 'waiting_address'
}

export type MyContext = Context & SessionFlavor<SessionData>
```

```ts
// src/index.ts
import { Bot, session } from 'grammy'

import type { MyContext, SessionData } from './context'

const bot = new Bot<MyContext>(token)

bot.use(
  session({
    // именно функция: каждый чат получает свой новый объект
    initial: (): SessionData => ({ cart: [], step: 'idle' }),
  })
)
```

### Использование

```ts
// src/modules/cart.ts
import { Composer } from 'grammy'

import type { MyContext } from '../context'

export const cartModule = new Composer<MyContext>() // тип обязателен

cartModule.command('add', (ctx) => {
  ctx.session.cart.push({ productId: Number(ctx.match), qty: 1 })
  return ctx.reply(`В корзине: ${ctx.session.cart.length} шт.`)
})

cartModule.command('checkout', (ctx) => {
  if (!ctx.session.cart.length) return ctx.reply('Корзина пуста')
  ctx.session.step = 'waiting_address'
  return ctx.reply('Напиши адрес доставки')
})

cartModule.on('message:text', (ctx, next) => {
  if (ctx.session.step !== 'waiting_address') return next()
  ctx.session.step = 'idle'
  ctx.session.cart = []
  return ctx.reply(`Заказ оформлен, адрес: ${ctx.message.text}`)
})
```

### Хранилище

По умолчанию данные лежат **в памяти** и пропадают при перезапуске. Для продакшена подключи адаптер:

```ts
import { RedisAdapter } from '@grammyjs/storage-redis'
import { Redis } from 'ioredis'

bot.use(
  session({
    initial: (): SessionData => ({ cart: [], step: 'idle' }),
    storage: new RedisAdapter({ instance: new Redis(process.env.REDIS_URL!) }),
  })
)
```

Адаптеры: `@grammyjs/storage-redis`, `storage-psql`, `storage-mongodb`, `storage-prisma`, `storage-file`, `storage-free` (бесплатное облако grammY).

### Опции

```ts
session({
  initial,
  storage,
  // сессия на пользователя, а не на чат (в группах иначе одна сессия на всех)
  getSessionKey: (ctx) => ctx.from?.id.toString(),
})
```

- `lazySession(...)` — загружать сессию из хранилища только при обращении; тогда `const data = await ctx.session`.
- Мульти-сессии — разные части сессии в разных хранилищах (`type: 'multi'`).

> В сессии храни только JSON-совместимые данные (без классов, `Date`, функций) и только временное состояние диалога. Заказы и пользователей — в нормальной БД.

---

## 12. Свой контекст (Context Flavors)

В `ctx` можно добавлять свои поля через middleware: пользователя из БД, конфиг, сервисы.

```ts
// src/context.ts
import type { Context, SessionFlavor } from 'grammy'

interface CustomFlavor {
  user: { id: number; isAdmin: boolean }
}

export type MyContext = Context & SessionFlavor<SessionData> & CustomFlavor
```

```ts
// src/middlewares/load-user.ts
import type { NextFunction } from 'grammy'

import type { MyContext } from '../context'

export const loadUser = async (ctx: MyContext, next: NextFunction) => {
  if (!ctx.from) return next()
  ctx.user = await db.users.findOrCreate(ctx.from.id)
  await next()
}
```

Теперь `ctx.user` доступен во всех обработчиках после `bot.use(loadUser)`.

---

## 13. Обработка ошибок

### Глобальный обработчик

Без `bot.catch` первая же ошибка в обработчике остановит бота.

```ts
import { GrammyError, HttpError } from 'grammy'

bot.catch((err) => {
  const ctx = err.ctx
  console.error(`Ошибка при обработке апдейта ${ctx.update.update_id}:`)
  const e = err.error

  if (e instanceof GrammyError) {
    console.error('Ошибка от Telegram:', e.description) // например «bot was blocked by the user»
  } else if (e instanceof HttpError) {
    console.error('Нет связи с Telegram:', e)
  } else {
    console.error('Неизвестная ошибка:', e)
  }
})
```

### Ошибки внутри модуля

```ts
const safeModule = orderModule.errorBoundary(async (err) => {
  console.error('Ошибка в модуле заказов', err.error)
  await err.ctx.reply('Что-то пошло не так, попробуй ещё раз')
})
```

### Точечный перехват

```ts
try {
  await bot.api.sendMessage(userId, 'Привет')
} catch (e) {
  if (e instanceof GrammyError && e.error_code === 403) {
    // пользователь заблокировал бота — пометить в БД
  }
}
```

---

## 14. Прямые вызовы Bot API

`bot.api` и `ctx.api` дают доступ ко **всем** методам [Telegram Bot API](https://core.telegram.org/bots/api) с типами. Имена методов совпадают с документацией.

```ts
await bot.api.sendMessage(chatId, 'текст')
await bot.api.getChat(chatId)
await bot.api.getChatMember(chatId, userId)
await bot.api.banChatMember(chatId, userId)
await bot.api.pinChatMessage(chatId, messageId)
await bot.api.setMyDescription('Описание бота на пустом экране чата')
await bot.api.setMyShortDescription('Короткое описание в профиле')
await bot.api.setChatMenuButton({ menu_button: { type: 'commands' } })
const me = await bot.api.getMe()
```

**Трансформеры** — middleware для исходящих запросов (повторы, лимиты, логирование):

```ts
bot.api.config.use(async (prev, method, payload, signal) => {
  console.info('→', method)
  return prev(method, payload, signal)
})
```

---

## 15. Плагины

Ставятся отдельно: `npm i <пакет>`.

### `@grammyjs/conversations` — пошаговые диалоги

Вместо ручного поля `step` диалог пишется как обычный `async`-код:

```ts
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from '@grammyjs/conversations'
import { Bot, type Context } from 'grammy'

type MyContext = ConversationFlavor<Context>
type MyConversation = Conversation<MyContext, Context>

async function orderConversation(conversation: MyConversation, ctx: Context) {
  await ctx.reply('Что заказываем?')
  const product = await conversation.form.text()

  await ctx.reply('Сколько штук?')
  const qty = await conversation.form.number()

  await ctx.reply('Пришли фото товара')
  const photoCtx = await conversation.waitFor('message:photo')

  // побочные эффекты (БД, HTTP) — только через external
  await conversation.external(() => db.orders.create({ product, qty }))

  await photoCtx.reply(`Заказ: ${product} × ${qty} оформлен`)
}

const bot = new Bot<MyContext>(token)
bot.use(conversations())
bot.use(createConversation(orderConversation, 'order'))

bot.command('order', (ctx) => ctx.conversation.enter('order'))
bot.command('cancel', (ctx) => ctx.conversation.exitAll())
```

### `@grammyjs/menu` — интерактивные меню

```ts
import { Menu } from '@grammyjs/menu'

const settings = new Menu('settings')
  .text('🔔 Уведомления', (ctx) => ctx.reply('...'))
  .row()
  .back('⬅️ Назад')

const main = new Menu('main')
  .text('📦 Заказы', (ctx) => ctx.reply('Заказы'))
  .submenu('⚙️ Настройки', 'settings')

main.register(settings)
bot.use(main) // до обработчиков, которые показывают меню

bot.command('menu', (ctx) => ctx.reply('Главное меню', { reply_markup: main }))
```

Меню само обрабатывает нажатия, переходы и обновление текста кнопок (например, `.text((ctx) => (on ? '✅' : '❌'), ...)`).

### `@grammyjs/auto-retry` — повтор при лимитах

```ts
import { autoRetry } from '@grammyjs/auto-retry'

bot.api.config.use(autoRetry()) // при 429 ждёт и повторяет запрос
```

### `@grammyjs/transformer-throttler` — не превышать лимиты

Ставит исходящие запросы в очередь так, чтобы не упереться в лимиты Telegram. Полезно для рассылок.

### `@grammyjs/ratelimiter` — защита от спама

```ts
import { limit } from '@grammyjs/ratelimiter'

bot.use(
  limit({
    timeFrame: 2000,
    limit: 3, // не больше 3 апдейтов за 2 секунды от одного пользователя
    onLimitExceeded: (ctx) => ctx.reply('Слишком часто, подожди немного'),
  })
)
```

### `@grammyjs/runner` — параллельная обработка

По умолчанию `bot.start()` обрабатывает апдейты по одному. Runner — параллельно:

```ts
import { run, sequentialize } from '@grammyjs/runner'

// апдейты одного чата — по очереди (важно для сессий), разных — параллельно
bot.use(sequentialize((ctx) => ctx.chat?.id.toString()))
run(bot) // вместо bot.start()
```

### Остальные

| Плагин                 | Для чего                                                                |
| ---------------------- | ----------------------------------------------------------------------- |
| `@grammyjs/hydrate`    | методы у результатов: `const m = await ctx.reply(...); m.editText(...)` |
| `@grammyjs/files`      | удобное скачивание файлов: `await (await ctx.getFile()).download()`     |
| `@grammyjs/i18n`       | мультиязычность на файлах `.ftl`                                        |
| `@grammyjs/parse-mode` | форматирование без ручного экранирования                                |
| `@grammyjs/commands`   | объявление команд и их описаний для меню в одном месте                  |
| `@grammyjs/router`     | роутинг апдейтов по ключу (альтернатива `branch`/`lazy`)                |
| `@grammyjs/emoji`      | эмодзи по имени в шаблонных строках                                     |

Полный список: <https://grammy.dev/plugins/>.

---

## 16. Webhook вместо polling

При webhook Telegram сам отправляет апдейты на твой HTTPS-адрес. Это быстрее и подходит для serverless.

```ts
import express from 'express'
import { webhookCallback } from 'grammy'

const app = express()
app.use(express.json())
app.post('/webhook', webhookCallback(bot, 'express', { secretToken: process.env.WEBHOOK_SECRET }))
app.listen(3000)

// один раз (например, в скрипте деплоя)
await bot.api.setWebhook('https://example.com/webhook', {
  secret_token: process.env.WEBHOOK_SECRET,
})
```

Поддерживаются адаптеры: `express`, `fastify`, `koa`, `hono`, `std/http`, `aws-lambda`, `cloudflare` и др.

> Polling и webhook одновременно не работают. Чтобы вернуться к polling: `await bot.api.deleteWebhook()`.

---

## 17. Лимиты Telegram

| Что                         | Лимит         |
| --------------------------- | ------------- |
| Сообщений в один чат        | ~1 в секунду  |
| Сообщений в группу          | ~20 в минуту  |
| Сообщений всего (рассылки)  | ~30 в секунду |
| Длина текста сообщения      | 4096 символов |
| Длина подписи к медиа       | 1024 символа  |
| `callback_data` кнопки      | 64 байта      |
| Параметр deep link `/start` | 64 символа    |
| Отправка файла ботом        | до 50 МБ      |
| Скачивание файла ботом      | до 20 МБ      |

При превышении Telegram возвращает ошибку `429 Too Many Requests` — её автоматически обрабатывает `@grammyjs/auto-retry`.

---

**Полезные ссылки**

- Документация grammY: <https://grammy.dev>
- Справочник API grammY: <https://grammy.dev/ref/>
- Telegram Bot API: <https://core.telegram.org/bots/api>
