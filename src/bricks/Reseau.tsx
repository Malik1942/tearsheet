/** The réseau (Measured drawing): 5 × 5 crosses at 100…900 on the 0–1000 grid the regions are measured on, the center one double, as a metric camera's plate
 *  records on every frame. Drawn on a photo only where Tearsheet measures it: a Library card while Spark reads it, and Details. Decoration, so hidden from a screen reader. */
const GRID = [10, 30, 50, 70, 90]

export function Reseau({ small = false }: { small?: boolean }) {
  return (
    <span className={`reseau${small ? ' sm' : ''}`} aria-hidden="true">
      {GRID.flatMap(y => GRID.map(x => <i key={`${x}-${y}`} className={x === 50 && y === 50 ? 'c' : undefined} style={{ left: `${x}%`, top: `${y}%` }} />))}
    </span>
  )
}
