/* eslint-env mocha */
import * as utils from './utils'
import assert from 'assert'

describe('utils', () => {
  describe('isSerializable', () => {
    it('should return true on strings', () => {
      assert.ok(utils.isSerializable('foo'))
    })
    it('should return true on numbers', () => {
      assert.ok(utils.isSerializable(123))
    })
    it('should return true on boolean', () => {
      assert.ok(utils.isSerializable(true))
    })
    it('should return true on arrays', () => {
      assert.ok(utils.isSerializable([]))
    })
    it('should return true on plain objects', () => {
      assert.ok(utils.isSerializable({}))
    })
    it('should return true on plain objects without prototype', () => {
      assert.ok(utils.isSerializable(Object.create(null)))
    })
    it('should return false on classes', () => {
      class Test {}
      assert.equal(utils.isSerializable(new Test()), false)
    })
    it('should return false on functions', () => {
      assert.equal(utils.isSerializable(() => {}), false)
    })
    it('should return false on dates', () => {
      assert.equal(utils.isSerializable(new Date()), false)
    })
    it('should return true if additionalTypes match', () => {
      assert.equal(utils.isSerializable(new Date(), [ Date ]), true)
    })
    it('should check more than one additionalTypes', () => {
      assert.equal(utils.isSerializable(new Date(), [ RegExp, Date ]), true)
    })
  })
  describe('delay', () => {
    it('should delay', (done) => {
      const start = Date.now()
      const func = (n) => {
        assert.ok(Date.now() - start >= 100)
        assert.equal(n, 1)
        done()
      }
      utils.delay(func, 100)(1)
    })
  })
  describe('ensurePath', () => {
    it('should always return array', () => {
      assert.deepEqual(utils.ensurePath(null), [])
      assert.deepEqual(utils.ensurePath(undefined), [])
      assert.deepEqual(utils.ensurePath({}), [])
    })
  })
  describe('forceSerializable', () => {
    it('should return constructor name when it is not serializable', () => {
      class Test {}
      assert.equal(utils.forceSerializable(new Test()).toJSON(), '[Test]')
    })
  })
  describe('getWithPath', () => {
    it('should throw when path is not valid for given object', () => {
      const obj = {
        form: 'Ben'
      }
      assert.throws(() => {
        utils.getWithPath(obj)('form.user.name')
      })
    })
  })
  describe('createResolver', () => {
    it('should throw when argument is not a Tag', () => {
      const resolver = utils.createResolver({})
      assert.throws(() => {
        resolver.path('test')
      })
    })
  })
  describe('dependencyMatch', () => {
    it('should match dependencies', () => {
      assert.equal(utils.dependencyMatch([{
        path: ['foo']
      }], {
        foo: {}
      }).length, 1)
      assert.equal(utils.dependencyMatch([], {
        foo: {}
      }).length, 0)
    })
    it('should match nested dependencies', () => {
      assert.ok(utils.dependencyMatch([{
        path: ['foo', 'bar']
      }], {
        foo: {
          children: {
            bar: {}
          }
        }
      }).length, 1)
    })
    it('should match child interest dependencies', () => {
      assert.equal(utils.dependencyMatch([{
        path: ['foo', 'bar']
      }], {
        'foo': {}
      }).length, 0)
      assert.equal(utils.dependencyMatch([{
        path: ['foo', 'bar']
      }], {
        foo: {
          children: {
            '*': {}
          }
        }
      }).length, 1)
      assert.equal(utils.dependencyMatch([{
        path: ['foo', 'bar']
      }], {
        foo: {
          children: {
            '**': {}
          }
        }
      }).length, 1)
    })
    it('should match exact paths', () => {
      assert.equal(utils.dependencyMatch([{
        path: ['foo', 'bar']
      }], {
        foo: {
          children: {
            bar: {}
          }
        }
      }).length, 1)
      assert.equal(utils.dependencyMatch([{
        path: ['foo', 'bar']
      }], {
        foo: {
          children: {
            barbar: {}
          }
        }
      }).length, 0)
    })
  })
})
