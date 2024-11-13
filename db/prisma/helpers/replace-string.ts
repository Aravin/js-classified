export function replaceAllCases(inputString: string, targetWord: string, replacementWord: string): string {
    // Create a regular expression with the 'i' flag for case insensitivity and 'g' for global replacement
    const regex = new RegExp(targetWord, 'gi');
    // Replace all occurrences of the target word with the replacement word
    return inputString.replace(regex, replacementWord);
}
