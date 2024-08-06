"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var path = require("path");
// import AdmZip from 'adm-zip';
var AdmZip = require('adm-zip');
var xml2js = require("xml2js");
// Get the file path from command line arguments
var filePath = process.argv[2];
if (!filePath) {
    console.error('Please provide a file path as an argument.');
    process.exit(1);
}
// Check if the file is a Word document
var fileExtension = path.extname(filePath).toLowerCase();
if (fileExtension !== '.docx') {
    throw new Error('The provided file is not a Word document (.docx)');
}
/**
 * Reads the custom properties XML of a Word document.
 *
 * @param {string} filePath - The path to the Word document.
 * @return {Promise<Object | undefined>} A Promise that resolves to an object representing the custom properties.
 *                                       Returns undefined if no custom properties are found.
 * @throws {Error} If there is an error reading or parsing the custom properties XML.
 */
function readCustomPropertiesXml(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var zip, customXml, xmlContent, parser, Properties, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    zip = new AdmZip(filePath);
                    customXml = zip.getEntry('docProps/custom.xml');
                    // If no custom.xml file is found, return undefined
                    if (!customXml) {
                        console.log('No custom properties found in this document.');
                        return [2 /*return*/];
                    }
                    xmlContent = customXml.getData().toString('utf8');
                    parser = new xml2js.Parser();
                    return [4 /*yield*/, parser.parseStringPromise(xmlContent)];
                case 1:
                    Properties = _a.sent();
                    // Return the custom properties object
                    return [2 /*return*/, Properties];
                case 2:
                    error_1 = _a.sent();
                    // If there is an error, throw an error with the message
                    console.error('Error:', error_1.message);
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Asynchronously checks the accessibility of a Word document by reading its custom properties XML.
 *
 * @param {string} filePath - The path to the Word document.
 * @return {Promise<boolean>} A Promise that resolves to a boolean indicating whether the document is accessible.
 */
function checkAccessibility(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var result, isAccessible;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readCustomPropertiesXml(filePath)];
                case 1:
                    result = _a.sent();
                    isAccessible = false;
                    if (result && result.Properties && result.Properties.property) {
                        result.Properties.property.forEach(function (prop) {
                            if (prop.$.name === "isAccessible") {
                                isAccessible = prop["vt:bool"] == 1;
                            }
                        });
                    }
                    else {
                        console.log("No custom properties found in this document.");
                    }
                    return [2 /*return*/, isAccessible];
            }
        });
    });
}
var r = checkAccessibility(filePath);
r.then(function (a) {
    console.log(a);
})["catch"](function (e) {
    console.log(e);
});
