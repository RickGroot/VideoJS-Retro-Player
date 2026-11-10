/**
 * Make the ids in a skin template unique, so two players can share one page.
 *
 *   const html = uniqueIds(skinTemplate, '2'); // id="sleeve-play-trigger" becomes id="sleeve-play-trigger-2"
 *
 * Every `id` value is collected first. Then each attribute whose value (or, for a space-separated list, any token of
 * it) equals one of those ids gets the same suffix, whatever the attribute is called: `trigger`, `commandfor`, `for`,
 * `aria-controls`, `aria-labelledby`, `popovertarget`, `anchor` and so on. Only tags are read, so text is left alone.
 */
export function uniqueIds(template: string, suffix: string): string {
  const tag = /<[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
  const attribute = /(\s)([^\s=/>"']+)=(["'])(.*?)\3/g;
  const ids = new Set<string>();

  for (const [markup] of template.matchAll(tag)) {
    for (const [, , name, , value] of markup.matchAll(attribute)) {
      if (name === 'id' && value) ids.add(value);
    }
  }

  if (ids.size === 0) return template;

  const rename = (value: string) =>
    value
      .split(/(\s+)/)
      .map((token) => (ids.has(token) ? `${token}-${suffix}` : token))
      .join('');

  return template.replace(tag, (markup) =>
    markup.replace(attribute, (_all, space: string, name: string, quote: string, value: string) =>
      `${space}${name}=${quote}${rename(value)}${quote}`
    )
  );
}
