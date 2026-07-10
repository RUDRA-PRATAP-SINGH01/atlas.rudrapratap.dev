/**
 * Compatibility re-exports. Prefer importing from `./nav` for navigation
 * and lazy section loaders; page bodies stay in section modules.
 */
export {
  canonicalNavigationOrder,
  getSectionInfoBySlug,
  getNavBySlug,
  getPageHref,
  pageTitles,
  sectionLoaders,
} from "./nav";

/** Eager registry — only for tooling/tests that need all pages at once. Prefer sectionLoaders. */
export async function loadFullRegistry() {
  const { sectionLoaders: loaders } = await import("./nav");
  const entries = await Promise.all(
    Object.entries(loaders).map(async ([section, load]) => {
      const pages = await load();
      return [section, pages];
    }),
  );
  return Object.assign({}, ...entries.map(([, pages]) => pages));
}
