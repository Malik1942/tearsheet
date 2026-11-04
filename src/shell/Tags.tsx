import { Fragment } from 'react'

/** A dot held to the tag before it by a no-break space: a line can end on "indie ·" but never start on "· pop". */
const SEP = ' · '
/** The dot before the last tag of a short pair, held on both sides: the list never ends on a lone tag. */
const SEP_PAIR = ' · '

/** A list of tags with one dot between them (whole words, contract rule 7). The dot is text, so the browser sees each tag as a word, and the last two tags
 *  stay together when they are a short pair (12 characters or fewer, as keepLastTwo). Before, the dot was a CSS inline-block between two spans with no
 *  space, which the browser broke at but `pretty` and `balance` could not see. Screen readers skip the dot. */
export function Tags({ tags }: { tags: readonly string[] }) {
  const pair = tags.length >= 2 && tags[tags.length - 2].length + 1 + tags[tags.length - 1].length <= 12
  return <>{tags.map((t, i) => <Fragment key={t}>{i > 0 && <span className="tag-sep" aria-hidden="true">{pair && i === tags.length - 1 ? SEP_PAIR : SEP}</span>}<span className="tag">{t}</span></Fragment>)}</>
}
