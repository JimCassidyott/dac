import { isAccessible } from "./accessibilityChecker";

try {
    const result = isAccessible("a.docx");
    console.log(result);
} catch (error) {
    console.error("Error checking accessibility:", error);
}