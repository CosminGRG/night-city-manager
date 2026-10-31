export type Queue = <T>(task: () => Promise<T>) => Promise<T>

export function createQueue(): Queue {
  let last: Promise<unknown> = Promise.resolve()

  return (task) => {
    const result = last.then(() => task())
    last = result.catch(() => {
      //failed task already reported to its own handler
    })
    return result
  }
}
