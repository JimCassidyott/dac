// accessibilityChecker.test.ts
import { isAccessible, readCustomPropertiesXml } from '../../src/components/accessibilityChecker';

// Create a mock file for readCustomPropertiesXml
jest.mock('../components/accessibilityChecker', () => ({
    ...jest.requireActual('../../src/components/accessibilityChecker'),
    readCustomPropertiesXml: jest.fn(),
}));

// jest.mock('./__mocks__/readCustomPropertiesXml');

jest.mock('./accessibilityChecker', () => ({
    ...jest.requireActual('./accessibilityChecker'),
    readCustomPropertiesXml: jest.fn(),
}));

describe('isAccessible', () => {
    it('should return false if custom properties are not found', async () => {
        (readCustomPropertiesXml as jest.Mock).mockResolvedValue(null);
        const result = await isAccessible('path/to/file.docx');
        expect(result).toBe(false);
    });

    it('should return false if custom properties do not contain "isAccessible"', async () => {
        (readCustomPropertiesXml as jest.Mock).mockResolvedValue({
            Properties: {
                property: [],
            },
        });
        const result = await isAccessible('path/to/file.docx');
        expect(result).toBe(false);
    });

    it('should return true if "isAccessible" property is set to true', async () => {
        (readCustomPropertiesXml as jest.Mock).mockResolvedValue({
            Properties: {
                property: [
                    { $: { name: 'isAccessible' }, 'vt:bool': 1 },
                ],
            },
        });
        const result = await isAccessible('path/to/file.docx');
        expect(result).toBe(true);
    });

    it('should return false if "isAccessible" property is set to false', async () => {
        (readCustomPropertiesXml as jest.Mock).mockResolvedValue({
            Properties: {
                property: [
                    { $: { name: 'isAccessible' }, 'vt:bool': 0 },
                ],
            },
        });
        const result = await isAccessible('path/to/file.docx');
        expect(result).toBe(false);
    });

    it('should log a message if no custom properties are found', async () => {
        console.log = jest.fn();
        (readCustomPropertiesXml as jest.Mock).mockResolvedValue({
            Properties: {},
        });
        const result = await isAccessible('path/to/file.docx');
        expect(console.log).toHaveBeenCalledWith("No custom properties found in this document. Run the cecker.", 'path/to/file.docx');
        expect(result).toBe(false);
    });
});