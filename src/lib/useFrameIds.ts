import { useMemo } from 'react'
import { useStore } from './store'
import { frameIds } from './frames'

/** The library's frame ids (frames.ts), recomputed only when its bricks change. The store always holds the starters, so the numbers do not depend on Include starters. */
export function useFrameIds(): Map<string, string> {
  const { bricks } = useStore()
  return useMemo(() => frameIds(bricks), [bricks])
}
