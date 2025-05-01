# Codebase Mermaid Generator

Generate Mermaid diagrams of your codebase structure directly within Visual Studio Code using the power of Anthropic's AI models.

## Features

*   Analyzes the code within your current workspace.
*   Uses the Anthropic API (Claude models) to understand code structure and relationships.
*   Generates Mermaid JS syntax for various diagram types (e.g., class diagrams, flowcharts) based on the analysis.
*   Displays the generated Mermaid diagram in a preview panel within VS Code.
*   Accessible via the command palette and the explorer context menu (right-click on a folder).

## Requirements

*   **VS Code**: Version 1.99.0 or higher.
*   **Anthropic API Key**: You need an API key from Anthropic to use this extension. You can obtain one from the [Anthropic Console](https://console.anthropic.com/).

## Extension Settings

This extension contributes the following settings:

*   `codebaseMermaidGenerator.anthropicApiKey`: Your Anthropic API Key. This is **required** for the extension to function.

    You can set this in your VS Code User or Workspace settings:
    1.  Open Settings (File > Preferences > Settings or `Ctrl+,`).
    2.  Search for "Codebase Mermaid Generator".
    3.  Enter your Anthropic API Key in the provided field.

## Usage

1.  **Ensure API Key is Set**: Make sure you have added your Anthropic API key to the extension settings (see above).
2.  **Open a Workspace**: Open the folder containing the codebase you want to analyze in VS Code.
3.  **Generate Diagram**:
    *   **Command Palette**: Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`), type "Generate Mermaid Diagram", and select the command.
    *   **Explorer Context Menu**: Right-click on a folder in the VS Code Explorer and select "Generate Mermaid Diagram".
4.  **View Diagram**: The extension will search for relevant code files, send the context to the Anthropic API, and display the generated Mermaid diagram in a new preview panel.

**Note**: The analysis currently includes common code file types (`.ts`, `.js`, `.py`, `.java`, etc.) and excludes common directories like `node_modules`, `.git`, etc. It processes up to 100 files or a maximum context length to avoid excessive API usage.

## Known Issues

*   The quality and type of the generated diagram depend heavily on the Anthropic model's interpretation of the code context and the specific instructions in the prompt.
*   Large codebases might exceed the context limits or API processing capabilities, potentially leading to incomplete or inaccurate diagrams.
*   Network errors or issues with the Anthropic API service can prevent diagram generation.

## Release Notes

### 0.0.1

*   Initial release.
*   Generate Mermaid diagrams from workspace code using Anthropic API.
*   Display diagrams in a webview preview.
*   Configuration for Anthropic API Key.
*   Command Palette and Explorer context menu integration.

---

**Enjoy visualizing your code!**

