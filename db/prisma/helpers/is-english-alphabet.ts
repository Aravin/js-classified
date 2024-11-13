export function isEnglishAlphabet(inputString: string) {
    // Regular expression to match only English alphabetic characters
    const regex = /^[a-zA-Z]+$/;
    // Test the input string against the regular expression
    return regex.test(inputString);
}
