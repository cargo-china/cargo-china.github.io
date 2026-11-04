import type { Context, NextFunction } from 'grammy'

export const logger = async (ctx: Context, next: NextFunction) => {
  const start = Date.now()
  await next()
  console.info(`update ${ctx.update.update_id} processed in ${Date.now() - start}ms`)
}
