import { AMINO_ACIDS, translate, type AminoAcid, type Codon } from '../genetics/genetic-code';
import type { Stats } from './game';

/** How many of one amino acid were made in a game, and from which codons. */
export interface AminoAcidSummary {
	aminoAcid: AminoAcid;
	count: number;
	codons: Codon[];
}

/** Group a game's codons by the amino acid they made: most-made first, then by name. */
export function summariseAminoAcids(stats: Stats): AminoAcidSummary[] {
	const byAminoAcid = new Map<AminoAcid, AminoAcidSummary>();
	for (const [codon, uses] of Object.entries(stats.codons) as [Codon, number][]) {
		const result = translate(codon);
		if (result === 'STOP') continue;
		const entry = byAminoAcid.get(result) ?? { aminoAcid: result, count: 0, codons: [] };
		entry.count += uses;
		entry.codons.push(codon);
		byAminoAcid.set(result, entry);
	}
	return [...byAminoAcid.values()]
		.map((entry) => ({ ...entry, codons: [...entry.codons].sort() }))
		.sort(
			(a, b) =>
				b.count - a.count ||
				AMINO_ACIDS[a.aminoAcid].name.localeCompare(AMINO_ACIDS[b.aminoAcid].name)
		);
}

/**
 * The amino acid made from the most different codons, if any was made from two or more:
 * a personal example of codon redundancy for the game-over screen.
 */
export function redundancyHighlight(summary: AminoAcidSummary[]): AminoAcidSummary | null {
	let best: AminoAcidSummary | null = null;
	for (const entry of summary) {
		if (entry.codons.length >= 2 && entry.codons.length > (best?.codons.length ?? 0)) best = entry;
	}
	return best;
}
