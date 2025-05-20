# Document Accessibility Checker (DAC)

**The Document Accessibility Checker (DAC) is an application designed to perform bulk testing of documents for accessibility compliance.**

## Supported Document Types
DAC currently supports accessibility testing for the following document types:

- Microsoft Word Documents (.docx)
- Microsoft PowerPoint Documents (.pptx) 
- PDF Documents (.pdf)

*Note: The test suite for PowerPoint and PDF documents is currently limited. Future versions of DAC will include more comprehensive tests for these formats to ensure more thorough accessibility evaluations.*

## Features
- Browse folders on your computer or in GCDocs using DAC’s built-in file explorer.
- Instantly view a document’s accessibility status via the status icon next to each file.
- Test individual documents for accessibility compliance.
- Perform bulk testing on all documents within a folder and its subfolders.
- Generate accessibility reports summarizing how many documents are accessible vs. inaccessible.


> ⚠️ **Important:** GCDocs support is currently limited. DAC can only connect to a development environment of GCDocs. This feature is not available to all users. Please contact the DAC development team if you would like more information.


## Installation Instructions
1. **Install Pandoc** (required for DAC functionality):
    - Visit the [Pandoc Installer Page](https://pandoc.org/installing.html).
    - Download and run the latest installer.

2. **Install DAC**
    - Go to the latest release on the [Releases page](https://github.com/JimCassidyott/dac/releases/).
    - Download the DAC-(version).Setup.zip file.
    - Right-click the .zip file and select Extract All.
    - Open the extracted DAC-(version).Setup folder.
    - Run the .exe setup file to install DAC

    **If Microsoft Defender blocks the installer, try running it via Command Prompt.**

3. **Launch DAC**
    - The application will be installed at:
`C:\Users\<your_username>\AppData\Local\DAC`
    - To create a desktop shortcut:
        - Right-click DAC.exe and select Create shortcut.
        - Move the shortcut to your desktop.

- Next, Go to the latest release in this repository [Releases](https://github.com/JimCassidyott/dac/releases/)
- Download the `DAC-(version).Setup.zip` file.
- Unzip the `DAC-(version).Setup.zip` file. (Right click on .zip file and select Extract all)
- Open the unzipped `DAC-(version).Setup` folder.
- Run the (.exe) setup file to install the Document Accessibility Checker.
- _If Microsoft Defender prevents the DAC installer from running, run the DAC installer using Command Prompt._
- The DAC program will be installed at `C:\Users\<your_username>\AppData\Local\DAC`
- To create a desktop shortcut right click on the DAC program file named DAC.exe and select `Create shortcut`. Then copy over the shortcut to your desktop. 

