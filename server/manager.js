const ARMED = 'armed'
const PRERUNNING = 'prerunning'
const RUNNING = 'running'
const ENDED = 'ended'

const EventEmitter = require('events')

const { logger } = require('./logger')

const WRONG_STATE_OF_CLOCK_CODE = exports.WRONG_STATE_OF_CLOCK_CODE = 'WRONG_STATE_OF_CLOCK'

const MATCH_TIME = (process.env.NODE_ENV === 'development') ? 35 : 150
const MATCH_TIME_BUFFER = 5

exports.ClockManager = class extends EventEmitter {
  constructor (clock, timeSaver, config) {
    super()
    this._status = ARMED
    this._clock = clock
    this._timeSaver = timeSaver
    this._config = config

    this._clock.on('end', () => {
      if (this.status === PRERUNNING) {
        setImmediate(() => this.start())
      } else {
        this._end()
      }
    })

    setImmediate(() => this.reload())
  }

  get status () {
    return this._status
  }

  prestart () {
    if (this._status !== ARMED) {
      throw Object.assign(new Error('Clock is not armed'), {
        code: WRONG_STATE_OF_CLOCK_CODE
      })
    }

    const precount = this._config.getCurrentConfig().precount

    if (!precount) {
      this.start()
    } else {
      this._status = PRERUNNING
      this.emit('prestart')
      this._clock.startCountdown(precount)
    }
  }

  start () {
    logger.warn('clock start() entry')

    if (![ARMED, PRERUNNING].includes(this._status)) {
      throw Object.assign(new Error('Clock is not armed'), {
        code: WRONG_STATE_OF_CLOCK_CODE
      })
    }

    this._status = RUNNING

    this.emit('start')
    this._timeSaver.saveTime(new Date())
    this._clock.startCountdown(MATCH_TIME)

    logger.warn('clock start() done')
  }

  _end () {
    if (![PRERUNNING, RUNNING].includes(this._status)) {
      throw Object.assign(new Error('Clock is not running when countdown ended'), {
        code: WRONG_STATE_OF_CLOCK_CODE
      })
    }

    this._status = ENDED
    this.emit('end')
    this._timeSaver.clearTime()
  }

  stop () {
    if (![PRERUNNING, RUNNING].includes(this._status)) {
      throw Object.assign(new Error('Clock is not running'), {
        code: WRONG_STATE_OF_CLOCK_CODE
      })
    }

    this._status = ARMED
    this._clock.stopCountdown()
    this._clock.setTime(MATCH_TIME)
    this.emit('stop')
    this._timeSaver.clearTime()
  }

  reload () {
    if (![ARMED, ENDED].includes(this._status)) {
      throw Object.assign(new Error('Clock is not ended'), {
        code: WRONG_STATE_OF_CLOCK_CODE
      })
    }

    return this._timeSaver.getTime()
      .then(time => {
        if (time) {
          this._status = RUNNING

          const currentTime = new Date()
          const timeRan = Math.floor((currentTime.getTime() - time.getTime()) / 1000)

          if (timeRan < MATCH_TIME) {
            const timeLeft = MATCH_TIME - timeRan
            logger.warn(`Running timer after restart. Time remaining: ${timeLeft}`)
            this._clock.startCountdown(timeLeft)
          } else {
            logger.warn('Clock recovered after time is up.')
            if (timeRan < MATCH_TIME + MATCH_TIME_BUFFER) {
              logger.warn('We are in the buffer period. Playing end sound.')
              this._clock.startCountdown(1)
            }
          }
        } else {
          this._status = ARMED
          this._clock.setTime(MATCH_TIME)
          this.emit('reload')
        }

        return null // Bluebird warning
      })
      .catch(err => {
        logger.error(err.toString())

        this._status = ARMED
        this._clock.setTime(MATCH_TIME)
        this.emit('reload')
      })
  }
}
