/* eslint-env mocha */
import FunctionTree from '../'
import assert from 'assert'

describe('PropsProvider', () => {
  it('should have "props" on context', () => {
    const ft = new FunctionTree()

    ft.run([
      ({props}) => {
        assert.ok(props)
      }
    ])
  })
  it('should have initial payload on props', () => {
    const ft = new FunctionTree()

    ft.run([
      ({props}) => {
        assert.deepEqual(props, {
          foo: 'bar'
        })
      }
    ], {
      foo: 'bar'
    })
  })
})
