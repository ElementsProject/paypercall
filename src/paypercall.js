import { createHmac } from 'crypto'
import { join } from 'path'
import { pwrap, only, now } from './util'

require('babel-polyfill')

module.exports = opt => {
  const db     = opt.db     || require('knex')({ client: 'sqlite3', connection: opt.dbPath || 'paypercall.db', useNullAsDefault: true })
      , charge = opt.charge || require('lightning-charge-client')(opt.chargeUrl, opt.chargeToken)
      , secret = opt.secret || opt.chargeToken && createHmac('sha256', opt.chargeToken).update('paypercall-secret').digest()
                            || (_ => { throw new Error('secret or chargeToken are required') })()

  const invoiceExp  = +opt.invoiceExp || 60*60
      , accessExp   = +opt.accessExp  || 60*60
      , defCurrency = opt.currency    || 'BTC'

  // HMAC tokens
  const hmac = (req, invid) => createHmac('sha256', secret)
    .update([ invid, req.method, req.path ].join(' '))
    .digest().toString('base64').replace(/\W+/g, '')

  const makeToken  = (req, invid) => [ invid, hmac(req, invid) ].join('.')
  const parseToken = (req, t=req.get('X-Token').split('.')) => hmac(req, t[0]) === t[1] && t[0]

  // Database
  const markSpent = inv        => db('spent').insert({ status: 'processing', invid: inv.id, paid_at: inv.paid_at }).catch(err => false)
      , markDone  = (inv, res) => db('spent').update({ status: 'done', res: res._header }).where({ invid: inv.id, status: 'processing' })

  db.migrate.latest({ directory: join(__dirname, '..', 'migrations') })
  .then(async function cleanup() {
    // cleanup spent tokens that expired over a week ago
    await db('spent').where('paid_at', '<', now() - accessExp - 604800).delete()
    setTimeout(cleanup, 36000000) // every 10 hours
  })

  // Middleware
  return (amount, currency=defCurrency) => pwrap(async (req, res, next) => {
    const invid = req.get('X-Token') && parseToken(req)
        , inv   = invid && await charge.fetch(invid)
        , paid  = inv && inv.status === 'paid' && inv.paid_at > now() - accessExp

    if (paid) {
      if (!await markSpent(inv)) return res.status(410).send('Error: payment token already spent')

      res.once('finish', async _ => await markDone(inv, res))
      next()
    } else {
      const inv = await charge.invoice({
        amount, currency
      , metadata: { app: 'paypercall', req: only(req, 'method', 'path') }
      , description: `Pay to call ${req.method} ${req.path}`
      , expiry: invoiceExp
      })

      res.status(402) // Payment Required
         .type('application/vnd.lightning.bolt11')
         .set('X-Token', makeToken(req, inv.id))
         .send(inv.payreq)
    }
  })
}
