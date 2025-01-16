/**
 * @fileoverview Enhanced user and system information retrieval module for Windows systems
 * This module provides comprehensive information about the current user, system environment,
 * and corporate details using Node.js native APIs and Windows-specific commands.
 */

import * as os from 'os';
import { execSync } from 'child_process';

/**
 * Represents basic user information
 */
interface BasicUserInfo {
    username: string;
    homedir: string;
    platform: string;
    hostname: string;
    userDomain: string;
    computerName: string;
}

/**
 * Represents extended user information including Windows-specific details
 */
interface ExtendedUserInfo extends BasicUserInfo {
    fullName?: string;
    fullWindowsIdentity?: string;
    [key: string]: string | undefined;
}

/**
 * Represents the structure for displaying information categories
 */
interface InfoCategories {
    [category: string]: string[];
}

/**
 * Safely executes a PowerShell command and returns the result
 * @param command - PowerShell command to execute
 * @returns Command output or empty string if failed
 */
function executePowerShellCommand(command: string): string {
    try {
        return execSync(`powershell -command "${command}"`).toString().trim();
    } catch (error) {
        return '';
    }
}

/**
 * Gets basic user information from OS module
 * @returns BasicUserInfo object containing basic user details
 */
function getBasicUserInfo(): BasicUserInfo {
    return {
        username: os.userInfo().username,
        homedir: os.homedir(),
        platform: os.platform(),
        hostname: os.hostname(),
        userDomain: process.env.USERDOMAIN || 'Unknown',
        computerName: process.env.COMPUTERNAME || 'Unknown',
    };
}

/**
 * Gets Windows identity information
 * @returns Windows identity string or undefined if not available
 */
function getWindowsIdentity(): string | undefined {
    const identity = executePowerShellCommand("[System.Security.Principal.WindowsIdentity]::GetCurrent().Name");
    return identity || undefined;
}

/**
 * Gets user's full name from local user account
 * @returns Full name string or undefined if not available
 */
function getFullName(): string | undefined {
    const userDetail = executePowerShellCommand("Get-LocalUser -Name $env:USERNAME | Select-Object FullName | ConvertTo-Json");
    try {
        const userDetailObj = JSON.parse(userDetail);
        return userDetailObj.FullName || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Gets domain information if available
 * @returns Object containing domain information or empty object if not available
 */
function getDomainInfo(): Record<string, string> {
    const domainInfo: Record<string, string> = {};
    const rawDomainInfo = executePowerShellCommand(
        "Get-WmiObject -Class Win32_NTDomain | Select-Object DomainName,DomainControllerName,DomainControllerAddress | ConvertTo-Json"
    );

    try {
        const domainDetails = JSON.parse(rawDomainInfo);
        if (Array.isArray(domainDetails)) {
            domainDetails.forEach((domain, index) => {
                Object.entries(domain).forEach(([key, value]) => {
                    if (value) {
                        domainInfo[`Domain ${key} ${index + 1}`] = String(value);
                    }
                });
            });
        }
    } catch {
        // Silent fail - domain info might not be available
    }

    return domainInfo;
}

/**
 * Collects all user information
 * @returns ExtendedUserInfo object containing all user details
 */
function collectUserInformation(): ExtendedUserInfo {
    const basicInfo = getBasicUserInfo();
    const windowsIdentity = getWindowsIdentity();
    const fullName = getFullName();
    const domainInfo = getDomainInfo();

    return {
        ...basicInfo,
        ...(windowsIdentity && { fullWindowsIdentity: windowsIdentity }),
        ...(fullName && { fullName }),
        ...domainInfo,
    };
}

/**
 * Formats the information for display
 * @param userInfo - Extended user information
 * @returns Categorized information for display
 */
function categorizeInformation(userInfo: ExtendedUserInfo): InfoCategories {
    return {
        'User Information': ['username', 'fullWindowsIdentity', 'fullName', 'homedir'],
        'Network Information': ['hostname', 'userDomain', 'computerName', 'Domain', 'WorkGroup']
    };
}

/**
 * Displays the user information in a formatted way
 * @param userInfo - Extended user information
 * @param categories - Information categories for display
 */
function displayUserInformation(userInfo: ExtendedUserInfo, categories: InfoCategories): void {
    console.log('\nSystem Information Report');
    console.log('=======================');

    Object.entries(categories).forEach(([category, keys]) => {
        console.log(`\n${category}:`);
        console.log('-'.repeat(category.length + 1));
        keys.forEach(key => {
            const value = userInfo[key];
            if (value && value !== 'Unknown') {
                console.log(`${key}: ${value}`);
            }
        });
    });
}

/**
 * Main function to run the user information collection and display
 */
function main(): void {
    const userInfo = collectUserInformation();
    const categories = categorizeInformation(userInfo);
    displayUserInformation(userInfo, categories);
    console.log(`full name: ${getBasicUserInfo().username}`);
}

// Run the program
if (require.main === module) {
    main();
}

// Export for testing
export {
    BasicUserInfo,
    ExtendedUserInfo,
    InfoCategories,
    executePowerShellCommand,
    getBasicUserInfo,
    getWindowsIdentity,
    getFullName,
    getDomainInfo,
    collectUserInformation,
    categorizeInformation,
    displayUserInformation,
};
