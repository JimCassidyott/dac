class HeadingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HeadingError';
    }
}

class Heading {
    private text: string;
    private level: number;
    private children: Heading[];
    private parent: Heading | null;
    private activeHeading: Heading;
    private root: Heading | null;

    constructor(text: string, level: number) {
        this.validateLevel(level);
        this.text = text;
        this.level = level;
        this.children = [];
        this.parent = null;
        this.activeHeading = this;
        this.root = null;

        // If this is level 1, it becomes the root
        if (level === 1) {
            this.root = this;
        }
    }

    private validateLevel(level: number): void {
        if (level < 1) {
            throw new HeadingError(`Invalid heading level: ${level}. Level must be 1 or greater.`);
        }
    }

    /**
     * Attempts to add a new heading to the hierarchy
     */
    addHeading(text: string, level: number): void {
        this.validateLevel(level);

        // If we don't have a root yet, this must be level 1
        if (!this.root) {
            if (level !== 1) {
                throw new HeadingError('First heading must be level 1');
            }
            this.text = text;
            this.level = level;
            this.root = this;
            this.activeHeading = this;
            return;
        }

        // Cannot add another level 1 if we already have one
        if (level === 1) {
            throw new HeadingError('Cannot add another level 1 heading');
        }

        // Create the new heading
        const newHeading = new Heading(text, level);
        newHeading.root = this.root;

        // Try to add the heading starting from the active heading
        if (!this.tryAddHeadingToHierarchy(newHeading)) {
            throw new HeadingError(
                `Cannot add heading level ${level} at current position in hierarchy`
            );
        }
    }

    /**
     * Attempts to add a heading to the hierarchy, starting from the active heading
     * and working up the tree if necessary
     */
    private tryAddHeadingToHierarchy(newHeading: Heading): boolean {
        let current: Heading | null = this.activeHeading;

        while (current) {
            if (this.canAddHeadingToParent(current, newHeading)) {
                this.addHeadingToParent(current, newHeading);
                this.activeHeading = newHeading;
                return true;
            }
            current = current.parent;
        }

        return false;
    }

    /**
     * Checks if a heading can be added to a potential parent
     */
    private canAddHeadingToParent(parent: Heading, child: Heading): boolean {
        return child.level === parent.level + 1;
    }

    /**
     * Adds a heading to a parent heading
     */
    private addHeadingToParent(parent: Heading, child: Heading): void {
        child.parent = parent;
        parent.children.push(child);
    }

    /**
     * Gets the active heading
     */
    getActiveHeading(): { text: string; level: number } {
        return {
            text: this.activeHeading.text,
            level: this.activeHeading.level
        };
    }

    /**
     * Returns a string representation of the heading hierarchy
     */
    toString(indent: string = ''): string {
        let result = `${indent}Level ${this.level}: ${this.text}\n`;
        for (const child of this.children) {
            result += child.toString(indent + '  ');
        }
        return result;
    }

    /**
     * Gets the current heading structure as a nested object
     */
    toStructure(): any {
        return {
            text: this.text,
            level: this.level,
            children: this.children.map(child => child.toStructure())
        };
    }
}

// Example usage and testing
function testHeadingHierarchy(): void {
    try {
        // Create the heading manager with initial level 1 heading
        const headingManager = new Heading("Document Title", 1);
        console.log("Initial structure:");
        console.log(headingManager.toString());

        // Add some valid headings
        headingManager.addHeading("Section 1", 2);
        headingManager.addHeading("Subsection 1.1", 3);
        headingManager.addHeading("Subsection 1.2", 3);
        headingManager.addHeading("Section 2", 2);
        headingManager.addHeading("Subsection 2.1", 3);
        headingManager.addHeading("Section 3", 2);
        headingManager.addHeading("Section 4", 2);

        console.log("\nAfter adding valid headings:");
        console.log(headingManager.toString());

        // Try to add an invalid heading (should throw error)
        try {
            headingManager.addHeading("Invalid Level 4", 4);
        } catch (e) {
            if (e instanceof HeadingError) {
                console.log("\nExpected error when adding invalid level:", e.message);
            }
        }

        // Try to add another level 1 (should throw error)
        try {
            headingManager.addHeading("Another Title", 1);
        } catch (e) {
            if (e instanceof HeadingError) {
                console.log("\nExpected error when adding second level 1:", e.message);
            }
        }

        console.log("\nActive heading:", headingManager.getActiveHeading());

    } catch (e) {
        if (e instanceof HeadingError) {
            console.log("Heading Error:", e.message);
        } else {
            console.log("Unexpected Error:", e);
        }
    }
}

// Run the test
testHeadingHierarchy();