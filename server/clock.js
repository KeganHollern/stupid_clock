
const EventEmitter = require('events')
const { logger } = require('./logger')

const SECOND = 1000

function exactTimeListener (listener, requestedTime, currentTime) {
  if (currentTime === requestedTime) {
    listener.call(this, currentTime)
  }
}

exports.Clock = class extends EventEmitter {
  constructor () {
    super()

    this._time = 0
  }

  get time () {
    return this._time
  }

  set time (seconds) {
    this._time = seconds
    logger.warn(`set time: ${seconds}`)
    setImmediate(() => this.emit('time', this._time))
  }

  onExactTime (requestedTime, listener) {
    logger.warn(`on exact time: ${requestedTime}, ${listener}`)
    this.on('time', exactTimeListener.bind(this, listener, requestedTime))
  }

  setTime (seconds) {
    this.time = seconds
  }

  startCountdown (seconds) {
    logger.warn('starting countdown')

    this._interval = setInterval(() => {
      this._time -= 1
      logger.warn(`emit time change: ${this._time}`)
      setImmediate(() => this.emit('time', this._time))

      if (this._time <= 0) {
        setImmediate(() => this._endCountdown())
      }
    }, SECOND)

    this._time = seconds
    // TODO: this fires right before our crash
    logger.warn(`emit time change 2: ${this._time}`)

    var allListeners = this.listeners('time')
    allListeners.forEach(listener => {
      logger.warn(`found listener: ${listener.name}`)
      //var result = listener(this._time)
      //logger.warn(`listener result: ${result}`)
    })

    logger.warn("SENDING ACTUAL EMIT EVENT")
    setImmediate(() => this.emit('time', this._time))
    
    logger.warn('countdown started')
  }

  stopCountdown () {
    if (this._interval) {
      clearInterval(this._interval)
      delete this._interval
    }
  }

  _endCountdown () {
    this.emit('end')
    if (this._interval) {
      clearInterval(this._interval)
      delete this._interval
    }
  }
}
