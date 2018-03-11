import { readFileSync } from 'fs'

const app   = require('express')()
    , proxy = require('http-proxy').createProxyServer({ target: process.env.UPSTREAM_URL })
    , rates = require('js-yaml').safeLoad(process.env.RATES_YAML || readFileSync(process.env.RATES_PATH || 'rates.yaml'))

const pay = require('./paypercall')({
  chargeUrl:   process.env.CHARGE_URL
, chargeToken: process.env.CHARGE_TOKEN
, dbPath:      process.env.DB_PATH
, currency:    process.env.CURRENCY
, secret:      process.env.TOKEN_SECRET
, invoiceExp:  process.env.INVOICE_EXPIRY
, accessExp:   process.env.ACCESS_EXPIRY
})

app.set('env', process.env.NODE_ENV || 'production')
app.set('port', process.env.PORT || 4000)
app.set('host', process.env.HOST || 'localhost')
app.set('trust proxy', process.env.PROXIED || 'loopback')

app.enable('strict routing')
app.enable('case sensitive routing')
app.disable('x-powered-by')
app.disable('etag')

app.use(require('morgan')('dev'))

const proxyweb = proxy.web.bind(proxy)

Object.keys(rates).forEach(ep => {
  const [ method, path ] = ep.split(' ', 2), rate = rates[ep].toString()
  app[method.toLowerCase()](path, pay(...rate.split(' ')), proxyweb)
})

app.listen(app.settings.port, app.settings.host, _ =>
  console.log(`HTTP reverse proxy running on http://${ app.settings.host }:${ app.settings.port }, proxying to ${ process.env.UPSTREAM_URL }`))
