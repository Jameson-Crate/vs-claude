import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { TextBlock } from '@anthropic-ai/sdk/resources/messages'; // Import TextBlock type

export class AnthropicService {
    private client: Anthropic | undefined;
    private apiKey: string | undefined;

    constructor() {
        this.loadApiKey();
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codebaseMermaidGenerator.anthropicApiKey')) {
                this.loadApiKey();
            }
        });
    }

    private loadApiKey(): void {
        this.apiKey = vscode.workspace.getConfiguration('codebaseMermaidGenerator').get('anthropicApiKey');
        if (this.apiKey) {
            try {
                this.client = new Anthropic({ apiKey: this.apiKey });
            } catch (error: any) {
                this.client = undefined;
                vscode.window.showErrorMessage(`Failed to initialize Anthropic client: ${error.message}`);
            }
        } else {
            this.client = undefined;
            // Don't show warning on startup, only when command is run
            // vscode.window.showWarningMessage('Anthropic API key not found. Please set it in the extension settings.');
        }
    }

    public async generateMermaidDiagram(codeContext: string): Promise<string | null> {
        // Ensure API key is loaded and client is initialized before making a call
        if (!this.apiKey) {
             vscode.window.showErrorMessage('Anthropic API key not set. Please configure it in VS Code settings (Codebase Mermaid Generator > Anthropic Api Key).');
             return null;
        }
        if (!this.client) {
            // Attempt to reload/reinitialize if client is missing but key exists (e.g., after setting the key)
            this.loadApiKey();
            if (!this.client) {
                 vscode.window.showErrorMessage('Anthropic client could not be initialized. Check your API key and network connection.');
                 return null;
            }
        }

        if (!codeContext.trim()) {
            vscode.window.showWarningMessage('No code context provided for analysis.');
            return null;
        }

        const prompt = `Analyze the following code context and generate a Mermaid JS diagram representing its structure (e.g., class diagram, sequence diagram, flowchart). Only output the Mermaid code block, starting with \
\
\
mermaid
 and ending with \
\
\
. Do not include any other text, explanations, or markdown formatting outside the Mermaid block.

Code Context:
---
${codeContext}
---

Mermaid Diagram:`;

        try {
            const response = await this.client.messages.create({
                model: 'claude-3-opus-20240229', // Or another suitable model like claude-3-haiku-20240307 for speed/cost
                max_tokens: 2048,
                messages: [
                    { role: 'user', content: prompt }
                ]
            });

            // Safely extract text content by checking the type
            let messageText: string | undefined;
            if (response.content && response.content.length > 0) {
                const firstBlock = response.content[0];
                if (firstBlock.type === 'text') {
                    messageText = firstBlock.text;
                }
            }

            if (!messageText) {
                vscode.window.showErrorMessage('Received no text content from Anthropic API.');
                console.error('Raw Anthropic Response Content:', response.content);
                return null;
            }

            // Extract the Mermaid code block
            const mermaidMatch = messageText.match(/```mermaid\n([\s\S]*?)\n```/);
            if (mermaidMatch && mermaidMatch[1]) {
                return mermaidMatch[1].trim();
            } else {
                 // Fallback: Maybe the API returned only the code without backticks
                 const trimmedContent = messageText.trim();
                 if (trimmedContent.startsWith('graph') || trimmedContent.startsWith('sequenceDiagram') || trimmedContent.startsWith('classDiagram') || trimmedContent.startsWith('stateDiagram') || trimmedContent.startsWith('flowchart')) {
                    return trimmedContent;
                 }
                vscode.window.showErrorMessage('Could not extract Mermaid diagram from Anthropic API response. Ensure the model is instructed to output only the mermaid code block.');
                console.error('Raw Anthropic Text Response:', messageText);
                return null;
            }

        } catch (error: any) {
            // Provide more specific error messages
            let errorMessage = `Error calling Anthropic API: ${error.message}`;
            if (error.status === 401) {
                errorMessage = 'Anthropic API Error: Authentication failed. Please check your API key.';
            } else if (error.status === 429) {
                errorMessage = 'Anthropic API Error: Rate limit exceeded. Please try again later.';
            } else if (error.message.includes('fetch failed')) {
                 errorMessage = 'Anthropic API Error: Network error. Could not connect to Anthropic API.';
            }
            vscode.window.showErrorMessage(errorMessage);
            console.error('Anthropic API Error Details:', error);
            return null;
        }
    }
}

