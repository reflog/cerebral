import HttpProviderError from './HttpProviderError'

export function createResponse (options, resolve, reject) {
  return (event) => {
    switch (event.type) {
      case 'load':
        return options.onResponse(event.currentTarget, resolve, reject)
      case 'progress':
        if (options.onProgress && event.lengthComputable) {
          options.onProgress({
            progress: Number(event.loaded / event.total).toFixed(0)
          })
        }
        break
      case 'error':
        reject(new HttpProviderError(event.currentTarget.status, null, null, 'request error'))
        break
      case 'abort':
        reject(new HttpProviderError(event.currentTarget.status, null, null, 'request abort', true))
        break
    }
  }
}

export function mergeWith (optionsA, optionsB) {
  return Object.keys(optionsB).reduce((newOptions, key) => {
    if (!newOptions[key]) {
      newOptions[key] = optionsB[key]
    } else if (key === 'headers') {
      newOptions[key] = mergeWith(newOptions[key], optionsB[key] || {})
    }

    return newOptions
  }, optionsA)
}

export function urlEncode (obj, prefix) {
  var str = []

  for (var p in obj) {
    if (obj.hasOwnProperty(p)) {
      var k = prefix ? prefix + '[' + p + ']' : p
      var v = obj[p]

      str.push(typeof v === 'object'
        ? urlEncode(v, k)
        : encodeURIComponent(k) + '=' + encodeURIComponent(v))
    }
  }
  return str.join('&')
}

export function convertObjectWithTemplates (obj, resolve) {
  if (resolve.isTag(obj)) {
    return resolve.value(obj)
  }

  return Object.keys(obj).reduce((convertedObject, key) => {
    convertedObject[key] = resolve.value(obj[key])
    return convertedObject
  }, {})
}

export function parseHeaders (rawHeaders) {
  const headerPairs = rawHeaders.replace(/\r?\n$/, '').split(/\r?\n/)

  return headerPairs.reduce((parsedHeaders, headerPair) => {
    const index = headerPair.indexOf(':')
    const key = headerPair.substr(0, index).trim().toLowerCase()
    const value = headerPair.substr(index + 1).trim()
    if (key) {
      parsedHeaders[key] = parsedHeaders[key]
        ? parsedHeaders[key] + ', ' + value
        : value
    }

    return parsedHeaders
  }, {})
}

export function processResponse (httpAction, path) {
  return httpAction
    .then((response) => {
      if (path && path[response.status]) {
        return path[response.status](response)
      }

      return path && path.success ? path.success(response) : response
    })
    // This error will be an instance of HttpError
    .catch((error) => {
      if (!path) {
        throw error
      }

      if (error.isAborted && path.abort) {
        return path.abort({error: error.toJSON()})
      }

      if (path[error.status]) {
        return path[error.status]({error: error.toJSON()})
      }

      if (path.error) {
        return path.error({error: error.toJSON()})
      }

      throw error
    })
}

export function getAllResponseHeaders (xhr) {
  return 'getAllResponseHeaders' in xhr
    ? parseHeaders(xhr.getAllResponseHeaders())
    : null
}
