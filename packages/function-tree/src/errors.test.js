/* eslint-env mocha */
import {FunctionTreeError, FunctionTreeExecutionError} from './'
import assert from 'assert'

describe('errors', () => {
  it('should have base error', () => {
    const error = new FunctionTreeError(new Error('foo'))

    assert.ok(error instanceof Error)
    assert.equal(error.message, 'foo')
    assert.ok(error.stack)
    assert.equal(error.toJSON().name, 'FunctionTreeError')
    assert.equal(error.toJSON().message, 'foo')
    assert.ok(error.toJSON().stack)
  })
  it('should have extended execution error', () => {
    const baseError = new Error('foo')
    const execution = {name: 'exec'}
    const funcDetails = {name: 'func', functionIndex: 1}
    const payload = {foo: 'bar'}
    const error = new FunctionTreeExecutionError(execution, funcDetails, payload, baseError)

    assert.ok(error instanceof Error)
    assert.ok(error instanceof FunctionTreeError)
    assert.equal(error.message, 'foo')
    assert.equal(error.execution, execution)
    assert.equal(error.funcDetails, funcDetails)
    assert.equal(error.payload, payload)
    assert.ok(error.stack)
    assert.equal(error.toJSON().name, 'FunctionTreeExecutionError')
    assert.equal(error.toJSON().message, 'foo')
    assert.deepEqual(error.toJSON().execution, {name: 'exec'})
    assert.deepEqual(error.toJSON().funcDetails, {name: 'func', functionIndex: 1})
    assert.deepEqual(error.toJSON().payload, {foo: 'bar'})
    assert.ok(error.toJSON().stack)
  })
})
