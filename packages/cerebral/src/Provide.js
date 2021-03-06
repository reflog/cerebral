export default function Provide (name, provider) {
  return function (context) {
    context[name] = provider

    if (context.debugger) {
      context.debugger.wrapProvider(name)
    }

    return context
  }
}
