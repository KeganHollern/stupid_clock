
const Promise = require('bluebird')
const { MClient } = require('mhub')

const { logger } = require('./logger')
const { getCurrentConfig } = require('./configuration')

const mClient = new MClient(process.env.MHUB_URI)

let loginPromise = null

mClient.on('error', msg => {
  logger.error('Unable to connect to mhub, other modules won\'t be notified changes \n ' + msg)
})

mClient.on('close', () => {
  loginPromise = null
  logger.warn('Disconnected from mhub. Retrying upon next publish')
})

function login () {
  logger.warn('MHUB-HANDLER.JS LOGIN()')

  if (!loginPromise) {
    logger.warn('Connecting to mhub')
    loginPromise = Promise.resolve(mClient.connect().then(res => {
      logger.warn(`connected: ${res}`)
      return res
    }))
      .tap(() => logger.warn('Trying to login to mhub'))
      .then(() => mClient.login('protected-client', process.env.PROTECTED_MHUB_PASSWORD))
      .tap(() => logger.warn('Logged into mhub'))
      .tapCatch(err => {
        logger.error(`error while logging into mhub: ${err.message}`)
        loginPromise = null
      })
  }

  return loginPromise
}

exports.sendEvent = event => {
  return login()
    .then(() => logger.warn(`sending ${event} event to mhub`))
    .then(() => mClient.publish('protected', `clock:${event}`, {}))
}

exports.sendTimeEvent = time => {
  logger.warn(`sendTimeEvent ${time}`)

  var loginPromise = login();

  logger.warn(`promise acquired`)

  var postLoginPromise = loginPromise
    .then(() => logger.warn(`sending time event to mhub for (t=${time})`))
    .tapCatch(err => logger.error(`failed login to mhub`))

  logger.warn(`post login promise acquired`)

  var cfg =  getCurrentConfig()
  var toPublish = Object.assign({ time }, cfg)
  logger.warn(`config ${JSON.stringify(cfg)}`)
  logger.warn(`going to publish ${JSON.stringify(toPublish)}`)

  var result = postLoginPromise
    .then(() => {
      logger.warn('publishing time to clock:time')
      mClient.publish('protected', 'clock:time', toPublish)
    })
    .tapCatch(err => logger.error(`failed to print log?`))

  logger.warn('post publish promise acquired')

  return result
}

exports.sendClockFormat = format => {
  return login()
    .then(() => logger.warn(`sending format event to mhub for format ${format}`))
    .then(() => mClient.publish('protected', 'clock:format-changed', { format }))
}

exports.subscribe = (node, topic, listener) => {
  logger.warn(`subscribing to mhub: ${node}, ${topic}, ${listener}`)
  return login()
    .then(() => mClient.subscribe(node, topic))
    .then(() => mClient.on('message', function (message) {
      logger.warn(`mhub message: ${JSON.stringify(message)}`)
      if (message.topic === topic) {
        listener.apply(this, arguments)
      }
    }))
}
