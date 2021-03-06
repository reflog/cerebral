import EventEmitter from 'eventemitter3'
import executeTree from './executeTree'
import createStaticTree from './staticTree'
import ExecutionProvider from './providers/Execution'
import ContextProvider from './providers/Context'
import PropsProvider from './providers/Props'
import PathProvider from './providers/Path'
import Path from './Path'
import {Primitive} from './primitives'
import {FunctionTreeExecutionError, FunctionTreeError} from './errors'

/*
  Need to create a unique ID for each execution to identify it
  in debugger
*/
function createUniqueId () {
  return Date.now() + '_' + Math.floor(Math.random() * 10000)
}

/*
  Validate any returned value from a function. Has
  to be nothing or an object
*/
function isValidResult (result) {
  return (
    !result ||
    (
      typeof result === 'object' &&
      !Array.isArray(result)
    )
  )
}

/*
  Create an error with execution details
*/
function createErrorObject (error, execution, functionDetails, payload) {
  const errorToReturn = error || new Error()

  errorToReturn.execution = execution
  errorToReturn.functionDetails = functionDetails
  errorToReturn.payload = Object.assign({}, payload, {
    _execution: {id: execution.id, functionIndex: functionDetails.functionIndex},
    error: error.toJSON ? error.toJSON() : {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  })

  return errorToReturn
}

/*
  If it walks like a duck and quacks like a duck...
*/
function isPromise (result) {
  return result && typeof result.then === 'function' && typeof result.catch === 'function'
}

class FunctionTreeExecution {
  constructor (name, staticTree, functionTree, errorCallback) {
    this.id = createUniqueId()
    this.name = name || staticTree.name || this.id
    this.staticTree = staticTree
    this.functionTree = functionTree
    this.datetime = Date.now()
    this.errorCallback = errorCallback
    this.hasThrown = false

    this.runFunction = this.runFunction.bind(this)
  }

  /*
    Creates the context for the current function to be run,
    emits events and handles its returned value. Also handles
    the returned value being a promise
  */
  runFunction (funcDetails, payload, prevPayload, next) {
    if (this.hasThrown) {
      return
    }

    const context = this.createContext(funcDetails, payload, prevPayload)
    const functionTree = this.functionTree
    const errorCallback = this.errorCallback
    const execution = this
    let result

    functionTree.emit('functionStart', execution, funcDetails, payload)
    try {
      result = funcDetails.function(context)
    } catch (error) {
      this.hasThrown = true

      return errorCallback(createErrorObject(error, execution, funcDetails, payload), execution, funcDetails, payload)
    }

    /*
      If result is a promise we want to emit an event and wait for it to resolve to
      move on
    */
    if (isPromise(result)) {
      functionTree.emit('asyncFunction', execution, funcDetails, payload, result)
      result
        .then(function (result) {
          if (result instanceof Path) {
            functionTree.emit('functionEnd', execution, funcDetails, payload, result)
            next(result.toJS())
          } else if (funcDetails.outputs) {
            functionTree.emit('functionEnd', execution, funcDetails, payload, result)
            throw new FunctionTreeExecutionError(execution, funcDetails, payload, new Error('The result ' + JSON.stringify(result) + ' from function ' + funcDetails.name + ' needs to be a path of either ' + Object.keys(funcDetails.outputs)))
          } else if (isValidResult(result)) {
            functionTree.emit('functionEnd', execution, funcDetails, payload, result)
            next({
              payload: result
            })
          } else {
            functionTree.emit('functionEnd', execution, funcDetails, payload, result)
            throw new FunctionTreeExecutionError(execution, funcDetails, payload, new Error('The result ' + JSON.stringify(result) + ' from function ' + funcDetails.name + ' is not a valid result'))
          }
        })
        .catch(function (result) {
          if (result instanceof Error) {
            execution.hasThrown = true
            errorCallback(createErrorObject(result, execution, funcDetails, payload), execution, funcDetails, payload)
          } else if (result instanceof Path) {
            functionTree.emit('functionEnd', execution, funcDetails, payload, result)
            next(result.toJS())
          } else if (funcDetails.outputs) {
            let error = new FunctionTreeExecutionError(execution, funcDetails, payload, new Error('The result ' + JSON.stringify(result) + ' from function ' + funcDetails.name + ' needs to be a path of either ' + Object.keys(funcDetails.outputs)))

            execution.hasThrown = true
            errorCallback(createErrorObject(error, execution, funcDetails, payload), execution, funcDetails, payload)
          } else if (isValidResult(result)) {
            functionTree.emit('functionEnd', execution, funcDetails, payload, result)
            next({
              payload: result
            })
          } else {
            let error = new FunctionTreeExecutionError(execution, funcDetails, payload, new Error('The result ' + JSON.stringify(result) + ' from function ' + funcDetails.name + ' is not a valid result'))
            execution.hasThrown = true

            errorCallback(createErrorObject(error, execution, funcDetails, payload), execution, funcDetails, payload)
          }
        })
    } else if (result instanceof Path) {
      functionTree.emit('functionEnd', execution, funcDetails, payload, result)
      next(result.toJS())
    } else if (funcDetails.outputs) {
      let error = new FunctionTreeExecutionError(execution, funcDetails, payload, new Error('The result ' + JSON.stringify(result) + ' from function ' + funcDetails.name + ' needs to be a path of either ' + Object.keys(funcDetails.outputs)))

      this.hasThrown = true
      errorCallback(createErrorObject(error, execution, funcDetails, payload), execution, funcDetails, payload)
    } else if (isValidResult(result)) {
      functionTree.emit('functionEnd', execution, funcDetails, payload, result)
      next({
        payload: result
      })
    } else {
      let error = new FunctionTreeExecutionError(execution, funcDetails, payload, new Error('The result ' + JSON.stringify(result) + ' from function ' + funcDetails.name + ' is not a valid result'))
      this.hasThrown = true

      errorCallback(createErrorObject(error, execution, funcDetails, payload), execution, funcDetails, payload)
    }
  }

  /*
    Creates the context for the next running function
  */
  createContext (funcDetails, payload, prevPayload) {
    return [
      ExecutionProvider(this),
      PropsProvider(),
      PathProvider()
    ].concat(this.functionTree.contextProviders).reduce(function (currentContext, contextProvider) {
      var newContext = (
        typeof contextProvider === 'function'
          ? contextProvider(currentContext, funcDetails, payload, prevPayload)
          : ContextProvider(contextProvider)(currentContext, funcDetails, payload, prevPayload)
      )

      if (newContext !== currentContext) {
        throw new FunctionTreeError('A provider is not returning the context object, maybe it is a function factory and you forgot to call it?')
      }

      return newContext
    }, {})
  }
}

export class FunctionTree extends EventEmitter {
  constructor (contextProviders) {
    super()
    this.cachedTrees = []
    this.cachedStaticTrees = []
    if (Array.isArray(contextProviders)) {
      this.contextProviders = contextProviders
    } else if (contextProviders) {
      this.contextProviders = [ContextProvider(contextProviders)]
    } else {
      this.contextProviders = []
    }

    this.run = this.run.bind(this)
  }

  /*
    Analyses the tree to identify paths and its validity. This analysis
    is cached. Then the method creates an execution for the tree to run.
  */
  run () {
    let name
    let tree
    let payload
    let cb
    let staticTree
    const args = [].slice.call(arguments)
    args.forEach((arg) => {
      if (typeof arg === 'string') {
        name = arg
      } else if (Array.isArray(arg) || arg instanceof Primitive) {
        tree = arg
      } else if (!tree && typeof arg === 'function') {
        tree = arg
      } else if (typeof arg === 'function') {
        cb = arg
      } else {
        payload = arg
      }
    })

    if (!tree) {
      throw new Error('function-tree - You did not pass in a function tree')
    }

    const withResolveAndReject = (resolve, reject) => {
      const treeIdx = this.cachedTrees.indexOf(tree)
      if (treeIdx === -1) {
        staticTree = createStaticTree(tree)
        this.cachedTrees.push(tree)
        this.cachedStaticTrees.push(staticTree)
      } else {
        staticTree = this.cachedStaticTrees[treeIdx]
      }
      const execution = new FunctionTreeExecution(name, staticTree, this, (error, execution, funcDetails, finalPayload) => {
        this.emit('error', error, execution, funcDetails, finalPayload)
        reject(error)
      })

      this.emit('start', execution, payload)
      executeTree(
        execution,
        payload,
        (funcDetails, path, currentPayload) => {
          this.emit('pathStart', path, execution, funcDetails, currentPayload)
        },
        (currentPayload) => {
          this.emit('pathEnd', execution, currentPayload)
        },
        (currentPayload, functionsToResolve) => {
          this.emit('parallelStart', execution, currentPayload, functionsToResolve)
        },
        (currentPayload, functionsResolved) => {
          this.emit('parallelProgress', execution, currentPayload, functionsResolved)
        },
        (currentPayload, functionsResolved) => {
          this.emit('parallelEnd', execution, currentPayload, functionsResolved)
        },
        (finalPayload) => {
          this.emit('end', execution, finalPayload)
          resolve === reject ? resolve(null, finalPayload) : resolve(finalPayload)
        }
      )
    }

    if (cb) {
      withResolveAndReject(cb, cb)
    } else {
      return new Promise(withResolveAndReject)
    }
  }
}
