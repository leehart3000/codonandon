import type { Codon } from '../genetics/genetic-code';

/** A short card shown at a level-up, introducing one idea. */
export interface Tip {
	level: number;
	title: string;
	text: string;
	/** Codons to show as coloured chips on the card. */
	codons?: { codon: Codon; kind: 'start' | 'stop' }[];
}

export const TIPS: Tip[] = [
	{
		level: 1,
		title: 'Bases and codons',
		text: 'Every square is an mRNA base: A, U, G or C. Completed rows score and are read like a strand of mRNA, where each group of three bases is called a codon. Complete 10 rows to reach level 2.'
	},
	{
		level: 2,
		title: 'Start codon',
		text: 'Form AUG anywhere in a row. When that row clears, a chain starts. Rows score double points until the chain ends.',
		codons: [{ codon: 'AUG', kind: 'start' }]
	},
	{
		level: 3,
		title: 'Stop codons',
		text: 'Any of these codons ends the chain and banks its bonus points. Longer chains are worth more. If the game ends before you bank, you only get a small consolation bonus.',
		codons: [
			{ codon: 'UAA', kind: 'stop' },
			{ codon: 'UAG', kind: 'stop' },
			{ codon: 'UGA', kind: 'stop' }
		]
	},
	{
		level: 4,
		title: 'Amino acids',
		text: 'The start codon makes the first amino acid, methionine. After it, each codon adds another amino acid to the chain. A chain of amino acids is called a peptide. Long peptides fold up into proteins.'
	},
	{
		level: 5,
		title: 'Reading frame',
		text: 'Once a chain starts with AUG, bases are read in sets of three until a stop codon is reached. Only stop codons in step with the AUG can end the chain. They are shown with an orange glow.'
	}
];

/** The card for this level, if there is one. */
export function tipForLevel(level: number): Tip | undefined {
	return TIPS.find((tip) => tip.level === level);
}
