export const pages=['home','training','history','coach','settings','condition'] as const
export type Page=typeof pages[number]
export function pageFromHash(hash:string):Page {
  return pages.find(page=>'#'+page===hash) ?? 'home'
}
