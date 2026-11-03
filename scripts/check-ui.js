// Tearsheet UI checks. Paste the whole file into the browser console on any page of the app, then call:
//   checkUI()            -> page overflow and offending elements, unlabeled controls, images without alt
//   checkUI({ all: true }) -> same, but visits every main route in turn (same tab) and returns one row per route
// No dependencies. Used for the "nothing clips, nothing unlabeled" acceptance; results are copied into docs/ACCEPTANCE.md.
(function () {
  function sweep() {
    const w = document.documentElement.clientWidth
    const offenders = [...document.querySelectorAll('body *')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && !e.closest('.shell') && getComputedStyle(e).visibility !== 'hidden' })
      .filter(e => { let p = e.parentElement; while (p) { if (getComputedStyle(p).overflow !== 'visible') return false; p = p.parentElement } return true })
      .slice(0, 8)
      .map(e => `${e.tagName.toLowerCase()}.${typeof e.className === 'string' ? e.className.split(' ')[0] : ''}:+${Math.round(e.getBoundingClientRect().right - w)}px`)
    const unlabeled = [...document.querySelectorAll('button, a, input, select, textarea')]
      .filter(e => !['file', 'radio', 'checkbox', 'hidden'].includes(e.type))
      .filter(e => !((e.textContent || '').trim() || e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder') || (e.labels && e.labels.length)))
      .map(e => e.outerHTML.slice(0, 80))
    const noAlt = [...document.querySelectorAll('img')].filter(i => i.getAttribute('alt') === null).length
    return { path: location.pathname, viewport: w, pageOverflow: document.documentElement.scrollWidth > w + 1, offenders, unlabeled, noAlt }
  }
  async function visit(path) {
    history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate'))
    await new Promise(r => setTimeout(r, 800))
    return sweep()
  }
  window.checkUI = async function (opts) {
    if (!opts || !opts.all) return sweep()
    const routes = ['/', '/projects', ...[...document.querySelectorAll('a[href^="/brick/"]')].slice(0, 1).map(a => a.getAttribute('href')), ...[...document.querySelectorAll('a[href^="/project/"]')].slice(0, 1).map(a => a.getAttribute('href'))]
    const rows = []
    for (const r of routes) rows.push(await visit(r))
    console.table(rows.map(r => ({ path: r.path, overflow: r.pageOverflow, offenders: r.offenders.length, unlabeled: r.unlabeled.length, noAlt: r.noAlt })))
    return rows
  }
  console.log('checkUI ready: checkUI() for this page, checkUI({ all: true }) for every route')
})()
