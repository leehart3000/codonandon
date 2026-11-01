/**
 * The version shown on the main menu, worked out at build time from git (see vite.config.ts).
 * `git describe --tags --long` gives, for example, "v0.1.0-1-gc49aa02": the last tag, how many
 * commits have been made since it, and the commit. That becomes "v0.1.0+1/c49aa02", or
 * "v0.1.0/c49aa02" when the build is exactly the tagged release.
 */
export function formatVersion(describe: string): string {
	const match = /^(.+)-(\d+)-g([0-9a-f]+)$/.exec(describe.trim());
	if (!match) return describe.trim();
	const [, tag, ahead, commit] = match;
	return ahead === '0' ? `${tag}/${commit}` : `${tag}+${ahead}/${commit}`;
}
