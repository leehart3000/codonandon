import { describe, expect, it } from 'vitest';
import { formatVersion } from './build-version';

describe('the version shown on the main menu', () => {
	it('shows the tag, how many commits since it, and the commit', () => {
		expect(formatVersion('v0.1.0-1-gc49aa02')).toBe('v0.1.0+1/c49aa02');
		expect(formatVersion('v0.1.0-12-gabc1234\n')).toBe('v0.1.0+12/abc1234');
	});

	it('shows just the tag and commit for the tagged release itself', () => {
		expect(formatVersion('v0.1.0-0-gc49aa02')).toBe('v0.1.0/c49aa02');
	});

	it('copes with tags that contain hyphens', () => {
		expect(formatVersion('v1.0.0-beta.2-3-g1234567')).toBe('v1.0.0-beta.2+3/1234567');
	});

	it('leaves anything else as it is, such as a bare commit', () => {
		expect(formatVersion('c49aa02')).toBe('c49aa02');
	});
});
