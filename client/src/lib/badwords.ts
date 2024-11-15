// src/lib/badwords.ts
import { Filter } from 'bad-words';

const filter = new Filter();

export function containsBadWords(text: string): { hasBadWords: boolean; foundWords: string[] } {
    const words = text.toLowerCase().split(/\s+/);
    const foundBadWords = words.filter(word => filter.isProfane(word));

    return {
        hasBadWords: foundBadWords.length > 0,
        foundWords: foundBadWords
    };
}