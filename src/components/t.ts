import { isAccessible } from './accessibilityChecker';

import { SystemAdapter } from './systemAdaptor';


const testFilePath = 'myfile.docx';

try {
    const result = isAccessible(testFilePath);
    result.then((result) => {
        console.log(`Accessibility check for ${testFilePath}: ${result}`);
    });

} catch (error) {
    console.error(`Error checking accessibility for ${testFilePath}:`, error);
}

const sa = new SystemAdapter();

sa.getFiles('../../x').then((files) => {
    console.log(files);
}).catch((err) => {
    console.error(err);
}); 