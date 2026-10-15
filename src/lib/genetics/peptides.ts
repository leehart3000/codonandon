/** A well-known peptide or protein, for comparing chain lengths. */
export interface Peptide {
	name: string;
	/** Length in amino acids (of the mature molecule). */
	length: number;
}

/**
 * Shortest first. These compare length only: many are cut from longer precursors in
 * the body, so the game never claims a player "made" them.
 */
export const PEPTIDES: Peptide[] = [
	{ name: 'oxytocin', length: 9 },
	{ name: 'glucagon', length: 29 },
	{ name: "human insulin's two chains together", length: 51 },
	{ name: 'ubiquitin', length: 76 },
	{ name: 'the β chain of haemoglobin', length: 146 },
	{ name: 'green fluorescent protein', length: 238 }
];

/** Describe a chain's length against real peptides, e.g. "longer than glucagon (29), but …". */
export function describeLength(length: number): string {
	const same = PEPTIDES.find((peptide) => peptide.length === length);
	if (same) return `the same length as ${same.name}`;

	const longerThan = PEPTIDES.filter((peptide) => peptide.length < length).at(-1);
	const shorterThan = PEPTIDES.find((peptide) => peptide.length > length);
	const parts = [
		longerThan && `longer than ${longerThan.name} (${longerThan.length})`,
		shorterThan && `shorter than ${shorterThan.name} (${shorterThan.length})`
	].filter(Boolean);
	return parts.join(', but ');
}
