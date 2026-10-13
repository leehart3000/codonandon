/**
 * The standard genetic code (NCBI translation table 1), for mRNA.
 * mRNA uses U (uracil); T (thymine) only appears in DNA.
 */

/** The four mRNA bases, in the conventional table order U, C, A, G. */
export const BASES = ['U', 'C', 'A', 'G'] as const;
export type Base = (typeof BASES)[number];

/** Three bases read together, for example "AUG". */
export type Codon = `${Base}${Base}${Base}`;

/** The 20 standard amino acids, by one-letter code. */
export const AMINO_ACIDS = {
	A: { short: 'Ala', name: 'Alanine' },
	R: { short: 'Arg', name: 'Arginine' },
	N: { short: 'Asn', name: 'Asparagine' },
	D: { short: 'Asp', name: 'Aspartic acid' },
	C: { short: 'Cys', name: 'Cysteine' },
	E: { short: 'Glu', name: 'Glutamic acid' },
	Q: { short: 'Gln', name: 'Glutamine' },
	G: { short: 'Gly', name: 'Glycine' },
	H: { short: 'His', name: 'Histidine' },
	I: { short: 'Ile', name: 'Isoleucine' },
	L: { short: 'Leu', name: 'Leucine' },
	K: { short: 'Lys', name: 'Lysine' },
	M: { short: 'Met', name: 'Methionine' },
	F: { short: 'Phe', name: 'Phenylalanine' },
	P: { short: 'Pro', name: 'Proline' },
	S: { short: 'Ser', name: 'Serine' },
	T: { short: 'Thr', name: 'Threonine' },
	W: { short: 'Trp', name: 'Tryptophan' },
	Y: { short: 'Tyr', name: 'Tyrosine' },
	V: { short: 'Val', name: 'Valine' }
} as const;
export type AminoAcid = keyof typeof AMINO_ACIDS;

/** The result of reading one codon: an amino acid, or a stop signal. */
export type Translation = AminoAcid | 'STOP';

/** AUG starts a chain, and also codes for methionine. */
export const START_CODON: Codon = 'AUG';

/**
 * One letter per codon, in U, C, A, G order for the first, second and third base.
 * "*" marks a stop codon.
 */
const TABLE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';

/** All 64 codons, in table order. */
export const ALL_CODONS: readonly Codon[] = BASES.flatMap((first) =>
	BASES.flatMap((second) => BASES.map((third) => `${first}${second}${third}` as Codon))
);

/** Read one codon. */
export function translate(codon: Codon): Translation {
	const [first, second, third] = codon.split('') as Base[];
	const index = BASES.indexOf(first) * 16 + BASES.indexOf(second) * 4 + BASES.indexOf(third);
	const letter = TABLE[index];
	return letter === '*' ? 'STOP' : (letter as AminoAcid);
}
