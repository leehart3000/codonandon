import type { Codon } from '../genetics/genetic-code';

/** A short card shown at a level-up, introducing one idea. */
export interface Tip {
	level: number;
	title: string;
	text: string;
	/** Codons to show as coloured chips on the card. */
	codons?: { codon: Codon; kind: 'start' | 'stop' }[];
}

/** The rules never change; these cards introduce them one at a time. */
export const TIPS: Tip[] = [
	{
		level: 1,
		title: 'Bases and codons',
		text: 'Every square is an mRNA base: A, U, G or C. Clear rows to score, as in the classic game. Cleared rows are then read like mRNA, three bases at a time. Each group of three is a codon.'
	},
	{
		level: 2,
		title: 'Start codon',
		text: 'Form AUG anywhere in a row. When that row clears, a chain starts, and rows score double until it ends.',
		codons: [{ codon: 'AUG', kind: 'start' }]
	},
	{
		level: 3,
		title: 'Stop codons',
		text: 'Any of these ends the chain and banks its bonus. Longer chains are worth more, but most of the bonus is lost if the game ends first.',
		codons: [
			{ codon: 'UAA', kind: 'stop' },
			{ codon: 'UAG', kind: 'stop' },
			{ codon: 'UGA', kind: 'stop' }
		]
	},
	{
		level: 4,
		title: 'Amino acids',
		text: 'After the start codon, each codon adds one amino acid to the chain. A chain of amino acids is called a peptide; long ones fold up into proteins.'
	},
	{
		level: 5,
		title: 'Reading frame',
		text: 'Once a chain starts, bases are read in steps of three from the AUG. Only stop codons in step with it count, which is why only some of them glow.'
	}
];

/** The card for this level, if there is one. */
export function tipForLevel(level: number): Tip | undefined {
	return TIPS.find((tip) => tip.level === level);
}
