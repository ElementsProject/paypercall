#!/usr/bin/env node

const args = require('meow')(`
    Usage
      $ paypercall [options]

    Options
      -c, --charge-url <url>      lightning charge server url [default: http://localhost:9112]
      -t, --charge-token <token>  lightning charge access token [required]

      -u, --upstream-url <url>    the upstream server to reverse proxy [required]
      -r, --rates-path <path>     path to YAML file mapping from endpoints to rates [default: ./rates.yaml]
      -y, --rates-yaml <yaml>     YAML string to use instead of reading from {rates-path}
      -x, --currency <name>       default rate currency if none is specified [default: BTC]
      -d, --db-path <path>        path to store sqlite database [default: ./payperclick.db]

      --invoice-expiry <sec>      how long should invoices be payable for [default: 1 hour]
      --access-expiry <sec>       how long should paid access tokens remain valid for [default: 1 hour]
      --token-secret <secret>     secret key used for HMAC tokens [default: generated based on {charge-token}]

      -p, --port <port>           http server port [default: 4000]
      -i, --host <host>           http server listen address [default: 127.0.0.1]
      -e, --node-env <env>        nodejs environment mode [default: production]
      -h, --help                  output usage information
      -v, --version               output version number

    Example
      $ payperclick -t myAccessToken -u http://upstream-server.com/ \\
                    -y '{ POST /sms: 0.0001 BTC, PUT /page/:id: 0.0002 BTC }'

`, { flags: { chargeUrl: {alias:'c'}, chargeToken: {alias:'t'}
            , upstreamUrl: {alias:'u'}, ratesPath: {alias:'r'}, ratesYaml: {alias:'y'}
            , currency: {alias:'x'}, dbPath: {alias:'d'}
            , port: {alias:'p'}, host: {alias:'i'}, nodeEnv: {alias:'e'} } }
).flags

Object.keys(args).filter(k => k.length > 1)
  .forEach(k => process.env[k.replace(/([A-Z])/g, '_$1').toUpperCase()] = args[k])

require('./reverse-proxy')
