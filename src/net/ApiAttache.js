import { log, error } from '../utils/log'
import { apply, invoke } from '../utils/invoke'

function i(...messages) {
  log('[api-attache]', ...messages)
}

function e(...errors) {
  error('[api-attache]', ...errors)
}

export default class ApiAttache {
  constructor(config) {
    this.config = config
  }

  setup(component) {
    this.component = component
    const { trigger } = this.config
    if (trigger && typeof trigger === 'string') {
      const trig = ApiAttache.prototype.trig
      const fn = component[trigger]
      const that = this
      component[trigger] = async function (...args) {
        apply(that, trig, [component].concat(args))
        .then(() => {
          if (fn) {
            fn.apply(component, args)
          }
        })
      }
    }
  }

  async trig(component = this.component, ...args) {
    const debug = this.config.debug
    try {
      if (debug) {
        i('begin:', component)
      }
      await invoke(component, this.config.begin)
      
      if (debug) {
        i('before-fetch:', args)
      }
      const a = await this.beforeFetch({ component, args })

      if (debug) {
        i('fetch:', a.url, a.data)
      }
      const b = await this.fetch(a)

      if (debug) {
        i('after-fetch:', b.response)
      }
      await this.afterFetch(b)
    } catch (e) {
      this.error(e)
    }

    if (debug) {
      i('end')
    }
    await invoke(component, this.config.end)
  }

  async beforeFetch({ component = this.component, args }) {
    const url = await apply(component, this.config.url, args)
    const data = await apply(component, this.config.data, args)
    return { component, url, data }
  }

  async fetch({ component = this.component, url, data }) {
    const fetch = this.config.fetch
    const request = {
      url,
      data,
      method: this.config.method,
      headers: this.config.headers
    }

    if (this.config.debug) {
      i('fetch-request:', request)
    }
    const response = await invoke(component, fetch, request)
    return { component, response }
  }

  async afterFetch({ component = this.component, response }) {
    const config = this.config

    const { success, data } = await invoke(component, config.response, response)

    if (!success) {
      throw response
    }

    const { success: succ, data: dat } = await invoke(component, config.result, data)

    if (succ) {
      await invoke(component, config.success, dat)
    } else {
      await invoke(component, config.failure, dat)
    }

    if (config.debug) {
      i('after-fetch-data:', dat)
    }
    if (dat) {
      const { dataname, datanames } = config
      if (dataname) {
        if (config.debug) {
          i('after-fetch-dataname:', `${dataname} <-`, dat)
        }
        component[dataname] = dat
      }
      if (datanames && Array.isArray(datanames)) {
        if (config.debug) {
          datanames.forEach(name => {
            if (typeof name === 'object') {
              i('after-fetch-datanames:', `${name.key} <-`, dat[name.value])
              component[name.key] = dat[name.value]
            } else {
              i('after-fetch-datanames:', `${name} <-`, dat[name])
              component[name] = dat[name]
            }
          })
        } else {
          datanames.forEach(name => {
            if (typeof name === 'object') {
              component[name.key] = dat[name.value]
            } else {
              component[name] = dat[name]
            }
          })
        }
      }
    }
  }

  error(exception) {
    if (this.config.debug) {
      e(exception)
    }
    // TODO
  }
}
