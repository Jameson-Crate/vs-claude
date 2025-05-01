// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AnthropicService } from './anthropicService'; // Import the Anthropic service

// Helper function to get code context from the workspace
async function getCodeContextFromWorkspace(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder open. Please open a folder to analyze.');
        return null;
    }

    // For simplicity, use the first workspace folder
    const workspaceFolder = workspaceFolders[0].uri;

    // Define include/exclude patterns (consider making these configurable later)
    const includePattern = '**/*.{ts,js,py,java,go,rb,php,cs,cpp,c,h,hpp}'; // Example common code files
    const excludePattern = '**/{node_modules,venv,vendor,.git,.vscode,dist,build}/**';

    vscode.window.showInformationMessage(`Searching for files matching: ${includePattern} in ${workspaceFolder.fsPath}`);

    try {
        // Add a progress indicator for file search
        const files = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Searching workspace files...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            const foundFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceFolder, includePattern), new vscode.RelativePattern(workspaceFolder, excludePattern), 100); // Limit to 100 files for now
            progress.report({ increment: 100 });
            return foundFiles;
        });


        if (files.length === 0) {
            vscode.window.showWarningMessage('No relevant code files found in the workspace matching the pattern.');
            return null;
        }

        let combinedCodeContext = '';
        const maxContextLength = 100000; // Rough character limit to avoid overly large contexts

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Reading file contents...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            let filesProcessed = 0;
            for (const fileUri of files) {
                try {
                    const fileContentBytes = await vscode.workspace.fs.readFile(fileUri);
                    const fileContent = Buffer.from(fileContentBytes).toString('utf-8');
                    const relativePath = path.relative(workspaceFolder.fsPath, fileUri.fsPath);

                    const fileContext = `
// File: ${relativePath}
// ---------- START ----------
${fileContent}
// ---------- END ----------
`;

                    if (combinedCodeContext.length + fileContext.length > maxContextLength) {
                        vscode.window.showWarningMessage(`Code context limit reached (${maxContextLength} chars). Some files may be excluded.`);
                        break; // Stop adding more files if limit exceeded
                    }
                    combinedCodeContext += fileContext;
                    filesProcessed++;
                    progress.report({ increment: (filesProcessed / files.length) * 100, message: `Read ${filesProcessed}/${files.length} files` });
                } catch (readError: any) {
                    vscode.window.showWarningMessage(`Skipping file ${fileUri.fsPath} due to read error: ${readError.message}`);
                }
            }
            progress.report({ increment: 100 });
        });


        if (!combinedCodeContext.trim()) {
             vscode.window.showWarningMessage('Could not gather any code context from the found files.');
             return null;
        }

        return combinedCodeContext;

    } catch (findError: any) {
        vscode.window.showErrorMessage(`Error finding files: ${findError.message}`);
        return null;
    }
}

// Function to create and show a webview panel with the Mermaid diagram
function showMermaidDiagram(mermaidCode: string, context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'mermaidDiagramPreview', // Identifies the type of the webview. Used internally
        'Mermaid Diagram Preview', // Title of the panel displayed to the user
        vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
        {
            // Enable scripts in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's directories.
            // localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] // Enable if loading local resources
        }
    );

    // Set the webview's HTML content
    panel.webview.html = getWebviewContent(mermaidCode, panel.webview);
}

// Function to generate the HTML content for the webview
// Pass webview object to access cspSource
function getWebviewContent(mermaidCode: string, webview: vscode.Webview): string {
    const nonce = getNonce(); // Function to generate nonce for CSP
    const cspSource = webview.cspSource;

    // Escape the mermaid code for safe embedding in HTML
    const escapedMermaidCode = mermaidCode.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <!--
    Adjust Content Security Policy:
    - default-src 'none'
    - script-src: Allow scripts from the webview's origin (cspSource) and the Mermaid CDN, using the nonce.
    - style-src: Allow styles from the webview's origin (cspSource).
    - connect-src: Allow connections to the Mermaid CDN if needed (though ESM import might handle this).
    -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${cspSource} https://cdn.jsdelivr.net; style-src ${cspSource} 'unsafe-inline';">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mermaid Diagram Preview</title>
    <style>
        body, html { margin: 0; padding: 10px; height: 100%; box-sizing: border-box; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
        .mermaid { text-align: center; width: 100%; height: 100%; }
        /* Ensure SVG scales correctly */
        .mermaid svg {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    <div class="mermaid">
${escapedMermaidCode}
    </div>

    <script nonce="${nonce}" type="module">
        // Use ESM version of Mermaid from CDN
        try {
            const mermaidModule = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
            const mermaid = mermaidModule.default;

            function getTheme() {
                 // Check if the body element exists and has the class list
                if (document.body && document.body.classList) {
                    return document.body.classList.contains('vscode-dark') ? 'dark' : 'default';
                } 
                // Default theme if body or classList is not available yet
                return 'default'; 
            }

            mermaid.initialize({ 
                startOnLoad: false, // Initialize manually after setting theme
                securityLevel: 'strict', // Recommended for security
                theme: getTheme()
            });

            await mermaid.run({ nodes: [document.querySelector('.mermaid')] });

            // Rerender if VS Code theme changes
            const observer = new MutationObserver(() => {
                mermaid.initialize({ 
                    startOnLoad: false,
                    theme: getTheme()
                });
                // Re-render the specific element
                 mermaid.run({ nodes: [document.querySelector('.mermaid')] });
            });
            observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        } catch (error) {
            console.error('Failed to load or initialize Mermaid:', error);
            const errorDiv = document.createElement('div');
            errorDiv.textContent = 'Error loading Mermaid diagram. Check console for details.';
            errorDiv.style.color = 'red';
            document.body.insertBefore(errorDiv, document.querySelector('.mermaid'));
        }
    </script>
</body>
</html>`;
}

// Function to generate a nonce for Content Security Policy
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

    // Initialize the Anthropic Service
    const anthropicService = new AnthropicService();

    console.log('Congratulations, your extension "codebase-mermaid-generator" is now active!');

    const disposable = vscode.commands.registerCommand('codebase-mermaid-generator.generateDiagram', async () => {
        // Get code context from the workspace
        const codeContext = await getCodeContextFromWorkspace();

        if (codeContext) {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Mermaid Diagram...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Sending code context to Anthropic API..." });

                // Call the Anthropic service to generate the diagram
                const mermaidCode = await anthropicService.generateMermaidDiagram(codeContext);

                progress.report({ increment: 100, message: "Diagram generation complete." });

                if (mermaidCode) {
                    // Show the generated Mermaid code in a webview
                    showMermaidDiagram(mermaidCode, context);
                    vscode.window.showInformationMessage('Mermaid diagram generated successfully!');
                } else {
                    // Error messages are handled within the AnthropicService or getCodeContextFromWorkspace
                    // Avoid redundant messages unless providing more specific feedback
                }
            });
        }
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

