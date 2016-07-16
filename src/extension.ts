'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import {spawn, ChildProcess} from 'child_process';

const LUAC_OUTPUT_REGEXP = /.+: .+:([0-9]+): (.+) near.*[<'](.*)['>]/;
const LUAC_COMMAND = 'luac';

let diagnosticCollection: vscode.DiagnosticCollection;
let currentDiagnostic: vscode.Diagnostic;

function parseDocumentDiagnostics(document: vscode.TextDocument, luacOutput: string) {
    const matches = LUAC_OUTPUT_REGEXP.exec(luacOutput);
    if (!matches) {
        return;
    }
    const message = {
        line: parseInt(matches[1]),
        text: matches[2],
        at: matches[3]
    }
    if (!message.line) {
        return;
    }

    var errorLine = document.lineAt(message.line - 1).text;

    var rangeLine = message.line - 1;
    var rangeStart = new vscode.Position(rangeLine, 0);
    var rangeEnd = new vscode.Position(rangeLine, errorLine.length);
    if (message.at !== 'eof') {
        var linePosition = errorLine.indexOf(message.at);
        if (linePosition >= 0) {
            rangeStart = new vscode.Position(rangeLine, linePosition);
            rangeEnd = new vscode.Position(rangeLine, linePosition + message.at.length);
        }
    }
    var range = new vscode.Range(rangeStart, rangeEnd);
    currentDiagnostic = new vscode.Diagnostic(range, message.text, vscode.DiagnosticSeverity.Error); 
}

function lintDocument(document: vscode.TextDocument, warnOnError: Boolean = false) {
    let lualinterConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('lualinter');
    if (!lualinterConfig.get('enable')) {
        return;
    }

    if (document.languageId !== 'lua') {
        return;
    }
    currentDiagnostic = null;

    const options = {
        cwd: path.dirname(document.fileName)
    };
    var luacProcess: ChildProcess = spawn(LUAC_COMMAND, ['-p', '-'], options);
    luacProcess.stdout.setEncoding('utf8');
    luacProcess.stderr.on('data', (data: Buffer) => {
        if (data.length == 0) {
            return;
        }
        parseDocumentDiagnostics(document, data.toString());
    });
    luacProcess.stderr.on('error', error => {
        vscode.window.showErrorMessage('luac error: ' + error);
    });
    // Pass current file contents to luac's stdin
    luacProcess.stdin.end(new Buffer(document.getText()));
    luacProcess.on('exit', (code: number, signal: string) => {
        if (!currentDiagnostic) {
            diagnosticCollection.clear();
        } else {
            diagnosticCollection.set(document.uri, [currentDiagnostic]);

            // Optionally show warining message 
            if (warnOnError && lualinterConfig.get('warnOnSave')) {
                vscode.window.showWarningMessage(`Current file contains an error: "${currentDiagnostic.message}" at line ${currentDiagnostic.range.start.line}`);
            }
        }
    });
}

export function activate(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('lua');
    context.subscriptions.push(diagnosticCollection);

    vscode.workspace.onDidSaveTextDocument(document => lintDocument(document, true));
    vscode.workspace.onDidChangeTextDocument(event => lintDocument(event.document));
    vscode.workspace.onDidOpenTextDocument(document => lintDocument(document));
    vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor) => lintDocument(editor.document));
}